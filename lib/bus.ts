/**
 * A tiny event bus so the character, the screen and the form can talk without
 * threading props through the whole tree. Browser-only; no-ops on the server.
 */

export type BusEvents = {
  /** The character flipped the switch: start the sizzle. */
  "screen:on": void;
  /** The visitor touched a form field for the first time. */
  "form:start": void;
  /**
   * A lead was successfully submitted; eventId dedupes pixel vs server event.
   * qualified is false for an under-floor budget (a newsletter signup).
   */
  "lead:sent": { eventId: string; qualified: boolean };
  /** True while the form is the focus of the pinned hero stage. */
  "form:focus": boolean;
};

type Handler<T> = (payload: T) => void;
const handlers = new Map<string, Set<Handler<unknown>>>();

export function on<K extends keyof BusEvents>(name: K, fn: Handler<BusEvents[K]>): () => void {
  if (!handlers.has(name)) handlers.set(name, new Set());
  handlers.get(name)!.add(fn as Handler<unknown>);
  return () => handlers.get(name)?.delete(fn as Handler<unknown>);
}

export function emit<K extends keyof BusEvents>(name: K, payload?: BusEvents[K]) {
  handlers.get(name)?.forEach((fn) => fn(payload));
}
