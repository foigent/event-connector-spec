package pageplan

import (
	"testing"
)

func TestSteadyPageConvergenceAndProgress(t *testing.T) {
	current := SteadyCheckpoint{
		ConnectorID: "foigent.example.source", ConnectorVersion: "1.0.0",
		ProducerInstance: "instance", Cursor: "10", HighWatermark: "20",
		UpdatedAt: "2026-01-01T00:00:00.000000Z",
	}
	page := Page{
		ConnectorID: "foigent.example.source", ConnectorVersion: "1.0.0",
		ProducerInstance: "instance", NextCursor: "11", HighWatermark: "20",
		EventCount: 2,
	}
	plan, err := PlanSteadyPage(
		current, page, []ItemOutcome{Inserted, DuplicateNoop},
		"2026-01-01T00:00:01.000000Z", nil,
	)
	if err != nil {
		t.Fatal(err)
	}
	if plan.CandidateCheckpoint().Cursor() != "11" {
		t.Fatalf("unexpected plan: %+v", plan)
	}
	page.NextCursor = "10"
	page.HasMore = true
	if _, err := PlanSteadyPage(current, page, []ItemOutcome{Inserted, DuplicateNoop}, "2026-01-01T00:00:01.000000Z", nil); err == nil {
		t.Fatal("has_more no-progress must fail closed")
	}
	page.HasMore = false
	page.EventCount = 0
	page.NextCursor = "11"
	if _, err := PlanSteadyPage(current, page, nil, "2026-01-01T00:00:01.000000Z", nil); err == nil {
		t.Fatal("empty cursor advance must fail closed")
	}
	page.EventCount = 1
	if _, err := PlanSteadyPage(current, page, []ItemOutcome{Conflict}, "2026-01-01T00:00:01.000000Z", nil); err == nil {
		t.Fatal("conflict must preserve old checkpoint")
	}
}
