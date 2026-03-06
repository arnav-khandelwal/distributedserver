/**
 * network/qrDiscovery
 *
 * QR-code based peer discovery and bootstrap signaling.
 *
 * Flow:
 *   Host                              Joiner
 *   ──────────────────────────────────────────────
 *   createSession()
 *   generateQrInvite(payload) ──QR──► parseQrInvite()
 *                                     generateQrResponse(payload) ──QR──►
 *   parseQrResponsePayload()
 *   register peer                     register peer
 *
 * Payloads are JSON-encoded then base64url-encoded so the QR data is
 * compact printable ASCII.
 */

import QRCode from 'qrcode'

// ─── Payload types ────────────────────────────────────────────────────────────

export interface QrInvitePayload {
  /** Unique ID of the node generating the invite. */
  nodeId: string
  /** Session this invite belongs to. */
  sessionId: string
  /** Unix-ms timestamp of generation (used for expiry checks). */
  timestamp: number
  /** Coarse device category of the host. */
  deviceType: string
  /** Host's benchmark score — helps joiner decide whether to proceed. */
  localBenchmarkScore: number | null
  /** Placeholder WebRTC SDP offer (will be real SDP once WebRTC lands). */
  webrtcOffer: string
}

export interface QrResponsePayload {
  /** Unique ID of the node responding to the invite. */
  nodeId: string
  /** Session ID copied from the invite. */
  sessionId: string
  /** Unix-ms timestamp of generation. */
  timestamp: number
  /** Coarse device category of the joiner. */
  deviceType: string
  /** Joiner's benchmark score. */
  localBenchmarkScore: number | null
  /** Placeholder WebRTC SDP answer. */
  webrtcAnswer: string
}

// ─── Support checks ───────────────────────────────────────────────────────────

/** Returns true when the QR canvas/data-URL generation library is available. */
export function isQrGenerationSupported(): boolean {
  return typeof document !== 'undefined'
}

/** Returns true when the browser supports the BarcodeDetector API for scanning. */
export function isBarcodeScannerSupported(): boolean {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window
}

// ─── Payload builders ─────────────────────────────────────────────────────────

/**
 * Constructs a `QrInvitePayload` from the host's node/session info.
 * Generates a placeholder WebRTC offer — replace with real SDP once WebRTC
 * signalling is wired up.
 */
export function generateQrInvitePayload(params: {
  nodeId: string
  sessionId: string
  deviceType: string
  localBenchmarkScore: number | null
}): QrInvitePayload {
  return {
    nodeId: params.nodeId,
    sessionId: params.sessionId,
    timestamp: Date.now(),
    deviceType: params.deviceType,
    localBenchmarkScore: params.localBenchmarkScore,
    webrtcOffer: JSON.stringify({ type: 'offer', sdp: `placeholder-offer-${params.nodeId}` }),
  }
}

/**
 * Constructs a `QrResponsePayload` from the joiner's node info and the
 * session ID extracted from the scanned invite.
 */
export function generateQrResponsePayload(params: {
  nodeId: string
  sessionId: string
  deviceType: string
  localBenchmarkScore: number | null
}): QrResponsePayload {
  return {
    nodeId: params.nodeId,
    sessionId: params.sessionId,
    timestamp: Date.now(),
    deviceType: params.deviceType,
    localBenchmarkScore: params.localBenchmarkScore,
    webrtcAnswer: JSON.stringify({ type: 'answer', sdp: `placeholder-answer-${params.nodeId}` }),
  }
}

// ─── Encoding helpers ─────────────────────────────────────────────────────────

function encodePayload(payload: object): string {
  return btoa(JSON.stringify(payload))
}

function decodePayload(raw: string): unknown {
  try {
    return JSON.parse(atob(raw))
  } catch {
    return null
  }
}

// ─── QR generation ───────────────────────────────────────────────────────────

/**
 * Encodes `payload` as a base64 string and renders it as a QR code PNG
 * data URL. Returns the data URL.
 */
export async function generateQrInvite(payload: QrInvitePayload): Promise<string> {
  const encoded = encodePayload(payload)
  const dataUrl = await QRCode.toDataURL(encoded, { errorCorrectionLevel: 'M', width: 300 })
  console.log('QR invite generated', { nodeId: payload.nodeId, sessionId: payload.sessionId })
  return dataUrl
}

/**
 * Encodes `payload` as a base64 string and renders it as a QR code PNG
 * data URL. Returns the data URL.
 */
export async function generateQrResponse(payload: QrResponsePayload): Promise<string> {
  const encoded = encodePayload(payload)
  const dataUrl = await QRCode.toDataURL(encoded, { errorCorrectionLevel: 'M', width: 300 })
  console.log('QR response generated', { nodeId: payload.nodeId, sessionId: payload.sessionId })
  return dataUrl
}

