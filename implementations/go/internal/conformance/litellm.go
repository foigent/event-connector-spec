package conformance

import (
	"bytes"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"
)

const (
	liteLLMBundleSHA256       = "sha256:a090c3e0f093354e8134b38e8e6d3c56016bbb5b2fbf30dcde1b888f081b9c59"
	liteLLMGoldenSHA256       = "sha256:6b76fb2bf90e94f57dff5307ab4852e623be0180e277c96ea62a89ce6b6bab98"
	liteLLMBundleVersion      = "foigent.litellm-connector-vector-bundle.v1"
	liteLLMGoldenVersion      = "foigent.litellm-golden-fixture-bundle.v1"
	liteLLMProtocolVersion    = "1.1.0"
	liteLLMConnectorID        = "foigent.litellm.spend-logs"
	liteLLMImplementationVers = "1.1.0+litellm.1"
)

type liteLLMVectorBundle struct {
	BundleVersion           string                  `json:"bundle_version"`
	ProtocolVersion         string                  `json:"protocol_version"`
	GoldenFixtureBundlePath string                  `json:"golden_fixture_bundle_path"`
	MappingContext          liteLLMMappingContext   `json:"mapping_context"`
	CanonicalEnvelopes      []canonicalEnvelopeCase `json:"canonical_envelopes"`
	Idempotency             []idempotencyCase       `json:"idempotency"`
	CanonicalDecimals       []liteLLMDecimalCase    `json:"canonical_decimals"`
	Checkpoint              []liteLLMCheckpointCase `json:"checkpoint"`
	Replay                  []replayCase            `json:"replay"`
}

type liteLLMMappingContext struct {
	ProducerProduct    string  `json:"producer_product"`
	ProducerInstance   string  `json:"producer_instance"`
	ConnectorID        string  `json:"connector_id"`
	ConnectorVersion   string  `json:"connector_version"`
	TenantRef          *string `json:"tenant_ref"`
	OrgRef             string  `json:"org_ref"`
	ProjectRef         string  `json:"project_ref"`
	AdapterFidelity    string  `json:"adapter_fidelity"`
	PayloadCaptureMode string  `json:"payload_capture_mode"`
	RawPayloadPresent  bool    `json:"raw_payload_present"`
	SourceRevision     string  `json:"source_revision"`
	TimelineComplete   bool    `json:"timeline_complete"`
}

type liteLLMSource struct {
	SchemaVersion    string `json:"schema_version"`
	RequestID        string `json:"request_id"`
	Status           string `json:"status"`
	StartTime        string `json:"start_time"`
	EndTime          string `json:"end_time"`
	Model            string `json:"model"`
	ModelGroup       string `json:"model_group,omitempty"`
	Provider         string `json:"provider,omitempty"`
	PromptTokens     string `json:"prompt_tokens"`
	CompletionTokens string `json:"completion_tokens"`
	TotalTokens      string `json:"total_tokens"`
	ReportedSpend    string `json:"reported_spend"`
	Currency         string `json:"currency"`
	CacheStatus      string `json:"cache_status"`
}

type liteLLMGoldenBundle struct {
	BundleVersion       string         `json:"bundle_version"`
	ProtocolVersion     string         `json:"protocol_version"`
	Connector           string         `json:"connector"`
	Cases               []goldenCase   `json:"cases"`
	NegativeSourceSeeds []negativeSeed `json:"negative_source_seeds"`
}

type liteLLMDecimalCase struct {
	CaseID    string `json:"case_id"`
	Input     string `json:"input"`
	Canonical string `json:"canonical,omitempty"`
	ErrorCode string `json:"error_code,omitempty"`
	Valid     bool   `json:"valid"`
}

type liteLLMCheckpoint struct {
	LastStartTime     string   `json:"last_start_time"`
	BoundaryRequestID []string `json:"boundary_request_ids"`
}

type liteLLMCheckpointRow struct {
	RequestID string `json:"request_id"`
	StartTime string `json:"start_time"`
}

type liteLLMCheckpointCase struct {
	CaseID             string                 `json:"case_id"`
	Previous           *liteLLMCheckpoint     `json:"previous"`
	FinalizedThrough   string                 `json:"finalized_through"`
	Rows               []liteLLMCheckpointRow `json:"rows"`
	SourceTotal        *int                   `json:"source_total,omitempty"`
	ExpectedNext       *liteLLMCheckpoint     `json:"expected_next,omitempty"`
	ErrorCode          string                 `json:"error_code,omitempty"`
	AcceptedRequestIDs []string               `json:"accepted_request_ids"`
	CheckpointAdvances bool                   `json:"checkpoint_advances"`
}

