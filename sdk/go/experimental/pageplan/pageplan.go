// Package pageplan contains an experimental, pure steady-page planner.
// It owns no ports, persistence, Cursor codec, Ack, or product transaction.
package pageplan

import (
	"errors"
	"fmt"

	"github.com/foigent/event-connector-spec/sdk/go/canonical"
)

type ItemOutcome string

const (
	Inserted       ItemOutcome = "inserted"
	DuplicateNoop  ItemOutcome = "duplicate_noop"
	Conflict       ItemOutcome = "conflict"
	Rejected       ItemOutcome = "rejected"
	RetryableError ItemOutcome = "retryable_error"
	PermanentError ItemOutcome = "permanent_error"
)

type SteadyCheckpoint struct {
	ConnectorID      string
	ConnectorVersion string
	ProducerInstance string
	Cursor           string
	HighWatermark    string
	UpdatedAt        string
}

type Page struct {
	ConnectorID      string
	ConnectorVersion string
	ProducerInstance string
	EventCount       int
	NextCursor       string
	HighWatermark    string
	HasMore          bool
}

type CheckpointCandidate struct {
	connectorID      string
	connectorVersion string
	producerInstance string
	cursor           string
	highWatermark    string
	updatedAt        string
}

type PagePlan struct {
	outcomes  []ItemOutcome
	candidate CheckpointCandidate
}

type CursorTransitionValidator interface {
	ValidateSteadyTransition(previousCursor string, nextCursor string) error
}

func (value CheckpointCandidate) ConnectorID() string      { return value.connectorID }
func (value CheckpointCandidate) ConnectorVersion() string { return value.connectorVersion }
func (value CheckpointCandidate) ProducerInstance() string { return value.producerInstance }
func (value CheckpointCandidate) Cursor() string           { return value.cursor }
func (value CheckpointCandidate) HighWatermark() string    { return value.highWatermark }
func (value CheckpointCandidate) UpdatedAt() string        { return value.updatedAt }
func (value PagePlan) Outcomes() []ItemOutcome {
	return append([]ItemOutcome(nil), value.outcomes...)
}
func (value PagePlan) CandidateCheckpoint() CheckpointCandidate {
	return value.candidate
}

func PlanSteadyPage(
	current SteadyCheckpoint,
	page Page,
	outcomes []ItemOutcome,
	updatedAt string,
	cursorValidator CursorTransitionValidator,
) (PagePlan, error) {
	if current.ConnectorID == "" || current.ConnectorVersion == "" ||
		current.ProducerInstance == "" {
		return PagePlan{}, errors.New("steady checkpoint identity must not be empty")
	}
	if current.ConnectorID != page.ConnectorID ||
		current.ConnectorVersion != page.ConnectorVersion ||
		current.ProducerInstance != page.ProducerInstance {
		return PagePlan{}, errors.New("page identity does not match the current checkpoint")
	}
	if page.EventCount < 0 {
		return PagePlan{}, errors.New("page event count must not be negative")
	}
	if len(outcomes) != page.EventCount {
		return PagePlan{}, errors.New("outcome count does not match page event count")
	}
	if page.EventCount == 0 && page.NextCursor != current.Cursor {
		return PagePlan{}, errors.New("empty steady page must not advance the cursor")
	}
	if page.EventCount > 0 && page.NextCursor == current.Cursor {
		return PagePlan{}, errors.New("nonempty steady page must advance the cursor")
	}
	if page.HasMore && page.NextCursor == current.Cursor {
		return PagePlan{}, errors.New("has_more steady page must advance the cursor")
	}
	if cursorValidator != nil {
		if err := cursorValidator.ValidateSteadyTransition(current.Cursor, page.NextCursor); err != nil {
			return PagePlan{}, fmt.Errorf("cursor transition rejected: %w", err)
		}
	}
	for _, outcome := range outcomes {
		if outcome != Inserted && outcome != DuplicateNoop {
			return PagePlan{}, fmt.Errorf("page did not converge: %s", outcome)
		}
	}
	normalized := canonical.NormalizeMicrosecondTimestamp(updatedAt)
	if normalized.ErrorCode != "" || normalized.Normalized != updatedAt {
		return PagePlan{}, errors.New("checkpoint update time must be exact UTC microseconds")
	}
	return PagePlan{
		outcomes: append([]ItemOutcome(nil), outcomes...),
		candidate: CheckpointCandidate{
			connectorID:      current.ConnectorID,
			connectorVersion: current.ConnectorVersion,
			producerInstance: current.ProducerInstance,
			cursor:           page.NextCursor,
			highWatermark:    page.HighWatermark,
			updatedAt:        updatedAt,
		},
	}, nil
}
