package conformance

import (
	"bytes"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"sort"
	"strconv"
	"unicode/utf8"
)

func runCanonicalEnvelopeCases(inputs candidateInputs) []caseObservation {
	goldenByID := make(map[string]goldenCase, len(inputs.golden.Cases))
	for _, item := range inputs.golden.Cases {
		goldenByID[item.CaseID] = item
	}

	observations := make([]caseObservation, 0, len(inputs.bundle.CanonicalEnvelopes))
	for _, vector := range inputs.bundle.CanonicalEnvelopes {
		observation := caseObservation{
			id:      "canonical_envelopes/" + vector.CaseID,
			classes: []string{"canonical_envelope", "capture_gap_derivation"},
			kind:    "bytes",
		}
		golden, exists := goldenByID[vector.CaseID]
		addFailure(&observation.failures, exists, "missing corresponding Golden fixture case")
		if !exists {
			observations = append(observations, observation)
			continue
		}
		addFailure(
			&observation.failures,
			vector.SourceInputPath == golden.SourceFixture.ReleasePath,
			"vector and Golden Source paths differ",
		)
		addFailure(
			&observation.failures,
			vector.InputPath == golden.SharedHashInput.Path,
			"vector and Golden shared-input paths differ",
		)
		addFailure(
			&observation.failures,
			vector.CanonicalBytes == golden.Expected.CanonicalBytes &&
				vector.EnvelopeHash == golden.Expected.EnvelopeHash,
			"vector and Golden canonical expectations differ",
		)
		addFailure(
			&observation.failures,
			golden.SharedHashInput.EnvelopeHashField == "absent",
			"Golden hash input does not declare envelope_hash absent",
		)

		sourceBytes, err := readCandidateArtifact(inputs.root, vector.SourceInputPath)
		if err != nil {
			observation.failures = append(observation.failures, err.Error())
			observations = append(observations, observation)
			continue
		}
		addFailure(
			&observation.failures,
			sha256Reference(sourceBytes) == golden.SourceFixture.SHA256,
			"exact Source fixture digest mismatch",
		)

		mapped, source, err := mapReferenceSource(
			sourceBytes,
			inputs.bundle.ReferenceMappingContext,
			inputs.bundle.CaptureGaps,
		)
		if err != nil {
			observation.failures = append(observation.failures, "Source mapping failed: "+err.Error())
			observations = append(observations, observation)
			continue
		}
		mappedCanonical, err := canonicalizeValue(mapped)
		if err != nil {
			observation.failures = append(observation.failures, "mapped Envelope canonicalization failed: "+err.Error())
			observations = append(observations, observation)
			continue
		}
		observation.result = mappedCanonical

		sharedBytes, err := readCandidateArtifact(inputs.root, vector.InputPath)
		if err != nil {
			observation.failures = append(observation.failures, err.Error())
			observations = append(observations, observation)
			continue
		}
		addFailure(
			&observation.failures,
			sha256Reference(sharedBytes) == golden.SharedHashInput.FileSHA256,
			"exact shared hash-input file digest mismatch",
		)
		expectedCanonical, err := canonicalizeJSON(sharedBytes)
		if err != nil {
			observation.failures = append(observation.failures, "shared hash input is not strict canonicalizable JSON: "+err.Error())
			observations = append(observations, observation)
			continue
		}
		addFailure(
			&observation.failures,
			canonicalEqual(mappedCanonical, expectedCanonical),
			"complete Source-to-shared hash-input mapping differs from Golden bytes",
		)
		addFailure(
			&observation.failures,
			len(mappedCanonical) == vector.CanonicalBytes,
			"canonical Envelope byte length mismatch",
		)
		envelopeHash := sha256Reference(mappedCanonical)
		addFailure(
			&observation.failures,
			envelopeHash == vector.EnvelopeHash,
			"canonical Envelope hash mismatch",
		)
		addFailure(
			&observation.failures,
			source.Terminal.Status == golden.Expected.TerminalStatus,
			"terminal status differs from Golden expectation",
		)
		addFailure(
			&observation.failures,
			len(source.CaptureGaps) == golden.Expected.CaptureGapCount,
			"capture-gap count differs from Golden expectation",
		)
		identity, ok := mapped["identity"].(map[string]any)
		if !ok {
			observation.failures = append(observation.failures, "mapped identity is missing")
		} else {
			key, _ := identity["idempotency_key"].(string)
			addFailure(
				&observation.failures,
				key == golden.Expected.IdempotencyKey,
				"idempotency key differs from Golden expectation",
			)
		}
		if err := validateFinalEnvelopeSequence(mapped, mappedCanonical, envelopeHash); err != nil {
			observation.failures = append(observation.failures, "final Envelope validation sequence failed: "+err.Error())
		}
		observations = append(observations, observation)
	}
	return observations
}

