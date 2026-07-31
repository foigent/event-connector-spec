package conformance

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestSourceNeutralBundlePasses(t *testing.T) {
	root := protocolRoot(t)
	reportPath := filepath.Join(t.TempDir(), "go-source-neutral-v2.json")
	summary, exitCode, err := Execute(
		filepath.Join(root, "vectors/source-neutral-vector-bundle.v2.json"),
		reportPath,
	)
	if err != nil {
		t.Fatalf("execute: %v", err)
	}
	if exitCode != ExitPass || summary.Status != "pass" || summary.CaseCount != 69 {
		t.Fatalf("unexpected summary: %+v exit=%d", summary, exitCode)
	}
	if info, err := os.Stat(reportPath); err != nil || info.Size() == 0 {
		t.Fatalf("report not written: info=%v err=%v", info, err)
	}
}

func TestOpenInferenceOptionalFactsAndBatchOrdering(t *testing.T) {
	root := protocolRoot(t)
	missingRaw, err := os.ReadFile(filepath.Join(
		root,
		"fixtures/source/openinference/missing-optional-otlp-export.v1.json",
	))
	if err != nil {
		t.Fatal(err)
	}
	missing, err := sanitizeOTLP(missingRaw)
	if err != nil {
		t.Fatalf("sanitize missing facts: %v", err)
	}
	if len(missing.Records) != 1 ||
		!missing.Records[0].MissingParent ||
		missing.Records[0].Status != "failed" ||
		missing.Records[0].SessionID != "" ||
		missing.Records[0].TotalTokens != "" {
		t.Fatalf("missing-fact semantics differ: %+v", missing)
	}
	envelope, _, err := mapSourceToEnvelope(
		missing.Records[0],
		mappingContext{
			ProducerProduct: "openinference", ProducerInstance: "otel-collector-prod-a",
			OrgRef: "1", ProjectRef: "7",
			ConnectorID: "foigent.openinference.otlp-spans", ConnectorVersion: "1.0.0",
		},
	)
	if err != nil {
		t.Fatal(err)
	}
	actor := envelope["actor"].(map[string]any)
	payload := envelope["payload"].(map[string]any)
	if actor["type"] != "system" ||
		len(payload["usage"].(map[string]any)) != 0 ||
		len(payload["capture_gaps"].([]any)) != 7 {
		t.Fatalf("optional facts were fabricated or gaps lost: %v", envelope)
	}

	orderedRaw, err := os.ReadFile(filepath.Join(
		root,
		"fixtures/source/openinference/ordered-batch-otlp-export.v1.json",
	))
	if err != nil {
		t.Fatal(err)
	}
	ordered, err := sanitizeOTLP(orderedRaw)
	if err != nil {
		t.Fatalf("sanitize ordered batch: %v", err)
	}
	identities := make([]string, 0, len(ordered.Records))
	for _, record := range ordered.Records {
		identities = append(identities, record.TraceID+":"+record.SpanID)
	}
	expected := []string{
		"11111111111111111111111111111111:ffffffffffffffff",
		"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb:1111111111111111",
		"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb:2222222222222222",
	}
	if !equalStringSlices(identities, expected) ||
		ordered.SkippedNonLLM != 1 ||
		ordered.Records[2].MissingParent {
		t.Fatalf("bounded batch semantics differ: %+v", ordered)
	}
}

func TestOpenInferenceNegativeFixturesReturnStableCodes(t *testing.T) {
	root := protocolRoot(t)
	cases := map[string]string{
		"unknown-status-otlp-export.invalid.json":     "status_code_invalid",
		"end-before-start-otlp-export.invalid.json":   "timestamp_order_invalid",
		"malformed-trace-id-otlp-export.invalid.json": "source_shape_invalid",
		"too-many-spans-otlp-export.invalid.json":     "span_limit_exceeded",
	}
	for name, expected := range cases {
		raw, err := os.ReadFile(filepath.Join(
			root, "fixtures/source/openinference", name,
		))
		if err != nil {
			t.Fatal(err)
		}
		_, err = sanitizeOTLP(raw)
		var failure *sanitizationError
		if !errors.As(err, &failure) || failure.Code != expected {
			t.Fatalf("%s: got %v, want %s", name, err, expected)
		}
	}
}

func TestManifestAxesFailClosed(t *testing.T) {
	got := classifyManifest(map[string]any{
		"transport":              "otlp_http_push",
		"delivery":               "https_pull",
		"activation":             "receiver_activation_forward",
		"checkpoint":             "not_applicable",
		"ingestion_capture_mode": "otlp_http_receive",
		"delivery_scope":         "accepted_request",
		"partial_acceptance":     "reject_batch",
	})
	if got["valid"] != false || got["error_code"] != "mode_axis_mismatch" {
		t.Fatalf("hybrid manifest did not fail closed: %v", got)
	}
}

func TestOperationalReceiptSemanticsFailClosed(t *testing.T) {
	counts := map[string]any{
		"received":       float64(1),
		"inserted":       float64(1),
		"duplicate_noop": float64(0),
		"conflict":       float64(0),
		"rejected":       float64(0),
	}
	valid := classifyReceipt(map[string]any{
		"mode":                 "otlp_http_push",
		"operation":            "acknowledge",
		"status":               "completed",
		"acknowledgement":      "durable",
		"checkpoint_committed": false,
		"counts":               counts,
		"error_retryable":      nil,
	})
	if valid["valid"] != true || valid["counts_accounted"] != true {
		t.Fatalf("valid receipt rejected: %v", valid)
	}
	invalid := classifyReceipt(map[string]any{
		"mode":                 "otlp_http_push",
		"operation":            "acknowledge",
		"status":               "completed",
		"acknowledgement":      "withheld",
		"checkpoint_committed": false,
		"counts":               counts,
		"error_retryable":      nil,
	})
	if invalid["error_code"] != "receipt_acknowledgement_mismatch" {
		t.Fatalf("completed withheld receipt accepted: %v", invalid)
	}
}

func protocolRoot(t *testing.T) string {
	t.Helper()
	root, err := filepath.Abs(filepath.Join("..", "..", "..", "..", ".."))
	if err != nil {
		t.Fatal(err)
	}
	return root
}
