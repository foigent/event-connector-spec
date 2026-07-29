package protocol

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/foigent/event-connector-spec/sdk/go/canonical"
)

func TestReleasedHashInputsAndFinalEnvelope(t *testing.T) {
	root := filepath.Clean(filepath.Join("..", "..", ".."))
	for _, relative := range []string{
		"fixtures/shared/settled-envelope.hash-input.json",
		"fixtures/shared/cancelled-envelope.hash-input.json",
		"fixtures/shared/litellm-succeeded-envelope.hash-input.json",
		"fixtures/shared/litellm-failed-envelope.hash-input.json",
		"fixtures/shared/litellm-cache-hit-envelope.hash-input.json",
	} {
		t.Run(filepath.Base(relative), func(t *testing.T) {
			bytes, err := os.ReadFile(filepath.Join(root, relative))
			if err != nil {
				t.Fatal(err)
			}
			if _, err := ParseEnvelopeHashInput(bytes, canonical.DefaultLimits(), nil); err != nil {
				t.Fatal(err)
			}
			value, err := canonical.Parse(bytes, canonical.DefaultLimits())
			if err != nil {
				t.Fatal(err)
			}
			canonicalBytes, err := canonical.CanonicalizeValue(value)
			if err != nil {
				t.Fatal(err)
			}
			integrity := value.Members["integrity"]
			integrity.Members["envelope_hash"] = canonical.Value{Kind: canonical.String, Text: canonical.SHA256(canonicalBytes)}
			value.Members["integrity"] = integrity
			finalBytes, err := canonical.CanonicalizeValue(value)
			if err != nil {
				t.Fatal(err)
			}
			if _, err := ParseEnvelope(finalBytes, canonical.DefaultLimits(), nil); err != nil {
				t.Fatal(err)
			}
		})
	}
}

func TestReleasedManifests(t *testing.T) {
	root := filepath.Clean(filepath.Join("..", "..", ".."))
	for _, name := range []string{
		"manifests/foigent.unirouter.completed-execution-1.0.0.json",
		"manifests/foigent.litellm.spend-logs-1.0.0.json",
	} {
		bytes, err := os.ReadFile(filepath.Join(root, name))
		if err != nil {
			t.Fatal(err)
		}
		if _, err := ParseManifest(bytes, canonical.DefaultLimits()); err != nil {
			t.Fatalf("%s: %v", name, err)
		}
	}
}

func TestOtherProtocolWireObjects(t *testing.T) {
	checkpoint := `{"checkpoint_version":"foigent.connector-checkpoint.v1","connector_id":"foigent.example.source","connector_version":"1.0.0","producer_instance":"instance","cursor":"10","high_watermark":"20","phase":"steady","updated_at":"2026-01-01T00:00:00.000000Z"}`
	if _, err := ParseCheckpoint([]byte(checkpoint), canonical.DefaultLimits()); err != nil {
		t.Fatal(err)
	}
	connectorError := `{"error_version":"foigent.connector-error.v1","category":"transport","code":"source.timeout","phase":"fetch","operation":"poll","retryable":true,"retry_after_seconds":10,"safe_message":"source temporarily unavailable","recovery":"automatic_retry"}`
	if _, err := ParseConnectorError([]byte(connectorError), canonical.DefaultLimits()); err != nil {
		t.Fatal(err)
	}
	lifecycle := `{"lifecycle_version":"foigent.connector-lifecycle.v1","configuration":"configured","authentication":"valid","transport":"ready","processing":"idle","checkpoint":"steady","health":"healthy"}`
	if _, err := ParseLifecycle([]byte(lifecycle), canonical.DefaultLimits()); err != nil {
		t.Fatal(err)
	}
	receipt := `{"receipt_version":"foigent.operational-receipt.v1","operation_id":"op-1","connector_id":"foigent.example.source","producer_instance":"instance","operation":"commit_page","status":"completed","counts":{"received":2,"inserted":1,"duplicate_noop":1,"conflict":0,"rejected":0},"checkpoint_before":"10","checkpoint_after":"11","observed_at":"2026-01-01T00:00:01.000000Z"}`
	if _, err := ParseOperationalReceipt([]byte(receipt), canonical.DefaultLimits()); err != nil {
		t.Fatal(err)
	}
	if _, err := ParseCheckpoint([]byte(strings.Replace(checkpoint, `"phase":"steady"`, `"phase":"steady","unknown":true`, 1)), canonical.DefaultLimits()); err == nil {
		t.Fatal("unknown checkpoint member must be rejected")
	}
}

func TestBatchWireParser(t *testing.T) {
	root := filepath.Clean(filepath.Join("..", "..", ".."))
	input, err := os.ReadFile(filepath.Join(root, "fixtures/shared/settled-envelope.hash-input.json"))
	if err != nil {
		t.Fatal(err)
	}
	value, err := canonical.Parse(input, canonical.DefaultLimits())
	if err != nil {
		t.Fatal(err)
	}
	hashInput, err := canonical.CanonicalizeValue(value)
	if err != nil {
		t.Fatal(err)
	}
	integrity := value.Members["integrity"]
	integrity.Members["envelope_hash"] = canonical.Value{Kind: canonical.String, Text: canonical.SHA256(hashInput)}
	value.Members["integrity"] = integrity
	envelope, err := canonical.CanonicalizeValue(value)
	if err != nil {
		t.Fatal(err)
	}
	batch := fmt.Sprintf(`{"batch_version":"foigent.event-batch.v1","connector_id":"foigent.unirouter.completed-execution","connector_version":"1.0.0","producer_instance":"unirouter-development","generated_at":"2026-01-01T00:00:00.000000Z","events":[%s],"next_cursor":"11","high_watermark":"20","has_more":false}`, envelope)
	if _, err := ParseBatch([]byte(batch), canonical.DefaultLimits(), nil); err != nil {
		t.Fatal(err)
	}
}

func TestCompatibilityMatrixFailsClosed(t *testing.T) {
	for _, pin := range SupportedCompatibilityPins() {
		if err := ValidateCompatibilityPin(pin); err != nil {
			t.Fatal(err)
		}
	}
	unknown := SupportedCompatibilityPins()[0]
	unknown.ProtocolVersion = "latest"
	if err := ValidateCompatibilityPin(unknown); err == nil {
		t.Fatal("unknown compatibility tuple must fail closed")
	}
	if err := ValidateReleasedSourceRevision("1"); err != nil {
		t.Fatal(err)
	}
	if err := ValidateReleasedSourceRevision("2"); err == nil {
		t.Fatal("unknown Source revision must fail closed")
	}
}
