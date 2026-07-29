// Package protocol strictly parses and validates the source-neutral protocol
// wire objects. Domain payload validation remains an explicit consumer-owned
// port because payload schemas are versioned independently.
package protocol

import (
	"fmt"
	"regexp"
	"strconv"
	"unicode"
	"unicode/utf8"

	"github.com/foigent/event-connector-spec/sdk/go/canonical"
)

var (
	eventTypePattern     = regexp.MustCompile(`^[a-z][a-z0-9]*(\.[a-z][a-z0-9_]*)+$`)
	schemaRefPattern     = regexp.MustCompile(`^foigent://events/[a-z0-9][a-z0-9/_-]*/v[1-9][0-9]*$`)
	productPattern       = regexp.MustCompile(`^[a-z][a-z0-9_-]*$`)
	connectorPattern     = regexp.MustCompile(`^[a-z][a-z0-9]*(\.[a-z][a-z0-9_-]*)+$`)
	semverPattern        = regexp.MustCompile(`^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$`)
	positivePattern      = regexp.MustCompile(`^[1-9][0-9]*$`)
	namePattern          = regexp.MustCompile(`^[a-z][a-z0-9_.-]*$`)
	subjectTypePattern   = regexp.MustCompile(`^[a-z][a-z0-9_]*$`)
	shaPattern           = regexp.MustCompile(`^sha256:[0-9a-f]{64}$`)
	microTimePattern     = regexp.MustCompile(`^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}Z$`)
	gitCommitPattern     = regexp.MustCompile(`^[0-9a-f]{40}$`)
	imagePattern         = regexp.MustCompile(`^[a-z0-9.-]+(/[a-z0-9._-]+)+$`)
	routePattern         = regexp.MustCompile(`^/[A-Za-z0-9_./-]+$`)
	componentPathPattern = regexp.MustCompile(`^[A-Za-z0-9._/-]+$`)
)

type ValidationError struct {
	Code string
	Path string
	Why  string
}

func (e *ValidationError) Error() string {
	return fmt.Sprintf("%s at %s: %s", e.Code, e.Path, e.Why)
}

type Envelope struct {
	Value          canonical.Value
	EventID        string
	EventType      string
	EnvelopeHash   string
	IdempotencyKey string
}

type Batch struct {
	Value            canonical.Value
	ConnectorID      string
	ConnectorVersion string
	ProducerInstance string
	GeneratedAt      string
	Events           []Envelope
	NextCursor       string
	HighWatermark    string
	HasMore          bool
}

type Checkpoint struct {
	Value            canonical.Value
	ConnectorID      string
	ConnectorVersion string
	ProducerInstance string
	Cursor           string
	HighWatermark    string
	Phase            string
	UpdatedAt        string
}

type ConnectorError struct {
	Value             canonical.Value
	Category          string
	Code              string
	Phase             string
	Operation         string
	Retryable         bool
	RetryAfterSeconds *int
	SafeMessage       string
	Recovery          string
}

type OperationalReceipt struct {
	Value canonical.Value
}

type Lifecycle struct {
	Value canonical.Value
}

type Manifest struct {
	Value            canonical.Value
	ConnectorID      string
	ConnectorVersion string
}

type PayloadValidator interface {
	Validate(schemaRef string, schemaVersion string, payload canonical.Value) error
}

func ParseEnvelope(data []byte, limits canonical.Limits, payloadValidator PayloadValidator) (Envelope, error) {
	value, err := canonical.Parse(data, limits)
	if err != nil {
		return Envelope{}, invalid("$", err.Error())
	}
	return ValidateEnvelope(value, true, payloadValidator)
}

func ParseEnvelopeHashInput(data []byte, limits canonical.Limits, payloadValidator PayloadValidator) (Envelope, error) {
	value, err := canonical.Parse(data, limits)
	if err != nil {
		return Envelope{}, invalid("$", err.Error())
	}
	return ValidateEnvelope(value, false, payloadValidator)
}

