import { useState, useEffect, useCallback, useRef } from 'react'
import { type NodeRuntime, initializeNodeRuntime } from '../network/nodeRuntime'
import { runCpuBenchmark } from '../compute/benchmark'

export interface UseNodeRuntimeResult {
  runtime: NodeRuntime | null
  /** Trigger a fresh benchmark run at any time. No-ops if one is already running. */
  runBenchmark: () => void
}

/**
 * Initializes the node runtime once when the application loads, then runs the
 * CPU benchmark asynchronously and updates state when it completes.
 * Exposes runBenchmark() so consumers can trigger a rerun at any time.
 */
export function useNodeRuntime(): UseNodeRuntimeResult {
  const [runtime, setRuntime] = useState<NodeRuntime | null>(null)
  const isRunningRef = useRef(false)

  const runBenchmark = useCallback(() => {
    if (isRunningRef.current) return
    isRunningRef.current = true

    // Mark isRunning in state so the UI reacts immediately.
    setRuntime((prev) =>
      prev
        ? { ...prev, benchmarkDetails: { ...prev.benchmarkDetails, isRunning: true } }
        : prev
    )

    runCpuBenchmark().then((result) => {
      isRunningRef.current = false
      setRuntime((prev) =>
        prev
          ? {
              ...prev,
              benchmarkDetails: {
                localBenchmarkScore: result.localBenchmarkScore,
                operationsCompleted: result.operationsCompleted,
                durationMs: result.durationMs,
                operationsPerSecond: result.operationsPerSecond,
                timestamp: result.timestamp,
                isRunning: false,
              },
            }
          : prev
      )
    })
  }, [])

  useEffect(() => {
    // Synchronous metadata collection — sets the runtime immediately.
    const initial = initializeNodeRuntime()
    setRuntime(initial)

    // Async benchmark — runs after the browser finishes the initial paint.
    runBenchmark()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { runtime, runBenchmark }
}
