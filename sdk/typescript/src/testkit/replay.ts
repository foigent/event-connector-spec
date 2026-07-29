export type ReplayOutcome = "inserted" | "duplicate_noop" | "conflict";

/**
 * In-memory conformance helper only. This is not a persistence,
 * deduplication, EvidenceStore, receipt, or product transaction authority.
 */
export class ReplayLedger {
  readonly #accepted = new Map<string, string>();

  classify(identity: string, envelopeHash: string): ReplayOutcome {
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
