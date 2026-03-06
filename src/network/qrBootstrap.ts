/**
 * network/qrBootstrap
 *
 * QR-code-based signaling exchange — the fallback transport when Web Bluetooth
 * is unavailable or when the user prefers a manual flow.
 *
 * ── Two-scan handshake flow ─────────────────────────────────────────────────
 * 1. Host generates a QR invite  →  joiner scans it
 * 2. Joiner enters passcode manually (not encoded in the QR)
 * 3. Joiner generates a response QR  →  host scans it
 * 4. Session signaling is complete; WebRTC connection can be established
 * ───────────────────────────────────────────────────────────────────────────
 *
 * The passscode is NEVER encoded in any QR code.
 * Scanning uses the native BarcodeDetector API (Chrome 83+, Edge 83+).
 */

import QRCode from 'qrcode'

// ---------------------------------------------------------------------------
// Payloads
// ---------------------------------------------------------------------------

/** Data encoded in the host's invite QR code. */
export interface QrInvitePayload {
  nodeId: string
  sessionId: string
  /** Placeholder SDP offer — replaced by real RTCSessionDescription in the WebRTC step. */
  webrtcOffer: string
  /** Unix ms — for freshness checks on the joiner side. */
  timestamp: number
}

/** Data encoded in the joiner's response QR code. */
export interface QrResponsePayload {
  nodeId: string
  sessionId: string
  /** Placeholder SDP answer — replaced by real RTCSessionDescription in the WebRTC step. */
  webrtcAnswer: string
  timestamp: number
}

// ---------------------------------------------------------------------------
// Feature detection
// ---------------------------------------------------------------------------

export function isQrGenerationSupported(): boolean {
  // qrcode library works in all modern browsers
  return true
}

export function isBarcodeScannerSupported(): boolean {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

/**
 * Encodes a QrInvitePayload as a data-URL PNG.
 * The passcode is intentionally excluded from the payload.
 */
export async function generateQrInvite(payload: QrInvitePayload): Promise<string> {
  const data = JSON.stringify(payload)
  const dataUrl = await QRCode.toDataURL(data, {
    errorCorrectionLevel: 'M',
    type: 'image/png',
    margin: 2,
    width: 256,
  })
  console.log('QR invite generated', { sessionId: payload.sessionId, nodeId: payload.nodeId })
  return dataUrl
}

/**
 * Encodes a QrResponsePayload as a data-URL PNG.
 */
export async function generateQrResponse(payload: QrResponsePayload): Promise<string> {
  const data = JSON.stringify(payload)
  return QRCode.toDataURL(data, {
    errorCorrectionLevel: 'M',
    type: 'image/png',
    margin: 2,
    width: 256,
  })
}

// ---------------------------------------------------------------------------
// Scanning
// ---------------------------------------------------------------------------

type BarcodeFormat = 'qr_code' | string

interface BarcodeResult {
  rawValue: string
  format: BarcodeFormat
}

interface BarcodeDetectorInstance {
  detect(source: HTMLVideoElement | ImageBitmapSource): Promise<BarcodeResult[]>
}

interface BarcodeDetectorConstructor {
  new (options: { formats: BarcodeFormat[] }): BarcodeDetectorInstance
}

/** Opens the rear camera and streams it into the provided video element. */
export async function startCameraStream(video: HTMLVideoElement): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment' },
    audio: false,
  })
  video.srcObject = stream
  await video.play()
  return stream
}

/**
 * Polls frames from a live video element until a QR code is detected.
 *
 * @param video     - A video element with an active MediaStream.
 * @param timeoutMs - Abort after this many ms (default 60 s).
 * @returns         - The raw string value decoded from the QR code.
 */
export function scanQrFromVideo(video: HTMLVideoElement, timeoutMs = 60_000): Promise<string> {
  if (!isBarcodeScannerSupported()) {
    return Promise.reject(
      new Error('BarcodeDetector API is not supported in this browser.'),
    )
  }

  const BarcodeDetectorClass = (window as unknown as { BarcodeDetector: BarcodeDetectorConstructor })
    .BarcodeDetector
  const detector = new BarcodeDetectorClass({ formats: ['qr_code'] })

  return new Promise((resolve, reject) => {
    let settled = false

    const settle = (fn: typeof resolve | typeof reject, value: Parameters<typeof fn>[0]) => {
      if (settled) return
      settled = true
      clearInterval(intervalId)
      clearTimeout(timeoutId)
      ;(fn as (v: typeof value) => void)(value)
    }

    const intervalId = setInterval(async () => {
      try {
        const results = await detector.detect(video)
        if (results.length > 0) {
          settle(resolve, results[0].rawValue)
        }
      } catch {
        // Transient decode errors are normal — keep polling.
      }
    }, 250)

    const timeoutId = setTimeout(
      () => settle(reject, new Error('QR scan timed out.')),
      timeoutMs,
    )
  })
}

/**
 * Parses raw QR text as a QrInvitePayload.
 * Throws if the data is malformed or the payload is too old.
 */
export function parseQrInvite(raw: string, maxAgeMs = 300_000): QrInvitePayload {
  let parsed: QrInvitePayload
  try {
    parsed = JSON.parse(raw) as QrInvitePayload
  } catch {
    throw new Error('QR code does not contain valid JSON.')
  }

  if (!parsed.nodeId || !parsed.sessionId || !parsed.webrtcOffer || !parsed.timestamp) {
    throw new Error('QR code is missing required fields.')
  }

  const age = Date.now() - parsed.timestamp
  if (age < 0 || age > maxAgeMs) {
    throw new Error('QR invite has expired. Ask the host to generate a new one.')
  }

  return parsed
}

/**
 * Parses raw QR text as a QrResponsePayload.
 */
export function parseQrResponse(raw: string): QrResponsePayload {
  let parsed: QrResponsePayload
  try {
    parsed = JSON.parse(raw) as QrResponsePayload
  } catch {
    throw new Error('QR response does not contain valid JSON.')
  }
  if (!parsed.nodeId || !parsed.sessionId || !parsed.webrtcAnswer) {
    throw new Error('QR response is missing required fields.')
  }
  return parsed
}