type liteLLMInputs struct {
	root      string
	bundle    liteLLMVectorBundle
	bundleRaw []byte
	golden    liteLLMGoldenBundle
}

func ExecuteLiteLLM(bundlePath string, reportPath string) (Summary, int, error) {
	inputs, err := loadLiteLLMInputs(bundlePath)
	if err != nil {
		return Summary{}, ExitInvalidArtifact, err
	}
	observations := runLiteLLMCases(inputs)
	generated := buildLiteLLMReport(observations)
	if err := validateLiteLLMReport(generated); err != nil {
		return Summary{}, ExitInternalFailure, fmt.Errorf("generated LiteLLM report is invalid: %w", err)
	}
	reportBytes, err := canonicalizeValue(generated)
	if err != nil {
		return Summary{}, ExitInternalFailure, fmt.Errorf("canonicalize LiteLLM report: %w", err)
	}
	if err := writeFileAtomically(reportPath, reportBytes); err != nil {
		return Summary{}, ExitInternalFailure, fmt.Errorf("write LiteLLM report: %w", err)
	}
	summary := Summary{Status: generated.Status, CaseCount: len(generated.Cases)}
	if generated.Status == "fail" {
		return summary, ExitMismatch, nil
	}
	return summary, ExitPass, nil
}

func loadLiteLLMInputs(bundlePath string) (liteLLMInputs, error) {
	absolute, err := filepath.Abs(bundlePath)
	if err != nil {
		return liteLLMInputs{}, err
	}
	bundleRaw, err := os.ReadFile(absolute)
	if err != nil {
		return liteLLMInputs{}, err
	}
	if sha256Reference(bundleRaw) != liteLLMBundleSHA256 {
		return liteLLMInputs{}, errors.New("LiteLLM vector bundle digest mismatch")
	}
	var bundle liteLLMVectorBundle
	if err := decodeStrict(bundleRaw, &bundle); err != nil {
		return liteLLMInputs{}, err
	}
	if bundle.BundleVersion != liteLLMBundleVersion ||
		bundle.ProtocolVersion != liteLLMProtocolVersion ||
		bundle.MappingContext.ConnectorID != liteLLMConnectorID {
		return liteLLMInputs{}, errors.New("LiteLLM vector bundle identity mismatch")
	}
	root := filepath.Clean(filepath.Join(filepath.Dir(absolute), ".."))
	goldenPath, err := resolveWithin(root, bundle.GoldenFixtureBundlePath)
	if err != nil {
		return liteLLMInputs{}, err
	}
	goldenRaw, err := os.ReadFile(goldenPath)
	if err != nil {
		return liteLLMInputs{}, err
	}
	if sha256Reference(goldenRaw) != liteLLMGoldenSHA256 {
		return liteLLMInputs{}, errors.New("LiteLLM Golden bundle digest mismatch")
	}
	var golden liteLLMGoldenBundle
	if err := decodeStrict(goldenRaw, &golden); err != nil {
		return liteLLMInputs{}, err
	}
	if golden.BundleVersion != liteLLMGoldenVersion ||
		golden.ProtocolVersion != liteLLMProtocolVersion ||
		golden.Connector != liteLLMConnectorID {
		return liteLLMInputs{}, errors.New("LiteLLM Golden bundle identity mismatch")
	}
	return liteLLMInputs{root: root, bundle: bundle, bundleRaw: bundleRaw, golden: golden}, nil
}

func runLiteLLMCases(inputs liteLLMInputs) []caseObservation {
	observations := make([]caseObservation, 0, 19)
	observations = append(observations, runLiteLLMCanonicalCases(inputs)...)
	observations = append(observations, runLiteLLMIdentityCases(inputs.bundle)...)
	observations = append(observations, runLiteLLMDecimalCases(inputs.bundle)...)
	observations = append(observations, runLiteLLMCheckpointCases(inputs.bundle)...)
	observations = append(observations, runLiteLLMReplayCases(inputs.bundle)...)
	observations = append(observations, runLiteLLMNegativeCases(inputs)...)
	return observations
}

