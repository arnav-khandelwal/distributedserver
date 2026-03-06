/**
 * components/SessionPanel
 *
 * Session control panel — QR-only peer discovery.
 *
 * Views:
 *   main          — default; shows session info, action buttons, peer list
 *   scan-invite   — joiner workflow: camera open, scanning host's invite QR
 *   scan-response — host workflow: camera open, scanning joiner's response QR
 */

import { useRef, useState, type JSX } from 'react'
import type { UseSessionResult } from '../hooks/useSession'

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusPill({
  label,
  variant = 'idle',
}: {
  label: string
  variant?: 'idle' | 'active' | 'busy'
}) {
  const colours: Record<string, string> = {
    idle: 'bg-slate-800 text-slate-400',
    active: 'bg-emerald-900/60 text-emerald-400',
    busy: 'bg-amber-900/60 text-amber-400',
  }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colours[variant]}`}>
      {label}
    </span>
  )
}

function ActionButton({
  label,
  onClick,
  disabled = false,
  variant = 'default',
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  variant?: 'default' | 'primary' | 'danger'
}) {
  const base =
    'w-full py-2 px-3 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer'
  const colours: Record<string, string> = {
    default: 'bg-slate-800 hover:bg-slate-700 text-slate-200',
    primary: 'bg-indigo-600 hover:bg-indigo-500 text-white',
    danger: 'bg-rose-700 hover:bg-rose-600 text-white',
  }
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${colours[variant]}`}>
      {label}
    </button>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-slate-400 text-sm">{label}</span>
      <span className="text-slate-200 text-sm font-mono">{value}</span>
    </div>
  )
}

/** Camera viewfinder used during QR scanning. */
function QrScannerView({
  videoRef,
  onCancel,
  prompt,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>
  onCancel: () => void
  prompt: string
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-slate-400 text-xs font-mono animate-pulse">{prompt}</p>
      <div className="relative rounded-xl overflow-hidden bg-black border border-slate-700">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} autoPlay playsInline muted className="w-full aspect-square object-cover" />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-44 h-44 border-2 border-indigo-400/70 rounded-xl" />
        </div>
      </div>
      <ActionButton label="Cancel" onClick={onCancel} variant="danger" />
    </div>
  )
}