func runIdempotencyCases(bundle vectorBundle) []caseObservation {
	observations := make([]caseObservation, 0, len(bundle.Idempotency))
	for _, vector := range bundle.Idempotency {
		observation := caseObservation{
			id:      "idempotency/" + vector.CaseID,
			classes: []string{"scoped_idempotency"},
			kind:    "bytes",
		}
		identityInput, err := buildIdentityInput(
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
			observations = append(observations, observation)
			continue
		}
		observation.result = identityInput
		addFailure(
			&observation.failures,
			hex.EncodeToString(identityInput) == vector.IdentityInputHex,
			"LP identity input bytes mismatch",
		)
		addFailure(
			&observation.failures,
			sha256Reference(identityInput) == vector.IdempotencyKey,
			"scoped idempotency key mismatch",
		)
		if vector.EventIDUTF8Hex != "" {
			addFailure(
				&observation.failures,
				hex.EncodeToString([]byte(vector.EventID)) == vector.EventIDUTF8Hex,
				"opaque event_id UTF-8 bytes mismatch",
			)
		}
		observations = append(observations, observation)
	}
	return observations
}

func runDecimalCases(bundle vectorBundle) []caseObservation {
	observations := make([]caseObservation, 0, len(bundle.DecimalStrings))
	for _, vector := range bundle.DecimalStrings {
		valid := isValidInt64Decimal(vector.Value)
		result, err := canonicalizeValue(map[string]any{
			"valid": valid,
			"value": vector.Value,
		})
		observation := caseObservation{
			id:      "decimal_strings/" + vector.CaseID,
			classes: []string{"decimal_boundary"},
			kind:    "classification",
			result:  result,
		}
		if err != nil {
			observation.failures = append(observation.failures, err.Error())
		}
		addFailure(
			&observation.failures,
			valid == vector.ValidInt64Counter,
			"decimal int64 classification mismatch",
		)
		observations = append(observations, observation)
	}
	return observations
}

func runTimestampCases(bundle vectorBundle) []caseObservation {
	observations := make([]caseObservation, 0, len(bundle.Timestamps))
	for _, vector := range bundle.Timestamps {
		normalized := normalizeMicrosecondTimestamp(vector.Input)
		var resultObject map[string]any
		if normalized.Valid {
			resultObject = map[string]any{
				"normalized": normalized.Normalized,
				"valid":      true,
			}
		} else {
			resultObject = map[string]any{
				"error_code": normalized.ErrorCode,
				"valid":      false,
			}
		}
		result, err := canonicalizeValue(resultObject)
		observation := caseObservation{
			id:      "timestamps/" + vector.CaseID,
			classes: []string{"timestamp_normalization"},
			kind:    "classification",
			result:  result,
		}
		if err != nil {
			observation.failures = append(observation.failures, err.Error())
		}
		addFailure(&observation.failures, normalized.Valid == vector.Valid, "timestamp validity mismatch")
		if vector.Valid {
			addFailure(
				&observation.failures,
				normalized.Normalized == vector.Normalized,
				"UTC microsecond normalization mismatch",
			)
		} else {
			addFailure(
				&observation.failures,
				normalized.ErrorCode == vector.ErrorCode,
				"timestamp error code mismatch",
			)
		}
		observations = append(observations, observation)
	}
	return observations
}

