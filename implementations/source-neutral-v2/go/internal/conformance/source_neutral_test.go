package conformance

import (
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
	if exitCode != ExitPass || summary.Status != "pass" || summary.CaseCount != 39 {
		t.Fatalf("unexpected summary: %+v exit=%d", summary, exitCode)
	}
	if info, err := os.Stat(reportPath); err != nil || info.Size() == 0 {
		t.Fatalf("report not written: info=%v err=%v", info, err)
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

func protocolRoot(t *testing.T) string {
	t.Helper()
	root, err := filepath.Abs(filepath.Join("..", "..", "..", "..", ".."))
	if err != nil {
		t.Fatal(err)
	}
	return root
}
