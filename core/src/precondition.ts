/**
 * Precondition Gating — types, evaluator, and self-correction guidance.
 *
 * Per ADR 0005 and design 2026-06-19:
 *   - Precondition Rule: a boolean over Precondition Markers (allOf/anyOf/atLeast).
 *   - Precondition Table: config-as-data mapping interfaceId → rule.
 *   - Evaluator: pure function, reads rule + marker set, returns ok or guidance.
 *   - Guidance: structured, not free text; type-discriminated by status.
 *
 * The evaluator has no side effects and knows nothing about specific interfaces.
 * New interfaces only need a row in the table — no code change in the evaluator.
 */

// ─── Rule grammar types ────────────────────────────────────────────────────────

/** A marker is a namespaced key: "called:<id>", "approved:<action>", etc. */
export type Marker = string;

/** Marker -> entries the evaluator needs. */
export type MarkerSet = Set<Marker>;

export interface AllOfRule {
  allOf: (Marker | AnyOfRule | AtLeastRule)[];
}

export interface AnyOfRule {
  anyOf: Marker[];
}

export interface AtLeastRule {
  atLeast: { k: number; of: Marker[] };
}

/** A precondition rule — a boolean expression over markers. */
export type PreconditionRule = AllOfRule | AnyOfRule | AtLeastRule;

/** One entry in the Precondition Table. */
export interface PreconditionTableEntry {
  rule: PreconditionRule;
  /** Interfaces that can produce the markers this rule needs (for guidance). */
  suggestedNext?: string[];
}

/** The Precondition Table — interfaceId → precondition entry. */
export type PreconditionTable = Record<string, PreconditionTableEntry>;

// ─── Evaluation result ─────────────────────────────────────────────────────────

export interface EvaluationOk {
  ok: true;
}

export interface EvaluationBlocked {
  ok: false;
  missing: Marker[];
  guidance: string;
}

export type EvaluationResult = EvaluationOk | EvaluationBlocked;

// ─── Self-correction guidance (returned to the model) ──────────────────────────

export interface PreconditionUnmetGuidance {
  status: "precondition_unmet";
  interface: string;
  rule: PreconditionRule;
  missing: Marker[];
  suggestedNext: string[];
  message: string;
}

// ─── Pure evaluator ────────────────────────────────────────────────────────────

/**
 * Evaluate a precondition rule against a set of present markers.
 *
 * Pure function — no side effects, no knowledge of specific interfaces.
 * Returns either { ok: true } or { ok: false, missing, guidance }.
 */
export function evaluate(
  rule: PreconditionRule,
  markers: MarkerSet
): EvaluationResult {
  const missing = collectMissing(rule, markers);
  if (missing.length === 0) {
    return { ok: true };
  }
  return {
    ok: false,
    missing,
    guidance: formatGuidance(rule, missing),
  };
}

/** Recursively collect all markers a rule requires that are absent. */
function collectMissing(
  rule: PreconditionRule,
  markers: MarkerSet
): Marker[] {
  if ("allOf" in rule) {
    const missing: Marker[] = [];
    for (const child of rule.allOf) {
      if (typeof child === "string") {
        if (!markers.has(child)) missing.push(child);
      } else {
        // nested rule — check if it's satisfied as a whole
        const childMissing = collectMissing(child, markers);
        if (childMissing.length > 0) {
          // For a nested rule, report all the markers it needs
          missing.push(...childMissing);
        }
      }
    }
    return missing;
  }

  if ("anyOf" in rule) {
    const satisfied = rule.anyOf.some((m) => markers.has(m));
    if (satisfied) return [];
    // None satisfied — report all options
    return [...rule.anyOf];
  }

  if ("atLeast" in rule) {
    const present = rule.atLeast.of.filter((m) => markers.has(m));
    if (present.length >= rule.atLeast.k) return [];
    // Report the ones still needed
    const missing = rule.atLeast.of.filter((m) => !markers.has(m));
    return missing;
  }

  return [];
}

/** Generate a human-readable guidance string from the rule and missing markers. */
function formatGuidance(rule: PreconditionRule, missing: Marker[]): string {
  if ("allOf" in rule) {
    const missingSet = new Set(missing);
    const parts = rule.allOf
      .map((child) => {
        if (typeof child === "string") {
          return missingSet.has(child) ? child : undefined;
        }

        const childMissing = missingForRule(child, missingSet);
        return childMissing.length > 0
          ? formatGuidance(child, childMissing)
          : undefined;
      })
      .filter((part): part is string => Boolean(part));

    return parts.length === 1
      ? `需要先满足: ${parts[0]}`
      : `需要先满足: ${parts.join("; ")}`;
  }
  if ("anyOf" in rule) {
    const list = rule.anyOf.join(" 或 ");
    return `需要先满足其中之一: ${list}`;
  }
  if ("atLeast" in rule) {
    const list = missing.join(", ");
    return `需要先满足 [${rule.atLeast.of.join(", ")}] 中至少 ${rule.atLeast.k} 个, 当前缺少: ${list}`;
  }
  return "前置条件未满足";
}

function missingForRule(
  rule: PreconditionRule,
  missingSet: ReadonlySet<Marker>
): Marker[] {
  if ("allOf" in rule) {
    return rule.allOf.flatMap((child) =>
      typeof child === "string"
        ? missingSet.has(child)
          ? [child]
          : []
        : missingForRule(child, missingSet)
    );
  }
  if ("anyOf" in rule) {
    return rule.anyOf.filter((marker) => missingSet.has(marker));
  }
  return rule.atLeast.of.filter((marker) => missingSet.has(marker));
}

// ─── Guidance generation ───────────────────────────────────────────────────────

/**
 * Build a structured PreconditionUnmetGuidance object for return to the model.
 */
export function generateGuidance(
  interfaceId: string,
  entry: PreconditionTableEntry,
  missing: Marker[]
): PreconditionUnmetGuidance {
  return {
    status: "precondition_unmet",
    interface: interfaceId,
    rule: entry.rule,
    missing,
    suggestedNext: entry.suggestedNext ?? [],
    message: formatGuidance(entry.rule, missing),
  };
}

/**
 * Type guard: check if a value is a PreconditionUnmetGuidance.
 */
export function isPreconditionUnmet(
  value: unknown
): value is PreconditionUnmetGuidance {
  return (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    (value as Record<string, unknown>).status === "precondition_unmet"
  );
}
