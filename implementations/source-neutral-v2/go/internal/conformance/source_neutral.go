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
	"regexp"
	"sort"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"
)

const (
	expectedBundleSHA256   = "sha256:c556051776f5a0ecd2e193f34dd8b240ff5ebef2e8c3877d8f1a8f6d69af95cb"
	expectedContractSHA256 = "sha256:e3ab080cbfa633950b859d621e7cf58184881347277a9b30a0973aa4258177b3"
	expectedBundleVersion  = "foigent.source-neutral-vector-bundle.v2"
	expectedProtocol       = "2.0.0"
	reportVersion          = "foigent.conformance-report.v1"
	implementationName     = "go"
	implementationVersion  = "2.0.0-rc.1+independent.2"
)

const (
	ExitPass            = 0
	ExitInvalidArtifact = 2
	ExitMismatch        = 3
	ExitInternalFailure = 4
)

var requiredClasses = []string{
	"bounded_offline_receipt",
	"bounded_batch_ordering",
	"canonical_envelope",
	"capture_gap_derivation",
	"capture_mode_separation",
	"checkpoint_applicability",
	"conditional_capture_gaps",
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
	"optional_fact_preservation",
	"partial_batch_rejection",
	"privacy_rejection",
	"protocol_nfc_rejection",
	"scoped_idempotency",
	"source_shape_validation",
	"source_sanitization",
	"status_code_validation",
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
	RawInputPath          string   `json:"raw_input_path"`
	SourceInputPath       string   `json:"source_input_path"`
	HashInputPath         string   `json:"hash_input_path"`
	RawFileSHA256         string   `json:"raw_file_sha256"`
	SourceFileSHA256      string   `json:"source_file_sha256"`
	HashInputFileSHA256   string   `json:"hash_input_file_sha256"`
	CanonicalSourceSHA256 string   `json:"canonical_source_sha256"`
	CanonicalBytes        int      `json:"canonical_bytes"`
	EnvelopeHash          string   `json:"envelope_hash"`
	IdempotencyKey        string   `json:"idempotency_key"`
	CaptureGapCount       int      `json:"capture_gap_count"`
	RecordIndex           int      `json:"record_index"`
	ExpectedRecordOrder   []string `json:"expected_record_order"`
	ExpectedSkippedNonLLM int      `json:"expected_skipped_non_llm"`
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

type sanitizedBatch struct {
	Records       []sourceRecord
	SkippedNonLLM int
}

type otlpExport struct {
	ResourceSpans []otlpResourceSpans `json:"resourceSpans"`
}

type otlpResourceSpans struct {
	Resource   otlpResource   `json:"resource"`
	ScopeSpans []otlpScopeSpan `json:"scopeSpans"`
}

type otlpResource struct {
	Attributes []otlpAttribute `json:"attributes"`
}

type otlpScopeSpan struct {
	Spans []otlpSpan `json:"spans"`
}

type otlpSpan struct {
	TraceID           string          `json:"traceId"`
	SpanID            string          `json:"spanId"`
	ParentSpanID      string          `json:"parentSpanId,omitempty"`
	Name              string          `json:"name"`
	StartTimeUnixNano string          `json:"startTimeUnixNano"`
	EndTimeUnixNano   string          `json:"endTimeUnixNano"`
	Attributes        []otlpAttribute `json:"attributes"`
	Status            json.RawMessage `json:"status,omitempty"`
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
		observations = append(observations, runNegative(root, item))
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

	batch, err := sanitizeOTLP(raw)
	if err != nil {
		observation.failures = append(observation.failures, err.Error())
		return observation
	}
	if batch.SkippedNonLLM != item.ExpectedSkippedNonLLM {
		observation.failures = append(observation.failures, "skipped non-LLM count mismatch")
	}
	observedOrder := make([]string, 0, len(batch.Records))
	for _, record := range batch.Records {
		observedOrder = append(
			observedOrder,
			record.TraceID+":"+record.SpanID,
		)
	}
	if !equalStringSlices(observedOrder, item.ExpectedRecordOrder) {
		observation.failures = append(observation.failures, "sanitized record order mismatch")
	}
	if item.RecordIndex < 0 || item.RecordIndex >= len(batch.Records) {
		observation.failures = append(observation.failures, "mapping record index is outside batch")
		return observation
	}
	source := batch.Records[item.RecordIndex]
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

func runNegative(root string, item negativeCase) caseObservation {
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
	case "otlp_fixture":
		input, ok := item.Input.(map[string]any)
		if !ok {
			observed = invalid("invalid_negative_fixture")
			break
		}
		path, pathOK := input["path"].(string)
		digest, digestOK := input["sha256"].(string)
		if !pathOK || !digestOK {
			observed = invalid("invalid_negative_fixture")
			break
		}
		raw, err := readPinned(root, path, digest)
		if err != nil {
			observation.failures = append(observation.failures, err.Error())
			observed = invalid("invalid_negative_fixture")
			break
		}
		batch, err := sanitizeOTLP(raw)
		if err == nil {
			observed = map[string]any{
				"record_count": len(batch.Records),
				"valid":        true,
			}
			break
		}
		var failure *sanitizationError
		if errors.As(err, &failure) {
			observed = invalid(failure.Code)
		} else {
			observed = invalid("source_sanitization_failed")
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

type sanitizationError struct {
	Code    string
	Message string
}

func (failure *sanitizationError) Error() string {
	return failure.Message
}

func rejectSanitization(code string, message string) error {
	return &sanitizationError{Code: code, Message: message}
}

var (
	traceIDPattern = regexp.MustCompile(`^[0-9a-f]{32}$`)
	spanIDPattern  = regexp.MustCompile(`^[0-9a-f]{16}$`)
)

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

func equalStringSlices(left []string, right []string) bool {
	if len(left) != len(right) {
		return false
	}
	for index := range left {
		if left[index] != right[index] {
			return false
		}
	}
	return true
}

func sanitizeOTLP(raw []byte) (sanitizedBatch, error) {
	if len(raw) == 0 || len(raw) > 8<<20 || !utf8.Valid(raw) {
		return sanitizedBatch{}, rejectSanitization(
			"bounded_input_invalid",
			"OTLP export bytes are outside the bounded UTF-8 input profile",
		)
	}
	if _, err := parseStrictJSON(raw); err != nil {
		return sanitizedBatch{}, rejectSanitization("invalid_json", err.Error())
	}
	var export otlpExport
	decoder := json.NewDecoder(bytes.NewReader(raw))
	if err := decoder.Decode(&export); err != nil {
		return sanitizedBatch{}, rejectSanitization(
			"otlp_shape_invalid",
			"OTLP export shape is invalid",
		)
	}
	var trailing any
	if err := decoder.Decode(&trailing); !errors.Is(err, io.EOF) {
		return sanitizedBatch{}, rejectSanitization(
			"invalid_json",
			"OTLP export contains trailing content",
		)
	}

	records := make([]sourceRecord, 0)
	skipped := 0
	spanCount := 0
	for _, resourceGroup := range export.ResourceSpans {
		resource, err := attributes(resourceGroup.Resource.Attributes)
		if err != nil {
			return sanitizedBatch{}, err
		}
		for _, scopeGroup := range resourceGroup.ScopeSpans {
			for _, span := range scopeGroup.Spans {
				spanCount++
				if spanCount > 200 {
					return sanitizedBatch{}, rejectSanitization(
						"span_limit_exceeded",
						"OTLP export exceeds the bounded span limit",
					)
				}
				spanAttributes, err := attributes(span.Attributes)
				if err != nil {
					return sanitizedBatch{}, err
				}
				if spanAttributes["openinference.span.kind"] != "LLM" {
					skipped++
					continue
				}
				record, err := sourceRecordFromSpan(span, spanAttributes, resource)
				if err != nil {
					return sanitizedBatch{}, err
				}
				records = append(records, record)
			}
		}
	}
	if len(records) == 0 {
		return sanitizedBatch{}, rejectSanitization(
			"no_supported_llm_span",
			"OTLP export contains no supported OpenInference LLM spans",
		)
	}

	spanIdentities := make(map[string]struct{}, len(records))
	for _, record := range records {
		identity := record.TraceID + ":" + record.SpanID
		if _, duplicate := spanIdentities[identity]; duplicate {
			return sanitizedBatch{}, rejectSanitization(
				"duplicate_span_identity",
				"OTLP export contains a duplicate trace and span identity",
			)
		}
		spanIdentities[identity] = struct{}{}
	}
	for index := range records {
		if records[index].ParentSpanID != "" {
			parentIdentity := records[index].TraceID + ":" + records[index].ParentSpanID
			_, parentPresent := spanIdentities[parentIdentity]
			records[index].MissingParent = !parentPresent
		}
		if err := validateSourceRecord(records[index]); err != nil {
			return sanitizedBatch{}, err
		}
	}
	sort.Slice(records, func(left, right int) bool {
		if records[left].TraceID == records[right].TraceID {
			return records[left].SpanID < records[right].SpanID
		}
		return records[left].TraceID < records[right].TraceID
	})
	return sanitizedBatch{Records: records, SkippedNonLLM: skipped}, nil
}

func sourceRecordFromSpan(
	span otlpSpan,
	spanAttributes map[string]string,
	resourceAttributes map[string]string,
) (sourceRecord, error) {
	start, err := unixNanoToMicrosecond(span.StartTimeUnixNano)
	if err != nil {
		return sourceRecord{}, rejectSanitization(
			"timestamp_invalid",
			"OpenInference start timestamp is not exact microsecond time",
		)
	}
	end, err := unixNanoToMicrosecond(span.EndTimeUnixNano)
	if err != nil {
		return sourceRecord{}, rejectSanitization(
			"timestamp_invalid",
			"OpenInference end timestamp is not exact microsecond time",
		)
	}
	status, err := spanStatus(span.Status)
	if err != nil {
		return sourceRecord{}, err
	}
	record := sourceRecord{
		SchemaVersion:    "xinsight.otlp-openinference-span.v1",
		TraceID:          strings.ToLower(span.TraceID),
		SpanID:           strings.ToLower(span.SpanID),
		ParentSpanID:     strings.ToLower(span.ParentSpanID),
		SessionID:        spanAttributes["session.id"],
		SpanName:         span.Name,
		SpanKind:         "LLM",
		StartTime:        start,
		EndTime:          end,
		Status:           status,
		Model:            spanAttributes["llm.model_name"],
		Provider:         spanAttributes["llm.provider"],
		PromptTokens:     spanAttributes["llm.token_count.prompt"],
		CompletionTokens: spanAttributes["llm.token_count.completion"],
		TotalTokens:      spanAttributes["llm.token_count.total"],
		ActorRef:         spanAttributes["user.id"],
		ServiceName:      resourceAttributes["service.name"],
	}
	if err := validateSourceRecord(record); err != nil {
		return sourceRecord{}, err
	}
	return record, nil
}

func attributes(entries []otlpAttribute) (map[string]string, error) {
	result := make(map[string]string, len(entries))
	for _, entry := range entries {
		if !validOpaque(entry.Key, 1, 240) {
			return nil, rejectSanitization(
				"attribute_key_invalid",
				"OTLP attribute key is invalid",
			)
		}
		if _, duplicate := result[entry.Key]; duplicate {
			return nil, rejectSanitization(
				"duplicate_attribute_key",
				"OTLP attribute keys must be unique",
			)
		}
		switch {
		case entry.Value.StringValue != nil && entry.Value.IntValue == nil:
			if !validOpaque(*entry.Value.StringValue, 0, 512) {
				return nil, rejectSanitization(
					"attribute_value_invalid",
					"OTLP string attribute is invalid",
				)
			}
			result[entry.Key] = *entry.Value.StringValue
		case entry.Value.StringValue == nil && entry.Value.IntValue != nil:
			if !isValidInt64Decimal(*entry.Value.IntValue) {
				return nil, rejectSanitization(
					"attribute_encoding_invalid",
					"OTLP int attribute is outside canonical int64",
				)
			}
			result[entry.Key] = *entry.Value.IntValue
		case entry.Value.StringValue == nil && entry.Value.IntValue == nil:
		default:
			return nil, rejectSanitization(
				"attribute_encoding_invalid",
				"OTLP AnyValue has multiple scalar values",
			)
		}
	}
	return result, nil
}

func spanStatus(raw json.RawMessage) (string, error) {
	if len(raw) == 0 {
		return "succeeded", nil
	}
	var status struct {
		Code any `json:"code"`
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()
	if err := decoder.Decode(&status); err != nil {
		return "", rejectSanitization(
			"status_code_invalid",
			"OTLP span status is invalid",
		)
	}
	switch code := status.Code.(type) {
	case string:
		switch code {
		case "", "STATUS_CODE_UNSET", "STATUS_CODE_OK":
			return "succeeded", nil
		case "STATUS_CODE_ERROR":
			return "failed", nil
		}
	case json.Number:
		switch code.String() {
		case "0", "1":
			return "succeeded", nil
		case "2":
			return "failed", nil
		}
	case nil:
		return "succeeded", nil
	}
	return "", rejectSanitization(
		"status_code_invalid",
		"OTLP span status code is invalid",
	)
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

func validateSourceRecord(record sourceRecord) error {
	if record.SchemaVersion != "xinsight.otlp-openinference-span.v1" ||
		record.SpanKind != "LLM" ||
		(record.Status != "succeeded" && record.Status != "failed") ||
		!traceIDPattern.MatchString(record.TraceID) ||
		!spanIDPattern.MatchString(record.SpanID) ||
		(record.ParentSpanID != "" && !spanIDPattern.MatchString(record.ParentSpanID)) ||
		!validOpaque(record.SpanName, 1, 240) ||
		!validOpaque(record.Model, 1, 240) ||
		(record.Provider != "" && !validOpaque(record.Provider, 1, 160)) ||
		(record.SessionID != "" && !validOpaque(record.SessionID, 1, 256)) ||
		(record.ActorRef != "" && !validOpaque(record.ActorRef, 1, 256)) ||
		(record.ServiceName != "" && !validOpaque(record.ServiceName, 1, 240)) {
		return rejectSanitization(
			"source_shape_invalid",
			"OpenInference Source record is invalid",
		)
	}
	start, err := time.Parse("2006-01-02T15:04:05.000000Z", record.StartTime)
	if err != nil {
		return rejectSanitization(
			"timestamp_invalid",
			"OpenInference Source start time is invalid",
		)
	}
	end, err := time.Parse("2006-01-02T15:04:05.000000Z", record.EndTime)
	if err != nil {
		return rejectSanitization(
			"timestamp_invalid",
			"OpenInference Source end time is invalid",
		)
	}
	if end.Before(start) {
		return rejectSanitization(
			"timestamp_order_invalid",
			"OpenInference Source end time precedes start time",
		)
	}
	for _, counter := range []string{
		record.PromptTokens,
		record.CompletionTokens,
		record.TotalTokens,
	} {
		if counter != "" && !isValidInt64Decimal(counter) {
			return rejectSanitization(
				"token_counter_invalid",
				"OpenInference token counter is invalid",
			)
		}
	}
	if record.PromptTokens != "" &&
		record.CompletionTokens != "" &&
		record.TotalTokens != "" {
		prompt := new(big.Int)
		completion := new(big.Int)
		total := new(big.Int)
		prompt.SetString(record.PromptTokens, 10)
		completion.SetString(record.CompletionTokens, 10)
		total.SetString(record.TotalTokens, 10)
		sum := new(big.Int).Add(prompt, completion)
		if sum.Cmp(total) != 0 {
			return rejectSanitization(
				"token_counter_inconsistent",
				"OpenInference token counters are inconsistent",
			)
		}
	}
	return nil
}

func validOpaque(value string, minimum int, maximum int) bool {
	if !utf8.ValidString(value) {
		return false
	}
	length := utf8.RuneCountInString(value)
	if length < minimum || length > maximum {
		return false
	}
	for _, character := range value {
		if unicode.IsControl(character) {
			return false
		}
	}
	return true
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
	gapReasons := map[string]string{
		"billing_authority":       "not_exposed_by_openinference_span_v1",
		"business_outcome":        "not_exposed_by_openinference_span_v1",
		"downstream_side_effects": "not_exposed_by_openinference_span_v1",
		"routing_decision":        "not_exposed_by_openinference_span_v1",
	}
	if source.SessionID == "" {
		gapReasons["authoritative_session"] = "session_id_not_observed"
	}
	if source.PromptTokens == "" ||
		source.CompletionTokens == "" ||
		source.TotalTokens == "" {
		gapReasons["token_usage"] = "complete_token_counters_not_observed"
	}
	if source.MissingParent {
		gapReasons["causal_parent"] = "declared_parent_not_in_bounded_batch"
	}
	claims := make([]string, 0, len(gapReasons))
	for claim := range gapReasons {
		claims = append(claims, claim)
	}
	sort.Strings(claims)
	gaps := make([]any, 0, len(claims))
	for _, claim := range claims {
		gaps = append(gaps, map[string]any{
			"affected_claim": claim,
			"gap_type":       "not_available_from_source",
			"reason_code":    gapReasons[claim],
			"severity":       "warning",
		})
	}
	scope := map[string]any{
		"org_ref": context.OrgRef, "project_ref": context.ProjectRef,
	}
	if context.TenantRef != nil {
		scope["tenant_ref"] = *context.TenantRef
	}
	actor := map[string]any{"type": "system"}
	actorProof := "gap"
	if source.ActorRef != "" {
		actor = map[string]any{"type": "user", "ref": source.ActorRef}
		actorProof = "direct"
	}
	trace := map[string]any{
		"trace_id": source.TraceID,
		"span_id":  source.SpanID,
	}
	if source.ParentSpanID != "" {
		trace["parent_span_id"] = source.ParentSpanID
	}
	if source.SessionID != "" {
		trace["session_id"] = source.SessionID
	}
	model := map[string]any{"name": source.Model}
	if source.Provider != "" {
		model["provider"] = source.Provider
	}
	usage := map[string]any{}
	if source.PromptTokens != "" {
		usage["prompt_tokens"] = source.PromptTokens
	}
	if source.CompletionTokens != "" {
		usage["completion_tokens"] = source.CompletionTokens
	}
	if source.TotalTokens != "" {
		usage["total_tokens"] = source.TotalTokens
	}
	usageProof := "gap"
	if len(usage) > 0 {
		usageProof = "direct"
	}
	payload := map[string]any{
		"terminal":          map[string]any{"status": source.Status},
		"span":              map[string]any{"kind": source.SpanKind, "name": source.SpanName},
		"trace":             trace,
		"model":             model,
		"usage":             usage,
		"timeline_complete": false,
		"capture_gaps":      gaps,
	}
	if source.ServiceName != "" {
		payload["service"] = map[string]any{"name": source.ServiceName}
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
		"scope":   scope,
		"subject": map[string]any{"type": "span", "ref": source.SpanID},
		"actor":   actor,
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
				"actor": actorProof, "correlation": "direct", "data_policy": "declared",
				"identity": "derived", "payload.capture_gaps": "derived",
				"payload.model": "direct", "payload.span": "direct",
				"payload.timeline_complete": "declared", "payload.trace": "direct",
				"payload.usage": usageProof, "scope": "declared", "subject": "derived",
				"time.occurred_at": "derived", "time.terminal_at": "direct",
			},
		},
		"payload": payload,
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
