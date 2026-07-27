package conformance

import (
	"errors"
	"fmt"
	"math"
	"sort"
	"strconv"
	"unicode"
	"unicode/utf8"
)

const (
	sourceSchemaVersion = "unirouter.completed-execution.v1"
	eventType           = "model.request.completed"
	eventSchemaRef      = "foigent://events/model/request-completed/v1"
)

var (
	sourceGapOrder = []string{
		"call_log",
		"request_trace",
		"client_ip_presence",
		"upstream_error_presence",
	}
	sharedGapOrder = []string{
		"call_log",
		"client_ip_presence",
		"request_trace",
		"upstream_error_presence",
	}
	prohibitedRawFields = map[string]struct{}{
		"prompt":         {},
		"response":       {},
		"authorization":  {},
		"api_key":        {},
		"credential":     {},
		"ip_address":     {},
		"upstream_error": {},
	}
)

type sourceMappingError struct {
	code string
	err  error
}

func (e *sourceMappingError) Error() string {
	if e.err == nil {
		return e.code
	}
	return e.code + ": " + e.err.Error()
}

func (e *sourceMappingError) Unwrap() error {
	return e.err
}

func mapReferenceSource(
	sourceBytes []byte,
	context referenceMappingContext,
	gapProfile captureGapProfile,
) (map[string]any, sourceSnapshot, error) {
	source, err := decodeAndValidateSource(sourceBytes)
	if err != nil {
		return nil, sourceSnapshot{}, err
	}
	if err := validateReferenceContext(context); err != nil {
		return nil, sourceSnapshot{}, err
	}
	if err := validateGapProfile(gapProfile); err != nil {
		return nil, sourceSnapshot{}, err
	}

	terminalTime := normalizeMicrosecondTimestamp(source.Terminal.AvailableAt)
	if !terminalTime.Valid {
		return nil, sourceSnapshot{}, &sourceMappingError{
			code: terminalTime.ErrorCode,
			err:  errors.New("terminal.available_at cannot be mapped losslessly"),
		}
	}
	orgRef := strconv.FormatInt(source.OrgID, 10)
	projectRef := strconv.FormatInt(source.ProjectID, 10)
	identityInput, err := buildIdentityInput(
		context.ProducerProduct,
		context.ProducerInstance,
		nil,
		orgRef,
		projectRef,
		eventType,
		source.RequestID,
	)
	if err != nil {
		return nil, sourceSnapshot{}, err
	}

	usage := map[string]any{
		"model":                  source.Usage.Model,
		"prompt_tokens":          strconv.FormatInt(source.Usage.PromptTokens, 10),
		"uncached_prompt_tokens": strconv.FormatInt(source.Usage.UncachedPromptTokens, 10),
		"cache_read_tokens":      strconv.FormatInt(source.Usage.CacheReadTokens, 10),
		"cache_creation_tokens":  strconv.FormatInt(source.Usage.CacheCreationTokens, 10),
		"completion_tokens":      strconv.FormatInt(source.Usage.CompletionTokens, 10),
		"source":                 source.Usage.Source,
		"authority":              source.Usage.Authority,
		"purpose":                source.Usage.Purpose,
		"finality":               source.Usage.Finality,
		"contract_version":       source.Usage.ContractVersion,
		"cache_usage_schema":     source.Usage.CacheUsageSchema,
		"cache_usage_status":     source.Usage.CacheUsageStatus,
	}
	if source.Usage.EstimateVersion != nil {
		usage["estimate_version"] = *source.Usage.EstimateVersion
	}

	gaps := deriveCaptureGaps(source, terminalTime.Normalized, gapProfile)
	envelope := map[string]any{
		"spec_version":   "foigent.event-envelope.v1",
		"event_id":       source.RequestID,
		"event_type":     eventType,
		"schema_ref":     eventSchemaRef,
		"schema_version": "1",
		"producer": map[string]any{
			"product":           context.ProducerProduct,
			"instance":          context.ProducerInstance,
			"connector_id":      context.ConnectorID,
			"connector_version": context.ConnectorVersion,
		},
		"scope": map[string]any{
			"org_ref":     orgRef,
			"project_ref": projectRef,
		},
		"subject": map[string]any{
			"type": "request",
			"ref":  source.RequestID,
		},
		"actor": map[string]any{
			"type": "system",
		},
		"time": map[string]any{
			"occurred_at": terminalTime.Normalized,
			"terminal_at": terminalTime.Normalized,
		},
		"correlation": map[string]any{
			"request_ref": source.RequestID,
		},
		"identity": map[string]any{
			"idempotency_key": sha256Reference(identityInput),
			"source_revision": context.SourceRevision,
		},
		"integrity": map[string]any{
			"source_hash": sha256Reference(sourceBytes),
		},
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
				"identity":                  "direct",
				"payload.capture_gaps":      "direct",
				"payload.money":             "direct",
				"payload.terminal":          "direct",
				"payload.timeline_complete": "direct",
				"payload.usage":             "direct",
				"scope":                     "direct",
				"subject":                   "derived",
				"time.occurred_at":          "derived",
				"time.terminal_at":          "direct",
			},
		},
		"payload": map[string]any{
			"terminal": map[string]any{
				"status": source.Terminal.Status,
			},
			"usage": usage,
			"money": map[string]any{
				"schema":                 source.Money.Schema,
				"currency":               source.Money.Currency,
				"amount_scale":           source.Money.AmountScale,
				"calculated_cost_micros": source.Money.CalculatedCostMicros,
				"charged_cost_micros":    source.Money.ChargedCostMicros,
				"pricing_version":        source.Money.PricingVersion,
			},
			"timeline_complete": context.TimelineComplete,
			"capture_gaps":      gaps,
		},
	}
	return envelope, source, nil
}