func runUnicodeCases(bundle vectorBundle) []caseObservation {
	observations := make([]caseObservation, 0, len(bundle.Unicode))
	for _, vector := range bundle.Unicode {
		observation := caseObservation{
			id:   "unicode/" + vector.CaseID,
			kind: "classification",
		}
		var resultObject map[string]any
		switch vector.Class {
		case "protocol_controlled":
			observation.classes = []string{"protocol_nfc_rejection"}
			valid := isNFC(vector.Value)
			resultObject = map[string]any{"valid": valid}
			addFailure(&observation.failures, valid == vector.Valid, "protocol NFC classification mismatch")
		case "source_opaque":
			observation.classes = []string{"opaque_utf8_preservation"}
			valid := utf8.ValidString(vector.Value)
			utf8Hex := hex.EncodeToString([]byte(vector.Value))
			resultObject = map[string]any{
				"utf8_hex": utf8Hex,
				"valid":    valid,
			}
			addFailure(&observation.failures, valid == vector.Valid, "opaque UTF-8 classification mismatch")
			addFailure(&observation.failures, utf8Hex == vector.UTF8Hex, "opaque UTF-8 bytes were not preserved")
		default:
			observation.classes = []string{"protocol_nfc_rejection"}
			resultObject = map[string]any{"valid": false}
			observation.failures = append(observation.failures, "unsupported Unicode vector class")
		}
		result, err := canonicalizeValue(resultObject)
		observation.result = result
		if err != nil {
			observation.failures = append(observation.failures, err.Error())
		}
		observations = append(observations, observation)
	}
	return observations
}

func runStrictJSONCases(bundle vectorBundle) []caseObservation {
	observations := make([]caseObservation, 0, len(bundle.StrictJSON))
	for _, vector := range bundle.StrictJSON {
		_, err := parseStrictJSON([]byte(vector.RawJSON))
		valid := err == nil
		errorCode := ""
		if isDuplicateJSONKey(err) {
			errorCode = "duplicate_json_key"
		} else if err != nil {
			errorCode = "invalid_json"
		}
		result, resultErr := canonicalizeValue(map[string]any{
			"error_code": errorCode,
			"valid":      valid,
		})
		observation := caseObservation{
			id:      "strict_json/" + vector.CaseID,
			classes: []string{"duplicate_key_rejection"},
			kind:    "error",
			result:  result,
		}
		if resultErr != nil {
			observation.failures = append(observation.failures, resultErr.Error())
		}
		addFailure(&observation.failures, valid == vector.Valid, "strict JSON validity mismatch")
		addFailure(&observation.failures, errorCode == vector.ErrorCode, "strict JSON error code mismatch")
		observations = append(observations, observation)
	}
	return observations
}

func runReplayCases(bundle vectorBundle) []caseObservation {
	observations := make([]caseObservation, 0, len(bundle.Replay))
	for _, vector := range bundle.Replay {
		observation := caseObservation{
			id:   "replay/" + vector.CaseID,
			kind: "state_transition",
		}
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
			addFailure(
				&observation.failures,
				vector.FirstOutcome != nil && first.Outcomes[0] == *vector.FirstOutcome,
				"first insert outcome mismatch",
			)
			addFailure(
				&observation.failures,
				vector.ReplayOutcome != nil && replay.Outcomes[0] == *vector.ReplayOutcome,
				"duplicate replay outcome mismatch",
			)
			addFailure(
				&observation.failures,
				replay.CheckpointAdvances == vector.CheckpointAdvances,
				"duplicate replay Checkpoint transition mismatch",
			)
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
			addFailure(
				&observation.failures,
				vector.FirstOutcome != nil && first.Outcomes[0] == *vector.FirstOutcome,
				"first insert outcome mismatch",
			)
			addFailure(
				&observation.failures,
				vector.ReplayOutcome != nil && replay.Outcomes[0] == *vector.ReplayOutcome,
				"content conflict outcome mismatch",
			)
			addFailure(
				&observation.failures,
				replay.CheckpointAdvances == vector.CheckpointAdvances,
				"conflict Checkpoint transition mismatch",
			)
		case "partial-page-failure":
			observation.classes = []string{"checkpoint_commit", "partial_page_replay"}
			state := newReplayState()
			firstAttempt := state.processPage([]replayInput{
				{Identity: "event-a", EnvelopeHash: "hash-a"},
				{Identity: "event-b", EnvelopeHash: "hash-b", InjectedError: "retryable_error"},
			})
			nextAttempt := state.processPage([]replayInput{{Identity: "event-a", EnvelopeHash: "hash-a"}})
			observed = map[string]any{
				"first_item":              firstAttempt.Outcomes[0],
				"second_item":             firstAttempt.Outcomes[1],
				"checkpoint_advances":     firstAttempt.CheckpointAdvances,
				"next_attempt_first_item": nextAttempt.Outcomes[0],
			}
			addFailure(
				&observation.failures,
				vector.FirstItem != nil && firstAttempt.Outcomes[0] == *vector.FirstItem,
				"partial-page first item outcome mismatch",
			)
			addFailure(
				&observation.failures,
				vector.SecondItem != nil && firstAttempt.Outcomes[1] == *vector.SecondItem,
				"partial-page second item outcome mismatch",
			)
			addFailure(
				&observation.failures,
				firstAttempt.CheckpointAdvances == vector.CheckpointAdvances,
				"partial-page Checkpoint transition mismatch",
			)
			addFailure(
				&observation.failures,
				vector.NextAttemptFirstItem != nil &&
					nextAttempt.Outcomes[0] == *vector.NextAttemptFirstItem,
				"partial-page replay did not observe duplicate-noop",
			)
		default:
			observation.classes = []string{"checkpoint_commit"}
			observed = map[string]any{"checkpoint_advances": false}
			observation.failures = append(observation.failures, "unsupported replay vector case")
		}
		sort.Strings(observation.classes)
		result, err := canonicalizeValue(observed)
		observation.result = result
		if err != nil {
			observation.failures = append(observation.failures, err.Error())
		}
		expected := replayResultObject(vector)
		expectedBytes, err := canonicalizeValue(expected)
		if err != nil {
			observation.failures = append(observation.failures, err.Error())
		} else {
			addFailure(
				&observation.failures,
				bytes.Equal(result, expectedBytes),
				"observed replay object differs from vector object without case_id",
			)
		}
		observations = append(observations, observation)
	}
	return observations
}