func ValidateEnvelope(value canonical.Value, requireEnvelopeHash bool, payloadValidator PayloadValidator) (Envelope, error) {
	root, err := object(value, "$")
	if err != nil {
		return Envelope{}, err
	}
	required := []string{
		"spec_version", "event_id", "event_type", "schema_ref", "schema_version",
		"producer", "scope", "subject", "actor", "time", "correlation", "identity",
		"integrity", "data_policy", "provenance", "payload",
	}
	if err := exact(root, required, nil, "$"); err != nil {
		return Envelope{}, err
	}
	if err := constant(root, "spec_version", "foigent.event-envelope.v1", "$"); err != nil {
		return Envelope{}, err
	}
	eventID, err := boundedString(root, "event_id", 1, 128, false, "$")
	if err != nil {
		return Envelope{}, err
	}
	eventType, err := patternedString(root, "event_type", eventTypePattern, 128, "$")
	if err != nil {
		return Envelope{}, err
	}
	schemaRef, err := patternedString(root, "schema_ref", schemaRefPattern, 200, "$")
	if err != nil {
		return Envelope{}, err
	}
	schemaVersion, err := patternedString(root, "schema_version", positivePattern, 20, "$")
	if err != nil {
		return Envelope{}, err
	}

	producer, err := memberObject(root, "producer", "$")
	if err != nil {
		return Envelope{}, err
	}
	if err := exact(producer, []string{"product", "instance", "connector_id", "connector_version"}, nil, "$.producer"); err != nil {
		return Envelope{}, err
	}
	product, err := patternedString(producer, "product", productPattern, 64, "$.producer")
	if err != nil {
		return Envelope{}, err
	}
	instance, err := boundedString(producer, "instance", 1, 128, true, "$.producer")
	if err != nil {
		return Envelope{}, err
	}
	if _, err := patternedString(producer, "connector_id", connectorPattern, 160, "$.producer"); err != nil {
		return Envelope{}, err
	}
	if _, err := patternedString(producer, "connector_version", semverPattern, 64, "$.producer"); err != nil {
		return Envelope{}, err
	}

	scope, err := memberObject(root, "scope", "$")
	if err != nil {
		return Envelope{}, err
	}
	if err := exact(scope, []string{"org_ref", "project_ref"}, []string{"tenant_ref"}, "$.scope"); err != nil {
		return Envelope{}, err
	}
	orgRef, err := patternedString(scope, "org_ref", positivePattern, 20, "$.scope")
	if err != nil {
		return Envelope{}, err
	}
	projectRef, err := patternedString(scope, "project_ref", positivePattern, 20, "$.scope")
	if err != nil {
		return Envelope{}, err
	}
	var tenantRef *string
	if _, ok := scope["tenant_ref"]; ok {
		tenant, err := boundedString(scope, "tenant_ref", 1, 128, false, "$.scope")
		if err != nil {
			return Envelope{}, err
		}
		tenantRef = &tenant
	}

	subject, err := memberObject(root, "subject", "$")
	if err != nil {
		return Envelope{}, err
	}
	if err := exact(subject, []string{"type", "ref"}, nil, "$.subject"); err != nil {
		return Envelope{}, err
	}
	if _, err := patternedString(subject, "type", subjectTypePattern, 64, "$.subject"); err != nil {
		return Envelope{}, err
	}
	if _, err := boundedString(subject, "ref", 1, 128, false, "$.subject"); err != nil {
		return Envelope{}, err
	}

	actor, err := memberObject(root, "actor", "$")
	if err != nil {
		return Envelope{}, err
	}
	if err := exact(actor, []string{"type"}, []string{"ref", "on_behalf_of"}, "$.actor"); err != nil {
		return Envelope{}, err
	}
	if _, err := enumString(actor, "type", []string{"system", "service", "user", "unknown"}, "$.actor"); err != nil {
		return Envelope{}, err
	}
	for _, key := range []string{"ref", "on_behalf_of"} {
		if _, ok := actor[key]; ok {
			if _, err := boundedString(actor, key, 1, 128, false, "$.actor"); err != nil {
				return Envelope{}, err
			}
		}
	}

	times, err := memberObject(root, "time", "$")
	if err != nil {
		return Envelope{}, err
	}
	if err := exact(times, nil, []string{"occurred_at", "observed_at", "terminal_at"}, "$.time"); err != nil {
		return Envelope{}, err
	}
	if len(times) == 0 {
		return Envelope{}, invalid("$.time", "must contain at least one time")
	}
	for key := range times {
		if _, err := exactMicroTime(times, key, "$.time"); err != nil {
			return Envelope{}, err
		}
	}

	correlation, err := memberObject(root, "correlation", "$")
	if err != nil {
		return Envelope{}, err
	}
	if err := exact(correlation, nil, []string{"request_ref", "trace_ref", "span_ref", "causation_event_id"}, "$.correlation"); err != nil {
		return Envelope{}, err
	}
	for key := range correlation {
		if _, err := boundedString(correlation, key, 1, 128, false, "$.correlation"); err != nil {
			return Envelope{}, err
		}
	}

	identityObject, err := memberObject(root, "identity", "$")
	if err != nil {
		return Envelope{}, err
	}
	if err := exact(identityObject, []string{"idempotency_key", "source_revision"}, nil, "$.identity"); err != nil {
		return Envelope{}, err
	}
	idempotency, err := shaString(identityObject, "idempotency_key", "$.identity")
	if err != nil {
		return Envelope{}, err
	}
	if _, err := boundedString(identityObject, "source_revision", 1, 64, false, "$.identity"); err != nil {
		return Envelope{}, err
	}
	expectedID, err := canonical.IdempotencyKey(canonical.Identity{
		ProducerProduct: product, ProducerInstance: instance, TenantRef: tenantRef,
		OrgRef: orgRef, ProjectRef: projectRef, EventType: eventType, EventID: eventID,
	})
	if err != nil {
		return Envelope{}, invalid("$.identity", err.Error())
	}
	if idempotency != expectedID {
		return Envelope{}, mismatch("$.identity.idempotency_key", "does not match scoped identity")
	}

	integrity, err := memberObject(root, "integrity", "$")
	if err != nil {
		return Envelope{}, err
	}
	requiredIntegrity := []string{}
	optionalIntegrity := []string{"source_hash"}
	if requireEnvelopeHash {
		requiredIntegrity = append(requiredIntegrity, "envelope_hash")
	} else {
		optionalIntegrity = append(optionalIntegrity, "envelope_hash")
	}
	if err := exact(integrity, requiredIntegrity, optionalIntegrity, "$.integrity"); err != nil {
		return Envelope{}, err
	}
	if _, ok := integrity["source_hash"]; ok {
		if _, err := shaString(integrity, "source_hash", "$.integrity"); err != nil {
			return Envelope{}, err
		}
	}
	envelopeHash := ""
	if requireEnvelopeHash {
		envelopeHash, err = shaString(integrity, "envelope_hash", "$.integrity")
		if err != nil {
			return Envelope{}, err
		}
		hashInput := canonical.Clone(value)
		delete(hashInput.Members["integrity"].Members, "envelope_hash")
		canonicalBytes, err := canonical.CanonicalizeValue(hashInput)
		if err != nil {
			return Envelope{}, invalid("$", err.Error())
		}
		if envelopeHash != canonical.SHA256(canonicalBytes) {
			return Envelope{}, mismatch("$.integrity.envelope_hash", "does not match canonical Envelope hash input")
		}
	} else if _, present := integrity["envelope_hash"]; present {
		return Envelope{}, invalid("$.integrity.envelope_hash", "must be absent from an Envelope hash input")
	}

	dataPolicy, err := memberObject(root, "data_policy", "$")
	if err != nil {
		return Envelope{}, err
	}
	if err := exact(dataPolicy, []string{"payload_capture_mode", "raw_payload_present"}, []string{"redaction_profile"}, "$.data_policy"); err != nil {
		return Envelope{}, err
	}
	if _, err := enumString(dataPolicy, "payload_capture_mode", []string{"none", "metadata_only", "redacted", "full"}, "$.data_policy"); err != nil {
		return Envelope{}, err
	}
	if _, err := boolMember(dataPolicy, "raw_payload_present", "$.data_policy"); err != nil {
		return Envelope{}, err
	}
	if _, ok := dataPolicy["redaction_profile"]; ok {
		if _, err := boundedString(dataPolicy, "redaction_profile", 1, 128, false, "$.data_policy"); err != nil {
			return Envelope{}, err
		}
	}

	provenance, err := memberObject(root, "provenance", "$")
	if err != nil {
		return Envelope{}, err
	}
	if err := exact(provenance, []string{"adapter_fidelity", "field_groups"}, nil, "$.provenance"); err != nil {
		return Envelope{}, err
	}
	if _, err := enumString(provenance, "adapter_fidelity", []string{"F0", "F1", "F2", "F3"}, "$.provenance"); err != nil {
		return Envelope{}, err
	}
	fieldGroups, err := memberObject(provenance, "field_groups", "$.provenance")
	if err != nil {
		return Envelope{}, err
	}
	if len(fieldGroups) == 0 {
		return Envelope{}, invalid("$.provenance.field_groups", "must not be empty")
	}
	for key, item := range fieldGroups {
		if !namePattern.MatchString(key) {
			return Envelope{}, invalid("$.provenance.field_groups", "contains an invalid field-group name")
		}
		if _, err := enumValue(item, []string{"direct", "derived", "declared", "suppressed", "gap", "not_applicable", "unknown"}, "$.provenance.field_groups."+key); err != nil {
			return Envelope{}, err
		}
	}
	payload, err := memberObject(root, "payload", "$")
	if err != nil {
		return Envelope{}, err
	}
	if payloadValidator != nil {
		if err := payloadValidator.Validate(schemaRef, schemaVersion, canonical.Value{Kind: canonical.Object, Members: payload}); err != nil {
			return Envelope{}, invalid("$.payload", err.Error())
		}
	}
	return Envelope{Value: value, EventID: eventID, EventType: eventType, EnvelopeHash: envelopeHash, IdempotencyKey: idempotency}, nil
}

