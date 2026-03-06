import type { BenchmarkDetails } from '../network/nodeRuntime'

interface BenchmarkModalProps {
  details: BenchmarkDetails
  onClose: () => void
  onRerun: () => void
}

/** Row inside the modal */
function ModalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
      <span className="text-slate-400 text-sm">{label}</span>
      <span className="text-slate-100 text-sm font-mono">{value}</span>
    </div>
  )
}

/**
 * Overlay modal displaying detailed CPU benchmark results.
 * Rendered by NodeDashboard when the user clicks the Local Benchmark Score row.
 */
export function BenchmarkModal({ details, onClose, onRerun }: BenchmarkModalProps) {
  const { localBenchmarkScore, operationsCompleted, durationMs, operationsPerSecond, timestamp, isRunning } =
    details

  const fmt = (n: number | null, suffix = '') =>
    n !== null ? `${n.toLocaleString()}${suffix}` : '—'

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Panel — stop propagation so clicks inside don't close the modal */}
      <div
        className="w-full max-w-md mx-4 bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-slate-100 font-semibold text-base tracking-wide">
            Benchmark Details
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 text-xl leading-none transition-colors"
            aria-label="Close benchmark modal"
          >
            ×
          </button>
        </div>

        {/* Metrics */}
        <div className="flex flex-col">
          <ModalRow
            label="Local Benchmark Score"
            value={isRunning ? 'Running…' : fmt(localBenchmarkScore)}
          />
          <ModalRow
            label="Operations Completed"
            value={isRunning ? '—' : fmt(operationsCompleted)}
          />
          <ModalRow
            label="Duration (ms)"
            value={isRunning ? '—' : fmt(durationMs !== null ? Math.round(durationMs) : null)}
          />
          <ModalRow
            label="Operations Per Second"
            value={isRunning ? '—' : fmt(operationsPerSecond)}
          />
          <ModalRow
            label="Last Benchmark"
            value={
              isRunning
                ? 'Running…'
                : timestamp
                ? timestamp.toLocaleTimeString()
                : 'Not yet run'
            }
          />
        </div>

        {/* Action */}
        <button
          onClick={onRerun}
          disabled={isRunning}
          className="w-full py-2.5 rounded-xl text-sm font-semibold transition-colors
            bg-indigo-600 hover:bg-indigo-500 text-white
            disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-indigo-600"
        >
          {isRunning ? 'Running benchmark…' : 'Run Benchmark Again'}
        </button>
      </div>
    </div>
  )
}
