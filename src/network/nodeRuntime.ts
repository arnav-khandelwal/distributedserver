/**
 * network/nodeRuntime
 *
 * Initializes the browser device as a node in the distributed system.
 * Collects static device metadata once per session and exposes it as a
 * typed NodeRuntime object.  No networking logic lives here.
 */

export type DeviceType = 'mobile' | 'tablet' | 'desktop'

/** Detailed results from the most recent benchmark run, plus live status. */
export interface BenchmarkDetails {
  localBenchmarkScore: number | null
  operationsCompleted: number | null
  durationMs: number | null
  operationsPerSecond: number | null
  timestamp: Date | null
  /** True while a benchmark is actively running. */
  isRunning: boolean
}

export interface NodeRuntime {
  /** Randomly generated UUID, stable for the lifetime of the browser session. */
  nodeId: string
  /** Timestamp captured when initializeNodeRuntime() was first called. */
  sessionStartTime: Date
  /** Coarse device category derived from screen size and user-agent. */
  deviceType: DeviceType
  /** Logical CPU core count (navigator.hardwareConcurrency), or null if unavailable. */
  cpuCores: number | null
  /** Device RAM in GB (navigator.deviceMemory), or null if unavailable. */
  memoryEstimate: number | null
  /** Human-readable browser name, or null if unrecognised. */
  browserName: string | null
  /** Operating-system / platform string, or null if unavailable. */
  platform: string | null
  /** Live benchmark state and results. isRunning is true while a run is in progress. */
  benchmarkDetails: BenchmarkDetails
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function generateNodeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function detectDeviceType(): DeviceType {
  const ua = navigator.userAgent.toLowerCase()
  const width = window.screen.width

  const isMobileUA = /mobile|android|iphone|ipod/.test(ua)
  const isTabletUA = /tablet|ipad/.test(ua)

  if (isMobileUA && width < 768) return 'mobile'
  if (isTabletUA || (width >= 768 && width < 1024)) return 'tablet'
  return 'desktop'
}

function detectBrowserName(): string | null {
  const ua = navigator.userAgent
  if (ua.includes('Firefox')) return 'Firefox'
  if (ua.includes('Edg/')) return 'Edge'
  if (ua.includes('OPR') || ua.includes('Opera')) return 'Opera'
  if (ua.includes('Chrome')) return 'Chrome'
  if (ua.includes('Safari')) return 'Safari'
  return null
}

function getMemoryEstimate(): number | null {
  // navigator.deviceMemory is not in the standard TS lib yet
  const nav = navigator as Navigator & { deviceMemory?: number }
  return typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Collects all static device metadata and returns a NodeRuntime.
 * benchmarkDetails starts with all nulls; the hook fills them in asynchronously.
 * Intended to be called once at application startup.
 */
export function initializeNodeRuntime(): NodeRuntime {
  return {
    nodeId: generateNodeId(),
    sessionStartTime: new Date(),
    deviceType: detectDeviceType(),
    cpuCores: navigator.hardwareConcurrency ?? null,
    memoryEstimate: getMemoryEstimate(),
    browserName: detectBrowserName(),
    platform: navigator.platform || null,
    benchmarkDetails: {
      localBenchmarkScore: null,
      operationsCompleted: null,
      durationMs: null,
      operationsPerSecond: null,
      timestamp: null,
      isRunning: false,
    },
  }
}
