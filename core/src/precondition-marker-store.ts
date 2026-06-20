/**
 * Precondition Marker Store — port + in-memory adapter.
 *
 * Per CONTEXT.md: "Precondition Marker — A structured, queryable record that a
 * named precondition holds for an operational case."
 *
 * The marker store is the current-state source of truth, distinct from the
 * Audit Trail (which records transitions as history). Markers are scoped to
 * an Operational Case and survive across Agent Runs.
 *
 * In-memory adapter ships first; Postgres adapter deferred alongside the rest
 * of the bare-loop Postgres layer.
 */
import type { Marker } from "./precondition.js";

// ─── Port ──────────────────────────────────────────────────────────────────────

/** Port: read and write Precondition Markers scoped to an Operational Case. */
export interface PreconditionMarkerStore {
  /** Check whether a marker holds for a given case. */
  has(caseId: string, marker: Marker): Promise<boolean>;

  /** Record that a marker now holds. Idempotent — adding twice is a no-op. */
  add(caseId: string, marker: Marker): Promise<void>;

  /** Remove a marker (e.g. on case reset). */
  remove(caseId: string, marker: Marker): Promise<void>;

  /** List all markers currently holding for a case. */
  list(caseId: string): Promise<Marker[]>;
}

// ─── In-memory adapter ─────────────────────────────────────────────────────────

export class InMemoryPreconditionMarkerStore
  implements PreconditionMarkerStore
{
  private readonly store = new Map<string, Set<Marker>>();

  async has(caseId: string, marker: Marker): Promise<boolean> {
    const markers = this.store.get(caseId);
    return markers?.has(marker) ?? false;
  }

  async add(caseId: string, marker: Marker): Promise<void> {
    let markers = this.store.get(caseId);
    if (!markers) {
      markers = new Set();
      this.store.set(caseId, markers);
    }
    markers.add(marker);
  }

  async remove(caseId: string, marker: Marker): Promise<void> {
    const markers = this.store.get(caseId);
    markers?.delete(marker);
  }

  async list(caseId: string): Promise<Marker[]> {
    const markers = this.store.get(caseId);
    return markers ? [...markers] : [];
  }
}
