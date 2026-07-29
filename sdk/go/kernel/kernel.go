// Package kernel contains only deterministic, source-neutral transition logic
// and port contracts. Activation-forward fences and all port implementations
// remain product-local.
package kernel

import (
	"context"
	"errors"
	"fmt"

	"github.com/foigent/event-connector-spec/sdk/go/canonical"
	"github.com/foigent/event-connector-spec/sdk/go/protocol"
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

type ReplayLedger struct {
	accepted map[string]string
}

type PagePlan struct {
	Outcomes            []ItemOutcome
	CheckpointAdvances  bool
	CandidateCheckpoint *protocol.Checkpoint
}

type CursorTransitionValidator interface {
	ValidateSteadyTransition(previousCursor string, nextCursor string) error
}

type FetchPort interface {
	Fetch(ctx context.Context, checkpoint protocol.Checkpoint) (protocol.Batch, error)
}

type CommitPort interface {
	// Commit must classify a complete product-owned atomic item, including all
	// local provenance and projections. The SDK never infers completeness from
	// event counts.
	Commit(ctx context.Context, envelope protocol.Envelope) (ItemOutcome, error)
}

type CheckpointPort interface {
	Load(ctx context.Context, connectorID string, producerInstance string) (protocol.Checkpoint, error)
	CompareAndSwap(ctx context.Context, expected protocol.Checkpoint, replacement protocol.Checkpoint) (bool, error)
}

type ReceiptPort interface {
	Record(ctx context.Context, receipt protocol.OperationalReceipt) error
}

type AckPort interface {
	// Ack is invoked by a product only for a previously durable checkpoint.
	Ack(ctx context.Context, checkpoint protocol.Checkpoint) error
}

func NewReplayLedger() *ReplayLedger {
	return &ReplayLedger{accepted: make(map[string]string)}
}

func (ledger *ReplayLedger) Classify(identity string, envelopeHash string) (ItemOutcome, error) {
	if ledger == nil {
		return "", errors.New("replay ledger is nil")
	}
	if identity == "" {
		return "", errors.New("scoped identity must not be empty")
	}
	if envelopeHash == "" {
		return "", errors.New("envelope hash must not be empty")
	}
	acceptedHash, exists := ledger.accepted[identity]
	if !exists {
		ledger.accepted[identity] = envelopeHash
		return Inserted, nil
	}
	if acceptedHash == envelopeHash {
		return DuplicateNoop, nil
	}
	return Conflict, nil
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

func PlanSteadyPage(
	current protocol.Checkpoint,
	batch protocol.Batch,
	outcomes []ItemOutcome,
	updatedAt string,
	cursorValidator CursorTransitionValidator,
) (PagePlan, error) {
	if current.Phase != "steady" {
		return PagePlan{}, errors.New("shared steady transition requires an already-durable steady checkpoint")
	}
	if current.ConnectorID != batch.ConnectorID ||
		current.ConnectorVersion != batch.ConnectorVersion ||
		current.ProducerInstance != batch.ProducerInstance {
		return PagePlan{}, errors.New("batch identity does not match the current checkpoint")
	}
	if len(outcomes) != len(batch.Events) {
		return PagePlan{}, errors.New("outcome count does not match batch event count")
	}
	if len(batch.Events) == 0 && batch.NextCursor != current.Cursor {
		return PagePlan{}, errors.New("empty steady page must not advance the cursor")
	}
	if len(batch.Events) > 0 && batch.NextCursor == current.Cursor {
		return PagePlan{}, errors.New("nonempty steady page must advance the cursor")
	}
	if batch.HasMore && batch.NextCursor == current.Cursor {
		return PagePlan{}, errors.New("has_more steady page must advance the cursor")
	}
	if cursorValidator != nil {
		if err := cursorValidator.ValidateSteadyTransition(current.Cursor, batch.NextCursor); err != nil {
			return PagePlan{}, fmt.Errorf("cursor transition rejected: %w", err)
		}
	}
	for _, outcome := range outcomes {
		if outcome != Inserted && outcome != DuplicateNoop {
			return PagePlan{Outcomes: append([]ItemOutcome(nil), outcomes...)}, fmt.Errorf("page did not converge: %s", outcome)
		}
	}
	normalized := canonical.NormalizeMicrosecondTimestamp(updatedAt)
	if normalized.ErrorCode != "" || normalized.Normalized != updatedAt {
		return PagePlan{}, errors.New("checkpoint update time must be exact UTC microseconds")
	}
	candidate := protocol.Checkpoint{
		ConnectorID:      current.ConnectorID,
		ConnectorVersion: current.ConnectorVersion,
		ProducerInstance: current.ProducerInstance,
		Cursor:           batch.NextCursor,
		HighWatermark:    batch.HighWatermark,
		Phase:            "steady",
		UpdatedAt:        updatedAt,
	}
	return PagePlan{
		Outcomes:            append([]ItemOutcome(nil), outcomes...),
		CheckpointAdvances:  true,
		CandidateCheckpoint: &candidate,
	}, nil
}
