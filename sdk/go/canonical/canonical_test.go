package canonical

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestFrozenCanonicalAndIdentityVectors(t *testing.T) {
	root := filepath.Clean(filepath.Join("..", "..", ".."))
	for _, bundlePath := range []string{
		"vectors/canonical-vector-bundle.v1.json",
		"vectors/litellm-connector-vector-bundle.v1.json",
	} {
		var bundle struct {
			Canonical []struct {
				CaseID string `json:"case_id"`
				Path   string `json:"input_path"`
				Bytes  int    `json:"canonical_bytes"`
				Hash   string `json:"envelope_hash"`
			} `json:"canonical_envelopes"`
			Identity []struct {
				CaseID           string  `json:"case_id"`
				ProducerProduct  string  `json:"producer_product"`
				ProducerInstance string  `json:"producer_instance"`
				TenantRef        *string `json:"tenant_ref"`
				OrgRef           string  `json:"org_ref"`
				ProjectRef       string  `json:"project_ref"`
				EventType        string  `json:"event_type"`
				EventID          string  `json:"event_id"`
				InputHex         string  `json:"identity_input_hex"`
				Key              string  `json:"idempotency_key"`
			} `json:"idempotency"`
		}
		bytes, err := os.ReadFile(filepath.Join(root, bundlePath))
		if err != nil {
			t.Fatal(err)
		}
		if err := json.Unmarshal(bytes, &bundle); err != nil {
			t.Fatal(err)
		}
		for _, testCase := range bundle.Canonical {
			t.Run(testCase.CaseID, func(t *testing.T) {
				input, err := os.ReadFile(filepath.Join(root, testCase.Path))
				if err != nil {
					t.Fatal(err)
				}
				output, err := Canonicalize(input, DefaultLimits())
				if err != nil {
					t.Fatal(err)
				}
				if len(output) != testCase.Bytes || SHA256(output) != testCase.Hash {
					t.Fatalf("canonical mismatch: bytes=%d hash=%s", len(output), SHA256(output))
				}
			})
		}
		for _, testCase := range bundle.Identity {
			t.Run(testCase.CaseID, func(t *testing.T) {
				output, err := BuildIdentityInput(Identity{
					ProducerProduct: testCase.ProducerProduct, ProducerInstance: testCase.ProducerInstance,
					TenantRef: testCase.TenantRef, OrgRef: testCase.OrgRef, ProjectRef: testCase.ProjectRef,
					EventType: testCase.EventType, EventID: testCase.EventID,
				})
				if err != nil {
					t.Fatal(err)
				}
				if hex.EncodeToString(output) != testCase.InputHex || SHA256(output) != testCase.Key {
					t.Fatal("identity bytes drifted")
				}
			})
		}
	}
}

func TestStrictJSONLimitsAndCanonicalProfile(t *testing.T) {
	for _, input := range [][]byte{
		[]byte(`{"a":1,"a":2}`),
		[]byte(`{"a":{"\u0062":1,"b":2}}`),
		[]byte(`{"x":"\ud800"}`),
		{0xff},
	} {
		if _, err := Parse(input, DefaultLimits()); err == nil {
			t.Fatalf("expected strict rejection for %q", input)
		}
	}
	if _, err := Parse([]byte(`[[[0]]]`), Limits{MaxBytes: 32, MaxDepth: 2}); err == nil {
		t.Fatal("expected depth rejection")
	}
	if _, err := Parse([]byte(`{"abcdef":1}`), Limits{MaxBytes: 8, MaxDepth: 4}); err == nil {
		t.Fatal("expected byte limit rejection")
	}
	for _, input := range []string{`1.0`, `1e2`, `9007199254740992`} {
		if _, err := Canonicalize([]byte(input), DefaultLimits()); err == nil {
			t.Fatalf("expected safe-integer rejection for %s", input)
		}
	}
	output, err := Canonicalize([]byte(`{"":2,"😀":1}`), DefaultLimits())
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(output, []byte(`{"😀":1,"":2}`)) {
		t.Fatalf("UTF-16 key ordering drift: %s", output)
	}
}

func TestTimeDecimalAndNFCProfiles(t *testing.T) {
	if result := NormalizeMicrosecondTimestamp("2026-01-02T03:04:05.123456+08:00"); result.Normalized != "2026-01-01T19:04:05.123456Z" {
		t.Fatalf("unexpected time normalization: %+v", result)
	}
	if result := NormalizeMicrosecondTimestamp("2026-01-02T03:04:05.1234567Z"); result.ErrorCode != "timestamp_precision_loss" {
		t.Fatalf("expected precision loss: %+v", result)
	}
	if !IsValidInt64Decimal("9223372036854775807") || IsValidInt64Decimal("9223372036854775808") {
		t.Fatal("int64 decimal boundary drift")
	}
	if IsNFC("e\u0301") {
		t.Fatal("decomposed string must not be NFC")
	}
}