func ParseBatch(data []byte, limits canonical.Limits, payloadValidator PayloadValidator) (Batch, error) {
	value, err := canonical.Parse(data, limits)
	if err != nil {
		return Batch{}, invalid("$", err.Error())
	}
	root, err := object(value, "$")
	if err != nil {
		return Batch{}, err
	}
	required := []string{"batch_version", "connector_id", "connector_version", "producer_instance", "generated_at", "events", "next_cursor", "high_watermark", "has_more"}
	if err := exact(root, required, nil, "$"); err != nil {
		return Batch{}, err
	}
	if err := constant(root, "batch_version", "foigent.event-batch.v1", "$"); err != nil {
		return Batch{}, err
	}
	connectorID, err := boundedString(root, "connector_id", 1, 160, false, "$")
	if err != nil {
		return Batch{}, err
	}
	connectorVersion, err := patternedString(root, "connector_version", semverPattern, 64, "$")
	if err != nil {
		return Batch{}, err
	}
	instance, err := boundedString(root, "producer_instance", 1, 128, true, "$")
	if err != nil {
		return Batch{}, err
	}
	generatedAt, err := exactMicroTime(root, "generated_at", "$")
	if err != nil {
		return Batch{}, err
	}
	eventsValue, ok := root["events"]
	if !ok || eventsValue.Kind != canonical.Array {
		return Batch{}, invalid("$.events", "must be an array")
	}
	if len(eventsValue.Items) > 50 {
		return Batch{}, invalid("$.events", "must contain at most 50 items")
	}
	events := make([]Envelope, len(eventsValue.Items))
	for index, item := range eventsValue.Items {
		events[index], err = ValidateEnvelope(item, true, payloadValidator)
		if err != nil {
			return Batch{}, invalid(fmt.Sprintf("$.events[%d]", index), err.Error())
		}
	}
	nextCursor, err := boundedString(root, "next_cursor", 0, 512, true, "$")
	if err != nil {
		return Batch{}, err
	}
	highWatermark, err := boundedString(root, "high_watermark", 0, 512, true, "$")
	if err != nil {
		return Batch{}, err
	}
	hasMore, err := boolMember(root, "has_more", "$")
	if err != nil {
		return Batch{}, err
	}
	return Batch{
		Value: value, ConnectorID: connectorID, ConnectorVersion: connectorVersion,
		ProducerInstance: instance, GeneratedAt: generatedAt, Events: events,
		NextCursor: nextCursor, HighWatermark: highWatermark, HasMore: hasMore,
	}, nil
}

func ParseCheckpoint(data []byte, limits canonical.Limits) (Checkpoint, error) {
	value, err := canonical.Parse(data, limits)
	if err != nil {
		return Checkpoint{}, invalid("$", err.Error())
	}
	return ValidateCheckpoint(value)
}

