/**
 * network/
 *
 * Peer-to-peer networking modules for the distributed node application.
 */

export type { DeviceType, NodeRuntime, BenchmarkDetails } from './nodeRuntime'
export { initializeNodeRuntime } from './nodeRuntime'

export type { SessionInfo } from './sessionManager'
export { createSession } from './sessionManager'

export type { ConnectionState, DiscoveryMethod, PeerEntry } from './peerRegistry'
export { PeerRegistry } from './peerRegistry'

export type { QrInvitePayload, QrResponsePayload } from './qrDiscovery'
export {
  isQrGenerationSupported,
  isBarcodeScannerSupported,
  generateQrInvitePayload,
  generateQrResponsePayload,
  generateQrInvite,
  generateQrResponse,
  parseQrInvite,
  parseQrResponsePayload,
  startCameraStream,
  scanQrFromVideo,
} from './qrDiscovery'
