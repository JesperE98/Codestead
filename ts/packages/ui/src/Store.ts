/**
 * Something React views watch: the imperative objects of the C# version (the overlay, the notices, the learning
 * window) keep their methods, and call {@link changed} when what they show changed. Views read them with
 * {@link useStore}.
 */
import { useSyncExternalStore } from "react";

export class Store {
  private readonly listeners = new Set<() => void>();
  private revision = 0;

  /** For useSyncExternalStore. */
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Changes whenever something shown changed. */
  readonly getRevision = (): number => this.revision;

  protected changed(): void {
    this.revision++;
    for (const l of [...this.listeners]) l();
  }
}

/** Re-renders the component whenever the store changes. */
export function useStore(store: Store): number {
  return useSyncExternalStore(store.subscribe, store.getRevision, store.getRevision);
}
