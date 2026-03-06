import { useState, useCallback, useRef } from 'react'
import { type SessionInfo, createSession } from '../network/sessionManager'
import { PeerRegistry, type PeerEntry } from '../network/peerRegistry'
import {
  generateQrInvite,
  generateQrResponse,
  generateQrInvitePayload,
  generateQrResponsePayload,
  parseQrInvite,
  parseQrResponsePayload,
  startCameraStream,
  scanQrFromVideo,
  isBarcodeScannerSupported,
} from '../network/qrDiscovery'

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
  /** Data-URL PNG of the current QR code (invite or response), if available. */
  qrInviteUrl: string | null
  /** Whether the BarcodeDetector API is available in this browser. */
  scannerSupported: boolean
  /**
   * The most recently discovered peer — set after a successful QR scan.
   * Used by the UI to show a confirmation panel before the peer is listed.
   */
  lastDiscoveredPeer: PeerEntry | null

  // ── Actions ──────────────────────────────────────────────────────────────
  createAndHostSession: (hostNodeId: string) => void
  generateQrInviteFlow: () => Promise<void>
  /** Parse a joiner's response QR raw string and register them as a peer. */
  acceptQrResponse: (raw: string) => void
  /** Joiner side — scan the host's invite QR, then display response QR. */
  startQrScanInvite: (video: HTMLVideoElement) => Promise<void>
  /** Host side — scan the joiner's response QR and register them as a peer. */
  startQrScanResponse: (video: HTMLVideoElement) => Promise<void>
  stopQrScan: () => void
  clearError: () => void
  clearLastDiscoveredPeer: () => void
}

// ---------------------------------------------------------------------------
// Optional device info
// ---------------------------------------------------------------------------

export interface SessionDeviceInfo {
  deviceType: string
  localBenchmarkScore: number | null
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSession(
  nodeId: string,
  deviceInfo?: SessionDeviceInfo,
): UseSessionResult {
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [peers, setPeers] = useState<PeerEntry[]>([])
  const [status, setStatus] = useState<SessionStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [qrInviteUrl, setQrInviteUrl] = useState<string | null>(null)
  const [lastDiscoveredPeer, setLastDiscoveredPeer] = useState<PeerEntry | null>(null)

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
      setLastDiscoveredPeer(null)
    },
    [],
  )

  // ── QR invite generation (host side) ─────────────────────────────────────

  const generateQrInviteFlow = useCallback(async () => {
    if (!session) {
      setError('Create a session first.')
      return
    }
    setError(null)
    try {
      const payload = generateQrInvitePayload({
        nodeId,
        sessionId: session.sessionId,
        deviceType: deviceInfo?.deviceType ?? 'unknown',
        localBenchmarkScore: deviceInfo?.localBenchmarkScore ?? null,
      })
      const url = await generateQrInvite(payload)
      setQrInviteUrl(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'QR generation failed.')
    }
  }, [nodeId, session, deviceInfo])

  // ── Accept joiner's response QR (host side — programmatic) ───────────────

  const acceptQrResponse = useCallback(
    (raw: string) => {
      const parsed = parseQrResponsePayload(raw)
      if (!parsed) {
        setError('Invalid or unreadable QR response.')
        return
      }
      const entry: PeerEntry = {
        peerId: parsed.nodeId,
        deviceType: parsed.deviceType,
        localBenchmarkScore: parsed.localBenchmarkScore,
        connectionState: 'discovered',
        discoveryMethod: 'QR',
        joinedAt: new Date(),
      }
      addPeer(entry)
      setLastDiscoveredPeer(entry)
      console.log('Peer handshake validated', { peerId: parsed.nodeId, method: 'QR' })
    },
    [addPeer],
  )

  // ── QR scan — joiner scans host's invite ──────────────────────────────────

  const startQrScanInvite = useCallback(
    async (video: HTMLVideoElement) => {
      setStatus('scanning')
      setError(null)
      try {
        const stream = await startCameraStream()
        cameraStreamRef.current = stream
        video.srcObject = stream
        await video.play()

        const raw = await scanQrFromVideo(video)
        const invite = parseQrInvite(raw)

        if (!invite) {
          setError('Invalid or expired QR invite.')
          setStatus('idle')
          return
        }

        // Generate this joiner's response QR so the host can scan it back.
        const responsePayload = generateQrResponsePayload({
          nodeId,
          sessionId: invite.sessionId,
          deviceType: deviceInfo?.deviceType ?? 'unknown',
          localBenchmarkScore: deviceInfo?.localBenchmarkScore ?? null,
        })
        const responseDataUrl = await generateQrResponse(responsePayload)

        // Register the host as a discovered peer with their shared metadata.
        const hostEntry: PeerEntry = {
          peerId: invite.nodeId,
          deviceType: invite.deviceType,
          localBenchmarkScore: invite.localBenchmarkScore,
          connectionState: 'discovered',
          discoveryMethod: 'QR',
          joinedAt: new Date(),
        }
        addPeer(hostEntry)
        setLastDiscoveredPeer(hostEntry)

        // Show the response QR for the host to scan.
        setQrInviteUrl(responseDataUrl)
        setStatus('joining')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'QR scan failed.')
        setStatus('idle')
      } finally {
        cameraStreamRef.current?.getTracks().forEach((t) => t.stop())
        cameraStreamRef.current = null
      }
    },
    [nodeId, deviceInfo, addPeer],
  )

  // ── QR scan — host scans joiner's response ────────────────────────────────

  const startQrScanResponse = useCallback(
    async (video: HTMLVideoElement) => {
      setStatus('scanning')
      setError(null)
      try {
        const stream = await startCameraStream()
        cameraStreamRef.current = stream
        video.srcObject = stream
        await video.play()

        const raw = await scanQrFromVideo(video)
        const response = parseQrResponsePayload(raw)

        if (!response) {
          setError('Invalid QR response.')
          setStatus(session ? 'hosting' : 'idle')
          return
        }

        const joinerEntry: PeerEntry = {
          peerId: response.nodeId,
          deviceType: response.deviceType,
          localBenchmarkScore: response.localBenchmarkScore,
          connectionState: 'discovered',
          discoveryMethod: 'QR',
          joinedAt: new Date(),
        }
        addPeer(joinerEntry)
        setLastDiscoveredPeer(joinerEntry)
        setStatus('hosting')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'QR scan failed.')
        setStatus(session ? 'hosting' : 'idle')
      } finally {
        cameraStreamRef.current?.getTracks().forEach((t) => t.stop())
        cameraStreamRef.current = null
      }
    },
    [session, addPeer],
  )

  const stopQrScan = useCallback(() => {
    cameraStreamRef.current?.getTracks().forEach((t) => t.stop())
    cameraStreamRef.current = null
    setStatus(session ? 'hosting' : 'idle')
  }, [session])

  const clearError = useCallback(() => setError(null), [])

  const clearLastDiscoveredPeer = useCallback(() => setLastDiscoveredPeer(null), [])

  return {
    session,
    peers,
    status,
    error,
    qrInviteUrl,
    scannerSupported: isBarcodeScannerSupported(),
    lastDiscoveredPeer,
    createAndHostSession,
    generateQrInviteFlow,
    acceptQrResponse,
    startQrScanInvite,
    startQrScanResponse,
    stopQrScan,
    clearError,
    clearLastDiscoveredPeer,
  }
}