func runNegativeSourceSeedCases(inputs candidateInputs) []caseObservation {
	observations := make([]caseObservation, 0, len(inputs.golden.NegativeSourceSeeds))
	for _, vector := range inputs.golden.NegativeSourceSeeds {
		observation := caseObservation{
			id:   "negative_source_seeds/" + vector.CaseID,
			kind: "error",
		}
		sourceBytes, err := readCandidateArtifact(inputs.root, vector.ReleasePath)
		if err != nil {
			observation.failures = append(observation.failures, err.Error())
			observations = append(observations, observation)
			continue
		}
		addFailure(
			&observation.failures,
			sha256Reference(sourceBytes) == vector.SHA256,
			"negative Source seed digest mismatch",
		)

		var actual connectorError
		switch vector.CaseID {
		case "privacy-redaction-rejected":
			observation.classes = []string{"privacy_rejection"}
			_, mappingErr := decodeAndValidateSource(sourceBytes)
			var sourceErr *sourceMappingError
			addFailure(
				&observation.failures,
				errors.As(mappingErr, &sourceErr) && sourceErr.code == "prohibited_raw_field",
				"privacy seed did not fail with prohibited_raw_field",
			)
			actual = privacyConnectorError()
		case "cursor-expired":
			observation.classes = []string{"cursor_error"}
			actual, err = mapCursorError(sourceBytes)
			if err != nil {
				observation.failures = append(observation.failures, err.Error())
			}
		default:
			observation.classes = []string{"privacy_rejection"}
			observation.failures = append(observation.failures, "unsupported negative Source seed case")
		}
		result, resultErr := canonicalizeValue(actual)
		observation.result = result
		if resultErr != nil {
			observation.failures = append(observation.failures, resultErr.Error())
		}
		expected, expectedErr := canonicalizeValue(vector.ExpectedError)
		if expectedErr != nil {
			observation.failures = append(observation.failures, expectedErr.Error())
		} else {
			addFailure(
				&observation.failures,
				bytes.Equal(result, expected),
				"observed Connector error differs from expected_error",
			)
		}
		observations = append(observations, observation)
	}
	return observations
}

func replayResultObject(vector replayCase) map[string]any {
	result := map[string]any{
		"checkpoint_advances": vector.CheckpointAdvances,
	}
	if vector.FirstOutcome != nil {
		result["first_outcome"] = *vector.FirstOutcome
	}
	if vector.ReplayOutcome != nil {
		result["replay_outcome"] = *vector.ReplayOutcome
	}
	if vector.FirstItem != nil {
		result["first_item"] = *vector.FirstItem
	}
	if vector.SecondItem != nil {
		result["second_item"] = *vector.SecondItem
	}
	if vector.NextAttemptFirstItem != nil {
		result["next_attempt_first_item"] = *vector.NextAttemptFirstItem
	}
	return result
}

