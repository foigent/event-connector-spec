// Package testkit compares SDK output to immutable conformance-vector
// expectations. It does not map Source records; the existing independent
// runners remain the Source-specific byte authorities.
package testkit

import (
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/foigent/event-connector-spec/sdk/go/canonical"
)

type Report struct {
	ReportVersion string       `json:"report_version"`
	Cases         []ReportCase `json:"cases"`
}

type ReportCase struct {
	CaseID       string `json:"case_id"`
	ResultBase64 string `json:"result_base64"`
	ResultSHA256 string `json:"result_sha256"`
}

type vectorBundle struct {
	CanonicalEnvelopes []canonicalCase `json:"canonical_envelopes"`
	Idempotency        []identityCase  `json:"idempotency"`
}

type canonicalCase struct {
	CaseID         string `json:"case_id"`
	InputPath      string `json:"input_path"`
	CanonicalBytes int    `json:"canonical_bytes"`
	EnvelopeHash   string `json:"envelope_hash"`
}

type identityCase struct {
	CaseID           string  `json:"case_id"`
	ProducerProduct  string  `json:"producer_product"`
	ProducerInstance string  `json:"producer_instance"`
	TenantRef        *string `json:"tenant_ref"`
	OrgRef           string  `json:"org_ref"`
	ProjectRef       string  `json:"project_ref"`
	EventType        string  `json:"event_type"`
	EventID          string  `json:"event_id"`
	IdentityInputHex string  `json:"identity_input_hex"`
	IdempotencyKey   string  `json:"idempotency_key"`
}

func Build(protocolRoot string) (Report, error) {
	report := Report{
		ReportVersion: "foigent.event-connector-sdk-testkit.v1",
		Cases:         make([]ReportCase, 0, 12),
	}
	for _, relative := range []string{
		"vectors/canonical-vector-bundle.v1.json",
		"vectors/litellm-connector-vector-bundle.v1.json",
	} {
		var bundle vectorBundle
		bytes, err := os.ReadFile(filepath.Join(protocolRoot, relative))
		if err != nil {
			return Report{}, err
		}
		if err := json.Unmarshal(bytes, &bundle); err != nil {
			return Report{}, fmt.Errorf("%s: %w", relative, err)
		}
		for _, testCase := range bundle.CanonicalEnvelopes {
			input, err := os.ReadFile(filepath.Join(protocolRoot, testCase.InputPath))
			if err != nil {
				return Report{}, err
			}
			output, err := canonical.Canonicalize(input, canonical.DefaultLimits())
			if err != nil {
				return Report{}, fmt.Errorf("%s: %w", testCase.CaseID, err)
			}
			digest := canonical.SHA256(output)
			if len(output) != testCase.CanonicalBytes || digest != testCase.EnvelopeHash {
				return Report{}, fmt.Errorf("%s: immutable canonical expectation mismatch", testCase.CaseID)
			}
			report.Cases = append(report.Cases, ReportCase{
				CaseID:       "canonical_envelopes/" + testCase.CaseID,
				ResultBase64: base64.StdEncoding.EncodeToString(output),
				ResultSHA256: digest,
			})
		}
		for _, testCase := range bundle.Idempotency {
			output, err := canonical.BuildIdentityInput(canonical.Identity{
				ProducerProduct: testCase.ProducerProduct, ProducerInstance: testCase.ProducerInstance,
				TenantRef: testCase.TenantRef, OrgRef: testCase.OrgRef, ProjectRef: testCase.ProjectRef,
				EventType: testCase.EventType, EventID: testCase.EventID,
			})
			if err != nil {
				return Report{}, fmt.Errorf("%s: %w", testCase.CaseID, err)
			}
			if hex.EncodeToString(output) != testCase.IdentityInputHex || canonical.SHA256(output) != testCase.IdempotencyKey {
				return Report{}, fmt.Errorf("%s: immutable identity expectation mismatch", testCase.CaseID)
			}
			report.Cases = append(report.Cases, ReportCase{
				CaseID:       "idempotency/" + testCase.CaseID,
				ResultBase64: base64.StdEncoding.EncodeToString(output),
				ResultSHA256: canonical.SHA256(output),
			})
		}
	}
	return report, nil
}

func Marshal(report Report) ([]byte, error) {
	bytes, err := json.Marshal(report)
	if err != nil {
		return nil, err
	}
	return append(bytes, '\n'), nil
}
