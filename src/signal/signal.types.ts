/**
 * Messages a broadcaster POSTs. `id` identifies the target viewer.
 */
export type BroadcasterMessage =
  | { type: 'broadcaster-answer'; id: string; answer: unknown }
  | { type: 'broadcaster-ice'; id: string; candidate: unknown };

/**
 * Messages a viewer POSTs. The viewerId comes from the URL, so the server
 * tags the message with it before routing to the broadcaster.
 */
export type ViewerMessage =
  | { type: 'viewer-offer'; offer: unknown }
  | { type: 'viewer-ice'; candidate: unknown };