func ValidateCheckpoint(value canonical.Value) (Checkpoint, error) {
	root, err := object(value, "$")
	if err != nil {
		return Checkpoint{}, err
	}
	required := []string{"checkpoint_version", "connector_id", "connector_version", "producer_instance", "cursor", "high_watermark", "phase", "updated_at"}
	if err := exact(root, required, nil, "$"); err != nil {
		return Checkpoint{}, err
	}
	if err := constant(root, "checkpoint_version", "foigent.connector-checkpoint.v1", "$"); err != nil {
		return Checkpoint{}, err
	}
	connectorID, err := boundedString(root, "connector_id", 1, 160, false, "$")
	if err != nil {
		return Checkpoint{}, err
	}
	version, err := patternedString(root, "connector_version", semverPattern, 64, "$")
	if err != nil {
		return Checkpoint{}, err
	}
	instance, err := boundedString(root, "producer_instance", 1, 128, true, "$")
	if err != nil {
		return Checkpoint{}, err
	}
	cursor, err := boundedString(root, "cursor", 0, 512, true, "$")
	if err != nil {
		return Checkpoint{}, err
	}
	high, err := boundedString(root, "high_watermark", 0, 512, true, "$")
	if err != nil {
		return Checkpoint{}, err
	}
	phase, err := enumString(root, "phase", []string{"bootstrap", "steady", "error"}, "$")
	if err != nil {
		return Checkpoint{}, err
	}
	updated, err := exactMicroTime(root, "updated_at", "$")
	if err != nil {
		return Checkpoint{}, err
	}
	return Checkpoint{Value: value, ConnectorID: connectorID, ConnectorVersion: version, ProducerInstance: instance, Cursor: cursor, HighWatermark: high, Phase: phase, UpdatedAt: updated}, nil
}

func ParseConnectorError(data []byte, limits canonical.Limits) (ConnectorError, error) {
	value, err := canonical.Parse(data, limits)
	if err != nil {
		return ConnectorError{}, invalid("$", err.Error())
	}
	return ValidateConnectorError(value)
}

func ValidateConnectorError(value canonical.Value) (ConnectorError, error) {
	root, err := object(value, "$")
	if err != nil {
		return ConnectorError{}, err
	}
	required := []string{"error_version", "category", "code", "phase", "operation", "retryable", "safe_message", "recovery"}
	if err := exact(root, required, []string{"retry_after_seconds"}, "$"); err != nil {
		return ConnectorError{}, err
	}
	if err := constant(root, "error_version", "foigent.connector-error.v1", "$"); err != nil {
		return ConnectorError{}, err
	}
	category, err := enumString(root, "category", []string{"configuration", "authentication", "authorization", "transport", "source", "contract", "privacy", "cursor", "conflict", "persistence", "internal"}, "$")
	if err != nil {
		return ConnectorError{}, err
	}
	code, err := patternedString(root, "code", namePattern, 160, "$")
	if err != nil {
		return ConnectorError{}, err
	}
	phase, err := enumString(root, "phase", []string{"configure", "activate", "fetch", "decode", "validate", "normalize", "commit", "checkpoint", "status", "shutdown"}, "$")
	if err != nil {
		return ConnectorError{}, err
	}
	operation, err := patternedString(root, "operation", namePattern, 128, "$")
	if err != nil {
		return ConnectorError{}, err
	}
	retryable, err := boolMember(root, "retryable", "$")
	if err != nil {
		return ConnectorError{}, err
	}
	var retryAfter *int
	if raw, ok := root["retry_after_seconds"]; ok {
		number, err := boundedInteger(raw, 0, 300, "$.retry_after_seconds")
		if err != nil {
			return ConnectorError{}, err
		}
		if !retryable {
			return ConnectorError{}, invalid("$.retry_after_seconds", "is only allowed for retryable errors")
		}
		retryAfter = &number
	}
	safeMessage, err := boundedString(root, "safe_message", 1, 512, true, "$")
	if err != nil {
		return ConnectorError{}, err
	}
	recovery, err := enumString(root, "recovery", []string{"automatic_retry", "restart", "reauthorize", "operator_repair", "explicit_resync", "none"}, "$")
	if err != nil {
		return ConnectorError{}, err
	}
	return ConnectorError{Value: value, Category: category, Code: code, Phase: phase, Operation: operation, Retryable: retryable, RetryAfterSeconds: retryAfter, SafeMessage: safeMessage, Recovery: recovery}, nil
}

