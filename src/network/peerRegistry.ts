/**
 * network/peerRegistry
 *
 * Maintains the live list of discovered remote peers for this session.
 * Designed to be instantiated once inside useSession and passed around as
 * an opaque value — future networking modules read localBenchmarkScore and
 * connectionState to make scheduling decisions.
 */

export type ConnectionState =
  | 'discovered'
  | 'connecting'
  | 'connected'
  | 'rejected'
  | 'disconnected'

export type DiscoveryMethod = 'BLE' | 'QR'

export interface PeerEntry {
  /** Remote node's unique ID. */
  peerId: string
  /** Coarse device category reported by the remote node. */
  deviceType: string
  /** Benchmark score from the remote node, if shared during handshake. */
  localBenchmarkScore: number | null
  /** Current lifecycle state of the peer connection. */
  connectionState: ConnectionState
  /** How this peer was first discovered. */
  discoveryMethod: DiscoveryMethod
  /** When the peer was first added to the registry. */
  joinedAt: Date
}

export class PeerRegistry {
  private readonly peers = new Map<string, PeerEntry>()

  add(entry: PeerEntry): void {
    this.peers.set(entry.peerId, entry)
  }

  update(peerId: string, updates: Partial<Omit<PeerEntry, 'peerId'>>): void {
    const existing = this.peers.get(peerId)
    if (existing) {
      this.peers.set(peerId, { ...existing, ...updates })
    }
  }

  remove(peerId: string): void {
    this.peers.delete(peerId)
  }

  get(peerId: string): PeerEntry | undefined {
    return this.peers.get(peerId)
  }

  getAll(): PeerEntry[] {
    return Array.from(this.peers.values())
  }

  get size(): number {
    return this.peers.size
  }
}