func runLiteLLMCanonicalCases(inputs liteLLMInputs) []caseObservation {
	goldenByID := make(map[string]goldenCase, len(inputs.golden.Cases))
	for _, item := range inputs.golden.Cases {
		goldenByID[item.CaseID] = item
	}
	result := make([]caseObservation, 0, len(inputs.bundle.CanonicalEnvelopes))
	for _, vector := range inputs.bundle.CanonicalEnvelopes {
		observation := caseObservation{
			id:      "canonical_envelopes/" + vector.CaseID,
			classes: []string{"canonical_envelope", "capture_gap_derivation"},
			kind:    "bytes",
		}
		golden, ok := goldenByID[vector.CaseID]
		addFailure(&observation.failures, ok, "missing Golden case")
		if !ok {
			result = append(result, observation)
			continue
		}
		sourceBytes, err := readCandidateArtifact(inputs.root, vector.SourceInputPath)
		if err != nil {
			observation.failures = append(observation.failures, err.Error())
			result = append(result, observation)
			continue
		}
		addFailure(&observation.failures, sha256Reference(sourceBytes) == golden.SourceFixture.SHA256, "Source fixture digest mismatch")
		mapped, source, err := mapLiteLLMSource(sourceBytes, inputs.bundle.MappingContext)
		if err != nil {
			observation.failures = append(observation.failures, err.Error())
			result = append(result, observation)
			continue
		}
		canonical, err := canonicalizeValue(mapped)
		if err != nil {
			observation.failures = append(observation.failures, err.Error())
			result = append(result, observation)
			continue
		}
		observation.result = canonical
		expectedRaw, err := readCandidateArtifact(inputs.root, vector.InputPath)
		if err != nil {
			observation.failures = append(observation.failures, err.Error())
			result = append(result, observation)
			continue
		}
		expected, err := canonicalizeJSON(expectedRaw)
		if err != nil {
			observation.failures = append(observation.failures, err.Error())
			result = append(result, observation)
			continue
		}
		addFailure(&observation.failures, bytes.Equal(canonical, expected), "mapped Envelope differs from Golden bytes")
		addFailure(&observation.failures, len(canonical) == vector.CanonicalBytes, "canonical byte length mismatch")
		addFailure(&observation.failures, sha256Reference(canonical) == vector.EnvelopeHash, "Envelope hash mismatch")
		addFailure(&observation.failures, source.Status == golden.Expected.TerminalStatus, "terminal status mismatch")
		payload := mapped["payload"].(map[string]any)
		gaps := payload["capture_gaps"].([]any)
		addFailure(&observation.failures, len(gaps) == golden.Expected.CaptureGapCount, "capture-gap count mismatch")
		result = append(result, observation)
	}
	return result
}

func runLiteLLMIdentityCases(bundle liteLLMVectorBundle) []caseObservation {
	result := make([]caseObservation, 0, len(bundle.Idempotency))
	for _, vector := range bundle.Idempotency {
		observation := caseObservation{
			id:      "idempotency/" + vector.CaseID,
			classes: []string{"scoped_idempotency"},
			kind:    "bytes",
		}
		input, err := buildIdentityInput(
			vector.ProducerProduct,
			vector.ProducerInstance,
			vector.TenantRef,
			vector.OrgRef,
			vector.ProjectRef,
			vector.EventType,
			vector.EventID,
		)
		if err != nil {
			observation.failures = append(observation.failures, err.Error())
		} else {
			observation.result = input
			addFailure(&observation.failures, hex.EncodeToString(input) == vector.IdentityInputHex, "identity input mismatch")
			addFailure(&observation.failures, sha256Reference(input) == vector.IdempotencyKey, "idempotency key mismatch")
		}
		result = append(result, observation)
	}
	return result
}

func runLiteLLMDecimalCases(bundle liteLLMVectorBundle) []caseObservation {
	result := make([]caseObservation, 0, len(bundle.CanonicalDecimals))
	for _, vector := range bundle.CanonicalDecimals {
		canonical, code, valid := canonicalReportedDecimal(vector.Input)
		observed := map[string]any{"valid": valid}
		if valid {
			observed["canonical"] = canonical
		} else {
			observed["error_code"] = code
		}
		bytes, err := canonicalizeValue(observed)
		observation := caseObservation{
			id:      "canonical_decimals/" + vector.CaseID,
			classes: []string{"canonical_decimal"},
			kind:    "classification",
			result:  bytes,
		}
		if err != nil {
			observation.failures = append(observation.failures, err.Error())
		}
		addFailure(&observation.failures, valid == vector.Valid, "decimal validity mismatch")
		if valid {
			addFailure(&observation.failures, canonical == vector.Canonical, "canonical decimal mismatch")
		} else {
			addFailure(&observation.failures, code == vector.ErrorCode, "decimal error code mismatch")
		}
		result = append(result, observation)
	}
	return result
}

