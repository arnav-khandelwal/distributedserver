import { useState, useCallback, useRef } from 'react'
import { type SessionInfo, createSession } from '../network/sessionManager'
import { PeerRegistry, type PeerEntry } from '../network/peerRegistry'
import {
  isBleSupported,
  joinViaBle,
} from '../network/bleDiscovery'
import {
  generateQrInvite,
  generateQrResponse,
  parseQrInvite,
  parseQrResponse,
  startCameraStream,
  scanQrFromVideo,
  isBarcodeScannerSupported,
  type QrInvitePayload,
} from '../network/qrBootstrap'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SessionStatus =
  | 'idle'
  | 'hosting'
  | 'joining'
  | 'scanning'
  | 'error'

export interface UseSessionResult {
  /** The active session, or null if no session has been created yet. */
  session: SessionInfo | null
  /** All currently known remote peers. */
  peers: PeerEntry[]
  /** High-level status of the session subsystem. */
  status: SessionStatus
  /** Human-readable description of the last error, if any. */
  error: string | null
  /** Data-URL PNG of the QR invite, generated when hosting via QR. */
  qrInviteUrl: string | null
  /** Whether the Web Bluetooth API is available in this browser. */
  bleSupported: boolean
  /** Whether the BarcodeDetector API is available in this browser. */
  scannerSupported: boolean

  // ── Actions ──────────────────────────────────────────────────────────────
  createAndHostSession: (nodeId: string) => void
  startBleHost: () => void
  joinViaBleFlow: (passcode: string) => Promise<void>
  generateQrInviteFlow: () => Promise<void>
  /** Parse a joiner's response QR and register them as a peer. */
  acceptQrResponse: (raw: string) => void
  /** Start camera scan; call stopScan() when done with the video element. */
  startQrScan: (video: HTMLVideoElement) => Promise<void>
  stopQrScan: () => void
  clearError: () => void
}

// ---------------------------------------------------------------------------
// Placeholder WebRTC offer/answer helpers
// These are replaced by real RTCSessionDescription objects in the WebRTC step.
// ---------------------------------------------------------------------------

function makePlaceholderOffer(nodeId: string): string {
  return JSON.stringify({ type: 'offer', sdp: `placeholder-offer-${nodeId}` })
}

