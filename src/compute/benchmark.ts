/**
 * compute/benchmark
 *
 * Measures the CPU throughput of the current browser device.
 * The result feeds into the node runtime as a localBenchmarkScore that will
 * later be used by the distributed task scheduler to weight workload
 * distribution.
 *
 * No networking or distributed logic lives here.
 */

export interface BenchmarkResult {
  /** Normalised performance score (operations per millisecond, rounded). */
  localBenchmarkScore: number
  /** Total math iterations completed during the benchmark window. */
  operationsCompleted: number
  /** Actual elapsed time in milliseconds. */
  durationMs: number
  /** Operations per second (operationsCompleted / durationMs * 1000). */
  operationsPerSecond: number
  /** Timestamp captured when the benchmark finished. */
  timestamp: Date
}

const BENCHMARK_DURATION_MS = 150

/**
 * Runs a CPU-intensive math loop for ~150 ms and returns throughput metrics.
 *
 * Deferred with setTimeout(0) so the browser completes its initial render
 * before the benchmark starts, keeping the UI responsive.
 */
export function runCpuBenchmark(): Promise<BenchmarkResult> {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log('Benchmark started')

      const start = performance.now()
      let operationsCompleted = 0
      let acc = 1

      // Tight math loop — sqrt + multiply keeps the JIT from optimising away.
      while (performance.now() - start < BENCHMARK_DURATION_MS) {
        acc = Math.sqrt(acc * 1.0000001 + operationsCompleted)
        operationsCompleted++
      }

      // Consume acc so the compiler cannot eliminate the loop.
      void acc

      const durationMs = performance.now() - start
      const localBenchmarkScore = Math.round(operationsCompleted / durationMs)
      const operationsPerSecond = Math.round(operationsCompleted / (durationMs / 1000))

      const result: BenchmarkResult = {
        localBenchmarkScore,
        operationsCompleted,
        durationMs,
        operationsPerSecond,
        timestamp: new Date(),
      }

      console.log('Benchmark completed', result)
      resolve(result)
    }, 0)
  })
}
