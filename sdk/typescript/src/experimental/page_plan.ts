import { normalizeMicrosecondTimestamp } from "../canonical/core.ts";

export type ItemOutcome =
  | "inserted"
  | "duplicate_noop"
  | "conflict"
  | "rejected"
  | "retryable_error"
  | "permanent_error";

export interface PagePlan {
  readonly outcomes: readonly ItemOutcome[];
  readonly candidateCheckpoint: CheckpointCandidate;
}

export interface CursorTransitionValidator {
  validateSteadyTransition(previousCursor: string, nextCursor: string): void;
}

export interface SteadyCheckpoint {
  readonly connectorId: string;
  readonly connectorVersion: string;
  readonly producerInstance: string;
  readonly cursor: string;
  readonly highWatermark: string;
  readonly updatedAt: string;
}

export interface Page {
  readonly connectorId: string;
  readonly connectorVersion: string;
  readonly producerInstance: string;
  readonly eventCount: number;
  readonly nextCursor: string;
  readonly highWatermark: string;
  readonly hasMore: boolean;
}

export interface CheckpointCandidate {
  readonly connectorId: string;
  readonly connectorVersion: string;
  readonly producerInstance: string;
  readonly cursor: string;
  readonly highWatermark: string;
  readonly updatedAt: string;
}

export function planSteadyPage(
  current: SteadyCheckpoint,
  page: Page,
  outcomes: readonly ItemOutcome[],
  updatedAt: string,
  cursorValidator?: CursorTransitionValidator,
): PagePlan {
  if (
    current.connectorId.length === 0 ||
    current.connectorVersion.length === 0 ||
    current.producerInstance.length === 0
  ) {
    throw new Error("steady checkpoint identity must not be empty");
  }
  if (
    current.connectorId !== page.connectorId ||
    current.connectorVersion !== page.connectorVersion ||
    current.producerInstance !== page.producerInstance
  ) {
    throw new Error("page identity does not match the current checkpoint");
  }
  if (!Number.isSafeInteger(page.eventCount) || page.eventCount < 0) {
    throw new Error("page event count must be a nonnegative safe integer");
  }
  if (outcomes.length !== page.eventCount) {
    throw new Error("outcome count does not match page event count");
  }
  if (page.eventCount === 0 && page.nextCursor !== current.cursor) {
    throw new Error("empty steady page must not advance the cursor");
  }
  if (page.eventCount > 0 && page.nextCursor === current.cursor) {
    throw new Error("nonempty steady page must advance the cursor");
  }
  if (page.hasMore && page.nextCursor === current.cursor) {
    throw new Error("has_more steady page must advance the cursor");
  }
  cursorValidator?.validateSteadyTransition(
    current.cursor,
    page.nextCursor,
  );
  for (const outcome of outcomes) {
    if (outcome !== "inserted" && outcome !== "duplicate_noop") {
      throw new Error(`page did not converge: ${outcome}`);
    }
  }
  const normalized = normalizeMicrosecondTimestamp(updatedAt);
  if (normalized.normalized !== updatedAt) {
    throw new Error(
      "checkpoint update time must be exact UTC microseconds",
    );
  }
  const candidateCheckpoint: CheckpointCandidate = Object.freeze({
    connectorId: current.connectorId,
    connectorVersion: current.connectorVersion,
    producerInstance: current.producerInstance,
    cursor: page.nextCursor,
    highWatermark: page.highWatermark,
    updatedAt,
  });
  return Object.freeze({
    outcomes: Object.freeze([...outcomes]),
    candidateCheckpoint,
  });
}