func decodeAndValidateSource(sourceBytes []byte) (sourceSnapshot, error) {
	parsed, err := parseStrictJSON(sourceBytes)
	if err != nil {
		return sourceSnapshot{}, err
	}
	if field, found := findProhibitedRawField(parsed); found {
		return sourceSnapshot{}, &sourceMappingError{
			code: "prohibited_raw_field",
			err:  fmt.Errorf("source payload contains prohibited field %q", field),
		}
	}

	var source sourceSnapshot
	if err := decodeStrict(sourceBytes, &source); err != nil {
		return sourceSnapshot{}, err
	}
	if err := validateSourceSnapshot(source); err != nil {
		return sourceSnapshot{}, err
	}
	return source, nil
}

func findProhibitedRawField(value jsonValue) (string, bool) {
	switch value.kind {
	case jsonObject:
		for _, member := range value.object {
			if _, prohibited := prohibitedRawFields[member.key]; prohibited {
				return member.key, true
			}
			if field, found := findProhibitedRawField(member.value); found {
				return field, true
			}
		}
	case jsonArray:
		for _, item := range value.array {
			if field, found := findProhibitedRawField(item); found {
				return field, true
			}
		}
	}
	return "", false
}

func validateSourceSnapshot(source sourceSnapshot) error {
	if source.SchemaVersion != sourceSchemaVersion {
		return errors.New("unexpected Source schema_version")
	}
	if !validOpaqueSourceString(source.RequestID, 1, 64, true) {
		return errors.New("request_id violates exact Source byte/control bounds")
	}
	if source.OrgID <= 0 || source.ProjectID <= 0 {
		return errors.New("Source scope must contain positive org_id and project_id")
	}
	if source.Terminal.Status != "settled" && source.Terminal.Status != "cancelled" {
		return errors.New("Source terminal status is not settled or cancelled")
	}
	if !normalizeMicrosecondTimestamp(source.Terminal.AvailableAt).Valid {
		return errors.New("Source terminal.available_at is invalid or lossy")
	}
	if !validOpaqueSourceString(source.Usage.Model, 1, 100, false) {
		return errors.New("Source usage.model violates byte bounds")
	}
	counters := []int64{
		source.Usage.PromptTokens,
		source.Usage.UncachedPromptTokens,
		source.Usage.CacheReadTokens,
		source.Usage.CacheCreationTokens,
		source.Usage.CompletionTokens,
	}
	for _, counter := range counters {
		if counter < 0 {
			return errors.New("Source usage counter is negative")
		}
	}
	promptPartition, overflow := addNonnegativeInt64(
		source.Usage.UncachedPromptTokens,
		source.Usage.CacheReadTokens,
		source.Usage.CacheCreationTokens,
	)
	if overflow || promptPartition != source.Usage.PromptTokens {
		return errors.New("Source prompt-token partition is inconsistent")
	}
	if len(source.Usage.Source) > 32 ||
		len(source.Usage.Authority) > 64 ||
		len(source.Usage.Purpose) > 64 ||
		len(source.Usage.Finality) > 64 ||
		len(source.Usage.ContractVersion) > 80 ||
		len(source.Usage.CacheUsageSchema) > 80 ||
		len(source.Usage.CacheUsageStatus) > 40 {
		return errors.New("Source usage metadata exceeds current bounds")
	}
	if source.Usage.EstimateVersion != nil && len(*source.Usage.EstimateVersion) > 80 {
		return errors.New("Source usage estimate_version exceeds current bounds")
	}
	if source.Money.Schema != "micro-cny.v1" ||
		source.Money.Currency != "CNY" ||
		source.Money.AmountScale != 1000000 {
		return errors.New("Source money contract identity is invalid")
	}
	if !isValidMicroAmount(source.Money.CalculatedCostMicros) ||
		!isValidMicroAmount(source.Money.ChargedCostMicros) {
		return errors.New("Source money amount is not canonical")
	}
	if len(source.Money.PricingVersion) > 80 {
		return errors.New("Source pricing_version exceeds current bounds")
	}
	if len(source.CaptureGaps) != len(sourceGapOrder) {
		return errors.New("Source capture-gap count is not four")
	}
	for index, expected := range sourceGapOrder {
		gap := source.CaptureGaps[index]
		if gap.Source != expected || gap.Reason != "not_available_at_billing_terminal" {
			return errors.New("Source capture-gap set/order/reason is invalid")
		}
	}
	return nil
}