func ParseOperationalReceipt(data []byte, limits canonical.Limits) (OperationalReceipt, error) {
	value, err := canonical.Parse(data, limits)
	if err != nil {
		return OperationalReceipt{}, invalid("$", err.Error())
	}
	root, err := object(value, "$")
	if err != nil {
		return OperationalReceipt{}, err
	}
	required := []string{"receipt_version", "operation_id", "connector_id", "producer_instance", "operation", "status", "counts", "observed_at"}
	if err := exact(root, required, []string{"checkpoint_before", "checkpoint_after", "error"}, "$"); err != nil {
		return OperationalReceipt{}, err
	}
	if err := constant(root, "receipt_version", "foigent.operational-receipt.v1", "$"); err != nil {
		return OperationalReceipt{}, err
	}
	for _, check := range []struct {
		key string
		max int
	}{{"operation_id", 128}, {"connector_id", 160}, {"producer_instance", 128}} {
		if _, err := boundedString(root, check.key, 1, check.max, check.key == "producer_instance", "$"); err != nil {
			return OperationalReceipt{}, err
		}
	}
	if _, err := enumString(root, "operation", []string{"activate", "poll", "commit_page", "pause", "resume", "stop", "start", "rotate", "retire"}, "$"); err != nil {
		return OperationalReceipt{}, err
	}
	status, err := enumString(root, "status", []string{"accepted", "completed", "retryable_error", "permanent_error"}, "$")
	if err != nil {
		return OperationalReceipt{}, err
	}
	counts, err := memberObject(root, "counts", "$")
	if err != nil {
		return OperationalReceipt{}, err
	}
	countKeys := []string{"received", "inserted", "duplicate_noop", "conflict", "rejected"}
	if err := exact(counts, countKeys, nil, "$.counts"); err != nil {
		return OperationalReceipt{}, err
	}
	total := 0
	received := 0
	for _, key := range countKeys {
		value, err := boundedInteger(counts[key], 0, int(^uint(0)>>1), "$.counts."+key)
		if err != nil {
			return OperationalReceipt{}, err
		}
		if key == "received" {
			received = value
		} else {
			total += value
		}
	}
	if status == "completed" && received != total {
		return OperationalReceipt{}, invalid("$.counts", "completed receipt counts must fully classify received items")
	}
	for _, key := range []string{"checkpoint_before", "checkpoint_after"} {
		if _, ok := root[key]; ok {
			if _, err := boundedString(root, key, 0, 512, true, "$"); err != nil {
				return OperationalReceipt{}, err
			}
		}
	}
	if _, err := exactMicroTime(root, "observed_at", "$"); err != nil {
		return OperationalReceipt{}, err
	}
	if errorValue, ok := root["error"]; ok {
		if _, err := ValidateConnectorError(errorValue); err != nil {
			return OperationalReceipt{}, invalid("$.error", err.Error())
		}
	}
	return OperationalReceipt{Value: value}, nil
}

func ParseLifecycle(data []byte, limits canonical.Limits) (Lifecycle, error) {
	value, err := canonical.Parse(data, limits)
	if err != nil {
		return Lifecycle{}, invalid("$", err.Error())
	}
	root, err := object(value, "$")
	if err != nil {
		return Lifecycle{}, err
	}
	required := []string{"lifecycle_version", "configuration", "authentication", "transport", "processing", "checkpoint", "health"}
	if err := exact(root, required, nil, "$"); err != nil {
		return Lifecycle{}, err
	}
	if err := constant(root, "lifecycle_version", "foigent.connector-lifecycle.v1", "$"); err != nil {
		return Lifecycle{}, err
	}
	enums := map[string][]string{
		"configuration":  {"unconfigured", "configured", "retired"},
		"authentication": {"absent", "staged", "valid", "revoked", "error"},
		"transport":      {"stopped", "starting", "ready", "backoff", "error"},
		"processing":     {"inactive", "idle", "polling", "committing", "backoff", "stopping", "error"},
		"checkpoint":     {"absent", "bootstrap", "steady", "error"},
		"health":         {"unknown", "healthy", "degraded", "permanent_error", "stopped", "retired"},
	}
	for key, allowed := range enums {
		if _, err := enumString(root, key, allowed, "$"); err != nil {
			return Lifecycle{}, err
		}
	}
	return Lifecycle{Value: value}, nil
}

func ParseManifest(data []byte, limits canonical.Limits) (Manifest, error) {
	value, err := canonical.Parse(data, limits)
	if err != nil {
		return Manifest{}, invalid("$", err.Error())
	}
	root, err := object(value, "$")
	if err != nil {
		return Manifest{}, err
	}
	required := []string{
		"manifest_version", "connector_id", "connector_version", "connector_class", "direction",
		"source_product", "event_identity_profile", "supported_source_schemas", "emitted_event_schemas",
		"transport", "delivery", "bootstrap", "checkpoint", "coverage", "instance_binding",
		"payload_policy", "required_capabilities", "declared_capture_gaps", "compatibility",
	}
	if err := exact(root, required, []string{"source_release"}, "$"); err != nil {
		return Manifest{}, err
	}
	if err := constant(root, "manifest_version", "foigent.connector-manifest.v1", "$"); err != nil {
		return Manifest{}, err
	}
	connectorID, err := patternedString(root, "connector_id", connectorPattern, 160, "$")
	if err != nil {
		return Manifest{}, err
	}
	version, err := patternedString(root, "connector_version", semverPattern, 64, "$")
	if err != nil {
		return Manifest{}, err
	}
	if _, err := enumString(root, "connector_class", []string{"integration", "value", "enforcement"}, "$"); err != nil {
		return Manifest{}, err
	}
	if _, err := enumString(root, "direction", []string{"source", "sink", "bidirectional"}, "$"); err != nil {
		return Manifest{}, err
	}
	if _, err := patternedString(root, "source_product", productPattern, 64, "$"); err != nil {
		return Manifest{}, err
	}
	if _, err := patternedString(root, "event_identity_profile", connectorPattern, 200, "$"); err != nil {
		return Manifest{}, err
	}
	if err := validateManifestSchemaRefs(root); err != nil {
		return Manifest{}, err
	}
	if err := validateManifestTransport(root); err != nil {
		return Manifest{}, err
	}
	if err := validateManifestPolicy(root); err != nil {
		return Manifest{}, err
	}
	if sourceRelease, ok := root["source_release"]; ok {
		if err := validateSourceRelease(sourceRelease); err != nil {
			return Manifest{}, err
		}
	}
	return Manifest{Value: value, ConnectorID: connectorID, ConnectorVersion: version}, nil
}

