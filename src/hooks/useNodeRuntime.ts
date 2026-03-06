import { useState, useEffect } from 'react'
import { type NodeRuntime, initializeNodeRuntime } from '../network/nodeRuntime'
import { runCpuBenchmark } from '../compute/benchmark'

/**
 * Initializes the node runtime once when the application loads, then runs the
 * CPU benchmark asynchronously and updates state when it completes.
 *
 * Returns `null` during the brief synchronous render before initialization
 * completes, allowing consumers to show a loading state.
 */
export function useNodeRuntime(): NodeRuntime | null {
  const [runtime, setRuntime] = useState<NodeRuntime | null>(null)

  useEffect(() => {
    // Synchronous metadata collection — sets the runtime immediately.
    const initial = initializeNodeRuntime()
    setRuntime(initial)

    // Async benchmark — runs after the browser finishes the initial paint.
    console.log(`Benchmark started for node ${initial.nodeId}`)

    runCpuBenchmark().then(({ computeScore }) => {
      console.log(`Benchmark finished — computeScore: ${computeScore}`)
      setRuntime((prev) =>
        prev ? { ...prev, computeScore, benchmarkCompleted: true } : prev
      )
    })
  }, [])

  return runtime
}
