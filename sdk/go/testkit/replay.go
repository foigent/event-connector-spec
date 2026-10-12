package testkit

import "errors"

type ReplayOutcome string

const (
	ReplayInserted      ReplayOutcome = "inserted"
	ReplayDuplicateNoop ReplayOutcome = "duplicate_noop"
	ReplayConflict      ReplayOutcome = "conflict"
)

// ReplayLedger is an in-memory conformance helper. It is not a persistence,
// deduplication, receipt, EvidenceStore, or product transaction authority.
type ReplayLedger struct {
	accepted map[string]string
}

func NewReplayLedger() *ReplayLedger {
	return &ReplayLedger{accepted: make(map[string]string)}
}

func (ledger *ReplayLedger) Classify(identity string, envelopeHash string) (ReplayOutcome, error) {
	if ledger == nil {
		return "", errors.New("replay ledger is nil")
	}
	if identity == "" || envelopeHash == "" {
		return "", errors.New("identity and envelope hash must not be empty")
	}
	acceptedHash, exists := ledger.accepted[identity]
	if !exists {
		ledger.accepted[identity] = envelopeHash
		return ReplayInserted, nil
	}
	if acceptedHash == envelopeHash {
		return ReplayDuplicateNoop, nil
	}
	return ReplayConflict, nil
}

func (ledger *ReplayLedger) Clone() *ReplayLedger {
	cloned := NewReplayLedger()
	if ledger == nil {
		return cloned
	}
	for identity, hash := range ledger.accepted {
		cloned.accepted[identity] = hash
	}
	return cloned
}