func runLiteLLMCheckpointCases(bundle liteLLMVectorBundle) []caseObservation {
	result := make([]caseObservation, 0, len(bundle.Checkpoint))
	for _, vector := range bundle.Checkpoint {
		observed, failures := observeLiteLLMCheckpoint(vector)
		bytes, err := canonicalizeValue(observed)
		observation := caseObservation{
			id:       "checkpoint/" + vector.CaseID,
			classes:  []string{"bounded_complete_window", "checkpoint_commit", "same_timestamp_boundary"},
			kind:     "state_transition",
			result:   bytes,
			failures: failures,
		}
		if err != nil {
			observation.failures = append(observation.failures, err.Error())
		}
		result = append(result, observation)
	}
	return result
}

func runLiteLLMReplayCases(bundle liteLLMVectorBundle) []caseObservation {
	result := make([]caseObservation, 0, len(bundle.Replay))
	for _, vector := range bundle.Replay {
		observation := caseObservation{id: "replay/" + vector.CaseID, kind: "state_transition"}
		var observed map[string]any
		switch vector.CaseID {
		case "same-identity-same-hash":
			observation.classes = []string{"checkpoint_commit", "duplicate_noop"}
			state := newReplayState()
			first := state.processPage([]replayInput{{Identity: "event-a", EnvelopeHash: "hash-a"}})
			replay := state.processPage([]replayInput{{Identity: "event-a", EnvelopeHash: "hash-a"}})
			observed = map[string]any{
				"first_outcome":       first.Outcomes[0],
				"replay_outcome":      replay.Outcomes[0],
				"checkpoint_advances": replay.CheckpointAdvances,
			}
		case "same-identity-different-hash":
			observation.classes = []string{"checkpoint_commit", "content_conflict"}
			state := newReplayState()
			first := state.processPage([]replayInput{{Identity: "event-a", EnvelopeHash: "hash-a"}})
			replay := state.processPage([]replayInput{{Identity: "event-a", EnvelopeHash: "hash-b"}})
			observed = map[string]any{
				"first_outcome":       first.Outcomes[0],
				"replay_outcome":      replay.Outcomes[0],
				"checkpoint_advances": replay.CheckpointAdvances,
			}
		case "partial-batch-failure":
			observation.classes = []string{"checkpoint_commit", "partial_page_replay"}
			state := newReplayState()
			first := state.processPage([]replayInput{
				{Identity: "event-a", EnvelopeHash: "hash-a"},
				{Identity: "event-b", EnvelopeHash: "hash-b", InjectedError: "retryable_error"},
			})
			replay := state.processPage([]replayInput{{Identity: "event-a", EnvelopeHash: "hash-a"}})
			observed = map[string]any{
				"first_item":              first.Outcomes[0],
				"second_item":             first.Outcomes[1],
				"checkpoint_advances":     first.CheckpointAdvances,
				"next_attempt_first_item": replay.Outcomes[0],
			}
		default:
			observation.classes = []string{"checkpoint_commit"}
			observation.failures = append(observation.failures, "unsupported replay case")
			observed = map[string]any{}
		}
		expected, err := replayExpectedMap(vector)
		if err != nil {
			observation.failures = append(observation.failures, err.Error())
		}
		addFailure(&observation.failures, mapsEqual(observed, expected), "replay transition mismatch")
		observation.result, err = canonicalizeValue(observed)
		if err != nil {
			observation.failures = append(observation.failures, err.Error())
		}
		result = append(result, observation)
	}
	return result
}

func runLiteLLMNegativeCases(inputs liteLLMInputs) []caseObservation {
	result := make([]caseObservation, 0, len(inputs.golden.NegativeSourceSeeds))
	for _, vector := range inputs.golden.NegativeSourceSeeds {
		observation := caseObservation{
			id:      "negative_source_seeds/" + vector.CaseID,
			classes: []string{"privacy_rejection"},
			kind:    "error",
		}
		sourceBytes, err := readCandidateArtifact(inputs.root, vector.ReleasePath)
		if err != nil {
			observation.failures = append(observation.failures, err.Error())
		} else {
			_, _, err = mapLiteLLMSource(sourceBytes, inputs.bundle.MappingContext)
			var mappingError *sourceMappingError
			addFailure(&observation.failures, errors.As(err, &mappingError) && mappingError.code == "prohibited_raw_field", "privacy fixture was not rejected")
		}
		observation.result, err = canonicalizeValue(vector.ExpectedError)
		if err != nil {
			observation.failures = append(observation.failures, err.Error())
		}
		result = append(result, observation)
	}
	return result
}

