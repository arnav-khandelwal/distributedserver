/**
 * compute/benchmark
 *
 * Measures the CPU throughput of the current browser device.
 * The result feeds into the node runtime as a computeScore that will later be
 * used by the distributed task scheduler to weight workload distribution.
 *
 * No networking or distributed logic lives here.
 */

export interface BenchmarkResult {
  /** Total math iterations completed during the benchmark window. */
  operations: number
  /** Actual elapsed time in milliseconds. */
  duration: number
  /**
   * Normalised performance score (operations per millisecond, rounded).
   * Higher is faster.
   */
  computeScore: number
}

const BENCHMARK_DURATION_MS = 150

/**
 * Runs a CPU-intensive math loop for ~150 ms and returns throughput metrics.
 *
 * The work is deferred with a 0 ms setTimeout so the browser can complete its
 * initial render before the benchmark starts, keeping the UI responsive.
 */
export function runCpuBenchmark(): Promise<BenchmarkResult> {
  return new Promise((resolve) => {
    // Yield to the event loop so the UI paints first, then benchmark.
    setTimeout(() => {
      const start = performance.now()
      let operations = 0
      let acc = 1

      // Tight math loop — sqrt + multiply keeps the JIT from optimising away.
      while (performance.now() - start < BENCHMARK_DURATION_MS) {
        acc = Math.sqrt(acc * 1.0000001 + operations)
        operations++
      }

      // Consume acc so the compiler cannot eliminate the loop.
      void acc

      const duration = performance.now() - start
      const computeScore = Math.round(operations / duration)

      resolve({ operations, duration, computeScore })
    }, 0)
  })
}
