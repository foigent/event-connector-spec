package conformance

import (
	"bytes"
	"encoding/base64"
	"encoding/hex"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"testing"
)

func TestCanonicalJSONSafeIntegerProfileAndUTF16Ordering(t *testing.T) {
	t.Parallel()

	supplementary := "\U00010000"
	basic := "\uE000"
	input := []byte(`{"` + basic + `":1e0,"` + supplementary + `":-0,"text":"<>&` + "\u2028" + `"}`)
	actual, err := canonicalizeJSON(input)
	if err != nil {
		t.Fatalf("canonicalizeJSON: %v", err)
	}
	expected := []byte(`{"text":"<>&` + "\u2028" + `","` + supplementary + `":0,"` + basic + `":1}`)
	if !bytes.Equal(actual, expected) {
		t.Fatalf("canonical bytes\n got: %s\nwant: %s", actual, expected)
	}

	if _, err := canonicalizeJSON([]byte(`{"unsafe":9007199254740992}`)); err == nil {
		t.Fatal("unsafe JSON integer was accepted")
	}
	if _, err := canonicalizeJSON([]byte(`{"fraction":1.5}`)); err == nil {
		t.Fatal("non-integral JSON number was accepted")
	}
}

func TestStrictJSONRejectsNestedAndEscapedDuplicateKeys(t *testing.T) {
	t.Parallel()

	inputs := [][]byte{
		[]byte(`{"payload":{"terminal":{"status":"settled","status":"cancelled"}}}`),
		[]byte(`{"a":1,"\u0061":2}`),
	}
	for _, input := range inputs {
		if _, err := parseStrictJSON(input); !isDuplicateJSONKey(err) {
			t.Fatalf("expected duplicate-key error for %s, got %v", input, err)
		}
	}
	if _, err := parseStrictJSON([]byte(`{"bad":"\uD800"}`)); err == nil {
		t.Fatal("unpaired surrogate was accepted")
	}
}

func TestIdentityInputPreservesAbsentTenantAndOpaqueBytes(t *testing.T) {
	t.Parallel()

	eventID := "req_e\u0301"
	input, err := buildIdentityInput(
		"unirouter",
		"unirouter-development",
		nil,
		"101",
		"202",
		"model.request.completed",
		eventID,
	)
	if err != nil {
		t.Fatalf("buildIdentityInput: %v", err)
	}
	const expectedHex = "666f6967656e742e6576656e742d6964656d706f74656e63792e763100000009756e69726f7574657200000015756e69726f757465722d646576656c6f706d656e74000000000000000331303100000003323032000000176d6f64656c2e726571756573742e636f6d706c65746564000000077265715f65cc81"
	if actual := hex.EncodeToString(input); actual != expectedHex {
		t.Fatalf("identity input\n got: %s\nwant: %s", actual, expectedHex)
	}
	if actual := sha256Reference(input); actual != "sha256:fd256a506369a0fa05dad3ee68f2e577918b97810778e1802d11950112275447" {
		t.Fatalf("idempotency key: %s", actual)
	}
	emptyTenant := ""
	if _, err := buildIdentityInput(
		"unirouter",
		"unirouter-development",
		&emptyTenant,
		"101",
		"202",
		"model.request.completed",
		"request",
	); err == nil {
		t.Fatal("present empty tenant was accepted")
	}
}

func TestDecimalTimestampAndUnicodeBoundaries(t *testing.T) {
	t.Parallel()

	validDecimals := []string{
		"0",
		"9007199254740991",
		"9007199254740992",
		"9223372036854775807",
	}
	invalidDecimals := []string{
		"01",
		"-1",
		"9223372036854775808",
		"1.0",
		"1e3",
		" 1",
	}
	for _, value := range validDecimals {
		if !isValidInt64Decimal(value) {
			t.Errorf("valid int64 decimal rejected: %q", value)
		}
	}
	for _, value := range invalidDecimals {
		if isValidInt64Decimal(value) {
			t.Errorf("invalid int64 decimal accepted: %q", value)
		}
	}

	offset := normalizeMicrosecondTimestamp("2026-07-25T12:05:06.123456+08:00")
	if !offset.Valid || offset.Normalized != "2026-07-25T04:05:06.123456Z" {
		t.Fatalf("offset normalization: %+v", offset)
	}
	loss := normalizeMicrosecondTimestamp("2026-07-25T04:05:06.123456789Z")
	if loss.Valid || loss.ErrorCode != "timestamp_precision_loss" {
		t.Fatalf("sub-microsecond precision: %+v", loss)
	}
	zeroSubmicro := normalizeMicrosecondTimestamp("2026-07-25T04:05:06.123456000Z")
	if !zeroSubmicro.Valid || zeroSubmicro.Normalized != "2026-07-25T04:05:06.123456Z" {
		t.Fatalf("lossless zero sub-microseconds: %+v", zeroSubmicro)
	}

	if !isNFC("model.request.completed") {
		t.Fatal("NFC protocol value was rejected")
	}
	if isNFC("model.reque\u0301st.completed") {
		t.Fatal("non-NFC protocol value was accepted")
	}
	opaque := "req_e\u0301"
	if !bytes.Equal([]byte(opaque), []byte{0x72, 0x65, 0x71, 0x5f, 0x65, 0xcc, 0x81}) {
		t.Fatal("opaque UTF-8 bytes changed")
	}
}

