import { useState, useEffect } from 'react'
import { type NodeRuntime, initializeNodeRuntime } from '../network/nodeRuntime'

/**
 * Initializes the node runtime once when the application loads and exposes the
 * resulting NodeRuntime object to the rest of the component tree.
 *
 * Returns `null` during the brief synchronous render before initialization
 * completes, allowing consumers to show a loading state.
 */
export function useNodeRuntime(): NodeRuntime | null {
  const [runtime, setRuntime] = useState<NodeRuntime | null>(null)

  useEffect(() => {
    // Run once per session — the empty dependency array guarantees this.
    setRuntime(initializeNodeRuntime())
  }, [])

  return runtime
}
