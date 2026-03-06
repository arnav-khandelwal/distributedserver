/**
 * network/
 *
 * Peer-to-peer networking modules for the distributed node application.
 */

export type { DeviceType, NodeRuntime, BenchmarkDetails } from './nodeRuntime'
export { initializeNodeRuntime } from './nodeRuntime'

export type { SessionInfo } from './sessionManager'
export { createSession } from './sessionManager'

export type { ConnectionState, DiscoveryMethod, PeerEntry } from './peerRegistry'
export { PeerRegistry } from './peerRegistry'

export type { BleAdvertisement, BleHandshakePayload, BleHandshakeResponse } from './bleDiscovery'
export {
  BLE_SERVICE_UUID,
  BLE_HANDSHAKE_CHAR_UUID,
  BleHostingUnsupportedError,
  isBleSupported,
  hashPasscode,
  validateHandshake,
  startBleHosting,
  joinViaBle,
} from './bleDiscovery'

export type { QrInvitePayload, QrResponsePayload } from './qrBootstrap'
export {
  isQrGenerationSupported,
  isBarcodeScannerSupported,
  generateQrInvite,
  generateQrResponse,
  parseQrInvite,
  parseQrResponse,
  startCameraStream,
  scanQrFromVideo,
} from './qrBootstrap'
export { initializeNodeRuntime } from './nodeRuntime'
