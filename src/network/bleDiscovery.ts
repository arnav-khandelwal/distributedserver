/**
 * network/bleDiscovery
 *
 * Wraps the Web Bluetooth API for peer discovery and signaling exchange.
 *
 * ── Browser limitations ──────────────────────────────────────────────────
 * Browsers implement the Web Bluetooth GATT *client* role only.  They cannot
 * act as BLE peripherals / GATT servers or broadcast advertisements.
 * "Host mode" in a pure browser context therefore means: prepare the session
 * state and handshake verifier so that a physical BLE peripheral (a native
 * mobile app or companion device) can relay the advertisement.  When both
 * ends are plain browsers, fall back to the QR bootstrap method.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * The passcode is NEVER included in the BLE advertisement.  Joining devices
 * must include a SHA-256(sessionId + passcode) hash in the handshake payload;
 * the host verifies this hash before accepting the peer.  A timestamp is also
 * included in the payload to prevent replay attacks (rejected if > 30 s old).
 */

// ---------------------------------------------------------------------------
// Web Bluetooth type augmentation
// navigator.bluetooth is not yet in TypeScript's lib.dom.d.ts baseline.
// ---------------------------------------------------------------------------

interface BluetoothCharacteristic {
  writeValue(value: BufferSource): Promise<void>
  readValue(): Promise<DataView>
}

interface BluetoothService {
  getCharacteristic(uuid: string): Promise<BluetoothCharacteristic>
}

interface BluetoothGattServer {
  connect(): Promise<BluetoothGattServer>
  getPrimaryService(uuid: string): Promise<BluetoothService>
}

interface WebBluetoothDevice {
  name?: string
  gatt?: BluetoothGattServer
}

interface WebBluetooth {
  requestDevice(options: { filters: { services: string[] }[]; optionalServices?: string[] }): Promise<WebBluetoothDevice>
}

declare global {
  interface Navigator {
    bluetooth: WebBluetooth
  }
}

// Custom 128-bit UUIDs for the distributed-node BLE service.
export const BLE_SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b'
export const BLE_HANDSHAKE_CHAR_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8'

/** Data broadcast in the BLE advertisement — passcode intentionally omitted. */
export interface BleAdvertisement {
  sessionId: string
  hostNodeId: string
  deviceName: string
}

/**
 * Payload sent from the joining device to the host over the GATT
 * characteristic after BLE connection is established.
 */
export interface BleHandshakePayload {
  nodeId: string
  sessionId: string
  /** SHA-256(sessionId + sessionPasscode), hex-encoded. */
  passcodeHash: string
  /** Serialised RTCSessionDescriptionInit (placeholder until WebRTC step). */
  webrtcOffer: string
  /** Unix ms timestamp — used to reject replayed handshakes. */
  timestamp: number
}

/** Response written back by the host after validating the handshake. */
export interface BleHandshakeResponse {
  accepted: boolean
  webrtcAnswer?: string
  hostNodeId?: string
  reason?: string
}

/** Thrown when the caller tries to start BLE hosting from a browser context. */
export class BleHostingUnsupportedError extends Error {
  constructor() {
    super(
      'BLE peripheral/advertising mode is not supported in web browsers. ' +
        'Use the QR code method instead.',
    )
    this.name = 'BleHostingUnsupportedError'
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Returns true if the Web Bluetooth API is available in this browser. */
export function isBleSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator
}

/**
 * Computes SHA-256(sessionId + passcode) and returns the hex-encoded digest.
 * Used by joiners to prove knowledge of the passcode without transmitting it.
 */
export async function hashPasscode(sessionId: string, passcode: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(sessionId + passcode)
  const buffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Validates an incoming handshake payload on the host side.
 *
 * @param payload       - The payload received from the joining device.
 * @param expectedHash  - SHA-256(sessionId + passcode) pre-computed by host.
 * @param maxAgeMs      - Maximum age of the timestamp before the payload is
 *                        rejected as a potential replay (default 30 s).
 */
export function validateHandshake(
  payload: BleHandshakePayload,
  expectedHash: string,
  maxAgeMs = 30_000,
): boolean {
  const age = Date.now() - payload.timestamp
  if (age < 0 || age > maxAgeMs) return false
  return payload.passcodeHash === expectedHash
}

// ---------------------------------------------------------------------------
// Host mode
// ---------------------------------------------------------------------------

/**
 * Prepares the host side of a BLE session.
 *
 * Because browsers cannot act as BLE peripherals, this function throws
 * `BleHostingUnsupportedError`.  Callers should catch it and fall back to
 * `generateQrInvite()` from qrBootstrap.
 */
export function startBleHosting(_advertisement: BleAdvertisement): never {
  console.log('BLE hosting attempted — not supported in browser environment')
  throw new BleHostingUnsupportedError()
}

// ---------------------------------------------------------------------------
// Join mode
// ---------------------------------------------------------------------------

/**
 * Opens the browser Bluetooth device picker, connects to the selected device,
 * and performs the handshake exchange.
 *
 * @returns The host's WebRTC answer and nodeId on success.
 * @throws  If BLE is unsupported, the user cancels the picker, the connection
 *          fails, or the host rejects the handshake.
 */
export async function joinViaBle(config: {
  nodeId: string
  sessionId: string
  passcode: string
  webrtcOffer: string
}): Promise<{ webrtcAnswer: string; hostNodeId: string }> {
  if (!isBleSupported()) {
    throw new Error('Web Bluetooth is not supported in this browser.')
  }

  console.log('BLE discovery started')

  const device = await navigator.bluetooth.requestDevice({
    filters: [{ services: [BLE_SERVICE_UUID] }],
    optionalServices: [BLE_SERVICE_UUID],
  })

  if (!device.gatt) {
    throw new Error('Selected BLE device does not expose a GATT server.')
  }

  console.log('BLE peer connected', { deviceName: device.name ?? 'unknown' })

  const server = await device.gatt.connect()
  const service = await server.getPrimaryService(BLE_SERVICE_UUID)
  const characteristic = await service.getCharacteristic(BLE_HANDSHAKE_CHAR_UUID)

  const passcodeHash = await hashPasscode(config.sessionId, config.passcode)

  const payload: BleHandshakePayload = {
    nodeId: config.nodeId,
    sessionId: config.sessionId,
    passcodeHash,
    webrtcOffer: config.webrtcOffer,
    timestamp: Date.now(),
  }

  const encoder = new TextEncoder()
  await characteristic.writeValue(encoder.encode(JSON.stringify(payload)))

  const responseValue = await characteristic.readValue()
  const decoder = new TextDecoder()
  const response: BleHandshakeResponse = JSON.parse(decoder.decode(responseValue))

  if (!response.accepted || !response.webrtcAnswer || !response.hostNodeId) {
    throw new Error(`BLE handshake rejected: ${response.reason ?? 'unknown reason'}`)
  }

  console.log('BLE peer handshake validated', { hostNodeId: response.hostNodeId })

  return { webrtcAnswer: response.webrtcAnswer, hostNodeId: response.hostNodeId }
}