func validateManifestSchemaRefs(root map[string]canonical.Value) error {
	sourceSchemas, err := arrayMember(root, "supported_source_schemas", "$")
	if err != nil || len(sourceSchemas) == 0 {
		if err != nil {
			return err
		}
		return invalid("$.supported_source_schemas", "must not be empty")
	}
	seen := map[string]struct{}{}
	for index, item := range sourceSchemas {
		path := fmt.Sprintf("$.supported_source_schemas[%d]", index)
		object, err := object(item, path)
		if err != nil {
			return err
		}
		if err := exact(object, []string{"schema_id", "sha256"}, nil, path); err != nil {
			return err
		}
		id, err := boundedString(object, "schema_id", 1, 200, false, path)
		if err != nil {
			return err
		}
		if _, duplicate := seen[id]; duplicate {
			return invalid(path, "duplicates schema_id")
		}
		seen[id] = struct{}{}
		if _, err := shaString(object, "sha256", path); err != nil {
			return err
		}
	}
	eventSchemas, err := arrayMember(root, "emitted_event_schemas", "$")
	if err != nil || len(eventSchemas) == 0 {
		if err != nil {
			return err
		}
		return invalid("$.emitted_event_schemas", "must not be empty")
	}
	for index, item := range eventSchemas {
		path := fmt.Sprintf("$.emitted_event_schemas[%d]", index)
		object, err := object(item, path)
		if err != nil {
			return err
		}
		if err := exact(object, []string{"event_type", "schema_ref", "schema_version"}, nil, path); err != nil {
			return err
		}
		if _, err := boundedString(object, "event_type", 1, 128, false, path); err != nil {
			return err
		}
		if _, err := boundedString(object, "schema_ref", 1, 200, false, path); err != nil {
			return err
		}
		if _, err := patternedString(object, "schema_version", positivePattern, 20, path); err != nil {
			return err
		}
	}
	return nil
}

func validateManifestTransport(root map[string]canonical.Value) error {
	transport, err := memberObject(root, "transport", "$")
	if err != nil {
		return err
	}
	if err := exact(transport, []string{"mode", "route", "page_schema", "max_items", "max_bytes"}, nil, "$.transport"); err != nil {
		return err
	}
	if err := constant(transport, "mode", "https_pull", "$.transport"); err != nil {
		return err
	}
	if _, err := patternedString(transport, "route", routePattern, 240, "$.transport"); err != nil {
		return err
	}
	if _, err := boundedString(transport, "page_schema", 1, 160, false, "$.transport"); err != nil {
		return err
	}
	if _, err := boundedInteger(transport["max_items"], 1, 1000, "$.transport.max_items"); err != nil {
		return err
	}
	if _, err := boundedInteger(transport["max_bytes"], 1, int(^uint(0)>>1), "$.transport.max_bytes"); err != nil {
		return err
	}
	return nil
}

func validateManifestPolicy(root map[string]canonical.Value) error {
	constObjects := map[string]map[string]string{
		"delivery": {
			"guarantee": "at_least_once", "checkpoint_commit": "after_all_items_converge",
			"conflict": "fail_closed", "empty_page_cursor_advance": "fail_closed",
		},
		"bootstrap": {"mode": "activation_forward"},
		"instance_binding": {
			"source_field": "source_instance", "envelope_field": "producer.instance",
			"comparison": "exact_utf8_bytes", "change_semantics": "new_connector_instance_identity_domain",
		},
		"payload_policy": {
			"ingestion_capture_mode": "api_import", "payload_capture_mode": "metadata_only",
		},
	}
	for name, constants := range constObjects {
		object, err := memberObject(root, name, "$")
		if err != nil {
			return err
		}
		required := make([]string, 0, len(constants))
		for key := range constants {
			required = append(required, key)
		}
		if name == "bootstrap" {
			required = append(required, "broad_backfill")
		}
		if name == "payload_policy" {
			required = append(required, "raw_payload_present")
		}
		if err := exact(object, required, nil, "$."+name); err != nil {
			return err
		}
		for key, expected := range constants {
			if err := constant(object, key, expected, "$."+name); err != nil {
				return err
			}
		}
		if name == "bootstrap" {
			value, err := boolMember(object, "broad_backfill", "$.bootstrap")
			if err != nil || value {
				if err != nil {
					return err
				}
				return invalid("$.bootstrap.broad_backfill", "must be false")
			}
		}
		if name == "payload_policy" {
			value, err := boolMember(object, "raw_payload_present", "$.payload_policy")
			if err != nil || value {
				if err != nil {
					return err
				}
				return invalid("$.payload_policy.raw_payload_present", "must be false")
			}
		}
	}
	checkpoint, err := memberObject(root, "checkpoint", "$")
	if err != nil {
		return err
	}
	if err := exact(checkpoint, []string{"strategy", "cursor_ownership"}, nil, "$.checkpoint"); err != nil {
		return err
	}
	if _, err := enumString(checkpoint, "strategy", []string{"opaque_cursor", "litellm_start_time_boundary_v1"}, "$.checkpoint"); err != nil {
		return err
	}
	if err := constant(checkpoint, "cursor_ownership", "connector_state_only", "$.checkpoint"); err != nil {
		return err
	}
	coverage, err := memberObject(root, "coverage", "$")
	if err != nil {
		return err
	}
	if err := exact(coverage, []string{"included", "excluded"}, nil, "$.coverage"); err != nil {
		return err
	}
	for _, key := range []string{"included", "excluded"} {
		if err := validateStringArray(coverage, key, 240, false, "$.coverage"); err != nil {
			return err
		}
	}
	if err := validateStringArray(root, "required_capabilities", 128, true, "$"); err != nil {
		return err
	}
	gaps, err := arrayMember(root, "declared_capture_gaps", "$")
	if err != nil {
		return err
	}
	if len(gaps) == 0 {
		return invalid("$.declared_capture_gaps", "must not be empty")
	}
	seenGaps := make(map[string]struct{}, len(gaps))
	for index, gapValue := range gaps {
		path := fmt.Sprintf("$.declared_capture_gaps[%d]", index)
		gap, err := object(gapValue, path)
		if err != nil {
			return err
		}
		if err := exact(gap, []string{"affected_claim", "reason_code"}, nil, path); err != nil {
			return err
		}
		claim, err := boundedString(gap, "affected_claim", 1, 128, false, path)
		if err != nil {
			return err
		}
		reason, err := boundedString(gap, "reason_code", 1, 128, false, path)
		if err != nil {
			return err
		}
		key := claim + "\x00" + reason
		if _, duplicate := seenGaps[key]; duplicate {
			return invalid(path, "duplicates a declared capture gap")
		}
		seenGaps[key] = struct{}{}
	}
	compatibility, err := memberObject(root, "compatibility", "$")
	if err != nil {
		return err
	}
	requiredCompatibility := []string{"reference_profile", "reference_projection_contract", "reference_compatibility_vector_bundle", "source_revision", "timeline_complete", "retention"}
	if err := exact(compatibility, requiredCompatibility, nil, "$.compatibility"); err != nil {
		return err
	}
	if err := constant(compatibility, "source_revision", "1", "$.compatibility"); err != nil {
		return err
	}
	timeline, err := boolMember(compatibility, "timeline_complete", "$.compatibility")
	if err != nil || !timeline {
		if err != nil {
			return err
		}
		return invalid("$.compatibility.timeline_complete", "must be true")
	}
	if err := constant(compatibility, "retention", "7d", "$.compatibility"); err != nil {
		return err
	}
	if _, err := boundedString(compatibility, "reference_profile", 1, 200, false, "$.compatibility"); err != nil {
		return err
	}
	for _, key := range []string{"reference_projection_contract", "reference_compatibility_vector_bundle"} {
		component, err := memberObject(compatibility, key, "$.compatibility")
		if err != nil {
			return err
		}
		if err := exact(component, []string{"path", "sha256"}, nil, "$.compatibility."+key); err != nil {
			return err
		}
		path, err := boundedString(component, "path", 1, 240, false, "$.compatibility."+key)
		if err != nil {
			return err
		}
		if !componentPathPattern.MatchString(path) {
			return invalid("$.compatibility."+key+".path", "has invalid component path syntax")
		}
		if _, err := shaString(component, "sha256", "$.compatibility."+key); err != nil {
			return err
		}
	}
	return nil
}

