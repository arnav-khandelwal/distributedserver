/**
 * network/sessionManager
 *
 * Creates and manages sessions.  A session is the top-level container that
 * groups the host and joining peers together.  The sessionPasscode is shown to
 * the host but never broadcast over BLE or encoded in a QR invite — joiners
 * must enter it manually.
 */

export interface SessionInfo {
  /** Short, human-readable identifier for the session (e.g. "A3X7KQ"). */
  sessionId: string
  /** 6-digit numeric passcode known only to the host and shared out-of-band. */
  sessionPasscode: string
  /** nodeId of the device that created the session. */
  hostNodeId: string
  /** When the session was created. */
  createdAt: Date
}

// Unambiguous character set (no 0/O, 1/I/L confusion)
const SESSION_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateSessionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return Array.from(bytes)
    .map((b) => SESSION_ID_CHARS[b % SESSION_ID_CHARS.length])
    .join('')
}

function generatePasscode(): string {
  const digits = crypto.getRandomValues(new Uint8Array(6))
  return Array.from(digits)
    .map((d) => d % 10)
    .join('')
}

/**
 * Creates a new session owned by the given hostNodeId.
 * The passcode should be communicated verbally or via a secondary channel —
 * it is never included in BLE advertisements or QR codes.
 */
export function createSession(hostNodeId: string): SessionInfo {
  const session: SessionInfo = {
    sessionId: generateSessionId(),
    sessionPasscode: generatePasscode(),
    hostNodeId,
    createdAt: new Date(),
  }
  console.log('Session created', { sessionId: session.sessionId, hostNodeId })
  return session
}
