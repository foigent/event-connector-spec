package protocolv2candidate

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/foigent/event-connector-spec/sdk/go/canonical"
)

type fixturePayloadValidator struct {
	badDigest bool
}

func (validator fixturePayloadValidator) ValidatePinned(
	schemaRef string,
	schemaVersion string,
	canonicalPayload []byte,
) (string, error) {
	if len(canonicalPayload) == 0 {
		return "", fmt.Errorf("payload bytes are empty")
	}
	if validator.badDigest {
		return "not-a-digest", nil
	}
	switch schemaRef + "@" + schemaVersion {
	case "foigent://events/model/request-completed/v1@1":
		return "sha256:ea0ea7354f3d9f435bb86a34eb28284e4297e5a2d1a3d22a23058c7dcc514dc6", nil
	case "foigent://events/model/request-completed/v2@2":
		return "sha256:75e5af3fe8a433054988c6afa3faf5a9a9fbe03a300c8d1d5a869912ecd9154e", nil
	default:
		return "", fmt.Errorf("schema is not pinned: %s@%s", schemaRef, schemaVersion)
	}
}

func TestReleasedHashInputsAndFinalEnvelope(t *testing.T) {
	root := filepath.Clean(filepath.Join("..", "..", "..", ".."))
	validator := fixturePayloadValidator{}
	for _, relative := range []string{
		"fixtures/shared/settled-envelope.hash-input.json",
		"fixtures/shared/cancelled-envelope.hash-input.json",
		"fixtures/shared/litellm-succeeded-envelope.hash-input.json",
		"fixtures/shared/litellm-failed-envelope.hash-input.json",
		"fixtures/shared/litellm-cache-hit-envelope.hash-input.json",
	} {
		t.Run(filepath.Base(relative), func(t *testing.T) {
			inputBytes, err := os.ReadFile(filepath.Join(root, relative))
			if err != nil {
				t.Fatal(err)
			}
			parsed, err := ParseEnvelopeHashInput(inputBytes, canonical.DefaultLimits(), validator)
			if err != nil {
				t.Fatal(err)
			}
			first := parsed.CanonicalBytes()
			first[0] ^= 0xff
			if bytes.Equal(first, parsed.CanonicalBytes()) {
				t.Fatal("validated Envelope leaked its canonical byte backing store")
			}
			value, err := canonical.Parse(inputBytes, canonical.DefaultLimits())
			if err != nil {
				t.Fatal(err)
			}
			canonicalBytes, err := canonical.CanonicalizeValue(value)
			if err != nil {
				t.Fatal(err)
			}
			integrity, ok := value.Member("integrity")
			if !ok {
				t.Fatal("fixture is missing integrity")
			}
			integrity, err = integrity.WithMember(
				"envelope_hash",
				canonical.NewStringValue(canonical.SHA256(canonicalBytes)),
			)
			if err != nil {
				t.Fatal(err)
			}
			value, err = value.WithMember("integrity", integrity)
			if err != nil {
				t.Fatal(err)
			}
			finalBytes, err := canonical.CanonicalizeValue(value)
			if err != nil {
				t.Fatal(err)
			}
			if _, err := ParseEnvelope(finalBytes, canonical.DefaultLimits(), validator); err != nil {
				t.Fatal(err)
			}
		})
	}
}

func TestWireParsersApplyCandidateExactIntegerProfile(t *testing.T) {
	root := filepath.Clean(filepath.Join("..", "..", "..", ".."))
	input, err := os.ReadFile(filepath.Join(root, "fixtures/shared/settled-envelope.hash-input.json"))
	if err != nil {
		t.Fatal(err)
	}
	exponent := []byte(strings.Replace(string(input), `"amount_scale": 1000000`, `"amount_scale": 1e6`, 1))
	if bytes.Equal(exponent, input) {
		t.Fatal("test setup did not replace amount_scale")
	}
	if _, err := ParseEnvelopeHashInput(exponent, canonical.DefaultLimits(), fixturePayloadValidator{}); err != nil {
		t.Fatalf("Envelope hash-input parser rejected exact integral exponent: %v", err)
	}

	receipt := `{"receipt_version":"foigent.operational-receipt.v1","operation_id":"op-1","connector_id":"foigent.example.source","producer_instance":"instance","operation":"commit_page","status":"completed","counts":{"received":9007199254740992,"inserted":0,"duplicate_noop":0,"conflict":0,"rejected":0},"checkpoint_before":"10","checkpoint_after":"10","observed_at":"2026-01-01T00:00:01.000000Z"}`
	if _, err := ParseOperationalReceipt([]byte(receipt), canonical.DefaultLimits()); err == nil {
		t.Fatal("Operational Receipt parser accepted an unsafe JSON integer")
	}
}

func TestReleasedManifests(t *testing.T) {
	root := filepath.Clean(filepath.Join("..", "..", "..", ".."))
	for _, name := range []string{
		"manifests/foigent.unirouter.completed-execution-1.0.0.json",
		"manifests/foigent.litellm.spend-logs-1.0.0.json",
	} {
		bytes, err := os.ReadFile(filepath.Join(root, name))
		if err != nil {
			t.Fatal(err)
		}
		if _, err := parseManifestCharacterization(bytes, canonical.DefaultLimits()); err != nil {
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
	root := filepath.Clean(filepath.Join("..", "..", "..", ".."))
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
	integrity, ok := value.Member("integrity")
	if !ok {
		t.Fatal("fixture is missing integrity")
	}
	integrity, err = integrity.WithMember(
		"envelope_hash",
		canonical.NewStringValue(canonical.SHA256(hashInput)),
	)
	if err != nil {
		t.Fatal(err)
	}
	value, err = value.WithMember("integrity", integrity)
	if err != nil {
		t.Fatal(err)
	}
	envelope, err := canonical.CanonicalizeValue(value)
	if err != nil {
		t.Fatal(err)
	}
	batch := fmt.Sprintf(`{"batch_version":"foigent.event-batch.v1","connector_id":"foigent.unirouter.completed-execution","connector_version":"1.0.0","producer_instance":"unirouter-development","generated_at":"2026-01-01T00:00:00.000000Z","events":[%s],"next_cursor":"11","high_watermark":"20","has_more":false}`, envelope)
	if _, err := ParseBatch([]byte(batch), canonical.DefaultLimits(), fixturePayloadValidator{}); err != nil {
		t.Fatal(err)
	}
}

func TestPinnedPayloadValidatorIsMandatory(t *testing.T) {
	root := filepath.Clean(filepath.Join("..", "..", "..", ".."))
	input, err := os.ReadFile(filepath.Join(root, "fixtures/shared/settled-envelope.hash-input.json"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ParseEnvelopeHashInput(input, canonical.DefaultLimits(), nil); err == nil {
		t.Fatal("nil payload validator must fail closed")
	}
	if _, err := ParseEnvelopeHashInput(input, canonical.DefaultLimits(), fixturePayloadValidator{badDigest: true}); err == nil {
		t.Fatal("validator without a pinned Schema digest must fail closed")
	}
}
