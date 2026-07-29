package testkit

import "testing"

func TestReplayLedger(t *testing.T) {
	ledger := NewReplayLedger()
	if outcome, err := ledger.Classify("identity", "hash-a"); err != nil || outcome != ReplayInserted {
		t.Fatal(outcome, err)
	}
	if outcome, err := ledger.Classify("identity", "hash-a"); err != nil || outcome != ReplayDuplicateNoop {
		t.Fatal(outcome, err)
	}
	if outcome, err := ledger.Classify("identity", "hash-b"); err != nil || outcome != ReplayConflict {
		t.Fatal(outcome, err)
	}
}
