import React, { useRef, useState } from 'react'
import type { UseSessionResult } from '../hooks/useSession'
import type { PeerEntry } from '../network/peerRegistry'

// ---------------------------------------------------------------------------
// Internal sub-components
// ---------------------------------------------------------------------------

function ActionButton({
  onClick,
  disabled = false,
  variant = 'default',
  children,
}: {
  onClick: () => void
  disabled?: boolean
  variant?: 'default' | 'primary' | 'danger'
  children: React.ReactNode
}) {
  const base =
    'w-full py-2 px-3 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
  const variants = {
    default: 'bg-slate-800 hover:bg-slate-700 text-slate-200',
    primary: 'bg-indigo-600 hover:bg-indigo-500 text-white',
    danger: 'bg-rose-700 hover:bg-rose-600 text-white',
  }
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]}`}>
      {children}
    </button>
  )
}

function StatusPill({ label }: { label: string }) {
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
      {label}
    </span>
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

function PeerRow({ peer }: { peer: PeerEntry }) {
  const stateColor: Record<string, string> = {
    discovered: 'text-yellow-400',
    connecting: 'text-blue-400',
    connected: 'text-emerald-400',
    rejected: 'text-rose-400',
    disconnected: 'text-slate-500',
  }
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-800 last:border-0">
      <div className="flex flex-col">
        <span className="text-slate-300 text-xs font-mono truncate max-w-[140px]">
          {peer.peerId}
        </span>
        <span className="text-slate-500 text-xs">{peer.discoveryMethod}</span>
      </div>
      <span className={`text-xs font-medium ${stateColor[peer.connectionState] ?? 'text-slate-400'}`}>
        {peer.connectionState}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// QR Scanner overlay
// ---------------------------------------------------------------------------

interface QrScannerPanelProps {
  onCancel: () => void
  onStartScan: (video: HTMLVideoElement) => Promise<void>
}

function QrScannerPanel({ onCancel, onStartScan }: QrScannerPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [started, setStarted] = useState(false)

  const handleStart = async () => {
    if (!videoRef.current) return
    setStarted(true)
    await onStartScan(videoRef.current)
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-slate-400 text-xs">
        Point your camera at the host's QR invite. Once scanned, a response QR will appear for the
        host to scan.
      </p>
      <div className="relative bg-slate-950 rounded-lg overflow-hidden aspect-square w-full max-w-[220px] mx-auto border border-slate-700">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
        {!started && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-slate-500 text-xs">Camera inactive</span>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <ActionButton onClick={handleStart} variant="primary" disabled={started}>
          {started ? 'Scanning…' : 'Start Camera'}
        </ActionButton>
        <ActionButton onClick={onCancel} variant="danger">
          Cancel
        </ActionButton>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Passcode input modal
// ---------------------------------------------------------------------------

interface PasscodeInputProps {
  onSubmit: (passcode: string) => void
  onCancel: () => void
}

function PasscodeInput({ onSubmit, onCancel }: PasscodeInputProps) {
  const [value, setValue] = useState('')

  return (
    <div className="flex flex-col gap-3">
      <p className="text-slate-400 text-xs">
        Enter the 6-digit passcode shown on the host's dashboard.
      </p>
      <input
        type="text"
        inputMode="numeric"
        maxLength={6}
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="e.g. 482901"
        className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500"
      />
      <div className="flex gap-2">
        <ActionButton
          onClick={() => onSubmit(value)}
          variant="primary"
          disabled={value.length !== 6}
        >
          Connect via BLE
        </ActionButton>
        <ActionButton onClick={onCancel} variant="danger">
          Cancel
        </ActionButton>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main SessionPanel
// ---------------------------------------------------------------------------

interface SessionPanelProps {
  sessionState: UseSessionResult
  /** The local node's ID, used to create a session. */
  nodeId: string | undefined
}

type PanelView = 'main' | 'ble-passcode' | 'qr-scan'

export function SessionPanel({ sessionState, nodeId }: SessionPanelProps) {
  const {
    session,
    peers,
    status,
    error,
    qrInviteUrl,
    bleSupported,
    scannerSupported,
    createAndHostSession,
    startBleHost,
    joinViaBleFlow,
    generateQrInviteFlow,
    startQrScan,
    stopQrScan,
    clearError,
  } = sessionState

  const [view, setView] = useState<PanelView>('main')

  const handleCreate = () => {
    if (!nodeId) return
    createAndHostSession(nodeId)
  }

  const handleBleJoinSubmit = async (passcode: string) => {
    setView('main')
    await joinViaBleFlow(passcode)
  }

  const handleQrScan = async (video: HTMLVideoElement) => {
    await startQrScan(video)
    setView('main')
  }

  const handleCancelScan = () => {
    stopQrScan()
    setView('main')
  }

  const statusLabel =
    status === 'idle'
      ? 'no session'
      : status === 'hosting'
      ? 'hosting'
      : status === 'joining'
      ? 'joining…'
      : status === 'scanning'
      ? 'scanning…'
      : 'error'

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-3 sm:col-span-2">
      {/* Card header */}
      <div className="flex items-center justify-between">
        <h2 className="text-slate-100 font-semibold text-base tracking-wide">
          Session Control
        </h2>
        <StatusPill label={statusLabel} />
      </div>

      <div className="border-t border-slate-800 pt-3 flex flex-col gap-3">
        {/* ── Error banner ── */}
        {error && (
          <div className="bg-rose-950 border border-rose-800 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
            <span className="text-rose-300 text-xs">{error}</span>
            <button onClick={clearError} className="text-rose-500 hover:text-rose-300 text-sm leading-none">
              ×
            </button>
          </div>
        )}

        {/* ── No session ── */}
        {!session && view === 'main' && (
          <div className="flex flex-col gap-2">
            <p className="text-slate-500 text-xs">
              Create a session to allow nearby devices to discover and connect to this node.
            </p>
            <ActionButton onClick={handleCreate} variant="primary" disabled={!nodeId}>
              Create Session
            </ActionButton>
          </div>
        )}

        {/* ── Session info ── */}
        {session && view === 'main' && (
          <>
            <div className="flex flex-col gap-0.5">
              <InfoRow label="Session ID" value={session.sessionId} />
              <InfoRow label="Passcode" value={session.sessionPasscode} />
              <InfoRow label="Peers Found" value={String(peers.length)} />
            </div>

            {/* ── Action grid ── */}
            <div className="grid grid-cols-2 gap-2">
              <ActionButton
                onClick={startBleHost}
              >
                Start Hosting
              </ActionButton>

              <ActionButton
                onClick={() => setView('ble-passcode')}
                disabled={!bleSupported}
              >
                {bleSupported ? 'Join via BLE' : 'BLE Unavailable'}
              </ActionButton>

              <ActionButton onClick={generateQrInviteFlow}>
                Generate QR Invite
              </ActionButton>

              <ActionButton
                onClick={() => setView('qr-scan')}
                disabled={!scannerSupported}
              >
                {scannerSupported ? 'Scan QR Code' : 'Scanner Unavailable'}
              </ActionButton>
            </div>

            {/* ── QR invite display ── */}
            {qrInviteUrl && (
              <div className="flex flex-col items-center gap-2">
                <p className="text-slate-500 text-xs self-start">
                  Share this QR with nearby devices. Passcode: {' '}
                  <span className="text-slate-300 font-mono">{session.sessionPasscode}</span>
                </p>
                <img
                  src={qrInviteUrl}
                  alt="QR invite"
                  className="w-40 h-40 rounded-lg border border-slate-700"
                />
              </div>
            )}

            {/* ── Peer list ── */}
            {peers.length > 0 && (
              <div className="flex flex-col gap-1 mt-1">
                <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest">
                  Discovered Peers
                </p>
                {peers.map((p) => (
                  <PeerRow key={p.peerId} peer={p} />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── BLE passcode entry ── */}
        {view === 'ble-passcode' && (
          <PasscodeInput
            onSubmit={handleBleJoinSubmit}
            onCancel={() => setView('main')}
          />
        )}

        {/* ── QR scanner ── */}
        {view === 'qr-scan' && (
          <QrScannerPanel
            onStartScan={handleQrScan}
            onCancel={handleCancelScan}
          />
        )}
      </div>
    </div>
  )
}
