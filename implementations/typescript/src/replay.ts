export type PersistenceOutcome =
  | "inserted"
  | "duplicate_noop"
  | "conflict"
  | "retryable_error";

export interface ReplayObservation {
  first_outcome: PersistenceOutcome;
  replay_outcome: PersistenceOutcome;
  checkpoint_advances: boolean;
}

export interface PartialPageObservation {
  first_item: PersistenceOutcome;
  second_item: PersistenceOutcome;
  checkpoint_advances: boolean;
  next_attempt_first_item: PersistenceOutcome;
}

export class EvidenceIdentityStore {
  private readonly hashes = new Map<string, string>();

  apply(identity: string, contentHash: string): PersistenceOutcome {
    const existing = this.hashes.get(identity);
    if (existing === undefined) {
      this.hashes.set(identity, contentHash);
      return "inserted";
    }
    return existing === contentHash ? "duplicate_noop" : "conflict";
  }
}

export function checkpointCanAdvance(
  outcomes: readonly PersistenceOutcome[],
): boolean {
  return outcomes.every((outcome) =>
    outcome === "inserted" || outcome === "duplicate_noop"
  );
}

export function observeSameIdentitySameHash(): ReplayObservation {
  const store = new EvidenceIdentityStore();
  const first = store.apply("identity-1", "sha256:content-a");
  const replay = store.apply("identity-1", "sha256:content-a");
  return {
    first_outcome: first,
    replay_outcome: replay,
    checkpoint_advances: checkpointCanAdvance([replay]),
  };
}

export function observeSameIdentityDifferentHash(): ReplayObservation {
  const store = new EvidenceIdentityStore();
  const first = store.apply("identity-1", "sha256:content-a");
  const replay = store.apply("identity-1", "sha256:content-b");
  return {
    first_outcome: first,
    replay_outcome: replay,
    checkpoint_advances: checkpointCanAdvance([replay]),
  };
}

export function observePartialPageFailure(): PartialPageObservation {
  const store = new EvidenceIdentityStore();
  const first = store.apply("identity-1", "sha256:content-a");
  const second: PersistenceOutcome = "retryable_error";
  const checkpointAdvances = checkpointCanAdvance([first, second]);
  const nextFirst = store.apply("identity-1", "sha256:content-a");
  return {
    first_item: first,
    second_item: second,
    checkpoint_advances: checkpointAdvances,
    next_attempt_first_item: nextFirst,
  };
}