/** Confirmation card shown immediately after a peer is discovered via QR. */
function DiscoveredPeerCard({
  peerId,
  deviceType,
  localBenchmarkScore,
  sessionId,
  onDismiss,
}: {
  peerId: string
  deviceType: string
  localBenchmarkScore: number | null
  sessionId: string
  onDismiss: () => void
}) {
  return (
    <div className="border border-emerald-700/50 bg-emerald-950/30 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-emerald-400 text-sm font-semibold">Device discovered</span>
        <StatusPill label="Handshake in progress" variant="busy" />
      </div>
      <div className="text-xs font-mono text-slate-400 space-y-1.5">
        <div className="flex justify-between">
          <span className="text-slate-500">Node ID</span>
          <span className="text-slate-200 truncate max-w-[58%]">{peerId}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Device Type</span>
          <span className="text-slate-200">{deviceType}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Benchmark Score</span>
          <span className="text-slate-200">
            {localBenchmarkScore !== null ? String(localBenchmarkScore) : 'unknown'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Session ID</span>
          <span className="text-slate-200">{sessionId}</span>
        </div>
      </div>
      <ActionButton label="Dismiss" onClick={onDismiss} />
    </div>
  )
}

// ─── SessionPanel ─────────────────────────────────────────────────────────────

interface SessionPanelProps {
  sessionState: UseSessionResult
  nodeId: string | undefined
}

type PanelView = 'main' | 'scan-invite' | 'scan-response'

export function SessionPanel({ sessionState, nodeId }: SessionPanelProps): JSX.Element {
  const {
    session,
    peers,
    status,
    error,
    qrInviteUrl,
    scannerSupported,
    lastDiscoveredPeer,
    createAndHostSession,
    generateQrInviteFlow,
    startQrScanInvite,
    startQrScanResponse,
    stopQrScan,
    clearError,
    clearLastDiscoveredPeer,
  } = sessionState

  const [view, setView] = useState<PanelView>('main')
  const videoRef = useRef<HTMLVideoElement | null>(null)

  // ── Derived badge ─────────────────────────────────────────────────────────

  const badgeVariant: 'idle' | 'active' | 'busy' =
    view !== 'main' || status === 'scanning'
      ? 'busy'
      : status === 'hosting' || status === 'joining'
      ? 'active'
      : 'idle'

  const badgeLabel =
    view === 'scan-invite'
      ? 'scanning invite…'
      : view === 'scan-response'
      ? 'scanning response…'
      : status === 'hosting'
      ? 'hosting'
      : status === 'joining'
      ? 'joining'
      : status === 'error'
      ? 'error'
      : 'idle'

  // ── Connection status message ─────────────────────────────────────────────

  const connectionMessage =
    status === 'hosting' && qrInviteUrl && view === 'main'
      ? 'Waiting for device to scan invite…'
      : status === 'joining' && qrInviteUrl && view === 'main'
      ? 'Show your QR response to the host to complete connection.'
      : null

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleCreate = () => {
    if (!nodeId) return
    createAndHostSession(nodeId)
  }

  const handleScanInvite = async () => {
    if (!videoRef.current) return
    setView('scan-invite')
    await startQrScanInvite(videoRef.current)
    setView('main')
  }

  const handleScanResponse = async () => {
    if (!videoRef.current) return
    setView('scan-response')
    await startQrScanResponse(videoRef.current)
    setView('main')
  }

  const handleCancelScan = () => {
    stopQrScan()
    setView('main')
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-3 sm:col-span-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-slate-100 font-semibold text-base tracking-wide">Session Control</h2>
        <StatusPill label={badgeLabel} variant={badgeVariant} />
      </div>

      <div className="border-t border-slate-800 pt-3 flex flex-col gap-3">

        {/* ── Scanner views (render hidden video for ref in main view too) ── */}
        {view === 'scan-invite' && (
          <QrScannerView
            videoRef={videoRef}
            onCancel={handleCancelScan}
            prompt="Point camera at the host's QR invite…"
          />
        )}

        {view === 'scan-response' && (
          <QrScannerView
            videoRef={videoRef}
            onCancel={handleCancelScan}
            prompt="Point camera at the joiner's QR response…"
          />
        )}

        {/* ── Main view ── */}
        {view === 'main' && (
          <>
            {/* Hidden video element backing the videoRef for scans */}
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={videoRef} autoPlay playsInline muted className="hidden" />

            {/* Error banner */}
            {error && (
              <div className="bg-rose-950 border border-rose-800 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                <span className="text-rose-300 text-xs">{error}</span>
                <button
                  onClick={clearError}
                  className="text-rose-500 hover:text-rose-300 text-sm leading-none cursor-pointer"
                >
                  ×
                </button>
              </div>
            )}

            {/* No session state */}
            {!session && (
              <p className="text-slate-500 text-xs">
                Create a session to allow nearby devices to discover and connect to this node.
              </p>
            )}

            {/* Session info */}
            {session && (
              <div className="flex flex-col gap-0.5">
                <InfoRow label="Session ID" value={session.sessionId} />
                <InfoRow label="Passcode" value={session.sessionPasscode} />
                <InfoRow label="Peers Found" value={String(peers.length)} />
              </div>
            )}

            {/* Connection status */}
            {connectionMessage && (
              <p className="text-slate-400 text-xs font-mono animate-pulse">{connectionMessage}</p>
            )}

            {/* Discovered peer confirmation */}
            {lastDiscoveredPeer && session && (
              <DiscoveredPeerCard
                peerId={lastDiscoveredPeer.peerId}
                deviceType={lastDiscoveredPeer.deviceType}
                localBenchmarkScore={lastDiscoveredPeer.localBenchmarkScore}
                sessionId={session.sessionId}
                onDismiss={clearLastDiscoveredPeer}
              />
            )}

            {/* QR image */}
            {qrInviteUrl && (
              <div className="flex flex-col items-center gap-2">
                <img
                  src={qrInviteUrl}
                  alt="QR code"
                  className="w-44 h-44 rounded-xl border border-slate-700"
                />
                <p className="text-slate-500 text-xs font-mono">
                  {status === 'joining'
                    ? 'Your response QR — show to host'
                    : 'Invite QR — ask joiner to scan'}
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2">
              <ActionButton
                label="Create Session"
                onClick={handleCreate}
                disabled={!!session || !nodeId}
                variant="primary"
              />
              <ActionButton
                label="Generate QR Invite"
                onClick={generateQrInviteFlow}
                disabled={!session}
              />
              <ActionButton
                label="Scan QR Invite"
                onClick={handleScanInvite}
                disabled={!scannerSupported}
              />
              <ActionButton
                label="Scan QR Response"
                onClick={handleScanResponse}
                disabled={!session || !scannerSupported}
              />
            </div>

            {/* Peer list */}
            {peers.length > 0 && (
              <div className="flex flex-col gap-1 mt-1">
                <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest">
                  Discovered Peers
                </p>
                {peers.map((peer) => (
                  <div
                    key={peer.peerId}
                    className="flex items-center justify-between py-1.5 border-b border-slate-800 last:border-0"
                  >
                    <div className="flex flex-col">
                      <span className="text-slate-300 text-xs font-mono truncate max-w-[140px]">
                        {peer.peerId}
                      </span>
                      <span className="text-slate-500 text-xs">
                        {peer.deviceType}
                        {peer.localBenchmarkScore !== null
                          ? ` · score ${peer.localBenchmarkScore}`
                          : ''}
                      </span>
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        peer.connectionState === 'connected'
                          ? 'text-emerald-400'
                          : peer.connectionState === 'rejected' ||
                              peer.connectionState === 'disconnected'
                            ? 'text-rose-400'
                            : 'text-amber-400'
                      }`}
                    >
                      {peer.connectionState}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
