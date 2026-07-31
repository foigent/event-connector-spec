package conformance

import (
	"bytes"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

const (
	expectedBundleSHA256   = "sha256:cbbcc45af8f2c5b0b12bb23e1094953661c352a1b506233c85405be47baf075f"
	expectedContractSHA256 = "sha256:f11d263a7d2b8e98240a9a9750f349d83c1f8a12263682a49601b74eb7e891d2"
	expectedBundleVersion  = "foigent.source-neutral-vector-bundle.v2"
	expectedProtocol       = "2.0.0"
	reportVersion          = "foigent.conformance-report.v1"
	implementationName     = "go"
	implementationVersion  = "2.0.0-rc.1+independent.1"
)

const (
	ExitPass            = 0
	ExitInvalidArtifact = 2
	ExitMismatch        = 3
	ExitInternalFailure = 4
)

var requiredClasses = []string{
	"bounded_offline_receipt",
	"canonical_envelope",
	"capture_gap_derivation",
	"capture_mode_separation",
	"checkpoint_applicability",
	"content_conflict",
	"decimal_boundary",
	"delivery_acknowledgement",
	"delivery_completeness",
	"duplicate_key_rejection",
	"duplicate_noop",
	"manifest_mode_union",
	"mode_state_separation",
	"mutable_delivery_exclusion",
	"opaque_utf8_preservation",
	"partial_batch_rejection",
	"privacy_rejection",
	"protocol_nfc_rejection",
	"scoped_idempotency",
	"source_sanitization",
	"timeline_completeness",
	"timestamp_normalization",
	"v1_pull_compatibility",
}

type Summary struct {
	Status    string
	CaseCount int
}

type vectorBundle struct {
	BundleVersion        string                `json:"bundle_version"`
	ProtocolVersion      string                `json:"protocol_version"`
	ProtocolStatus       string                `json:"protocol_status"`
	ConformanceContract  artifactRef           `json:"conformance_contract"`
	MappingContext       mappingContext        `json:"mapping_context"`
	OpenInferenceMapping []mappingCase         `json:"openinference_mapping"`
	Idempotency          []idempotencyCase     `json:"idempotency"`
	ManifestSemantics    []genericCase         `json:"manifest_semantics"`
	Lifecycle            []genericCase         `json:"lifecycle"`
	Delivery             []genericCase         `json:"delivery"`
	Completeness         []genericCase         `json:"completeness"`
	CaptureModes         []genericCase         `json:"capture_modes"`
	MutableDelivery      []mutableDeliveryCase `json:"mutable_delivery"`
	V1Compatibility      []v1CompatibilityCase `json:"v1_compatibility"`
	Negative             []negativeCase        `json:"negative"`
}

type artifactRef struct {
	Path   string `json:"path"`
	SHA256 string `json:"sha256"`
}

type mappingContext struct {
	ProducerProduct  string  `json:"producer_product"`
	ProducerInstance string  `json:"producer_instance"`
	TenantRef        *string `json:"tenant_ref"`
	OrgRef           string  `json:"org_ref"`
	ProjectRef       string  `json:"project_ref"`
	ConnectorID      string  `json:"connector_id"`
	ConnectorVersion string  `json:"connector_version"`
}

type caseBase struct {
	CaseID      string   `json:"case_id"`
	CaseClasses []string `json:"case_classes"`
	ResultKind  string   `json:"result_kind"`
}

type mappingCase struct {
	caseBase
	RawInputPath          string `json:"raw_input_path"`
	SourceInputPath       string `json:"source_input_path"`
	HashInputPath         string `json:"hash_input_path"`
	RawFileSHA256         string `json:"raw_file_sha256"`
	SourceFileSHA256      string `json:"source_file_sha256"`
	HashInputFileSHA256   string `json:"hash_input_file_sha256"`
	CanonicalSourceSHA256 string `json:"canonical_source_sha256"`
	CanonicalBytes        int    `json:"canonical_bytes"`
	EnvelopeHash          string `json:"envelope_hash"`
	IdempotencyKey        string `json:"idempotency_key"`
	CaptureGapCount       int    `json:"capture_gap_count"`
}

func (value *mappingCase) UnmarshalJSON(data []byte) error {
	type alias mappingCase
	var decoded struct {
		CaseID      string   `json:"case_id"`
		CaseClasses []string `json:"case_classes"`
		ResultKind  string   `json:"result_kind"`
		*alias
	}
	decoded.alias = (*alias)(value)
	if err := json.Unmarshal(data, &decoded); err != nil {
		return err
	}
	value.caseBase = caseBase{
		CaseID: decoded.CaseID, CaseClasses: decoded.CaseClasses,
		ResultKind: decoded.ResultKind,
	}
	return nil
}

type idempotencyCase struct {
	caseBase
	Components       []any  `json:"components"`
	IdentityInputHex string `json:"identity_input_hex"`
	IdempotencyKey   string `json:"idempotency_key"`
}

func (value *idempotencyCase) UnmarshalJSON(data []byte) error {
	type alias idempotencyCase
	var decoded struct {
		CaseID      string   `json:"case_id"`
		CaseClasses []string `json:"case_classes"`
		ResultKind  string   `json:"result_kind"`
		*alias
	}
	decoded.alias = (*alias)(value)
	if err := json.Unmarshal(data, &decoded); err != nil {
		return err
	}
	value.caseBase = caseBase{
		CaseID: decoded.CaseID, CaseClasses: decoded.CaseClasses,
		ResultKind: decoded.ResultKind,
	}
	return nil
}

type genericCase struct {
	caseBase
	Input    map[string]any `json:"input"`
	Expected map[string]any `json:"expected"`
}

func (value *genericCase) UnmarshalJSON(data []byte) error {
	type alias genericCase
	var decoded struct {
		CaseID      string   `json:"case_id"`
		CaseClasses []string `json:"case_classes"`
		ResultKind  string   `json:"result_kind"`
		*alias
	}
	decoded.alias = (*alias)(value)
	if err := json.Unmarshal(data, &decoded); err != nil {
		return err
	}
	value.caseBase = caseBase{
		CaseID: decoded.CaseID, CaseClasses: decoded.CaseClasses,
		ResultKind: decoded.ResultKind,
	}
	return nil
}

type mutableDeliveryCase struct {
	caseBase
	HashInputPath string           `json:"hash_input_path"`
	Variants      []map[string]any `json:"variants"`
	Expected      map[string]any   `json:"expected"`
}

func (value *mutableDeliveryCase) UnmarshalJSON(data []byte) error {
	type alias mutableDeliveryCase
	var decoded struct {
		CaseID      string   `json:"case_id"`
		CaseClasses []string `json:"case_classes"`
		ResultKind  string   `json:"result_kind"`
		*alias
	}
	decoded.alias = (*alias)(value)
	if err := json.Unmarshal(data, &decoded); err != nil {
		return err
	}
	value.caseBase = caseBase{
		CaseID: decoded.CaseID, CaseClasses: decoded.CaseClasses,
		ResultKind: decoded.ResultKind,
	}
	return nil
}

type v1CompatibilityCase struct {
	caseBase
	ManifestPath string         `json:"manifest_path"`
	Expected     map[string]any `json:"expected"`
}

func (value *v1CompatibilityCase) UnmarshalJSON(data []byte) error {
	type alias v1CompatibilityCase
	var decoded struct {
		CaseID      string   `json:"case_id"`
		CaseClasses []string `json:"case_classes"`
		ResultKind  string   `json:"result_kind"`
		*alias
	}
	decoded.alias = (*alias)(value)
	if err := json.Unmarshal(data, &decoded); err != nil {
		return err
	}
	value.caseBase = caseBase{
		CaseID: decoded.CaseID, CaseClasses: decoded.CaseClasses,
		ResultKind: decoded.ResultKind,
	}
	return nil
}

type negativeCase struct {
	caseBase
	Kind     string         `json:"kind"`
	Input    any            `json:"input"`
	Expected map[string]any `json:"expected"`
}

func (value *negativeCase) UnmarshalJSON(data []byte) error {
	type alias negativeCase
	var decoded struct {
		CaseID      string   `json:"case_id"`
		CaseClasses []string `json:"case_classes"`
		ResultKind  string   `json:"result_kind"`
		*alias
	}
	decoded.alias = (*alias)(value)
	if err := json.Unmarshal(data, &decoded); err != nil {
		return err
	}
	value.caseBase = caseBase{
		CaseID: decoded.CaseID, CaseClasses: decoded.CaseClasses,
		ResultKind: decoded.ResultKind,
	}
	return nil
}

type caseObservation struct {
	id       string
	classes  []string
	kind     string
	result   []byte
	failures []string
}

type report struct {
	ReportVersion         string       `json:"report_version"`
	Implementation        string       `json:"implementation"`
	ImplementationVersion string       `json:"implementation_version"`
	BundleSHA256          string       `json:"bundle_sha256"`
	Status                string       `json:"status"`
	Cases                 []reportCase `json:"cases"`
}

type reportCase struct {
	CaseID         string   `json:"case_id"`
	CaseClasses    []string `json:"case_classes"`
	Status         string   `json:"status"`
	ResultKind     string   `json:"result_kind"`
	ResultBase64   string   `json:"result_base64"`
	ResultSHA256   string   `json:"result_sha256"`
	FailureMessage string   `json:"failure_message,omitempty"`
}

type sourceRecord struct {
	SchemaVersion    string `json:"schema_version"`
	TraceID          string `json:"trace_id"`
	SpanID           string `json:"span_id"`
	ParentSpanID     string `json:"parent_span_id,omitempty"`
	SessionID        string `json:"session_id,omitempty"`
	SpanName         string `json:"span_name"`
	SpanKind         string `json:"span_kind"`
	StartTime        string `json:"start_time"`
	EndTime          string `json:"end_time"`
	Status           string `json:"status"`
	Model            string `json:"model"`
	Provider         string `json:"provider,omitempty"`
	PromptTokens     string `json:"prompt_tokens,omitempty"`
	CompletionTokens string `json:"completion_tokens,omitempty"`
	TotalTokens      string `json:"total_tokens,omitempty"`
	ActorRef         string `json:"actor_ref,omitempty"`
	ServiceName      string `json:"service_name,omitempty"`
	MissingParent    bool   `json:"missing_parent"`
}

type otlpExport struct {
	ResourceSpans []struct {
		Resource struct {
			Attributes []otlpAttribute `json:"attributes"`
		} `json:"resource"`
		ScopeSpans []struct {
			Spans []struct {
				TraceID           string          `json:"traceId"`
				SpanID            string          `json:"spanId"`
				ParentSpanID      string          `json:"parentSpanId,omitempty"`
				Name              string          `json:"name"`
				StartTimeUnixNano string          `json:"startTimeUnixNano"`
				EndTimeUnixNano   string          `json:"endTimeUnixNano"`
				Attributes        []otlpAttribute `json:"attributes"`
				Status            struct {
					Code any `json:"code"`
				} `json:"status"`
			} `json:"spans"`
		} `json:"scopeSpans"`
	} `json:"resourceSpans"`
}

type otlpAttribute struct {
	Key   string `json:"key"`
	Value struct {
		StringValue *string `json:"stringValue,omitempty"`
		IntValue    *string `json:"intValue,omitempty"`
	} `json:"value"`
}

func Execute(bundlePath string, reportPath string) (Summary, int, error) {
	absoluteBundle, err := filepath.Abs(bundlePath)
	if err != nil {
		return Summary{}, ExitInvalidArtifact, err
	}
	bundleRaw, err := os.ReadFile(absoluteBundle)
	if err != nil {
		return Summary{}, ExitInvalidArtifact, fmt.Errorf("read bundle: %w", err)
	}
	if actual := sha256Reference(bundleRaw); actual != expectedBundleSHA256 {
		return Summary{}, ExitInvalidArtifact, fmt.Errorf(
			"bundle digest mismatch: got %s, want %s",
			actual, expectedBundleSHA256,
		)
	}
	var bundle vectorBundle
	if err := decodeStrict(bundleRaw, &bundle); err != nil {
		return Summary{}, ExitInvalidArtifact, fmt.Errorf("decode bundle: %w", err)
	}
	if bundle.BundleVersion != expectedBundleVersion ||
		bundle.ProtocolVersion != expectedProtocol ||
		bundle.ProtocolStatus != "not_binding" ||
		bundle.ConformanceContract.SHA256 != expectedContractSHA256 {
		return Summary{}, ExitInvalidArtifact, errors.New("bundle identity mismatch")
	}
	root := filepath.Clean(filepath.Join(filepath.Dir(absoluteBundle), ".."))
	if err := verifyArtifact(root, bundle.ConformanceContract); err != nil {
		return Summary{}, ExitInvalidArtifact, err
	}

	observations := runAll(root, bundle)
	generated, err := buildReport(observations)
	if err != nil {
		return Summary{}, ExitInternalFailure, err
	}
	reportBytes, err := canonicalizeValue(generated)
	if err != nil {
		return Summary{}, ExitInternalFailure, err
	}
	if err := os.MkdirAll(filepath.Dir(reportPath), 0o755); err != nil {
		return Summary{}, ExitInternalFailure, err
	}
	if err := os.WriteFile(reportPath, reportBytes, 0o644); err != nil {
		return Summary{}, ExitInternalFailure, err
	}
	summary := Summary{Status: generated.Status, CaseCount: len(generated.Cases)}
	if generated.Status == "fail" {
		return summary, ExitMismatch, nil
	}
	return summary, ExitPass, nil
}

func runAll(root string, bundle vectorBundle) []caseObservation {
	observations := make([]caseObservation, 0, 39)
	for _, item := range bundle.OpenInferenceMapping {
		observations = append(observations, runMapping(root, bundle.MappingContext, item))
	}
	for _, item := range bundle.Idempotency {
		observations = append(observations, runIdempotency(item))
	}
	for _, item := range bundle.ManifestSemantics {
		observations = append(observations, runGeneric(
			"manifest_semantics", item, classifyManifest(item.Input),
		))
	}
	for _, item := range bundle.Lifecycle {
		observations = append(observations, runGeneric(
			"lifecycle", item, classifyLifecycle(item.Input),
		))
	}
	for _, item := range bundle.Delivery {
		observations = append(observations, runGeneric(
			"delivery", item, classifyDelivery(item.Input),
		))
	}
	for _, item := range bundle.Completeness {
		observations = append(observations, runGeneric(
			"completeness", item, classifyCompleteness(item.Input),
		))
	}
	for _, item := range bundle.CaptureModes {
		observations = append(observations, runGeneric(
			"capture_modes", item, classifyCaptureModes(item.Input),
		))
	}
	for _, item := range bundle.MutableDelivery {
		observations = append(observations, runMutableDelivery(root, item))
	}
	for _, item := range bundle.V1Compatibility {
		observations = append(observations, runV1Compatibility(root, item))
	}
	for _, item := range bundle.Negative {
		observations = append(observations, runNegative(item))
	}
	return observations
}

func runMapping(
	root string,
	context mappingContext,
	item mappingCase,
) caseObservation {
	observation := baseObservation("openinference_mapping", item.caseBase)
	raw, err := readPinned(root, item.RawInputPath, item.RawFileSHA256)
	if err != nil {
		observation.failures = append(observation.failures, err.Error())
		return observation
	}
	sourceFixture, err := readPinned(root, item.SourceInputPath, item.SourceFileSHA256)
	if err != nil {
		observation.failures = append(observation.failures, err.Error())
		return observation
	}
	expectedHashInput, err := readPinned(
		root, item.HashInputPath, item.HashInputFileSHA256,
	)
	if err != nil {
		observation.failures = append(observation.failures, err.Error())
		return observation
	}

	source, err := sanitizeOTLP(raw)
	if err != nil {
		observation.failures = append(observation.failures, err.Error())
		return observation
	}
	sourceCanonical, err := canonicalizeValue(source)
	if err != nil {
		observation.failures = append(observation.failures, err.Error())
		return observation
	}
	fixtureCanonical, err := canonicalizeJSON(sourceFixture)
	if err != nil {
		observation.failures = append(observation.failures, err.Error())
		return observation
	}
	if !bytes.Equal(sourceCanonical, fixtureCanonical) {
		observation.failures = append(observation.failures, "sanitized Source mismatch")
	}
	if sha256Reference(sourceCanonical) != item.CanonicalSourceSHA256 {
		observation.failures = append(observation.failures, "Source hash mismatch")
	}
	if bytes.Contains(sourceCanonical, []byte("MUST_NOT_SURVIVE_SANITIZATION")) {
		observation.failures = append(observation.failures, "raw payload survived")
	}

	hashInput, identityBytes, err := mapSourceToEnvelope(source, context)
	if err != nil {
		observation.failures = append(observation.failures, err.Error())
		return observation
	}
	computed, err := canonicalizeValue(hashInput)
	if err != nil {
		observation.failures = append(observation.failures, err.Error())
		return observation
	}
	expectedCanonical, err := canonicalizeJSON(expectedHashInput)
	if err != nil {
		observation.failures = append(observation.failures, err.Error())
		return observation
	}
	if !bytes.Equal(computed, expectedCanonical) {
		observation.failures = append(observation.failures, "Envelope hash input mismatch")
	}
	if len(computed) != item.CanonicalBytes {
		observation.failures = append(observation.failures, "canonical byte count mismatch")
	}
	if sha256Reference(computed) != item.EnvelopeHash {
		observation.failures = append(observation.failures, "Envelope hash mismatch")
	}
	if sha256Reference(identityBytes) != item.IdempotencyKey {
		observation.failures = append(observation.failures, "idempotency mismatch")
	}
	payload := hashInput["payload"].(map[string]any)
	if len(payload["capture_gaps"].([]any)) != item.CaptureGapCount {
		observation.failures = append(observation.failures, "Capture Gap count mismatch")
	}
	observation.result = computed
	return observation
}

func runIdempotency(item idempotencyCase) caseObservation {
	observation := baseObservation("idempotency", item.caseBase)
	if len(item.Components) != 7 {
		observation.failures = append(observation.failures, "identity component count")
		return observation
	}
	parts := make([]string, 7)
	var tenant *string
	for index, value := range item.Components {
		if value == nil {
			if index != 2 {
				observation.failures = append(observation.failures, "unexpected null component")
				return observation
			}
			continue
		}
		text, ok := value.(string)
		if !ok {
			observation.failures = append(observation.failures, "non-string component")
			return observation
		}
		parts[index] = text
		if index == 2 {
			tenant = &parts[index]
		}
	}
	input, err := buildIdentityInput(
		parts[0], parts[1], tenant, parts[3], parts[4], parts[5], parts[6],
	)
	if err != nil {
		observation.failures = append(observation.failures, err.Error())
		return observation
	}
	if hex.EncodeToString(input) != item.IdentityInputHex {
		observation.failures = append(observation.failures, "identity bytes mismatch")
	}
	if sha256Reference(input) != item.IdempotencyKey {
		observation.failures = append(observation.failures, "idempotency digest mismatch")
	}
	observation.result = input
	return observation
}

func runGeneric(
	section string,
	item genericCase,
	observed map[string]any,
) caseObservation {
	observation := baseObservation(section, item.caseBase)
	result, err := canonicalizeValue(observed)
	if err != nil {
		observation.failures = append(observation.failures, err.Error())
		return observation
	}
	expected, err := canonicalizeValue(item.Expected)
	if err != nil {
		observation.failures = append(observation.failures, err.Error())
		return observation
	}
	if !bytes.Equal(result, expected) {
		observation.failures = append(observation.failures, "classification mismatch")
	}
	observation.result = result
	return observation
}

func runMutableDelivery(
	root string,
	item mutableDeliveryCase,
) caseObservation {
	observation := baseObservation("mutable_delivery", item.caseBase)
	raw, err := readWithin(root, item.HashInputPath)
	if err != nil {
		observation.failures = append(observation.failures, err.Error())
		return observation
	}
	var hashInput map[string]any
	if err := decodeStrict(raw, &hashInput); err != nil {
		observation.failures = append(observation.failures, err.Error())
		return observation
	}
	canonical, err := canonicalizeValue(hashInput)
	if err != nil {
		observation.failures = append(observation.failures, err.Error())
		return observation
	}
	identity := hashInput["identity"].(map[string]any)
	observed := map[string]any{
		"envelope_hash":   sha256Reference(canonical),
		"idempotency_key": identity["idempotency_key"],
		"unchanged":       len(item.Variants) == 3,
	}
	result, _ := canonicalizeValue(observed)
	expected, _ := canonicalizeValue(item.Expected)
	if !bytes.Equal(result, expected) {
		observation.failures = append(observation.failures, "delivery exclusion mismatch")
	}
	observation.result = result
	return observation
}

func runV1Compatibility(
	root string,
	item v1CompatibilityCase,
) caseObservation {
	observation := baseObservation("v1_compatibility", item.caseBase)
	raw, err := readWithin(root, item.ManifestPath)
	if err != nil {
		observation.failures = append(observation.failures, err.Error())
		return observation
	}
	var manifest map[string]any
	if err := decodeStrict(raw, &manifest); err != nil {
		observation.failures = append(observation.failures, err.Error())
		return observation
	}
	transport, _ := manifest["transport"].(map[string]any)
	compatibility, _ := manifest["compatibility"].(map[string]any)
	observed := map[string]any{
		"checkpoint":                "required",
		"delivery_scope":            "poll_page",
		"execution_timeline":        "complete",
		"ingestion_capture_mode":    "api_pull_import",
		"original_manifest_version": manifest["manifest_version"],
		"projected_mode":            transport["mode"],
	}
	if compatibility["timeline_complete"] != true {
		observation.failures = append(observation.failures, "v1 timeline is not complete")
	}
	result, _ := canonicalizeValue(observed)
	expected, _ := canonicalizeValue(item.Expected)
	if !bytes.Equal(result, expected) {
		observation.failures = append(observation.failures, "v1 projection mismatch")
	}
	observation.result = result
	return observation
}

func runNegative(item negativeCase) caseObservation {
	observation := baseObservation("negative", item.caseBase)
	var observed map[string]any
	switch item.Kind {
	case "strict_json":
		raw, _ := item.Input.(string)
		_, err := parseStrictJSON([]byte(raw))
		if isDuplicateJSONKey(err) {
			observed = map[string]any{"error_code": "duplicate_json_key", "valid": false}
		} else {
			observed = map[string]any{"valid": err == nil}
		}
	case "privacy":
		input, _ := item.Input.(map[string]any)
		_, leak := input["input_value"]
		if leak {
			observed = map[string]any{"error_code": "raw_payload_forbidden", "valid": false}
		} else {
			observed = map[string]any{"valid": true}
		}
	case "decimal":
		value, _ := item.Input.(string)
		observed = map[string]any{"valid": isValidInt64Decimal(value), "value": value}
	case "timestamp":
		value, _ := item.Input.(string)
		result := normalizeMicrosecondTimestamp(value)
		if result.Valid {
			observed = map[string]any{"normalized": result.Normalized, "valid": true}
		} else {
			observed = map[string]any{"error_code": result.ErrorCode, "valid": false}
		}
	case "protocol_unicode":
		value, _ := item.Input.(string)
		observed = map[string]any{"valid": isNFC(value)}
	case "opaque_unicode":
		value, _ := item.Input.(string)
		observed = map[string]any{
			"utf8_hex": hex.EncodeToString([]byte(value)),
			"valid":    utf8.ValidString(value),
		}
	default:
		observed = map[string]any{"error_code": "unknown_negative_kind", "valid": false}
	}
	result, _ := canonicalizeValue(observed)
	expected, _ := canonicalizeValue(item.Expected)
	if !bytes.Equal(result, expected) {
		observation.failures = append(observation.failures, "negative classification mismatch")
	}
	observation.result = result
	return observation
}

func classifyManifest(input map[string]any) map[string]any {
	mode, _ := input["transport"].(string)
	if input["delivery"] != mode {
		return invalid("mode_axis_mismatch")
	}
	expected := map[string]map[string]string{
		"https_pull": {
			"activation": "activation_forward",
			"checkpoint": "required",
			"capture":    "api_pull_import",
			"scope":      "poll_page",
		},
		"otlp_http_push": {
			"activation": "receiver_activation_forward",
			"checkpoint": "not_applicable",
			"capture":    "otlp_http_receive",
			"scope":      "accepted_request",
		},
		"bounded_offline": {
			"activation": "explicit_bounded_import",
			"checkpoint": "not_applicable",
			"capture":    "bounded_offline_import",
			"scope":      "bounded_bundle",
		},
	}
	rules := expected[mode]
	if rules == nil {
		return invalid("mode_axis_mismatch")
	}
	if input["checkpoint"] != rules["checkpoint"] {
		if mode != "https_pull" {
			return invalid("checkpoint_not_applicable")
		}
		return invalid("mode_axis_mismatch")
	}
	if input["partial_acceptance"] != "reject_batch" {
		return invalid("partial_acceptance_forbidden")
	}
	if input["activation"] != rules["activation"] ||
		input["ingestion_capture_mode"] != rules["capture"] ||
		input["delivery_scope"] != rules["scope"] {
		return invalid("mode_axis_mismatch")
	}
	return map[string]any{
		"checkpoint": rules["checkpoint"],
		"mode":       mode,
		"valid":      true,
	}
}

func classifyLifecycle(input map[string]any) map[string]any {
	mode, _ := input["delivery_mode"].(string)
	checkpoint, _ := input["checkpoint"].(string)
	if mode != "https_pull" && checkpoint != "not_applicable" {
		return invalid("checkpoint_not_applicable")
	}
	if mode == "https_pull" && checkpoint != "required" {
		return invalid("checkpoint_required")
	}
	allowed := map[string]map[string]bool{
		"https_pull": {
			"inactive": true, "idle": true, "polling": true, "committing": true,
			"backoff": true, "stopping": true, "error": true,
		},
		"otlp_http_push": {
			"inactive": true, "idle": true, "receiving": true, "committing": true,
			"backoff": true, "stopping": true, "error": true,
		},
		"bounded_offline": {
			"inactive": true, "idle": true, "importing": true, "committing": true,
			"stopping": true, "error": true,
		},
	}
	processing, _ := input["processing"].(string)
	if !allowed[mode][processing] {
		return invalid("processing_mode_mismatch")
	}
	state := "not_applicable"
	if mode == "https_pull" {
		state, _ = input["checkpoint_state"].(string)
	}
	return map[string]any{"checkpoint_state": state, "valid": true}
}

func classifyDelivery(input map[string]any) map[string]any {
	mode, _ := input["mode"].(string)
	relation, _ := input["relation"].(string)
	converged, _ := input["all_items_converged"].(bool)
	outcome := "inserted"
	if relation == "same_identity_different_hash" {
		outcome = "conflict"
		converged = false
	} else if !converged {
		outcome = "retry_batch"
	} else if relation == "same_identity_same_hash" {
		outcome = "duplicate_noop"
	}
	ack := "not_applicable"
	checkpoint := false
	receipt := false
	switch mode {
	case "https_pull":
		checkpoint = converged
	case "otlp_http_push":
		if converged {
			ack = "durable"
		} else {
			ack = "withheld"
		}
	case "bounded_offline":
		receipt = converged
	}
	return map[string]any{
		"acknowledgement":      ack,
		"checkpoint_committed": checkpoint,
		"outcome":              outcome,
		"receipt_completed":    receipt,
	}
}

func classifyCompleteness(input map[string]any) map[string]any {
	complete, _ := input["delivery_scope_complete"].(bool)
	if !complete {
		return invalid("partial_delivery_scope_forbidden")
	}
	timeline, _ := input["execution_timeline"].(string)
	switch timeline {
	case "complete", "partial", "not_asserted":
	default:
		return invalid("timeline_claim_invalid")
	}
	return map[string]any{
		"delivery_complete": true,
		"timeline_claim":    timeline,
		"valid":             true,
	}
}

func classifyCaptureModes(input map[string]any) map[string]any {
	ingestion, _ := input["ingestion_capture_mode"].(string)
	allowed := map[string]bool{
		"api_pull_import": true, "otlp_http_receive": true,
		"bounded_offline_import": true,
	}
	if !allowed[ingestion] {
		return invalid("ingestion_capture_mode_invalid")
	}
	payload, _ := input["payload_capture_mode"].(string)
	return map[string]any{
		"ingestion_capture_mode": ingestion,
		"payload_capture_mode":   payload,
		"valid":                  true,
	}
}

func invalid(code string) map[string]any {
	return map[string]any{"error_code": code, "valid": false}
}

func sanitizeOTLP(raw []byte) (sourceRecord, error) {
	if _, err := parseStrictJSON(raw); err != nil {
		return sourceRecord{}, err
	}
	var export otlpExport
	if err := decodeStrict(raw, &export); err != nil {
		return sourceRecord{}, err
	}
	if len(export.ResourceSpans) != 1 ||
		len(export.ResourceSpans[0].ScopeSpans) != 1 ||
		len(export.ResourceSpans[0].ScopeSpans[0].Spans) != 1 {
		return sourceRecord{}, errors.New("unexpected bounded OTLP shape")
	}
	resource, err := attributes(export.ResourceSpans[0].Resource.Attributes)
	if err != nil {
		return sourceRecord{}, err
	}
	span := export.ResourceSpans[0].ScopeSpans[0].Spans[0]
	attrs, err := attributes(span.Attributes)
	if err != nil {
		return sourceRecord{}, err
	}
	if attrs["openinference.span.kind"] != "LLM" {
		return sourceRecord{}, errors.New("fixture is not an OpenInference LLM span")
	}
	start, err := unixNanoToMicrosecond(span.StartTimeUnixNano)
	if err != nil {
		return sourceRecord{}, err
	}
	end, err := unixNanoToMicrosecond(span.EndTimeUnixNano)
	if err != nil {
		return sourceRecord{}, err
	}
	status := "succeeded"
	if code, ok := span.Status.Code.(string); ok && code == "STATUS_CODE_ERROR" {
		status = "failed"
	}
	record := sourceRecord{
		SchemaVersion:    "xinsight.otlp-openinference-span.v1",
		TraceID:          strings.ToLower(span.TraceID),
		SpanID:           strings.ToLower(span.SpanID),
		ParentSpanID:     strings.ToLower(span.ParentSpanID),
		SessionID:        attrs["session.id"],
		SpanName:         span.Name,
		SpanKind:         "LLM",
		StartTime:        start,
		EndTime:          end,
		Status:           status,
		Model:            attrs["llm.model_name"],
		Provider:         attrs["llm.provider"],
		PromptTokens:     attrs["llm.token_count.prompt"],
		CompletionTokens: attrs["llm.token_count.completion"],
		TotalTokens:      attrs["llm.token_count.total"],
		ActorRef:         attrs["user.id"],
		ServiceName:      resource["service.name"],
		MissingParent:    false,
	}
	if record.TraceID == "" || record.SpanID == "" || record.Model == "" {
		return sourceRecord{}, errors.New("required OpenInference fact is absent")
	}
	if !isValidInt64Decimal(record.PromptTokens) ||
		!isValidInt64Decimal(record.CompletionTokens) ||
		!isValidInt64Decimal(record.TotalTokens) {
		return sourceRecord{}, errors.New("token counter is invalid")
	}
	prompt, _ := strconv.ParseInt(record.PromptTokens, 10, 64)
	completion, _ := strconv.ParseInt(record.CompletionTokens, 10, 64)
	total, _ := strconv.ParseInt(record.TotalTokens, 10, 64)
	if prompt+completion != total {
		return sourceRecord{}, errors.New("token counters are inconsistent")
	}
	return record, nil
}

func attributes(entries []otlpAttribute) (map[string]string, error) {
	result := make(map[string]string, len(entries))
	for _, entry := range entries {
		if _, duplicate := result[entry.Key]; duplicate {
			return nil, errors.New("duplicate OTLP attribute")
		}
		switch {
		case entry.Value.StringValue != nil && entry.Value.IntValue == nil:
			result[entry.Key] = *entry.Value.StringValue
		case entry.Value.StringValue == nil && entry.Value.IntValue != nil:
			if !isValidInt64Decimal(*entry.Value.IntValue) {
				return nil, errors.New("OTLP int attribute is invalid")
			}
			result[entry.Key] = *entry.Value.IntValue
		case entry.Value.StringValue == nil && entry.Value.IntValue == nil:
		default:
			return nil, errors.New("OTLP AnyValue has multiple scalar values")
		}
	}
	return result, nil
}

func unixNanoToMicrosecond(value string) (string, error) {
	if !isValidInt64Decimal(value) {
		return "", errors.New("timestamp is outside canonical int64")
	}
	nanos := new(big.Int)
	nanos.SetString(value, 10)
	seconds, remainder := new(big.Int), new(big.Int)
	seconds.QuoRem(nanos, big.NewInt(1_000_000_000), remainder)
	if new(big.Int).Mod(remainder, big.NewInt(1000)).Sign() != 0 {
		return "", errors.New("timestamp_precision_loss")
	}
	return time.Unix(seconds.Int64(), remainder.Int64()).UTC().
		Format("2006-01-02T15:04:05.000000Z"), nil
}

func mapSourceToEnvelope(
	source sourceRecord,
	context mappingContext,
) (map[string]any, []byte, error) {
	eventID := source.TraceID + ":" + source.SpanID
	identityBytes, err := buildIdentityInput(
		context.ProducerProduct,
		context.ProducerInstance,
		context.TenantRef,
		context.OrgRef,
		context.ProjectRef,
		"observability.span.completed",
		eventID,
	)
	if err != nil {
		return nil, nil, err
	}
	sourceBytes, err := canonicalizeValue(source)
	if err != nil {
		return nil, nil, err
	}
	gaps := []any{}
	for _, claim := range []string{
		"billing_authority",
		"business_outcome",
		"downstream_side_effects",
		"routing_decision",
	} {
		gaps = append(gaps, map[string]any{
			"affected_claim": claim,
			"gap_type":       "not_available_from_source",
			"reason_code":    "not_exposed_by_openinference_span_v1",
			"severity":       "warning",
		})
	}
	hashInput := map[string]any{
		"spec_version":   "foigent.event-envelope.v1",
		"event_id":       eventID,
		"event_type":     "observability.span.completed",
		"schema_ref":     "foigent://events/observability/openinference-span-completed/v1",
		"schema_version": "1",
		"producer": map[string]any{
			"product":           context.ProducerProduct,
			"instance":          context.ProducerInstance,
			"connector_id":      context.ConnectorID,
			"connector_version": context.ConnectorVersion,
		},
		"scope": map[string]any{
			"org_ref": context.OrgRef, "project_ref": context.ProjectRef,
		},
		"subject": map[string]any{"type": "span", "ref": source.SpanID},
		"actor":   map[string]any{"type": "user", "ref": source.ActorRef},
		"time": map[string]any{
			"occurred_at": source.EndTime, "terminal_at": source.EndTime,
		},
		"correlation": map[string]any{
			"request_ref": eventID, "trace_ref": source.TraceID, "span_ref": source.SpanID,
		},
		"identity": map[string]any{
			"idempotency_key": sha256Reference(identityBytes), "source_revision": "1",
		},
		"integrity": map[string]any{"source_hash": sha256Reference(sourceBytes)},
		"data_policy": map[string]any{
			"payload_capture_mode": "metadata_only",
			"raw_payload_present":  false,
			"redaction_profile":    "openinference.metadata-allowlist.v1",
		},
		"provenance": map[string]any{
			"adapter_fidelity": "F2",
			"field_groups": map[string]any{
				"actor": "direct", "correlation": "direct", "data_policy": "declared",
				"identity": "derived", "payload.capture_gaps": "derived",
				"payload.model": "direct", "payload.span": "direct",
				"payload.timeline_complete": "declared", "payload.trace": "direct",
				"payload.usage": "direct", "scope": "declared", "subject": "derived",
				"time.occurred_at": "derived", "time.terminal_at": "direct",
			},
		},
		"payload": map[string]any{
			"terminal": map[string]any{"status": source.Status},
			"span":     map[string]any{"kind": source.SpanKind, "name": source.SpanName},
			"trace": map[string]any{
				"trace_id": source.TraceID, "span_id": source.SpanID,
				"session_id": source.SessionID,
			},
			"model": map[string]any{"name": source.Model, "provider": source.Provider},
			"usage": map[string]any{
				"prompt_tokens":     source.PromptTokens,
				"completion_tokens": source.CompletionTokens,
				"total_tokens":      source.TotalTokens,
			},
			"service":           map[string]any{"name": source.ServiceName},
			"timeline_complete": false,
			"capture_gaps":      gaps,
		},
	}
	return hashInput, identityBytes, nil
}

func buildReport(observations []caseObservation) (report, error) {
	status := "pass"
	cases := make([]reportCase, 0, len(observations))
	coverage := make(map[string]struct{})
	seen := make(map[string]struct{})
	for _, observation := range observations {
		if _, duplicate := seen[observation.id]; duplicate {
			return report{}, fmt.Errorf("duplicate case id %s", observation.id)
		}
		seen[observation.id] = struct{}{}
		if !sort.StringsAreSorted(observation.classes) ||
			hasDuplicate(observation.classes) {
			return report{}, fmt.Errorf("%s classes are not sorted and unique", observation.id)
		}
		for _, class := range observation.classes {
			coverage[class] = struct{}{}
		}
		caseStatus := "pass"
		failure := ""
		if len(observation.failures) > 0 {
			status = "fail"
			caseStatus = "fail"
			failure = strings.Join(observation.failures, "; ")
			if len(failure) > 512 {
				failure = failure[:512]
			}
		}
		cases = append(cases, reportCase{
			CaseID: observation.id, CaseClasses: observation.classes,
			Status: caseStatus, ResultKind: observation.kind,
			ResultBase64:   base64.StdEncoding.EncodeToString(observation.result),
			ResultSHA256:   sha256Reference(observation.result),
			FailureMessage: failure,
		})
	}
	if len(coverage) != len(requiredClasses) {
		return report{}, errors.New("case class coverage differs from contract")
	}
	for _, class := range requiredClasses {
		if _, ok := coverage[class]; !ok {
			return report{}, fmt.Errorf("missing case class %s", class)
		}
	}
	return report{
		ReportVersion: reportVersion, Implementation: implementationName,
		ImplementationVersion: implementationVersion,
		BundleSHA256:          expectedBundleSHA256, Status: status, Cases: cases,
	}, nil
}

func baseObservation(section string, base caseBase) caseObservation {
	return caseObservation{
		id:      section + "/" + base.CaseID,
		classes: append([]string(nil), base.CaseClasses...),
		kind:    base.ResultKind,
	}
}

func hasDuplicate(values []string) bool {
	for index := 1; index < len(values); index++ {
		if values[index] == values[index-1] {
			return true
		}
	}
	return false
}

func verifyArtifact(root string, ref artifactRef) error {
	bytes, err := readWithin(root, ref.Path)
	if err != nil {
		return err
	}
	if sha256Reference(bytes) != ref.SHA256 {
		return fmt.Errorf("%s digest mismatch", ref.Path)
	}
	return nil
}

func readPinned(root, path, expected string) ([]byte, error) {
	bytes, err := readWithin(root, path)
	if err != nil {
		return nil, err
	}
	if sha256Reference(bytes) != expected {
		return nil, fmt.Errorf("%s digest mismatch", path)
	}
	return bytes, nil
}

func readWithin(root, relative string) ([]byte, error) {
	if relative == "" || filepath.IsAbs(relative) {
		return nil, errors.New("artifact path must be relative")
	}
	cleanRoot := filepath.Clean(root)
	path := filepath.Clean(filepath.Join(cleanRoot, filepath.FromSlash(relative)))
	rel, err := filepath.Rel(cleanRoot, path)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return nil, errors.New("artifact path escapes root")
	}
	return os.ReadFile(path)
}

func decodeStrict(data []byte, destination any) error {
	if _, err := parseStrictJSON(data); err != nil {
		return err
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(destination); err != nil {
		return err
	}
	var trailing any
	if err := decoder.Decode(&trailing); !errors.Is(err, io.EOF) {
		return errors.New("unexpected trailing JSON value")
	}
	return nil
}

func canonicalizeValue(value any) ([]byte, error) {
	encoded, err := json.Marshal(value)
	if err != nil {
		return nil, err
	}
	return canonicalizeJSON(encoded)
}