func readCandidateArtifact(root string, relativePath string) ([]byte, error) {
	path, err := resolveWithin(root, relativePath)
	if err != nil {
		return nil, fmt.Errorf("resolve %s: %w", relativePath, err)
	}
	content, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", relativePath, err)
	}
	return content, nil
}

func validateFinalEnvelopeSequence(
	envelope map[string]any,
	hashInput []byte,
	expectedEnvelopeHash string,
) error {
	integrity, ok := envelope["integrity"].(map[string]any)
	if !ok {
		return errors.New("integrity object is missing")
	}
	if _, present := integrity["envelope_hash"]; present {
		return errors.New("integrity.envelope_hash is present in hash input")
	}
	reproducedHashInput, err := canonicalizeValue(envelope)
	if err != nil {
		return err
	}
	if !bytes.Equal(reproducedHashInput, hashInput) {
		return errors.New("hash input is not reproducible before hash insertion")
	}
	if sha256Reference(reproducedHashInput) != expectedEnvelopeHash {
		return errors.New("computed Envelope hash differs from expected")
	}

	integrity["envelope_hash"] = expectedEnvelopeHash
	if err := validateFinalReferenceEnvelope(envelope); err != nil {
		delete(integrity, "envelope_hash")
		return err
	}
	delete(integrity, "envelope_hash")
	reproducedAfterRemoval, err := canonicalizeValue(envelope)
	if err != nil {
		return err
	}
	if !bytes.Equal(reproducedAfterRemoval, hashInput) {
		return errors.New("hash input changed after final validation and hash removal")
	}
	return nil
}

