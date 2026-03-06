import React from 'react'
import { useNodeRuntime } from '../hooks/useNodeRuntime'

/** Placeholder row rendered inside a card */
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-slate-400 text-sm">{label}</span>
      <span className="text-slate-200 text-sm font-mono">{value}</span>
    </div>
  )
}

interface SectionCardProps {
  title: string
  statusLabel?: string
  children: React.ReactNode
}

/** Generic dashboard card */
function SectionCard({ title, statusLabel = 'not initialized yet', children }: SectionCardProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-slate-100 font-semibold text-base tracking-wide">{title}</h2>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
          {statusLabel}
        </span>
      </div>
      <div className="border-t border-slate-800 pt-3">{children}</div>
    </div>
  )
}

/** Top-level dashboard representing one node in the distributed network */
export default function NodeDashboard() {
  const runtime = useNodeRuntime()

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      {/* Page header */}
      <div className="mb-8">
        <p className="text-slate-500 text-xs font-mono uppercase tracking-widest mb-1">
          Distributed Computing — Node View
        </p>
        <h1 className="text-2xl font-bold text-slate-100">Node Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">
          This device is a participant in the distributed computing network. Subsystems below will
          activate as the application initializes.
        </p>
      </div>

      {/* Dashboard grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* ── Node Status ── */}
        <SectionCard
          title="Node Status"
          statusLabel={runtime ? 'active' : 'initializing…'}
        >
          {runtime === null ? (
            <p className="text-slate-500 text-sm animate-pulse">Initializing node runtime…</p>
          ) : (
            <>
              <InfoRow label="Node ID" value={runtime.nodeId} />
              <InfoRow label="Device Type" value={runtime.deviceType} />
              <InfoRow label="CPU Cores" value={runtime.cpuCores !== null ? String(runtime.cpuCores) : 'unknown'} />
              <InfoRow label="Memory Estimate" value={runtime.memoryEstimate !== null ? `${runtime.memoryEstimate} GB` : 'unknown'} />
              <InfoRow label="Browser" value={runtime.browserName ?? 'unknown'} />
              <InfoRow label="Platform" value={runtime.platform ?? 'unknown'} />
              <InfoRow
                label="Session Start"
                value={runtime.sessionStartTime.toLocaleTimeString()}
              />
            </>
          )}
        </SectionCard>

        {/* ── Peer Network ── */}
        <SectionCard title="Peer Network">
          <p className="text-slate-500 text-sm">
            Peer discovery and WebRTC connections will be established here.
          </p>
          <div className="mt-2 text-slate-600 text-xs font-mono">0 peers connected</div>
        </SectionCard>

        {/* ── Compute System ── */}
        <SectionCard title="Compute System">
          <p className="text-slate-500 text-sm">
            Distributed task scheduling and execution engine will run here.
          </p>
          <div className="mt-2 text-slate-600 text-xs font-mono">idle — no tasks queued</div>
        </SectionCard>

        {/* ── Cache System ── */}
        <SectionCard title="Cache System">
          <p className="text-slate-500 text-sm">
            Distributed cache and local storage layer will be managed here.
          </p>
          <div className="mt-2 text-slate-600 text-xs font-mono">0 entries cached</div>
        </SectionCard>
      </div>

      {/* Footer */}
      <footer className="mt-10 text-center text-slate-600 text-xs font-mono">
        distributed-node v0.1.0 — node runtime active
      </footer>
    </main>
  )
}
