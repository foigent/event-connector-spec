package kernel

import (
	"testing"

	"github.com/foigent/event-connector-spec/sdk/go/protocol"
)

func TestReplayClassifier(t *testing.T) {
	ledger := NewReplayLedger()
	if outcome, _ := ledger.Classify("identity", "hash-a"); outcome != Inserted {
		t.Fatal(outcome)
	}
	if outcome, _ := ledger.Classify("identity", "hash-a"); outcome != DuplicateNoop {
		t.Fatal(outcome)
	}
	if outcome, _ := ledger.Classify("identity", "hash-b"); outcome != Conflict {
		t.Fatal(outcome)
	}
}

func TestSteadyPageConvergenceAndProgress(t *testing.T) {
	current := protocol.Checkpoint{
		ConnectorID: "foigent.example.source", ConnectorVersion: "1.0.0",
		ProducerInstance: "instance", Cursor: "10", HighWatermark: "20",
		Phase: "steady", UpdatedAt: "2026-01-01T00:00:00.000000Z",
	}
	batch := protocol.Batch{
		ConnectorID: "foigent.example.source", ConnectorVersion: "1.0.0",
		ProducerInstance: "instance", NextCursor: "11", HighWatermark: "20",
		Events: []protocol.Envelope{{}, {}},
	}
	plan, err := PlanSteadyPage(
		current, batch, []ItemOutcome{Inserted, DuplicateNoop},
		"2026-01-01T00:00:01.000000Z", nil,
	)
	if err != nil {
		t.Fatal(err)
	}
	if !plan.CheckpointAdvances || plan.CandidateCheckpoint == nil || plan.CandidateCheckpoint.Cursor != "11" {
		t.Fatalf("unexpected plan: %+v", plan)
	}
	batch.NextCursor = "10"
	batch.HasMore = true
	if _, err := PlanSteadyPage(current, batch, []ItemOutcome{Inserted, DuplicateNoop}, "2026-01-01T00:00:01.000000Z", nil); err == nil {
		t.Fatal("has_more no-progress must fail closed")
	}
	batch.HasMore = false
	batch.Events = nil
	batch.NextCursor = "11"
	if _, err := PlanSteadyPage(current, batch, nil, "2026-01-01T00:00:01.000000Z", nil); err == nil {
		t.Fatal("empty cursor advance must fail closed")
	}
	batch.Events = []protocol.Envelope{{}}
	batch.NextCursor = "11"
	if _, err := PlanSteadyPage(current, batch, []ItemOutcome{Conflict}, "2026-01-01T00:00:01.000000Z", nil); err == nil {
		t.Fatal("conflict must preserve old checkpoint")
	}
	current.Phase = "bootstrap"
	if _, err := PlanSteadyPage(current, batch, []ItemOutcome{Inserted}, "2026-01-01T00:00:01.000000Z", nil); err == nil {
		t.Fatal("activation/bootstrap must bypass the shared steady transition")
	}
}