func validateFinalReferenceEnvelope(envelope map[string]any) error {
	requiredTopLevel := []string{
		"spec_version",
		"event_id",
		"event_type",
		"schema_ref",
		"schema_version",
		"producer",
		"scope",
		"subject",
		"actor",
		"time",
		"correlation",
		"identity",
		"integrity",
		"data_policy",
		"provenance",
		"payload",
	}
	if len(envelope) != len(requiredTopLevel) {
		return errors.New("final Envelope top-level field set is not exact")
	}
	for _, field := range requiredTopLevel {
		if _, present := envelope[field]; !present {
			return fmt.Errorf("final Envelope is missing %s", field)
		}
	}
	if envelope["spec_version"] != "foigent.event-envelope.v1" ||
		envelope["event_type"] != eventType ||
		envelope["schema_ref"] != eventSchemaRef ||
		envelope["schema_version"] != "1" {
		return errors.New("final Envelope protocol identity is invalid")
	}
	for _, controlled := range []string{
		envelope["spec_version"].(string),
		envelope["event_type"].(string),
		envelope["schema_ref"].(string),
	} {
		if !isNFC(controlled) {
			return errors.New("final Envelope contains non-NFC protocol identity")
		}
	}

	eventID, ok := envelope["event_id"].(string)
	if !ok || !validOpaqueSourceString(eventID, 1, 64, true) {
		return errors.New("final Envelope event_id is invalid")
	}
	scope, ok := envelope["scope"].(map[string]any)
	if !ok || len(scope) != 2 {
		return errors.New("final Envelope scope is invalid")
	}
	orgRef, orgOK := scope["org_ref"].(string)
	projectRef, projectOK := scope["project_ref"].(string)
	if !orgOK || !projectOK ||
		!isCanonicalPositiveDecimal(orgRef) ||
		!isCanonicalPositiveDecimal(projectRef) {
		return errors.New("final Envelope scope references are invalid")
	}
	if _, tenantPresent := scope["tenant_ref"]; tenantPresent {
		return errors.New("Reference Envelope must omit tenant_ref")
	}

	timeObject, ok := envelope["time"].(map[string]any)
	if !ok || len(timeObject) != 2 {
		return errors.New("final Envelope time object is invalid")
	}
	occurredAt, occurredOK := timeObject["occurred_at"].(string)
	terminalAt, terminalOK := timeObject["terminal_at"].(string)
	if !occurredOK || !terminalOK || occurredAt != terminalAt ||
		!normalizeMicrosecondTimestamp(terminalAt).Valid ||
		len(terminalAt) != len("2006-01-02T15:04:05.000000Z") {
		return errors.New("final Envelope terminal/occurred time is invalid")
	}
	if _, observed := timeObject["observed_at"]; observed {
		return errors.New("Reference parent observed_at must be absent")
	}

	identity, ok := envelope["identity"].(map[string]any)
	if !ok || len(identity) != 2 || identity["source_revision"] != "1" {
		return errors.New("final Envelope identity is invalid")
	}
	idempotencyKey, ok := identity["idempotency_key"].(string)
	if !ok || len(idempotencyKey) != len("sha256:")+64 ||
		idempotencyKey[:len("sha256:")] != "sha256:" {
		return errors.New("final Envelope idempotency key is invalid")
	}
	integrity, ok := envelope["integrity"].(map[string]any)
	if !ok || len(integrity) != 2 {
		return errors.New("final Envelope integrity object is invalid")
	}
	for _, field := range []string{"source_hash", "envelope_hash"} {
		digest, ok := integrity[field].(string)
		if !ok || len(digest) != len("sha256:")+64 || digest[:len("sha256:")] != "sha256:" {
			return fmt.Errorf("final Envelope %s is invalid", field)
		}
	}

	payload, ok := envelope["payload"].(map[string]any)
	if !ok || len(payload) != 5 || payload["timeline_complete"] != true {
		return errors.New("final Reference payload field set/finality is invalid")
	}
	terminal, ok := payload["terminal"].(map[string]any)
	if !ok || len(terminal) != 1 ||
		(terminal["status"] != "settled" && terminal["status"] != "cancelled") {
		return errors.New("final Reference terminal discriminator is invalid")
	}
	usage, ok := payload["usage"].(map[string]any)
	if !ok {
		return errors.New("final Reference usage is missing")
	}
	for _, field := range []string{
		"prompt_tokens",
		"uncached_prompt_tokens",
		"cache_read_tokens",
		"cache_creation_tokens",
		"completion_tokens",
	} {
		value, ok := usage[field].(string)
		if !ok || !isValidInt64Decimal(value) {
			return fmt.Errorf("final Reference usage.%s is invalid", field)
		}
	}
	money, ok := payload["money"].(map[string]any)
	if !ok ||
		money["schema"] != "micro-cny.v1" ||
		money["currency"] != "CNY" ||
		money["amount_scale"] != int64(1000000) {
		return errors.New("final Reference money contract is invalid")
	}
	for _, field := range []string{"calculated_cost_micros", "charged_cost_micros"} {
		value, ok := money[field].(string)
		if !ok || !isValidMicroAmount(value) {
			return fmt.Errorf("final Reference money.%s is invalid", field)
		}
	}
	gaps, ok := payload["capture_gaps"].([]any)
	if !ok || len(gaps) != len(sharedGapOrder) {
		return errors.New("final Reference capture_gaps is invalid")
	}
	for index, expectedClaim := range sharedGapOrder {
		gap, ok := gaps[index].(map[string]any)
		if !ok ||
			gap["affected_claim"] != expectedClaim ||
			gap["gap_id"] != eventID+":gap:"+expectedClaim ||
			gap["parent_event_id"] != eventID ||
			gap["reason_code"] != "not_available_at_billing_terminal" ||
			gap["gap_type"] != "not_available_from_source" ||
			gap["severity"] != "warning" ||
			gap["observed_at"] != terminalAt ||
			gap["payload_capture_mode"] != "none" {
			return fmt.Errorf("final Reference gap %s is invalid", expectedClaim)
		}
		provenance, ok := gap["field_provenance"].(map[string]any)
		if !ok || !matchesGapProvenance(provenance) {
			return fmt.Errorf("final Reference gap %s provenance is invalid", expectedClaim)
		}
	}
	return nil
}

func matchesGapProvenance(provenance map[string]any) bool {
	expected := map[string]string{
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
	}
	if len(provenance) != len(expected) {
		return false
	}
	for field, value := range expected {
		if provenance[field] != value {
			return false
		}
	}
	return true
}

func parseDecimal(value string) (int64, error) {
	if !isValidInt64Decimal(value) {
		return 0, errors.New("invalid int64 decimal")
	}
	return strconv.ParseInt(value, 10, 64)
}