// ─── QR parsing ──────────────────────────────────────────────────────────────

const DEFAULT_INVITE_MAX_AGE_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Decodes and validates a raw QR string as a `QrInvitePayload`.
 * Returns the payload on success, or `null` if the data is invalid or
 * older than `maxAgeMs` (default 5 min).
 */
export function parseQrInvite(
  raw: string,
  maxAgeMs: number = DEFAULT_INVITE_MAX_AGE_MS,
): QrInvitePayload | null {
  const data = decodePayload(raw)
  if (!data || typeof data !== 'object') return null

  const d = data as Record<string, unknown>
  if (
    typeof d.nodeId !== 'string' ||
    typeof d.sessionId !== 'string' ||
    typeof d.timestamp !== 'number' ||
    typeof d.deviceType !== 'string' ||
    typeof d.webrtcOffer !== 'string'
  ) {
    return null
  }

  if (Date.now() - d.timestamp > maxAgeMs) {
    console.warn('QR invite expired', { timestamp: d.timestamp })
    return null
  }

  console.log('QR invite scanned', { nodeId: d.nodeId, sessionId: d.sessionId })
  console.log('QR payload validated', { nodeId: d.nodeId })
  console.log('Peer discovered via QR', { nodeId: d.nodeId })
  console.log('WebRTC offer received', { nodeId: d.nodeId })

  return {
    nodeId: d.nodeId as string,
    sessionId: d.sessionId as string,
    timestamp: d.timestamp as number,
    deviceType: d.deviceType as string,
    localBenchmarkScore:
      typeof d.localBenchmarkScore === 'number' ? d.localBenchmarkScore : null,
    webrtcOffer: d.webrtcOffer as string,
  }
}

/**
 * Decodes a raw QR string as a `QrResponsePayload`.
 * Returns the payload on success, or `null` if the data is invalid.
 */
export function parseQrResponsePayload(raw: string): QrResponsePayload | null {
  const data = decodePayload(raw)
  if (!data || typeof data !== 'object') return null

  const d = data as Record<string, unknown>
  if (
    typeof d.nodeId !== 'string' ||
    typeof d.sessionId !== 'string' ||
    typeof d.timestamp !== 'number' ||
    typeof d.deviceType !== 'string' ||
    typeof d.webrtcAnswer !== 'string'
  ) {
    return null
  }

  console.log('QR response scanned', { nodeId: d.nodeId, sessionId: d.sessionId })
  console.log('WebRTC answer generated', { nodeId: d.nodeId })

  return {
    nodeId: d.nodeId as string,
    sessionId: d.sessionId as string,
    timestamp: d.timestamp as number,
    deviceType: d.deviceType as string,
    localBenchmarkScore:
      typeof d.localBenchmarkScore === 'number' ? d.localBenchmarkScore : null,
    webrtcAnswer: d.webrtcAnswer as string,
  }
}

// ─── Camera + scanning ───────────────────────────────────────────────────────

/**
 * Opens the rear (or default) camera and returns the active `MediaStream`.
 * Caller is responsible for stopping all tracks when done.
 */
export async function startCameraStream(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' } },
    audio: false,
  })
}

/**
 * Continuously scans frames from `videoEl` for a QR code until one is
 * found, then resolves with its raw string value.
 *
 * Rejects if `BarcodeDetector` is not available in the browser.
 */
export async function scanQrFromVideo(videoEl: HTMLVideoElement): Promise<string> {
  if (!isBarcodeScannerSupported()) {
    throw new Error('BarcodeDetector is not supported in this browser.')
  }

  // BarcodeDetector is not in lib.dom.d.ts — cast through unknown
  const BarcodeDetectorCtor = (window as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector
  const detector = new BarcodeDetectorCtor({ formats: ['qr_code'] })

  return new Promise((resolve, reject) => {
    let animFrameId: number

    const tick = async () => {
      if (videoEl.readyState !== videoEl.HAVE_ENOUGH_DATA) {
        animFrameId = requestAnimationFrame(tick)
        return
      }
      try {
        const codes = await detector.detect(videoEl)
        if (codes.length > 0) {
          resolve(codes[0].rawValue)
          return
        }
      } catch (err) {
        reject(err)
        return
      }
      animFrameId = requestAnimationFrame(tick)
    }

    animFrameId = requestAnimationFrame(tick)

    // Safety valve — cancel the loop if the video element is removed
    videoEl.addEventListener('emptied', () => {
      cancelAnimationFrame(animFrameId)
      reject(new Error('Video stream ended before QR code was detected.'))
    }, { once: true })
  })
}