func TestReferenceSourceMappingMatchesGoldenHashInputs(t *testing.T) {
	t.Parallel()

	root := repositoryRoot(t)
	bundleRaw := mustRead(t, filepath.Join(root, "vectors/canonical-vector-bundle.v1.json"))
	var bundle vectorBundle
	if err := decodeStrict(bundleRaw, &bundle); err != nil {
		t.Fatalf("decode bundle: %v", err)
	}
	for _, vector := range bundle.CanonicalEnvelopes {
		sourceRaw := mustRead(t, filepath.Join(root, filepath.FromSlash(vector.SourceInputPath)))
		mapped, source, err := mapReferenceSource(
			sourceRaw,
			bundle.ReferenceMappingContext,
			bundle.CaptureGaps,
		)
		if err != nil {
			t.Fatalf("%s mapReferenceSource: %v", vector.CaseID, err)
		}
		actual, err := canonicalizeValue(mapped)
		if err != nil {
			t.Fatalf("%s canonicalize mapped: %v", vector.CaseID, err)
		}
		expectedRaw := mustRead(t, filepath.Join(root, filepath.FromSlash(vector.InputPath)))
		expected, err := canonicalizeJSON(expectedRaw)
		if err != nil {
			t.Fatalf("%s canonicalize Golden input: %v", vector.CaseID, err)
		}
		if !bytes.Equal(actual, expected) {
			t.Fatalf("%s Source mapping differs from Golden hash input", vector.CaseID)
		}
		if len(actual) != vector.CanonicalBytes {
			t.Fatalf("%s canonical length = %d, want %d", vector.CaseID, len(actual), vector.CanonicalBytes)
		}
		if sha256Reference(actual) != vector.EnvelopeHash {
			t.Fatalf("%s envelope hash mismatch", vector.CaseID)
		}
		integrity := mapped["integrity"].(map[string]any)
		if integrity["source_hash"] != sha256Reference(sourceRaw) {
			t.Fatalf("%s exact Source hash mismatch", vector.CaseID)
		}
		gaps := mapped["payload"].(map[string]any)["capture_gaps"].([]any)
		if len(gaps) != 4 || source.CaptureGaps[1].Source != "request_trace" ||
			gaps[1].(map[string]any)["affected_claim"] != "client_ip_presence" {
			t.Fatalf("%s Source/shared gap order boundary is not preserved", vector.CaseID)
		}
	}
}

func TestReplayStatePreservesCheckpointOnConflictAndPartialPage(t *testing.T) {
	t.Parallel()

	state := newReplayState()
	first := state.processPage([]replayInput{{Identity: "a", EnvelopeHash: "hash-1"}})
	if !first.CheckpointAdvances || !reflect.DeepEqual(first.Outcomes, []string{"inserted"}) {
		t.Fatalf("first page: %+v", first)
	}
	duplicate := state.processPage([]replayInput{{Identity: "a", EnvelopeHash: "hash-1"}})
	if !duplicate.CheckpointAdvances || !reflect.DeepEqual(duplicate.Outcomes, []string{"duplicate_noop"}) {
		t.Fatalf("duplicate page: %+v", duplicate)
	}
	conflict := state.processPage([]replayInput{{Identity: "a", EnvelopeHash: "hash-2"}})
	if conflict.CheckpointAdvances || !reflect.DeepEqual(conflict.Outcomes, []string{"conflict"}) {
		t.Fatalf("conflict page: %+v", conflict)
	}

	partialState := newReplayState()
	partial := partialState.processPage([]replayInput{
		{Identity: "a", EnvelopeHash: "hash-1"},
		{Identity: "b", EnvelopeHash: "hash-2", InjectedError: "retryable_error"},
	})
	if partial.CheckpointAdvances ||
		!reflect.DeepEqual(partial.Outcomes, []string{"inserted", "retryable_error"}) {
		t.Fatalf("partial page: %+v", partial)
	}
	replayed := partialState.processPage([]replayInput{{Identity: "a", EnvelopeHash: "hash-1"}})
	if !reflect.DeepEqual(replayed.Outcomes, []string{"duplicate_noop"}) {
		t.Fatalf("partial replay: %+v", replayed)
	}
}