func validOpaqueSourceString(value string, minimumBytes int, maximumBytes int, rejectControl bool) bool {
	if !utf8.ValidString(value) || len(value) < minimumBytes || len(value) > maximumBytes {
		return false
	}
	if rejectControl {
		for _, r := range value {
			if unicode.IsControl(r) {
				return false
			}
		}
	}
	return true
}

func addNonnegativeInt64(values ...int64) (int64, bool) {
	var total int64
	for _, value := range values {
		if value < 0 || total > math.MaxInt64-value {
			return 0, true
		}
		total += value
	}
	return total, false
}

func validateReferenceContext(context referenceMappingContext) error {
	if context.ProducerProduct != "unirouter" ||
		context.ProducerInstance == "" ||
		context.ConnectorID != expectedReferenceConnector ||
		context.ConnectorVersion != "1.0.0" ||
		context.AdapterFidelity != "F2" ||
		context.PayloadCaptureMode != "metadata_only" ||
		context.RawPayloadPresent ||
		context.SourceRevision != "1" ||
		!context.TimelineComplete {
		return errors.New("reference_mapping_context does not match the frozen Reference Connector")
	}
	if !isNFC(context.ProducerProduct) ||
		!isNFC(context.ConnectorID) ||
		!isNFC(context.ConnectorVersion) ||
		!utf8.ValidString(context.ProducerInstance) {
		return errors.New("reference_mapping_context violates the protocol/opaque UTF-8 boundary")
	}
	return nil
}

func validateGapProfile(profile captureGapProfile) error {
	if len(profile.RequiredOrder) != len(sharedGapOrder) {
		return errors.New("shared capture-gap order must contain exactly four claims")
	}
	for index, expected := range sharedGapOrder {
		if profile.RequiredOrder[index] != expected {
			return errors.New("shared capture-gap order differs from the frozen order")
		}
	}
	if profile.ReasonCode != "not_available_at_billing_terminal" ||
		profile.GapType != "not_available_from_source" ||
		profile.Severity != "warning" ||
		profile.PayloadCaptureMode != "none" {
		return errors.New("shared capture-gap declared fields differ from the frozen profile")
	}
	return nil
}

func deriveCaptureGaps(
	source sourceSnapshot,
	observedAt string,
	profile captureGapProfile,
) []any {
	sourceByClaim := make(map[string]sourceGap, len(source.CaptureGaps))
	for _, gap := range source.CaptureGaps {
		sourceByClaim[gap.Source] = gap
	}
	claims := append([]string(nil), profile.RequiredOrder...)
	sort.Strings(claims)
	result := make([]any, 0, len(claims))
	orgRef := strconv.FormatInt(source.OrgID, 10)
	projectRef := strconv.FormatInt(source.ProjectID, 10)
	for _, claim := range claims {
		direct := sourceByClaim[claim]
		result = append(result, map[string]any{
			"gap_id":          source.RequestID + ":gap:" + direct.Source,
			"parent_event_id": source.RequestID,
			"scope": map[string]any{
				"org_ref":     orgRef,
				"project_ref": projectRef,
			},
			"correlation": map[string]any{
				"request_ref": source.RequestID,
			},
			"affected_claim":       direct.Source,
			"gap_type":             profile.GapType,
			"reason_code":          direct.Reason,
			"severity":             profile.Severity,
			"observed_at":          observedAt,
			"payload_capture_mode": profile.PayloadCaptureMode,
			"field_provenance": map[string]any{
				"affected_claim":       "direct",
				"reason_code":          "direct",
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
	return result
}

func privacyConnectorError() connectorError {
	return connectorError{
		ErrorVersion: "foigent.connector-error.v1",
		Category:     "privacy",
		Code:         "prohibited_raw_field",
		Phase:        "validate",
		Operation:    "map_source_snapshot",
		Retryable:    false,
		SafeMessage:  "Source payload contains a prohibited raw field",
		Recovery:     "operator_repair",
	}
}

func mapCursorError(sourceBytes []byte) (connectorError, error) {
	var source sourceCursorError
	if err := decodeStrict(sourceBytes, &source); err != nil {
		return connectorError{}, err
	}
	if source.Error.Code != "completed_execution_feed.cursor_expired" ||
		source.Error.Message != "Cursor is outside the retained replay window" ||
		source.Error.Retryable {
		return connectorError{}, errors.New("Source cursor error does not match the frozen negative seed")
	}
	return connectorError{
		ErrorVersion: "foigent.connector-error.v1",
		Category:     "cursor",
		Code:         source.Error.Code,
		Phase:        "fetch",
		Operation:    "fetch_page",
		Retryable:    false,
		SafeMessage:  source.Error.Message,
		Recovery:     "operator_repair",
	}, nil
}