func mapLiteLLMSource(sourceBytes []byte, context liteLLMMappingContext) (map[string]any, liteLLMSource, error) {
	parsed, err := parseStrictJSON(sourceBytes)
	if err != nil {
		return nil, liteLLMSource{}, err
	}
	canonicalSource, err := canonicalizeJSON(sourceBytes)
	if err != nil {
		return nil, liteLLMSource{}, err
	}
	if field, found := findLiteLLMProhibitedField(parsed); found {
		return nil, liteLLMSource{}, &sourceMappingError{
			code: "prohibited_raw_field",
			err:  fmt.Errorf("LiteLLM Source contains prohibited field %q", field),
		}
	}
	var source liteLLMSource
	if err := decodeStrict(sourceBytes, &source); err != nil {
		return nil, liteLLMSource{}, err
	}
	if err := validateLiteLLMSource(source); err != nil {
		return nil, liteLLMSource{}, err
	}
	if context.ProducerProduct != "litellm" ||
		context.ConnectorID != liteLLMConnectorID ||
		context.ConnectorVersion != "1.0.0" ||
		context.AdapterFidelity != "F1" ||
		context.PayloadCaptureMode != "metadata_only" ||
		context.RawPayloadPresent ||
		context.SourceRevision != "1" ||
		!context.TimelineComplete {
		return nil, liteLLMSource{}, errors.New("invalid LiteLLM mapping context")
	}
	identityInput, err := buildIdentityInput(
		context.ProducerProduct,
		context.ProducerInstance,
		context.TenantRef,
		context.OrgRef,
		context.ProjectRef,
		"model.request.completed",
		source.RequestID,
	)
	if err != nil {
		return nil, liteLLMSource{}, err
	}
	usage := map[string]any{
		"model":             source.Model,
		"prompt_tokens":     source.PromptTokens,
		"completion_tokens": source.CompletionTokens,
		"total_tokens":      source.TotalTokens,
		"source":            "litellm_spend_log",
		"authority":         "source_reported",
		"finality":          "finalized_after_delay",
		"contract_version":  "foigent.litellm.spend-log.v1",
		"cache_status":      source.CacheStatus,
	}
	if source.ModelGroup != "" {
		usage["model_group"] = source.ModelGroup
	}
	if source.Provider != "" {
		usage["provider"] = source.Provider
	}
	gapClaims := []string{
		"billing_authority",
		"business_outcome",
		"downstream_side_effects",
		"routing_decision",
	}
	gaps := make([]any, 0, len(gapClaims))
	for _, claim := range gapClaims {
		gaps = append(gaps, map[string]any{
			"gap_id":          source.RequestID + ":gap:" + claim,
			"parent_event_id": source.RequestID,
			"scope": map[string]any{
				"org_ref":     context.OrgRef,
				"project_ref": context.ProjectRef,
			},
			"correlation":          map[string]any{"request_ref": source.RequestID},
			"affected_claim":       claim,
			"gap_type":             "not_available_from_source",
			"reason_code":          "not_exposed_by_litellm_spend_logs_v1",
			"severity":             "warning",
			"observed_at":          source.EndTime,
			"payload_capture_mode": "none",
			"field_provenance": map[string]any{
				"affected_claim":       "declared",
				"reason_code":          "declared",
				"gap_id":               "derived",
				"parent_event_id":      "derived",
				"scope":                "derived",
				"correlation":          "derived",
				"observed_at":          "derived",
				"gap_type":             "declared",
				"severity":             "declared",
				"payload_capture_mode": "declared",
			},
		})
	}
	envelope := map[string]any{
		"spec_version":   "foigent.event-envelope.v1",
		"event_id":       source.RequestID,
		"event_type":     "model.request.completed",
		"schema_ref":     "foigent://events/model/request-completed/v2",
		"schema_version": "2",
		"producer": map[string]any{
			"product":           context.ProducerProduct,
			"instance":          context.ProducerInstance,
			"connector_id":      context.ConnectorID,
			"connector_version": context.ConnectorVersion,
		},
		"scope": map[string]any{
			"org_ref":     context.OrgRef,
			"project_ref": context.ProjectRef,
		},
		"subject": map[string]any{"type": "request", "ref": source.RequestID},
		"actor":   map[string]any{"type": "system"},
		"time": map[string]any{
			"occurred_at": source.EndTime,
			"terminal_at": source.EndTime,
		},
		"correlation": map[string]any{"request_ref": source.RequestID},
		"identity": map[string]any{
			"idempotency_key": sha256Reference(identityInput),
			"source_revision": context.SourceRevision,
		},
		"integrity": map[string]any{"source_hash": sha256Reference(canonicalSource)},
		"data_policy": map[string]any{
			"payload_capture_mode": context.PayloadCaptureMode,
			"raw_payload_present":  context.RawPayloadPresent,
		},
		"provenance": map[string]any{
			"adapter_fidelity": context.AdapterFidelity,
			"field_groups": map[string]any{
				"actor":                     "declared",
				"correlation":               "direct",
				"data_policy":               "declared",
				"identity":                  "derived",
				"payload.capture_gaps":      "declared",
				"payload.reported_money":    "direct",
				"payload.terminal":          "direct",
				"payload.timeline_complete": "declared",
				"payload.usage":             "direct",
				"scope":                     "declared",
				"subject":                   "derived",
				"time.occurred_at":          "derived",
				"time.terminal_at":          "direct",
			},
		},
		"payload": map[string]any{
			"terminal": map[string]any{"status": source.Status},
			"usage":    usage,
			"reported_money": map[string]any{
				"schema":    "decimal-currency.v1",
				"currency":  source.Currency,
				"amount":    source.ReportedSpend,
				"source":    "litellm_spend_log",
				"authority": "source_reported",
			},
			"timeline_complete": true,
			"capture_gaps":      gaps,
		},
	}
	return envelope, source, nil
}