func TestExecuteProducesExactDeterministicThirtyCaseReport(t *testing.T) {
	root := repositoryRoot(t)
	bundlePath := filepath.Join(root, "vectors/canonical-vector-bundle.v1.json")
	firstPath := filepath.Join(t.TempDir(), "first.json")
	secondPath := filepath.Join(t.TempDir(), "second.json")

	firstSummary, firstExit, firstErr := Execute(bundlePath, firstPath)
	if firstErr != nil || firstExit != ExitPass {
		t.Fatalf("first Execute: summary=%+v exit=%d err=%v", firstSummary, firstExit, firstErr)
	}
	secondSummary, secondExit, secondErr := Execute(bundlePath, secondPath)
	if secondErr != nil || secondExit != ExitPass {
		t.Fatalf("second Execute: summary=%+v exit=%d err=%v", secondSummary, secondExit, secondErr)
	}
	if firstSummary.CaseCount != 30 || firstSummary.Status != "pass" ||
		!reflect.DeepEqual(firstSummary, secondSummary) {
		t.Fatalf("unexpected summaries: first=%+v second=%+v", firstSummary, secondSummary)
	}

	firstBytes := mustRead(t, firstPath)
	secondBytes := mustRead(t, secondPath)
	if !bytes.Equal(firstBytes, secondBytes) {
		t.Fatal("report bytes are not deterministic")
	}
	canonical, err := canonicalizeJSON(firstBytes)
	if err != nil {
		t.Fatalf("canonicalize report: %v", err)
	}
	if !bytes.Equal(firstBytes, canonical) {
		t.Fatal("report file is not exact RFC 8785 canonical JSON")
	}

	var generated report
	if err := decodeStrict(firstBytes, &generated); err != nil {
		t.Fatalf("decode report: %v", err)
	}
	if err := validateGeneratedReport(generated); err != nil {
		t.Fatalf("validate report: %v", err)
	}
	expectedIDs := expectedReportCaseIDs(t, root)
	actualIDs := make([]string, 0, len(generated.Cases))
	byID := make(map[string]reportCase, len(generated.Cases))
	for _, item := range generated.Cases {
		actualIDs = append(actualIDs, item.CaseID)
		byID[item.CaseID] = item
		if !sort.StringsAreSorted(item.CaseClasses) {
			t.Fatalf("%s case classes are not sorted", item.CaseID)
		}
	}
	if !reflect.DeepEqual(actualIDs, expectedIDs) {
		t.Fatalf("case IDs\n got: %v\nwant: %v", actualIDs, expectedIDs)
	}
	assertResultBytes(
		t,
		byID["decimal_strings/zero"],
		[]byte(`{"valid":true,"value":"0"}`),
	)
	assertResultBytes(
		t,
		byID["timestamps/sub-microsecond-loss"],
		[]byte(`{"error_code":"timestamp_precision_loss","valid":false}`),
	)
	assertResultBytes(
		t,
		byID["replay/same-identity-same-hash"],
		[]byte(`{"checkpoint_advances":true,"first_outcome":"inserted","replay_outcome":"duplicate_noop"}`),
	)
}

func expectedReportCaseIDs(t *testing.T, root string) []string {
	t.Helper()
	var bundle vectorBundle
	if err := decodeStrict(
		mustRead(t, filepath.Join(root, "vectors/canonical-vector-bundle.v1.json")),
		&bundle,
	); err != nil {
		t.Fatalf("decode bundle: %v", err)
	}
	var golden goldenFixtureBundle
	if err := decodeStrict(
		mustRead(t, filepath.Join(root, "fixtures/golden-fixture-bundle.v1.json")),
		&golden,
	); err != nil {
		t.Fatalf("decode Golden bundle: %v", err)
	}

	ids := make([]string, 0, 30)
	for _, item := range bundle.CanonicalEnvelopes {
		ids = append(ids, "canonical_envelopes/"+item.CaseID)
	}
	for _, item := range bundle.Idempotency {
		ids = append(ids, "idempotency/"+item.CaseID)
	}
	for _, item := range bundle.DecimalStrings {
		ids = append(ids, "decimal_strings/"+item.CaseID)
	}
	for _, item := range bundle.Timestamps {
		ids = append(ids, "timestamps/"+item.CaseID)
	}
	for _, item := range bundle.Unicode {
		ids = append(ids, "unicode/"+item.CaseID)
	}
	for _, item := range bundle.StrictJSON {
		ids = append(ids, "strict_json/"+item.CaseID)
	}
	for _, item := range bundle.Replay {
		ids = append(ids, "replay/"+item.CaseID)
	}
	for _, item := range golden.NegativeSourceSeeds {
		ids = append(ids, "negative_source_seeds/"+item.CaseID)
	}
	return ids
}

func assertResultBytes(t *testing.T, item reportCase, expected []byte) {
	t.Helper()
	actual, err := base64.StdEncoding.Strict().DecodeString(item.ResultBase64)
	if err != nil {
		t.Fatalf("%s decode result: %v", item.CaseID, err)
	}
	if !bytes.Equal(actual, expected) {
		t.Fatalf("%s result\n got: %s\nwant: %s", item.CaseID, actual, expected)
	}
	if item.ResultSHA256 != sha256Reference(expected) {
		t.Fatalf("%s result digest mismatch", item.CaseID)
	}
}

func repositoryRoot(t *testing.T) string {
	t.Helper()
	workingDirectory, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	root := filepath.Clean(filepath.Join(workingDirectory, "..", "..", "..", ".."))
	if _, err := os.Stat(filepath.Join(root, "vectors/canonical-vector-bundle.v1.json")); err != nil {
		t.Fatalf("resolve repository root %s: %v", root, err)
	}
	return root
}

func mustRead(t *testing.T, path string) []byte {
	t.Helper()
	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	return content
}