function makePlaceholderAnswer(nodeId: string): string {
  return JSON.stringify({ type: 'answer', sdp: `placeholder-answer-${nodeId}` })
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSession(nodeId: string): UseSessionResult {
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [peers, setPeers] = useState<PeerEntry[]>([])
  const [status, setStatus] = useState<SessionStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [qrInviteUrl, setQrInviteUrl] = useState<string | null>(null)

  // PeerRegistry is stable across renders — mutations trigger setPeers.
  const registryRef = useRef(new PeerRegistry())
  const cameraStreamRef = useRef<MediaStream | null>(null)

  const syncPeers = useCallback(() => {
    setPeers(registryRef.current.getAll())
  }, [])

  const addPeer = useCallback(
    (entry: PeerEntry) => {
      registryRef.current.add(entry)
      syncPeers()
    },
    [syncPeers],
  )

  // ── Create session ────────────────────────────────────────────────────────

  const createAndHostSession = useCallback(
    (hostNodeId: string) => {
      const s = createSession(hostNodeId)
      setSession(s)
      setStatus('hosting')
      setError(null)
      setQrInviteUrl(null)
    },
    [],
  )

  // ── BLE host ──────────────────────────────────────────────────────────────
  // Browsers only support the BLE *client* (GATT central) role — they cannot
  // advertise as peripherals.  "Hosting" in a browser context means generating
  // a QR invite that joiners scan, which optionally triggers a BLE handshake
  // on their side.  We call generateQrInviteFlow() automatically here so the
  // UI doesn't show a confusing error just because bluetooth.requestDevice()
  // exists in the browser.

  const startBleHost = useCallback(async () => {
    if (!session) {
      setError('Create a session first.')
      return
    }
    console.log('BLE hosting requested — generating QR invite (browser peripheral mode unavailable)')
    const payload: QrInvitePayload = {
      nodeId,
      sessionId: session.sessionId,
      webrtcOffer: makePlaceholderOffer(nodeId),
      timestamp: Date.now(),
    }
    try {
      const url = await generateQrInvite(payload)
      setQrInviteUrl(url)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'QR generation failed.')
    }
  }, [nodeId, session])

  // ── BLE join ──────────────────────────────────────────────────────────────

  const joinViaBleFlow = useCallback(
    async (passcode: string) => {
      if (!session) {
        setError('No active session to join.')
        return
      }
      setStatus('joining')
      setError(null)
      try {
        const result = await joinViaBle({
          nodeId,
          sessionId: session.sessionId,
          passcode,
          webrtcOffer: makePlaceholderOffer(nodeId),
        })
        addPeer({
          peerId: result.hostNodeId,
          deviceType: 'unknown',
          localBenchmarkScore: null,
          connectionState: 'discovered',
          discoveryMethod: 'BLE',
          joinedAt: new Date(),
        })
        setStatus('hosting')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'BLE join failed.')
        setStatus('idle')
      }
    },
    [nodeId, session, addPeer],
  )

  // ── QR invite generation ──────────────────────────────────────────────────

  const generateQrInviteFlow = useCallback(async () => {
    if (!session) {
      setError('Create a session first.')
      return
    }
    setError(null)
    try {
      const payload: QrInvitePayload = {
        nodeId,
        sessionId: session.sessionId,
        webrtcOffer: makePlaceholderOffer(nodeId),
        timestamp: Date.now(),
      }
      const url = await generateQrInvite(payload)
      setQrInviteUrl(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'QR generation failed.')
    }
  }, [nodeId, session])

  // ── Accept joiner's response QR ───────────────────────────────────────────

  const acceptQrResponse = useCallback(
    (raw: string) => {
      try {
        const parsed = parseQrResponse(raw)
        addPeer({
          peerId: parsed.nodeId,
          deviceType: 'unknown',
          localBenchmarkScore: null,
          connectionState: 'discovered',
          discoveryMethod: 'QR',
          joinedAt: new Date(),
        })
        console.log('Peer handshake validated', { peerId: parsed.nodeId, method: 'QR' })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Invalid QR response.')
      }
    },
    [addPeer],
  )

  // ── QR scan (joiner side) ─────────────────────────────────────────────────

  const startQrScan = useCallback(
    async (video: HTMLVideoElement) => {
      setStatus('scanning')
      setError(null)
      try {
        const stream = await startCameraStream(video)
        cameraStreamRef.current = stream

        const raw = await scanQrFromVideo(video)
        const invite = parseQrInvite(raw)

        // Build a response QR and display it so the host can scan it back.
        const responseDataUrl = await generateQrResponse({
          nodeId,
          sessionId: invite.sessionId,
          webrtcAnswer: makePlaceholderAnswer(nodeId),
          timestamp: Date.now(),
        })

        // Register the host as a discovered peer.
        addPeer({
          peerId: invite.nodeId,
          deviceType: 'unknown',
          localBenchmarkScore: null,
          connectionState: 'discovered',
          discoveryMethod: 'QR',
          joinedAt: new Date(),
        })

        // Store the response QR as the active invite URL so the UI can show it.
        setQrInviteUrl(responseDataUrl)
        setStatus('hosting')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'QR scan failed.')
        setStatus('idle')
      } finally {
        // Stop the camera stream regardless of outcome.
        cameraStreamRef.current?.getTracks().forEach((t) => t.stop())
        cameraStreamRef.current = null
      }
    },
    [nodeId, addPeer],
  )

  const stopQrScan = useCallback(() => {
    cameraStreamRef.current?.getTracks().forEach((t) => t.stop())
    cameraStreamRef.current = null
    setStatus(session ? 'hosting' : 'idle')
  }, [session])

  const clearError = useCallback(() => setError(null), [])

  return {
    session,
    peers,
    status,
    error,
    qrInviteUrl,
    bleSupported: isBleSupported(),
    scannerSupported: isBarcodeScannerSupported(),
    createAndHostSession,
    startBleHost,
    joinViaBleFlow,
    generateQrInviteFlow,
    acceptQrResponse,
    startQrScan,
    stopQrScan,
    clearError,
  }
}