var liteLLMProhibitedFields = map[string]struct{}{
	"api_key":              {},
	"end_user":             {},
	"messages":             {},
	"metadata":             {},
	"proxy_server_request": {},
	"requester_ip_address": {},
	"response":             {},
	"user":                 {},
}

func findLiteLLMProhibitedField(value jsonValue) (string, bool) {
	switch value.kind {
	case jsonObject:
		for _, member := range value.object {
			if _, prohibited := liteLLMProhibitedFields[member.key]; prohibited {
				return member.key, true
			}
			if field, found := findLiteLLMProhibitedField(member.value); found {
				return field, true
			}
		}
	case jsonArray:
		for _, item := range value.array {
			if field, found := findLiteLLMProhibitedField(item); found {
				return field, true
			}
		}
	}
	return "", false
}

func validateLiteLLMSource(source liteLLMSource) error {
	if source.SchemaVersion != "foigent.litellm.spend-log.v1" ||
		(source.Status != "succeeded" && source.Status != "failed") ||
		source.Currency != "USD" ||
		(source.CacheStatus != "hit" &&
			source.CacheStatus != "miss" &&
			source.CacheStatus != "unknown") {
		return errors.New("invalid LiteLLM Source controlled field")
	}
	if !validOpaqueSourceString(source.RequestID, 1, 128, true) ||
		!validOpaqueSourceString(source.Model, 1, 200, false) ||
		(source.ModelGroup != "" && !validOpaqueSourceString(source.ModelGroup, 1, 200, false)) ||
		(source.Provider != "" && !validOpaqueSourceString(source.Provider, 1, 100, false)) {
		return errors.New("invalid LiteLLM Source opaque field")
	}
	const layout = "2006-01-02T15:04:05.000000Z"
	start, err := time.Parse(layout, source.StartTime)
	if err != nil {
		return errors.New("invalid LiteLLM Source start_time")
	}
	end, err := time.Parse(layout, source.EndTime)
	if err != nil || end.Before(start) {
		return errors.New("invalid LiteLLM Source end_time")
	}
	prompt, err := strconv.ParseInt(source.PromptTokens, 10, 64)
	if err != nil || prompt < 0 {
		return errors.New("invalid LiteLLM Source prompt_tokens")
	}
	completion, err := strconv.ParseInt(source.CompletionTokens, 10, 64)
	if err != nil || completion < 0 {
		return errors.New("invalid LiteLLM Source completion_tokens")
	}
	total, err := strconv.ParseInt(source.TotalTokens, 10, 64)
	if err != nil || total < 0 || prompt > total || completion > total-prompt ||
		prompt+completion != total {
		return errors.New("inconsistent LiteLLM Source token counters")
	}
	canonical, _, valid := canonicalReportedDecimal(source.ReportedSpend)
	if !valid || canonical != source.ReportedSpend {
		return errors.New("LiteLLM Source reported_spend is not canonical")
	}
	return nil
}

