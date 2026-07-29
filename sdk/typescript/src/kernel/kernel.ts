import { normalizeMicrosecondTimestamp } from "../canonical/core.ts";
import { Batch, Checkpoint, Envelope } from "../protocol/protocol.ts";

export type ItemOutcome =
  | "inserted"
  | "duplicate_noop"
  | "conflict"
  | "rejected"
  | "retryable_error"
  | "permanent_error";

export interface PagePlan {
  readonly outcomes: readonly ItemOutcome[];
  readonly checkpointAdvances: boolean;
  readonly candidateCheckpoint?: Checkpoint;
}

export interface CursorTransitionValidator {
  validateSteadyTransition(previousCursor: string, nextCursor: string): void;
}

export interface FetchPort {
  fetch(checkpoint: Checkpoint): Promise<Batch>;
}

export interface CommitPort {
  /**
   * The consumer classifies one complete product-owned atomic item. The SDK
   * never infers provenance or local projection completeness from event counts.
   */
  commit(envelope: Envelope): Promise<ItemOutcome>;
}

export interface CheckpointPort {
  load(connectorId: string, producerInstance: string): Promise<Checkpoint>;
  compareAndSwap(
    expected: Checkpoint,
    replacement: Checkpoint,
  ): Promise<boolean>;
}

export interface ReceiptPort<TReceipt> {
  record(receipt: TReceipt): Promise<void>;
}

export interface AckPort {
  /** The product may call this only for a previously durable checkpoint. */
  ack(checkpoint: Checkpoint): Promise<void>;
}

export class ReplayLedger {
  readonly #accepted = new Map<string, string>();

  classify(identity: string, envelopeHash: string): ItemOutcome {
    if (identity.length === 0 || envelopeHash.length === 0) {
      throw new Error("identity and envelope hash must not be empty");
    }
    const acceptedHash = this.#accepted.get(identity);
    if (acceptedHash === undefined) {
      this.#accepted.set(identity, envelopeHash);
      return "inserted";
    }
    return acceptedHash === envelopeHash ? "duplicate_noop" : "conflict";
  }

  clone(): ReplayLedger {
    const result = new ReplayLedger();
    for (const [identity, hash] of this.#accepted) {
      result.#accepted.set(identity, hash);
    }
    return result;
  }
}

export function planSteadyPage(
  current: Checkpoint,
  batch: Batch,
  outcomes: readonly ItemOutcome[],
  updatedAt: string,
  cursorValidator?: CursorTransitionValidator,
): PagePlan {
  if (current.phase !== "steady") {
    throw new Error(
      "shared steady transition requires an already-durable steady checkpoint",
    );
  }
  if (
    current.connectorId !== batch.connectorId ||
    current.connectorVersion !== batch.connectorVersion ||
    current.producerInstance !== batch.producerInstance
  ) {
    throw new Error("batch identity does not match the current checkpoint");
  }
  if (outcomes.length !== batch.events.length) {
    throw new Error("outcome count does not match batch event count");
  }
  if (batch.events.length === 0 && batch.nextCursor !== current.cursor) {
    throw new Error("empty steady page must not advance the cursor");
  }
  if (batch.events.length > 0 && batch.nextCursor === current.cursor) {
    throw new Error("nonempty steady page must advance the cursor");
  }
  if (batch.hasMore && batch.nextCursor === current.cursor) {
    throw new Error("has_more steady page must advance the cursor");
  }
  cursorValidator?.validateSteadyTransition(
    current.cursor,
    batch.nextCursor,
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
  const candidateCheckpoint: Checkpoint = {
    connectorId: current.connectorId,
    connectorVersion: current.connectorVersion,
    producerInstance: current.producerInstance,
    cursor: batch.nextCursor,
    highWatermark: batch.highWatermark,
    phase: "steady",
    updatedAt,
  };
  return {
    outcomes: [...outcomes],
    checkpointAdvances: true,
    candidateCheckpoint,
  };
}