func validateStringArray(root map[string]canonical.Value, key string, maximum int, unique bool, path string) error {
	items, err := arrayMember(root, key, path)
	if err != nil {
		return err
	}
	if len(items) == 0 {
		return invalid(path+"."+key, "must not be empty")
	}
	seen := make(map[string]struct{}, len(items))
	for index, item := range items {
		value, err := stringValue(item, fmt.Sprintf("%s.%s[%d]", path, key, index))
		if err != nil {
			return err
		}
		length := utf8.RuneCountInString(value)
		if length == 0 || length > maximum {
			return invalid(fmt.Sprintf("%s.%s[%d]", path, key, index), "has invalid length")
		}
		if _, duplicate := seen[value]; unique && duplicate {
			return invalid(path+"."+key, "must contain unique items")
		}
		seen[value] = struct{}{}
	}
	return nil
}

func validateSourceRelease(value canonical.Value) error {
	root, err := object(value, "$.source_release")
	if err != nil {
		return err
	}
	if err := exact(root, []string{"version", "git_commit", "image", "platform_manifests", "signature"}, nil, "$.source_release"); err != nil {
		return err
	}
	if _, err := boundedString(root, "version", 1, 80, false, "$.source_release"); err != nil {
		return err
	}
	commit, err := boundedString(root, "git_commit", 40, 40, false, "$.source_release")
	if err != nil || !gitCommitPattern.MatchString(commit) {
		if err != nil {
			return err
		}
		return invalid("$.source_release.git_commit", "must be a lowercase 40-character commit")
	}
	image, err := memberObject(root, "image", "$.source_release")
	if err != nil {
		return err
	}
	if err := exact(image, []string{"repository", "index_digest"}, nil, "$.source_release.image"); err != nil {
		return err
	}
	repository, err := boundedString(image, "repository", 1, 200, false, "$.source_release.image")
	if err != nil || !imagePattern.MatchString(repository) {
		if err != nil {
			return err
		}
		return invalid("$.source_release.image.repository", "has invalid image repository syntax")
	}
	if _, err := shaString(image, "index_digest", "$.source_release.image"); err != nil {
		return err
	}
	platforms, err := memberObject(root, "platform_manifests", "$.source_release")
	if err != nil {
		return err
	}
	if err := exact(platforms, []string{"linux_amd64", "linux_arm64"}, nil, "$.source_release.platform_manifests"); err != nil {
		return err
	}
	for _, key := range []string{"linux_amd64", "linux_arm64"} {
		if _, err := shaString(platforms, key, "$.source_release.platform_manifests"); err != nil {
			return err
		}
	}
	signature, err := memberObject(root, "signature", "$.source_release")
	if err != nil {
		return err
	}
	if err := exact(signature, []string{"scheme", "public_key_sha256", "verified_index_digest"}, nil, "$.source_release.signature"); err != nil {
		return err
	}
	if err := constant(signature, "scheme", "cosign-key-v1", "$.source_release.signature"); err != nil {
		return err
	}
	for _, key := range []string{"public_key_sha256", "verified_index_digest"} {
		if _, err := shaString(signature, key, "$.source_release.signature"); err != nil {
			return err
		}
	}
	return nil
}