func canonicalReportedDecimal(input string) (string, string, bool) {
	if input == "" || len(input) > 1024 {
		return "", "invalid_reported_spend", false
	}
	if strings.HasPrefix(input, "-") {
		return "", "negative_reported_spend", false
	}
	mantissa := input
	exponent := int64(0)
	if position := strings.IndexAny(mantissa, "eE"); position >= 0 {
		exponentRaw := mantissa[position+1:]
		mantissa = mantissa[:position]
		parsed, err := strconv.ParseInt(exponentRaw, 10, 32)
		if err != nil {
			return "", "invalid_reported_spend", false
		}
		exponent = parsed
	}
	if mantissa == "" || strings.Count(mantissa, ".") > 1 {
		return "", "invalid_reported_spend", false
	}
	parts := strings.SplitN(mantissa, ".", 2)
	if parts[0] == "" || !allDigits(parts[0]) ||
		(len(parts) == 2 && (parts[1] == "" || !allDigits(parts[1]))) {
		return "", "invalid_reported_spend", false
	}
	fractionLength := int64(0)
	digits := parts[0]
	if len(parts) == 2 {
		fractionLength = int64(len(parts[1]))
		digits += parts[1]
	}
	integer := new(big.Int)
	if _, ok := integer.SetString(digits, 10); !ok {
		return "", "invalid_reported_spend", false
	}
	if integer.Sign() == 0 {
		return "0", "", true
	}
	scale := exponent - fractionLength
	var rendered string
	if scale >= 0 {
		if scale > 80 {
			return "", "reported_spend_too_large", false
		}
		rendered = integer.String() + strings.Repeat("0", int(scale))
	} else {
		fractionDigits := int(-scale)
		digits = integer.String()
		if fractionDigits >= len(digits) {
			rendered = "0." + strings.Repeat("0", fractionDigits-len(digits)) + digits
		} else {
			position := len(digits) - fractionDigits
			rendered = digits[:position] + "." + digits[position:]
		}
		rendered = strings.TrimRight(rendered, "0")
		rendered = strings.TrimRight(rendered, ".")
	}
	if len(rendered) > 80 {
		return "", "reported_spend_too_large", false
	}
	return rendered, "", true
}

func allDigits(value string) bool {
	for _, r := range value {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

func observeLiteLLMCheckpoint(vector liteLLMCheckpointCase) (map[string]any, []string) {
	failures := []string{}
	if vector.SourceTotal != nil {
		unique := make(map[string]struct{}, len(vector.Rows))
		for _, row := range vector.Rows {
			unique[row.RequestID] = struct{}{}
		}
		if len(unique) != *vector.SourceTotal {
			observed := map[string]any{
				"accepted_request_ids": []any{},
				"checkpoint_advances":  false,
				"error_code":           "incomplete_paginated_snapshot",
			}
			addFailure(&failures, vector.ErrorCode == "incomplete_paginated_snapshot", "checkpoint error mismatch")
			return observed, failures
		}
	}
	if vector.Previous == nil {
		next := liteLLMCheckpoint{
			LastStartTime:     vector.FinalizedThrough,
			BoundaryRequestID: []string{},
		}
		observed := map[string]any{
			"accepted_request_ids": []any{},
			"checkpoint_advances":  true,
			"next_checkpoint":      checkpointMap(next),
		}
		addFailure(&failures, vector.ExpectedNext != nil && checkpointsEqual(next, *vector.ExpectedNext), "activation checkpoint mismatch")
		return observed, failures
	}
	previous := *vector.Previous
	boundary := make(map[string]struct{}, len(previous.BoundaryRequestID))
	for _, id := range previous.BoundaryRequestID {
		boundary[id] = struct{}{}
	}
	rows := append([]liteLLMCheckpointRow(nil), vector.Rows...)
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].StartTime != rows[j].StartTime {
			return rows[i].StartTime < rows[j].StartTime
		}
		return bytes.Compare([]byte(rows[i].RequestID), []byte(rows[j].RequestID)) < 0
	})
	acceptedRows := make([]liteLLMCheckpointRow, 0, len(rows))
	for _, row := range rows {
		if row.StartTime > previous.LastStartTime {
			acceptedRows = append(acceptedRows, row)
		} else if row.StartTime == previous.LastStartTime {
			if _, seen := boundary[row.RequestID]; !seen {
				acceptedRows = append(acceptedRows, row)
			}
		}
	}
	acceptedIDs := make([]string, 0, len(acceptedRows))
	for _, row := range acceptedRows {
		acceptedIDs = append(acceptedIDs, row.RequestID)
	}
	next := previous
	advances := len(acceptedRows) > 0
	if advances {
		maxTime := acceptedRows[len(acceptedRows)-1].StartTime
		ids := make([]string, 0)
		if maxTime == previous.LastStartTime {
			ids = append(ids, previous.BoundaryRequestID...)
		}
		for _, row := range acceptedRows {
			if row.StartTime == maxTime {
				ids = append(ids, row.RequestID)
			}
		}
		sort.Strings(ids)
		ids = uniqueStrings(ids)
		next = liteLLMCheckpoint{LastStartTime: maxTime, BoundaryRequestID: ids}
	}
	observedAccepted := make([]any, len(acceptedIDs))
	for index, id := range acceptedIDs {
		observedAccepted[index] = id
	}
	observed := map[string]any{
		"accepted_request_ids": observedAccepted,
		"checkpoint_advances":  advances,
		"next_checkpoint":      checkpointMap(next),
	}
	addFailure(&failures, advances == vector.CheckpointAdvances, "checkpoint advance mismatch")
	addFailure(&failures, strings.Join(acceptedIDs, "\n") == strings.Join(vector.AcceptedRequestIDs, "\n"), "accepted request IDs mismatch")
	addFailure(&failures, vector.ExpectedNext != nil && checkpointsEqual(next, *vector.ExpectedNext), "next checkpoint mismatch")
	return observed, failures
}

