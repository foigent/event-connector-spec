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
	for input, expected := range map[string]string{
		`1.0`:   `1`,
		`1e2`:   `100`,
		`1.5e1`: `15`,
	} {
		output, err := Canonicalize([]byte(input), DefaultLimits())
		if err != nil || string(output) != expected {
			t.Fatalf("exact integral JSON number %s: output=%s err=%v", input, output, err)
		}
	}
	for _, input := range []string{`1.5`, `1.0000000000000001`, `9007199254740992`, `-9007199254740992`} {
		if _, err := Parse([]byte(input), DefaultLimits()); err == nil {
			t.Fatalf("expected parse-time safe-integer rejection for %s", input)
		}
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

func TestParsedValuesAreImmutableByConstruction(t *testing.T) {
	value, err := Parse([]byte(`{"items":[1],"name":"before"}`), DefaultLimits())
	if err != nil {
		t.Fatal(err)
	}
	members := value.Members()
	delete(members, "name")
	items := members["items"].Items()
	items[0] = NewStringValue("changed")
	if output, err := CanonicalizeValue(value); err != nil || string(output) != `{"items":[1],"name":"before"}` {
		t.Fatalf("container accessor changed parsed value: output=%s err=%v", output, err)
	}
	updated, err := value.WithMember("name", NewStringValue("after"))
	if err != nil {
		t.Fatal(err)
	}
	original, err := CanonicalizeValue(value)
	if err != nil {
		t.Fatal(err)
	}
	replacement, err := CanonicalizeValue(updated)
	if err != nil {
		t.Fatal(err)
	}
	if string(original) != `{"items":[1],"name":"before"}` ||
		string(replacement) != `{"items":[1],"name":"after"}` {
		t.Fatalf("functional member replacement drifted: original=%s replacement=%s", original, replacement)
	}
}

func TestCandidateWireBoundaryVectors(t *testing.T) {
	var vectors struct {
		NumberProfile struct {
			Cases []struct {
				CaseID    string `json:"case_id"`
				Input     string `json:"input"`
				Expected  string `json:"expected"`
				Canonical string `json:"canonical"`
			} `json:"cases"`
		} `json:"number_profile"`
		TimestampProfile struct {
			Cases []struct {
				CaseID       string `json:"case_id"`
				Input        string `json:"input"`
				Expected     string `json:"expected"`
				Normalized   string `json:"normalized"`
				ExpectedCode string `json:"error_code"`
			} `json:"cases"`
		} `json:"timestamp_profile"`
	}
	input, err := os.ReadFile(filepath.Join("..", "..", "candidate-wire-boundary-vectors.v1.json"))
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(input, &vectors); err != nil {
		t.Fatal(err)
	}
	for _, testCase := range vectors.NumberProfile.Cases {
		t.Run(testCase.CaseID, func(t *testing.T) {
			output, err := Canonicalize([]byte(testCase.Input), DefaultLimits())
			if testCase.Expected == "reject" {
				if err == nil {
					t.Fatalf("candidate negative JSON vector was accepted: %s", testCase.Input)
				}
				return
			}
			if err != nil || string(output) != testCase.Canonical {
				t.Fatalf("number output=%s err=%v expected=%s", output, err, testCase.Canonical)
			}
		})
	}
	for _, testCase := range vectors.TimestampProfile.Cases {
		t.Run(testCase.CaseID, func(t *testing.T) {
			result := NormalizeMicrosecondTimestamp(testCase.Input)
			if testCase.Expected == "reject" {
				if result.ErrorCode != testCase.ExpectedCode {
					t.Fatalf("timestamp result=%+v expected=%s", result, testCase.ExpectedCode)
				}
				return
			}
			if result.ErrorCode != "" || result.Normalized != testCase.Normalized {
				t.Fatalf("timestamp result=%+v expected=%s", result, testCase.Normalized)
			}
		})
	}
}

func TestTimeDecimalAndNFCProfiles(t *testing.T) {
	if result := NormalizeMicrosecondTimestamp("2026-01-02T03:04:05.123456+08:00"); result.Normalized != "2026-01-01T19:04:05.123456Z" {
		t.Fatalf("unexpected time normalization: %+v", result)
	}
	if result := NormalizeMicrosecondTimestamp("2026-01-02T03:04:05.1234567Z"); result.ErrorCode != "timestamp_precision_loss" {
		t.Fatalf("expected precision loss: %+v", result)
	}
	if result := NormalizeMicrosecondTimestamp("0000-01-01T00:00:00.000000Z"); result.Normalized != "0000-01-01T00:00:00.000000Z" {
		t.Fatalf("expected year-zero acceptance: %+v", result)
	}
	if !IsValidInt64Decimal("9223372036854775807") || IsValidInt64Decimal("9223372036854775808") {
		t.Fatal("int64 decimal boundary drift")
	}
	if IsNFC("e\u0301") {
		t.Fatal("decomposed string must not be NFC")
	}
}