func object(value canonical.Value, path string) (map[string]canonical.Value, error) {
	if value.Kind != canonical.Object {
		return nil, invalid(path, "must be an object")
	}
	return value.Members, nil
}

func memberObject(root map[string]canonical.Value, key, path string) (map[string]canonical.Value, error) {
	value, ok := root[key]
	if !ok {
		return nil, invalid(path+"."+key, "is required")
	}
	return object(value, path+"."+key)
}

func arrayMember(root map[string]canonical.Value, key, path string) ([]canonical.Value, error) {
	value, ok := root[key]
	if !ok || value.Kind != canonical.Array {
		return nil, invalid(path+"."+key, "must be an array")
	}
	return value.Items, nil
}

func exact(root map[string]canonical.Value, required, optional []string, path string) error {
	allowed := make(map[string]struct{}, len(required)+len(optional))
	for _, key := range required {
		allowed[key] = struct{}{}
		if _, ok := root[key]; !ok {
			return invalid(path+"."+key, "is required")
		}
	}
	for _, key := range optional {
		allowed[key] = struct{}{}
	}
	for key := range root {
		if _, ok := allowed[key]; !ok {
			return invalid(path+"."+key, "is not allowed")
		}
	}
	return nil
}

func stringValue(value canonical.Value, path string) (string, error) {
	if value.Kind != canonical.String {
		return "", invalid(path, "must be a string")
	}
	if !utf8.ValidString(value.Text) {
		return "", invalid(path, "must be valid UTF-8")
	}
	return value.Text, nil
}

func boundedString(root map[string]canonical.Value, key string, minimum, maximum int, rejectControls bool, path string) (string, error) {
	value, ok := root[key]
	if !ok {
		return "", invalid(path+"."+key, "is required")
	}
	text, err := stringValue(value, path+"."+key)
	if err != nil {
		return "", err
	}
	length := utf8.RuneCountInString(text)
	if length < minimum || length > maximum {
		return "", invalid(path+"."+key, fmt.Sprintf("must contain %d..%d Unicode scalars", minimum, maximum))
	}
	if rejectControls {
		for _, r := range text {
			if unicode.IsControl(r) {
				return "", invalid(path+"."+key, "must not contain control characters")
			}
		}
	}
	return text, nil
}

func patternedString(root map[string]canonical.Value, key string, pattern *regexp.Regexp, maximum int, path string) (string, error) {
	text, err := boundedString(root, key, 1, maximum, false, path)
	if err != nil {
		return "", err
	}
	if !canonical.IsNFC(text) || !pattern.MatchString(text) {
		return "", invalid(path+"."+key, "does not match the protocol-controlled format")
	}
	return text, nil
}

func enumString(root map[string]canonical.Value, key string, allowed []string, path string) (string, error) {
	value, ok := root[key]
	if !ok {
		return "", invalid(path+"."+key, "is required")
	}
	return enumValue(value, allowed, path+"."+key)
}

func enumValue(value canonical.Value, allowed []string, path string) (string, error) {
	text, err := stringValue(value, path)
	if err != nil {
		return "", err
	}
	for _, candidate := range allowed {
		if text == candidate {
			return text, nil
		}
	}
	return "", invalid(path, "contains an unsupported enum value")
}

func constant(root map[string]canonical.Value, key, expected, path string) error {
	actual, err := stringValue(root[key], path+"."+key)
	if err != nil {
		return err
	}
	if actual != expected {
		return invalid(path+"."+key, "must equal "+expected)
	}
	return nil
}

func boolMember(root map[string]canonical.Value, key, path string) (bool, error) {
	value, ok := root[key]
	if !ok || value.Kind != canonical.Boolean {
		return false, invalid(path+"."+key, "must be a boolean")
	}
	return value.Bool, nil
}

func exactMicroTime(root map[string]canonical.Value, key, path string) (string, error) {
	text, err := boundedString(root, key, 27, 27, false, path)
	if err != nil {
		return "", err
	}
	if !microTimePattern.MatchString(text) {
		return "", invalid(path+"."+key, "must be exact UTC microseconds")
	}
	normalized := canonical.NormalizeMicrosecondTimestamp(text)
	if normalized.ErrorCode != "" || normalized.Normalized != text {
		return "", invalid(path+"."+key, "must be a valid exact UTC microsecond instant")
	}
	return text, nil
}

func shaString(root map[string]canonical.Value, key, path string) (string, error) {
	text, err := boundedString(root, key, 71, 71, false, path)
	if err != nil {
		return "", err
	}
	if !shaPattern.MatchString(text) {
		return "", invalid(path+"."+key, "must be a lowercase sha256 reference")
	}
	return text, nil
}

func boundedInteger(value canonical.Value, minimum, maximum int, path string) (int, error) {
	if value.Kind != canonical.Number {
		return 0, invalid(path, "must be an integer")
	}
	parsed, err := strconv.ParseInt(value.NumberText, 10, 64)
	if err != nil || parsed < int64(minimum) || parsed > int64(maximum) {
		return 0, invalid(path, fmt.Sprintf("must be in range %d..%d", minimum, maximum))
	}
	return int(parsed), nil
}

func invalid(path, why string) error {
	return &ValidationError{Code: "invalid_protocol_object", Path: path, Why: why}
}

func mismatch(path, why string) error {
	return &ValidationError{Code: "protocol_integrity_mismatch", Path: path, Why: why}
}
