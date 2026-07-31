package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/santhosh-tekuri/jsonschema/v6"
)

const (
	connectorManifestV1 = "foigent://schemas/connector-manifest/v1"
	connectorManifestV2 = "foigent://schemas/connector-manifest/v2"
	eventEnvelopeV1     = "foigent://schemas/event-envelope/v1"
	openInferenceSource = "xinsight://sources/openinference/otlp-span/v1"
	openInferenceEvent  = "foigent://events/observability/openinference-span-completed/v1"
	lifecycleV2         = "foigent://schemas/connector-lifecycle/v2"
	checkpointV2        = "foigent://schemas/connector-checkpoint/v2"
	eventBatchV2        = "foigent://schemas/event-batch/v2"
	errorV2             = "foigent://schemas/connector-error/v2"
	receiptV2           = "foigent://schemas/operational-receipt/v2"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintf(os.Stderr, "source-neutral v2 schema audit failed: %v\n", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	if len(args) != 1 {
		return errors.New("usage: schema-audit-v2 <protocol-root>")
	}
	root, err := filepath.Abs(args[0])
	if err != nil {
		return err
	}
	schemaPaths, err := filepath.Glob(filepath.Join(root, "schemas", "*.json"))
	if err != nil {
		return err
	}
	sort.Strings(schemaPaths)
	if len(schemaPaths) == 0 {
		return errors.New("no schemas found")
	}

	compiler := jsonschema.NewCompiler()
	compiler.DefaultDraft(jsonschema.Draft2020)
	compiler.AssertFormat()
	ids := make(map[string]string, len(schemaPaths))
	for _, path := range schemaPaths {
		value, err := readJSON(path)
		if err != nil {
			return err
		}
		object, ok := value.(map[string]any)
		if !ok {
			return fmt.Errorf("%s: schema is not an object", path)
		}
		id, ok := object["$id"].(string)
		if !ok || id == "" {
			return fmt.Errorf("%s: missing $id", path)
		}
		if previous := ids[id]; previous != "" {
			return fmt.Errorf("duplicate schema id %s: %s and %s", id, previous, path)
		}
		ids[id] = path
		if err := compiler.AddResource(id, value); err != nil {
			return fmt.Errorf("%s: add resource: %w", path, err)
		}
	}

	compiled := make(map[string]*jsonschema.Schema, len(ids))
	for id, path := range ids {
		schema, err := compiler.Compile(id)
		if err != nil {
			return fmt.Errorf("%s: compile: %w", path, err)
		}
		compiled[id] = schema
	}
	for _, required := range []string{
		connectorManifestV1,
		connectorManifestV2,
		eventEnvelopeV1,
		openInferenceSource,
		openInferenceEvent,
		lifecycleV2,
		checkpointV2,
		eventBatchV2,
		errorV2,
		receiptV2,
	} {
		if compiled[required] == nil {
			return fmt.Errorf("required schema is absent: %s", required)
		}
	}

	v1Names := []string{
		"foigent.unirouter.completed-execution-1.0.0.json",
		"foigent.litellm.spend-logs-1.0.0.json",
	}
	for _, name := range v1Names {
		if err := validatePath(
			root,
			filepath.Join("manifests", name),
			compiled[connectorManifestV1],
		); err != nil {
			return err
		}
	}
	if err := validatePath(
		root,
		"manifests/foigent.openinference.otlp-spans-1.0.0.json",
		compiled[connectorManifestV2],
	); err != nil {
		return err
	}
	manifest, err := readJSON(filepath.Join(
		root,
		"manifests/foigent.openinference.otlp-spans-1.0.0.json",
	))
	if err != nil {
		return err
	}
	if err := auditManifestModes(manifest, compiled[connectorManifestV2]); err != nil {
		return err
	}
	if err := validatePath(
		root,
		"fixtures/source/openinference/reference-sanitized-span.v1.json",
		compiled[openInferenceSource],
	); err != nil {
		return err
	}
	source, err := readJSON(filepath.Join(
		root,
		"fixtures/source/openinference/reference-sanitized-span.v1.json",
	))
	if err != nil {
		return err
	}
	sourceAboveInt64 := cloneObject(source)
	sourceAboveInt64["prompt_tokens"] = "9223372036854775808"
	if err := expectInvalid(
		compiled[openInferenceSource],
		sourceAboveInt64,
		"OpenInference Source counter above int64",
	); err != nil {
		return err
	}
	envelopeHashInput, err := readJSON(filepath.Join(
		root,
		"fixtures/shared/openinference-span-envelope.hash-input.json",
	))
	if err != nil {
		return err
	}
	envelope := cloneObject(envelopeHashInput)
	integrity, ok := envelope["integrity"].(map[string]any)
	if !ok {
		return errors.New("OpenInference hash input integrity is not an object")
	}
	integrity["envelope_hash"] =
		"sha256:02dc4475ff08b58ded11359de849f23c0b1d2dd378d376adfe6c2f09e7ea6819"
	if err := expectValid(compiled[eventEnvelopeV1], envelope, "OpenInference Envelope"); err != nil {
		return err
	}
	payload, ok := envelope["payload"].(map[string]any)
	if !ok {
		return errors.New("OpenInference Envelope payload is not an object")
	}
	if err := expectValid(compiled[openInferenceEvent], payload, "OpenInference payload"); err != nil {
		return err
	}
	additionalFixtures := []struct {
		source   string
		envelope string
	}{
		{
			source:   "fixtures/source/openinference/missing-optional-sanitized-span.v1.json",
			envelope: "fixtures/shared/openinference-missing-optional-envelope.hash-input.json",
		},
		{
			source:   "fixtures/source/openinference/ordered-separate-sanitized-span.v1.json",
			envelope: "fixtures/shared/openinference-ordered-separate-envelope.hash-input.json",
		},
		{
			source:   "fixtures/source/openinference/ordered-parent-sanitized-span.v1.json",
			envelope: "fixtures/shared/openinference-ordered-parent-envelope.hash-input.json",
		},
		{
			source:   "fixtures/source/openinference/ordered-child-sanitized-span.v1.json",
			envelope: "fixtures/shared/openinference-ordered-child-envelope.hash-input.json",
		},
	}
	for _, fixture := range additionalFixtures {
		if err := validatePath(root, fixture.source, compiled[openInferenceSource]); err != nil {
			return err
		}
		hashInput, err := readJSON(filepath.Join(root, fixture.envelope))
		if err != nil {
			return err
		}
		candidate := cloneObject(hashInput)
		candidateIntegrity, ok := candidate["integrity"].(map[string]any)
		if !ok {
			return fmt.Errorf("%s: integrity is not an object", fixture.envelope)
		}
		candidateIntegrity["envelope_hash"] = "sha256:" + strings.Repeat("0", 64)
		if err := expectValid(
			compiled[eventEnvelopeV1],
			candidate,
			fixture.envelope,
		); err != nil {
			return err
		}
		candidatePayload, ok := candidate["payload"].(map[string]any)
		if !ok {
			return fmt.Errorf("%s: payload is not an object", fixture.envelope)
		}
		if err := expectValid(
			compiled[openInferenceEvent],
			candidatePayload,
			fixture.envelope+" payload",
		); err != nil {
			return err
		}
	}
	missingEnvelope, err := readJSON(filepath.Join(
		root,
		"fixtures/shared/openinference-missing-optional-envelope.hash-input.json",
	))
	if err != nil {
		return err
	}
	missingActor, _ := missingEnvelope.(map[string]any)["actor"].(map[string]any)
	missingPayload, _ := missingEnvelope.(map[string]any)["payload"].(map[string]any)
	missingUsage, _ := missingPayload["usage"].(map[string]any)
	missingGaps, _ := missingPayload["capture_gaps"].([]any)
	if missingActor["type"] != "system" ||
		len(missingActor) != 1 ||
		len(missingUsage) != 0 ||
		len(missingGaps) != 7 {
		return errors.New("missing optional OpenInference facts were fabricated or gaps were lost")
	}
	orderedChild, err := readJSON(filepath.Join(
		root,
		"fixtures/shared/openinference-ordered-child-envelope.hash-input.json",
	))
	if err != nil {
		return err
	}
	orderedPayload, _ := orderedChild.(map[string]any)["payload"].(map[string]any)
	orderedTrace, _ := orderedPayload["trace"].(map[string]any)
	orderedGaps, _ := orderedPayload["capture_gaps"].([]any)
	if orderedTrace["parent_span_id"] != "1111111111111111" ||
		len(orderedGaps) != 4 {
		return errors.New("bounded parent resolution or conditional Gap semantics changed")
	}
	payloadAboveInt64 := cloneObject(payload)
	usage, ok := payloadAboveInt64["usage"].(map[string]any)
	if !ok {
		return errors.New("OpenInference payload usage is not an object")
	}
	usage["total_tokens"] = "9223372036854775808"
	if err := expectInvalid(
		compiled[openInferenceEvent],
		payloadAboveInt64,
		"OpenInference payload counter above int64",
	); err != nil {
		return err
	}
	envelopeWithDelivery := cloneObject(envelope)
	envelopeWithDelivery["delivery"] = map[string]any{"cursor": "forbidden"}
	if err := expectInvalid(
		compiled[eventEnvelopeV1],
		envelopeWithDelivery,
		"mutable delivery state inside Event Envelope",
	); err != nil {
		return err
	}
	if err := auditOperationalSchemas(compiled, envelope); err != nil {
		return err
	}

	fmt.Printf(
		"source-neutral v2 schema audit passed: %d schemas, %d manifests, "+
			"3 modes, 5 Source fixtures, Envelope/payload/operation-discriminated "+
			"operational boundaries\n",
		len(compiled),
		len(v1Names)+1,
	)
	return nil
}

func auditManifestModes(value any, schema *jsonschema.Schema) error {
	offline := cloneObject(value)
	pull := cloneObject(value)
	pull["transport"] = map[string]any{
		"mode":        "https_pull",
		"route":       "/v1/events",
		"page_schema": "foigent.event-page.v1",
		"max_items":   200,
		"max_bytes":   8388608,
	}
	pull["delivery"] = map[string]any{
		"mode":                      "https_pull",
		"guarantee":                 "at_least_once",
		"convergence":               "after_all_items_converge",
		"conflict":                  "fail_closed",
		"partial_acceptance":        "reject_batch",
		"empty_page_cursor_advance": "fail_closed",
	}
	pull["activation"] = map[string]any{
		"mode":           "activation_forward",
		"broad_backfill": false,
	}
	pull["state_progression"] = map[string]any{
		"mode":             "https_pull",
		"checkpoint":       "required",
		"strategy":         "opaque_cursor",
		"cursor_ownership": "connector_state_only",
	}
	pull["payload_policy"].(map[string]any)["ingestion_capture_mode"] =
		"api_pull_import"
	pull["completeness"].(map[string]any)["delivery_scope"] = "poll_page"

	push := cloneObject(value)
	push["transport"] = map[string]any{
		"mode":            "otlp_http_push",
		"receiver_route":  "/v1/traces",
		"request_schema":  "otlp.export-trace-service-request.json.v1",
		"response_schema": "foigent.otlp-acknowledgement.v1",
		"max_items":       200,
		"max_bytes":       8388608,
	}
	push["delivery"] = map[string]any{
		"mode":               "otlp_http_push",
		"guarantee":          "at_least_once",
		"convergence":        "after_all_items_converge",
		"conflict":           "fail_closed",
		"partial_acceptance": "reject_batch",
		"acknowledgement":    "durable_response_after_all_items_converge",
	}
	push["activation"] = map[string]any{
		"mode":           "receiver_activation_forward",
		"broad_backfill": false,
	}
	push["state_progression"] = map[string]any{
		"mode":            "otlp_http_push",
		"checkpoint":      "not_applicable",
		"replay_identity": "event_identity_and_hash",
	}
	push["payload_policy"].(map[string]any)["ingestion_capture_mode"] =
		"otlp_http_receive"
	push["completeness"].(map[string]any)["delivery_scope"] = "accepted_request"

	for name, document := range map[string]any{
		"pull Manifest":    pull,
		"push Manifest":    push,
		"offline Manifest": offline,
	} {
		if err := expectValid(schema, document, name); err != nil {
			return err
		}
	}
	hybrid := cloneObject(push)
	hybrid["state_progression"] = offline["state_progression"]
	return expectInvalid(schema, hybrid, "hybrid push/offline Manifest")
}

func auditOperationalSchemas(
	compiled map[string]*jsonschema.Schema,
	envelope map[string]any,
) error {
	lifecycles := map[string]map[string]any{
		"pull lifecycle": {
			"lifecycle_version": "foigent.connector-lifecycle.v2",
			"delivery_mode":     "https_pull",
			"configuration":     "configured",
			"authentication":    "valid",
			"transport":         "ready",
			"processing":        "polling",
			"checkpoint": map[string]any{
				"applicability": "required",
				"state":         "steady",
			},
			"health": "healthy",
		},
		"push lifecycle": {
			"lifecycle_version": "foigent.connector-lifecycle.v2",
			"delivery_mode":     "otlp_http_push",
			"configuration":     "configured",
			"authentication":    "valid",
			"transport":         "ready",
			"processing":        "receiving",
			"checkpoint": map[string]any{
				"applicability": "not_applicable",
			},
			"health": "healthy",
		},
		"offline lifecycle": {
			"lifecycle_version": "foigent.connector-lifecycle.v2",
			"delivery_mode":     "bounded_offline",
			"configuration":     "configured",
			"authentication":    "not_applicable",
			"transport":         "not_applicable",
			"processing":        "importing",
			"checkpoint": map[string]any{
				"applicability": "not_applicable",
			},
			"health": "healthy",
		},
	}
	for name, document := range lifecycles {
		if err := expectValid(compiled[lifecycleV2], document, name); err != nil {
			return err
		}
	}
	hybridLifecycle := cloneObject(lifecycles["push lifecycle"])
	hybridLifecycle["checkpoint"] = map[string]any{
		"applicability": "required",
		"state":         "steady",
	}
	if err := expectInvalid(
		compiled[lifecycleV2],
		hybridLifecycle,
		"push lifecycle with Checkpoint",
	); err != nil {
		return err
	}

	checkpoint := map[string]any{
		"checkpoint_version": "foigent.connector-checkpoint.v2",
		"delivery_mode":      "https_pull",
		"connector_id":       "foigent.reference.pull",
		"connector_version":  "1.0.0",
		"producer_instance":  "reference-a",
		"cursor":             "cursor-1",
		"high_watermark":     "2026-07-31T02:00:00.000000Z",
		"phase":              "steady",
		"updated_at":         "2026-07-31T02:01:00.000000Z",
	}
	if err := expectValid(compiled[checkpointV2], checkpoint, "pull Checkpoint"); err != nil {
		return err
	}
	pushCheckpoint := cloneObject(checkpoint)
	pushCheckpoint["delivery_mode"] = "otlp_http_push"
	if err := expectInvalid(
		compiled[checkpointV2],
		pushCheckpoint,
		"push Checkpoint",
	); err != nil {
		return err
	}

	batches := map[string]map[string]any{
		"pull batch": {
			"batch_version":     "foigent.event-batch.v2",
			"connector_id":      "foigent.reference.pull",
			"connector_version": "1.0.0",
			"producer_instance": "reference-a",
			"delivery_mode":     "https_pull",
			"events":            []any{envelope},
			"delivery": map[string]any{
				"mode":             "https_pull",
				"page_observed_at": "2026-07-31T02:01:00.000000Z",
				"next_cursor":      "cursor-2",
				"high_watermark":   "2026-07-31T02:00:00.000000Z",
				"has_more":         false,
			},
		},
		"push batch": {
			"batch_version":     "foigent.event-batch.v2",
			"connector_id":      "foigent.reference.push",
			"connector_version": "1.0.0",
			"producer_instance": "reference-a",
			"delivery_mode":     "otlp_http_push",
			"events":            []any{envelope},
			"delivery": map[string]any{
				"mode":        "otlp_http_push",
				"request_id":  "request-1",
				"received_at": "2026-07-31T02:01:00.000000Z",
			},
		},
		"offline batch": {
			"batch_version":     "foigent.event-batch.v2",
			"connector_id":      "foigent.reference.offline",
			"connector_version": "1.0.0",
			"producer_instance": "reference-a",
			"delivery_mode":     "bounded_offline",
			"events":            []any{envelope},
			"delivery": map[string]any{
				"mode":          "bounded_offline",
				"bundle_id":     "bundle-1",
				"bundle_sha256": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
				"imported_at":   "2026-07-31T02:01:00.000000Z",
			},
		},
	}
	for name, document := range batches {
		if err := expectValid(compiled[eventBatchV2], document, name); err != nil {
			return err
		}
	}
	hybridBatch := cloneObject(batches["push batch"])
	hybridBatch["delivery"] = batches["pull batch"]["delivery"]
	if err := expectInvalid(
		compiled[eventBatchV2],
		hybridBatch,
		"hybrid push/pull batch",
	); err != nil {
		return err
	}

	receipts := map[string]map[string]any{
		"pull receipt": receiptBase("https_pull", "poll", map[string]any{
			"mode":              "https_pull",
			"checkpoint_before": "cursor-1",
			"checkpoint_after":  "cursor-2",
		}),
		"push receipt": receiptBase("otlp_http_push", "acknowledge", map[string]any{
			"mode":            "otlp_http_push",
			"request_id":      "request-1",
			"acknowledgement": "durable",
		}),
		"offline receipt": receiptBase("bounded_offline", "import_bundle", map[string]any{
			"mode":          "bounded_offline",
			"bundle_id":     "bundle-1",
			"bundle_sha256": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		}),
	}
	for name, document := range receipts {
		if err := expectValid(compiled[receiptV2], document, name); err != nil {
			return err
		}
	}
	controlReceipts := map[string]map[string]any{
		"pull control receipt": controlReceiptBase("https_pull", "activate"),
		"push control receipt": controlReceiptBase("otlp_http_push", "rotate"),
		"offline control receipt": controlReceiptBase(
			"bounded_offline",
			"pause",
		),
	}
	for name, document := range controlReceipts {
		if err := expectValid(compiled[receiptV2], document, name); err != nil {
			return err
		}
	}
	for _, operation := range []string{
		"activate", "pause", "resume", "start", "rotate", "stop", "retire",
	} {
		retryableControl := controlReceiptBase("otlp_http_push", operation)
		retryableControl["status"] = "retryable_error"
		retryableControl["error"] = controlReceiptError(operation, true)
		if err := expectValid(
			compiled[receiptV2],
			retryableControl,
			"retryable push control receipt "+operation,
		); err != nil {
			return err
		}
	}
	retryableControl := controlReceiptBase("otlp_http_push", "start")
	retryableControl["status"] = "retryable_error"
	retryableControl["error"] = controlReceiptError("start", true)
	controlErrorPhaseMismatch := cloneObject(retryableControl)
	controlErrorPhaseMismatch["error"].(map[string]any)["phase"] = "receive"
	if err := expectInvalid(
		compiled[receiptV2],
		controlErrorPhaseMismatch,
		"control receipt with data-plane error phase",
	); err != nil {
		return err
	}
	controlErrorOperationMismatch := cloneObject(retryableControl)
	controlErrorOperationMismatch["error"].(map[string]any)["operation"] = "receive_batch"
	if err := expectInvalid(
		compiled[receiptV2],
		controlErrorOperationMismatch,
		"control receipt with data-plane error operation",
	); err != nil {
		return err
	}
	controlErrorRecoveryMismatch := cloneObject(retryableControl)
	controlErrorRecoveryMismatch["error"].(map[string]any)["recovery"] = "resubmit_request"
	if err := expectInvalid(
		compiled[receiptV2],
		controlErrorRecoveryMismatch,
		"control receipt with data-plane recovery",
	); err != nil {
		return err
	}
	controlWithDataState := cloneObject(controlReceipts["push control receipt"])
	controlWithDataState["delivery_state"] = receipts["push receipt"]["delivery_state"]
	if err := expectInvalid(
		compiled[receiptV2],
		controlWithDataState,
		"push control receipt with request acknowledgement",
	); err != nil {
		return err
	}
	dataWithControlState := cloneObject(receipts["pull receipt"])
	dataWithControlState["delivery_state"] = map[string]any{"mode": "control"}
	if err := expectInvalid(
		compiled[receiptV2],
		dataWithControlState,
		"pull data receipt with control state",
	); err != nil {
		return err
	}
	controlWithCounts := cloneObject(controlReceipts["offline control receipt"])
	controlWithCounts["counts"] = map[string]any{
		"received":       1,
		"inserted":       1,
		"duplicate_noop": 0,
		"conflict":       0,
		"rejected":       0,
	}
	if err := expectInvalid(
		compiled[receiptV2],
		controlWithCounts,
		"offline control receipt with data counts",
	); err != nil {
		return err
	}
	hybridReceipt := cloneObject(receipts["offline receipt"])
	hybridReceipt["delivery_state"] = receipts["push receipt"]["delivery_state"]
	if err := expectInvalid(
		compiled[receiptV2],
		hybridReceipt,
		"hybrid offline/push receipt",
	); err != nil {
		return err
	}
	crossModeOperation := cloneObject(receipts["offline receipt"])
	crossModeOperation["operation"] = "poll"
	if err := expectInvalid(
		compiled[receiptV2],
		crossModeOperation,
		"offline receipt with pull operation",
	); err != nil {
		return err
	}
	retryableReceipt := cloneObject(receipts["push receipt"])
	retryableReceipt["status"] = "retryable_error"
	retryableReceipt["delivery_state"].(map[string]any)["acknowledgement"] = "withheld"
	retryableReceipt["counts"] = map[string]any{
		"received":       1,
		"inserted":       0,
		"duplicate_noop": 0,
		"conflict":       0,
		"rejected":       1,
	}
	retryableReceipt["error"] = receiptError(true)
	if err := expectValid(
		compiled[receiptV2],
		retryableReceipt,
		"retryable push receipt",
	); err != nil {
		return err
	}
	completedWithheld := cloneObject(receipts["push receipt"])
	completedWithheld["delivery_state"].(map[string]any)["acknowledgement"] = "withheld"
	if err := expectInvalid(
		compiled[receiptV2],
		completedWithheld,
		"completed push receipt with withheld acknowledgement",
	); err != nil {
		return err
	}
	completedWithError := cloneObject(receipts["push receipt"])
	completedWithError["error"] = receiptError(true)
	if err := expectInvalid(
		compiled[receiptV2],
		completedWithError,
		"completed receipt with error",
	); err != nil {
		return err
	}
	acceptedWithError := cloneObject(receipts["push receipt"])
	acceptedWithError["status"] = "accepted"
	acceptedWithError["delivery_state"].(map[string]any)["acknowledgement"] = "withheld"
	acceptedWithError["counts"] = map[string]any{
		"received":       1,
		"inserted":       0,
		"duplicate_noop": 0,
		"conflict":       0,
		"rejected":       0,
	}
	acceptedWithError["error"] = receiptError(true)
	if err := expectInvalid(
		compiled[receiptV2],
		acceptedWithError,
		"accepted receipt with error",
	); err != nil {
		return err
	}
	retryableWithoutError := cloneObject(retryableReceipt)
	delete(retryableWithoutError, "error")
	if err := expectInvalid(
		compiled[receiptV2],
		retryableWithoutError,
		"retryable receipt without error",
	); err != nil {
		return err
	}
	permanentWithRetryableError := cloneObject(retryableReceipt)
	permanentWithRetryableError["status"] = "permanent_error"
	if err := expectInvalid(
		compiled[receiptV2],
		permanentWithRetryableError,
		"permanent receipt with retryable error",
	); err != nil {
		return err
	}
	completedWithConflict := cloneObject(receipts["offline receipt"])
	completedWithConflict["counts"] = map[string]any{
		"received":       1,
		"inserted":       0,
		"duplicate_noop": 0,
		"conflict":       1,
		"rejected":       0,
	}
	if err := expectInvalid(
		compiled[receiptV2],
		completedWithConflict,
		"completed receipt with conflict",
	); err != nil {
		return err
	}
	acceptedWithOutcome := cloneObject(receipts["push receipt"])
	acceptedWithOutcome["status"] = "accepted"
	acceptedWithOutcome["delivery_state"].(map[string]any)["acknowledgement"] = "withheld"
	if err := expectInvalid(
		compiled[receiptV2],
		acceptedWithOutcome,
		"accepted receipt with terminal outcome",
	); err != nil {
		return err
	}
	unsafeCount := cloneObject(receipts["offline receipt"])
	unsafeCount["counts"].(map[string]any)["received"] = float64(9007199254740992)
	if err := expectInvalid(
		compiled[receiptV2],
		unsafeCount,
		"receipt count above safe integer",
	); err != nil {
		return err
	}

	validError := map[string]any{
		"error_version":       "foigent.connector-error.v2",
		"category":            "transport",
		"code":                "receiver_temporarily_unavailable",
		"phase":               "receive",
		"operation":           "receive_batch",
		"retryable":           true,
		"retry_after_seconds": 5,
		"safe_message":        "receiver temporarily unavailable",
		"recovery":            "resubmit_request",
	}
	if err := expectValid(compiled[errorV2], validError, "retryable push error"); err != nil {
		return err
	}
	invalidError := cloneObject(validError)
	invalidError["retryable"] = false
	return expectInvalid(
		compiled[errorV2],
		invalidError,
		"non-retryable error with retry_after_seconds",
	)
}

func receiptError(retryable bool) map[string]any {
	recovery := "operator_repair"
	if retryable {
		recovery = "resubmit_request"
	}
	return map[string]any{
		"error_version": "foigent.connector-error.v2",
		"category":      "transport",
		"code":          "receipt_processing_failed",
		"phase":         "receive",
		"operation":     "receive_batch",
		"retryable":     retryable,
		"safe_message":  "receipt processing failed",
		"recovery":      recovery,
	}
}

func controlReceiptError(operation string, retryable bool) map[string]any {
	phase := "status"
	if operation == "activate" {
		phase = "activate"
	} else if operation == "stop" || operation == "retire" {
		phase = "shutdown"
	}
	recovery := "operator_repair"
	if retryable {
		recovery = "automatic_retry"
	}
	return map[string]any{
		"error_version": "foigent.connector-error.v2",
		"category":      "transport",
		"code":          "control_operation_failed",
		"phase":         phase,
		"operation":     operation,
		"retryable":     retryable,
		"safe_message":  "control operation failed",
		"recovery":      recovery,
	}
}

func receiptBase(
	mode string,
	operation string,
	deliveryState map[string]any,
) map[string]any {
	return map[string]any{
		"receipt_version":   "foigent.operational-receipt.v2",
		"operation_id":      "operation-1",
		"connector_id":      "foigent.reference.connector",
		"producer_instance": "reference-a",
		"delivery_mode":     mode,
		"operation":         operation,
		"status":            "completed",
		"counts": map[string]any{
			"received":       1,
			"inserted":       1,
			"duplicate_noop": 0,
			"conflict":       0,
			"rejected":       0,
		},
		"delivery_state": deliveryState,
		"observed_at":    "2026-07-31T02:01:00.000000Z",
	}
}

func controlReceiptBase(mode string, operation string) map[string]any {
	return map[string]any{
		"receipt_version":   "foigent.operational-receipt.v2",
		"operation_id":      "control-operation-1",
		"connector_id":      "foigent.reference.connector",
		"producer_instance": "reference-a",
		"delivery_mode":     mode,
		"operation":         operation,
		"status":            "completed",
		"counts": map[string]any{
			"received":       0,
			"inserted":       0,
			"duplicate_noop": 0,
			"conflict":       0,
			"rejected":       0,
		},
		"delivery_state": map[string]any{"mode": "control"},
		"observed_at":    "2026-07-31T02:01:00.000000Z",
	}
}

func cloneObject(value any) map[string]any {
	data, err := json.Marshal(value)
	if err != nil {
		panic(err)
	}
	var result map[string]any
	if err := json.Unmarshal(data, &result); err != nil {
		panic(err)
	}
	return result
}

func expectValid(schema *jsonschema.Schema, value any, name string) error {
	if err := schema.Validate(value); err != nil {
		return fmt.Errorf("%s unexpectedly invalid: %w", name, err)
	}
	return nil
}

func expectInvalid(schema *jsonschema.Schema, value any, name string) error {
	if err := schema.Validate(value); err == nil {
		return fmt.Errorf("%s unexpectedly valid", name)
	}
	return nil
}

func validatePath(root string, relative string, schema *jsonschema.Schema) error {
	value, err := readJSON(filepath.Join(root, filepath.FromSlash(relative)))
	if err != nil {
		return err
	}
	if err := schema.Validate(value); err != nil {
		return fmt.Errorf("%s: %w", relative, err)
	}
	return nil
}

func readJSON(path string) (any, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var value any
	if err := json.Unmarshal(data, &value); err != nil {
		return nil, fmt.Errorf("%s: %w", path, err)
	}
	return value, nil
}