func checkpointMap(value liteLLMCheckpoint) map[string]any {
	ids := make([]any, len(value.BoundaryRequestID))
	for index, id := range value.BoundaryRequestID {
		ids[index] = id
	}
	return map[string]any{
		"last_start_time":      value.LastStartTime,
		"boundary_request_ids": ids,
	}
}

func checkpointsEqual(left, right liteLLMCheckpoint) bool {
	return left.LastStartTime == right.LastStartTime &&
		strings.Join(left.BoundaryRequestID, "\n") == strings.Join(right.BoundaryRequestID, "\n")
}

func uniqueStrings(values []string) []string {
	if len(values) == 0 {
		return values
	}
	result := values[:1]
	for _, value := range values[1:] {
		if value != result[len(result)-1] {
			result = append(result, value)
		}
	}
	return result
}

func replayExpectedMap(vector replayCase) (map[string]any, error) {
	bytes, err := canonicalizeValue(vector)
	if err != nil {
		return nil, err
	}
	var raw map[string]any
	if err := decodeStrict(bytes, &raw); err != nil {
		return nil, err
	}
	delete(raw, "case_id")
	return raw, nil
}

func mapsEqual(left, right map[string]any) bool {
	leftBytes, leftErr := canonicalizeValue(left)
	rightBytes, rightErr := canonicalizeValue(right)
	return leftErr == nil && rightErr == nil && bytes.Equal(leftBytes, rightBytes)
}

func buildLiteLLMReport(observations []caseObservation) report {
	cases := make([]reportCase, 0, len(observations))
	status := "pass"
	for _, observation := range observations {
		caseStatus := "pass"
		failure := ""
		if len(observation.failures) > 0 {
			caseStatus = "fail"
			status = "fail"
			failure = boundedFailureMessage(observation.failures)
		}
		cases = append(cases, reportCase{
			CaseID:         observation.id,
			CaseClasses:    append([]string(nil), observation.classes...),
			Status:         caseStatus,
			ResultKind:     observation.kind,
			ResultBase64:   base64.StdEncoding.EncodeToString(observation.result),
			ResultSHA256:   sha256Reference(observation.result),
			FailureMessage: failure,
		})
	}
	return report{
		ReportVersion:         reportVersion,
		Implementation:        implementationName,
		ImplementationVersion: liteLLMImplementationVers,
		BundleSHA256:          liteLLMBundleSHA256,
		Status:                status,
		Cases:                 cases,
	}
}

func validateLiteLLMReport(generated report) error {
	if generated.ReportVersion != reportVersion ||
		generated.Implementation != implementationName ||
		generated.BundleSHA256 != liteLLMBundleSHA256 ||
		(generated.Status != "pass" && generated.Status != "fail") ||
		len(generated.Cases) != 19 {
		return errors.New("invalid LiteLLM report header or case count")
	}
	ids := make(map[string]struct{}, len(generated.Cases))
	anyFailure := false
	for _, item := range generated.Cases {
		if item.CaseID == "" || len(item.CaseID) > 160 {
			return errors.New("invalid LiteLLM report case ID")
		}
		if _, exists := ids[item.CaseID]; exists {
			return errors.New("duplicate LiteLLM report case ID")
		}
		ids[item.CaseID] = struct{}{}
		if !sort.StringsAreSorted(item.CaseClasses) || hasDuplicateStrings(item.CaseClasses) {
			return errors.New("LiteLLM report classes are not sorted unique")
		}
		anyFailure = anyFailure || item.Status == "fail"
	}
	if anyFailure != (generated.Status == "fail") {
		return errors.New("LiteLLM report status mismatch")
	}
	return nil
}
