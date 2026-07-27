package conformance

import (
	"bytes"
	"encoding/base64"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

type candidateInputs struct {
	root       string
	bundle     vectorBundle
	bundleRaw  []byte
	golden     goldenFixtureBundle
	goldenRaw  []byte
	sourceSeed sourceSeedIndex
}

type caseObservation struct {
	id       string
	classes  []string
	kind     string
	result   []byte
	failures []string
}

func Execute(bundlePath string, reportPath string) (Summary, int, error) {
	inputs, err := loadCandidateInputs(bundlePath)
	if err != nil {
		return Summary{}, ExitInvalidArtifact, err
	}

	observations := runAllCases(inputs)
	generated := buildReport(observations)
	if err := validateGeneratedReport(generated); err != nil {
		return Summary{}, ExitInternalFailure, fmt.Errorf("generated report is invalid: %w", err)
	}
	reportBytes, err := canonicalizeValue(generated)
	if err != nil {
		return Summary{}, ExitInternalFailure, fmt.Errorf("canonicalize report: %w", err)
	}
	if err := writeFileAtomically(reportPath, reportBytes); err != nil {
		return Summary{}, ExitInternalFailure, fmt.Errorf("write report: %w", err)
	}

	summary := Summary{Status: generated.Status, CaseCount: len(generated.Cases)}
	if generated.Status == "fail" {
		return summary, ExitMismatch, nil
	}
	return summary, ExitPass, nil
}

func loadCandidateInputs(bundlePath string) (candidateInputs, error) {
	absoluteBundle, err := filepath.Abs(bundlePath)
	if err != nil {
		return candidateInputs{}, fmt.Errorf("resolve bundle path: %w", err)
	}
	bundleRaw, err := os.ReadFile(absoluteBundle)
	if err != nil {
		return candidateInputs{}, fmt.Errorf("read canonical vector bundle: %w", err)
	}
	if actual := sha256Reference(bundleRaw); actual != expectedBundleSHA256 {
		return candidateInputs{}, fmt.Errorf(
			"canonical vector bundle digest mismatch: got %s, want %s",
			actual,
			expectedBundleSHA256,
		)
	}

	var bundle vectorBundle
	if err := decodeStrict(bundleRaw, &bundle); err != nil {
		return candidateInputs{}, fmt.Errorf("decode canonical vector bundle: %w", err)
	}
	if bundle.BundleVersion != expectedBundleVersion ||
		bundle.ProtocolVersion != expectedProtocolVersion {
		return candidateInputs{}, errors.New("canonical vector bundle identity is not the exact protocol release")
	}

	root := filepath.Clean(filepath.Join(filepath.Dir(absoluteBundle), ".."))
	if err := verifyPinnedProtocolArtifact(
		root,
		"conformance/conformance-contract.v1.json",
		expectedConformanceContractSHA,
	); err != nil {
		return candidateInputs{}, err
	}
	if err := verifyPinnedProtocolArtifact(
		root,
		"schemas/conformance-report.v1.schema.json",
		expectedConformanceReportSchema,
	); err != nil {
		return candidateInputs{}, err
	}

	goldenPath, err := resolveWithin(root, bundle.GoldenFixtureBundlePath)
	if err != nil {
		return candidateInputs{}, fmt.Errorf("resolve Golden fixture bundle: %w", err)
	}
	goldenRaw, err := os.ReadFile(goldenPath)
	if err != nil {
		return candidateInputs{}, fmt.Errorf("read Golden fixture bundle: %w", err)
	}
	if actual := sha256Reference(goldenRaw); actual != expectedGoldenBundleSHA256 {
		return candidateInputs{}, fmt.Errorf(
			"Golden fixture bundle digest mismatch: got %s, want %s",
			actual,
			expectedGoldenBundleSHA256,
		)
	}
	var golden goldenFixtureBundle
	if err := decodeStrict(goldenRaw, &golden); err != nil {
		return candidateInputs{}, fmt.Errorf("decode Golden fixture bundle: %w", err)
	}
	if golden.BundleVersion != expectedGoldenBundleVersion ||
		golden.ProtocolVersion != expectedProtocolVersion ||
		golden.ReferenceConnector != expectedReferenceConnector ||
		golden.SourceSeedIndex.Path != expectedReferenceSourceSeedIndex ||
		golden.SourceSeedIndex.SourceSchemaSHA256 != expectedSourceSchemaSHA256 {
		return candidateInputs{}, errors.New("Golden fixture bundle identity is not the exact protocol release")
	}

	sourceSeedPath, err := resolveWithin(root, golden.SourceSeedIndex.Path)
	if err != nil {
		return candidateInputs{}, fmt.Errorf("resolve Source seed index: %w", err)
	}
	sourceSeedRaw, err := os.ReadFile(sourceSeedPath)
	if err != nil {
		return candidateInputs{}, fmt.Errorf("read Source seed index: %w", err)
	}
	if actual := sha256Reference(sourceSeedRaw); actual != expectedSourceSeedIndexSHA256 {
		return candidateInputs{}, fmt.Errorf(
			"Source seed index digest mismatch: got %s, want %s",
			actual,
			expectedSourceSeedIndexSHA256,
		)
	}
	var sourceSeed sourceSeedIndex
	if err := decodeStrict(sourceSeedRaw, &sourceSeed); err != nil {
		return candidateInputs{}, fmt.Errorf("decode Source seed index: %w", err)
	}
	if err := validateSourceSeedIndex(sourceSeed, golden); err != nil {
		return candidateInputs{}, err
	}

	return candidateInputs{
		root:       root,
		bundle:     bundle,
		bundleRaw:  bundleRaw,
		golden:     golden,
		goldenRaw:  goldenRaw,
		sourceSeed: sourceSeed,
	}, nil
}

func verifyPinnedProtocolArtifact(root string, relativePath string, expectedDigest string) error {
	path, err := resolveWithin(root, relativePath)
	if err != nil {
		return fmt.Errorf("resolve %s: %w", relativePath, err)
	}
	content, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("read %s: %w", relativePath, err)
	}
	if _, err := parseStrictJSON(content); err != nil {
		return fmt.Errorf("strictly parse %s: %w", relativePath, err)
	}
	if actual := sha256Reference(content); actual != expectedDigest {
		return fmt.Errorf(
			"%s digest mismatch: got %s, want %s",
			relativePath,
			actual,
			expectedDigest,
		)
	}
	return nil
}

func validateSourceSeedIndex(index sourceSeedIndex, golden goldenFixtureBundle) error {
	if index.SeedVersion != "foigent.reference-source-seeds.v1" ||
		index.SourceRepository != "https://github.com/foigent/unirouter.git" ||
		index.SourceCommit != "bf91ea63a16952bb2925afd5438233cac597dcc1" ||
		index.SourceTree != "ddadc277fbede49fac0cbc1cc561203312432ac3" ||
		index.Schema.SHA256 != expectedSourceSchemaSHA256 {
		return errors.New("Source seed index does not match the frozen UniRouter baseline")
	}

	digestsByPath := make(map[string]string, len(index.Fixtures))
	for _, fixture := range index.Fixtures {
		if fixture.Path == "" || fixture.SHA256 == "" {
			return errors.New("Source seed index contains an incomplete fixture pin")
		}
		if _, duplicate := digestsByPath[fixture.Path]; duplicate {
			return errors.New("Source seed index contains a duplicate fixture path")
		}
		digestsByPath[fixture.Path] = fixture.SHA256
	}
	for _, goldenCase := range golden.Cases {
		if digestsByPath[goldenCase.SourceFixture.UpstreamPath] != goldenCase.SourceFixture.SHA256 {
			return fmt.Errorf("%s: Golden Source seed differs from Source seed index", goldenCase.CaseID)
		}
	}
	for _, negative := range golden.NegativeSourceSeeds {
		if digestsByPath[negative.UpstreamPath] != negative.SHA256 {
			return fmt.Errorf("%s: negative Source seed differs from Source seed index", negative.CaseID)
		}
	}
	return nil
}

func resolveWithin(root string, relativePath string) (string, error) {
	if relativePath == "" || filepath.IsAbs(relativePath) {
		return "", errors.New("artifact path must be a nonempty relative path")
	}
	cleanRoot := filepath.Clean(root)
	candidate := filepath.Clean(filepath.Join(cleanRoot, filepath.FromSlash(relativePath)))
	relative, err := filepath.Rel(cleanRoot, candidate)
	if err != nil {
		return "", err
	}
	if relative == ".." || strings.HasPrefix(relative, ".."+string(filepath.Separator)) {
		return "", errors.New("artifact path escapes the candidate root")
	}
	return candidate, nil
}

func runAllCases(inputs candidateInputs) []caseObservation {
	observations := make([]caseObservation, 0, 30)
	observations = append(observations, runCanonicalEnvelopeCases(inputs)...)
	observations = append(observations, runIdempotencyCases(inputs.bundle)...)
	observations = append(observations, runDecimalCases(inputs.bundle)...)
	observations = append(observations, runTimestampCases(inputs.bundle)...)
	observations = append(observations, runUnicodeCases(inputs.bundle)...)
	observations = append(observations, runStrictJSONCases(inputs.bundle)...)
	observations = append(observations, runReplayCases(inputs.bundle)...)
	observations = append(observations, runNegativeSourceSeedCases(inputs)...)
	return observations
}

func buildReport(observations []caseObservation) report {
	cases := make([]reportCase, 0, len(observations))
	status := "pass"
	for _, observation := range observations {
		caseStatus := "pass"
		failureMessage := ""
		if len(observation.failures) > 0 {
			caseStatus = "fail"
			status = "fail"
			failureMessage = boundedFailureMessage(observation.failures)
		}
		cases = append(cases, reportCase{
			CaseID:         observation.id,
			CaseClasses:    append([]string(nil), observation.classes...),
			Status:         caseStatus,
			ResultKind:     observation.kind,
			ResultBase64:   base64.StdEncoding.EncodeToString(observation.result),
			ResultSHA256:   sha256Reference(observation.result),
			FailureMessage: failureMessage,
		})
	}
	return report{
		ReportVersion:         reportVersion,
		Implementation:        implementationName,
		ImplementationVersion: implementationVersion,
		BundleSHA256:          expectedBundleSHA256,
		Status:                status,
		Cases:                 cases,
	}
}

func validateGeneratedReport(generated report) error {
	if generated.ReportVersion != reportVersion ||
		generated.Implementation != implementationName ||
		generated.ImplementationVersion == "" ||
		generated.BundleSHA256 != expectedBundleSHA256 ||
		(generated.Status != "pass" && generated.Status != "fail") ||
		len(generated.Cases) == 0 {
		return errors.New("invalid report header")
	}

	caseIDs := make(map[string]struct{}, len(generated.Cases))
	classCoverage := make(map[string]struct{})
	anyFailure := false
	for _, item := range generated.Cases {
		if item.CaseID == "" || len(item.CaseID) > 160 {
			return errors.New("invalid report case_id")
		}
		if _, duplicate := caseIDs[item.CaseID]; duplicate {
			return fmt.Errorf("duplicate report case_id %q", item.CaseID)
		}
		caseIDs[item.CaseID] = struct{}{}
		if len(item.CaseClasses) == 0 ||
			!sort.StringsAreSorted(item.CaseClasses) ||
			hasDuplicateStrings(item.CaseClasses) {
			return fmt.Errorf("%s: case_classes are not sorted and unique", item.CaseID)
		}
		for _, class := range item.CaseClasses {
			classCoverage[class] = struct{}{}
		}
		if item.Status != "pass" && item.Status != "fail" {
			return fmt.Errorf("%s: invalid status", item.CaseID)
		}
		if item.Status == "pass" && item.FailureMessage != "" {
			return fmt.Errorf("%s: passing case has failure_message", item.CaseID)
		}
		if item.Status == "fail" {
			anyFailure = true
			if item.FailureMessage == "" || len(item.FailureMessage) > 512 {
				return fmt.Errorf("%s: failing case has invalid failure_message", item.CaseID)
			}
		}
		switch item.ResultKind {
		case "bytes", "classification", "error", "state_transition":
		default:
			return fmt.Errorf("%s: invalid result_kind", item.CaseID)
		}
		decoded, err := base64.StdEncoding.Strict().DecodeString(item.ResultBase64)
		if err != nil {
			return fmt.Errorf("%s: invalid result_base64: %w", item.CaseID, err)
		}
		if sha256Reference(decoded) != item.ResultSHA256 {
			return fmt.Errorf("%s: result digest mismatch", item.CaseID)
		}
	}
	requiredClasses := []string{
		"canonical_envelope",
		"capture_gap_derivation",
		"checkpoint_commit",
		"content_conflict",
		"cursor_error",
		"decimal_boundary",
		"duplicate_key_rejection",
		"duplicate_noop",
		"opaque_utf8_preservation",
		"partial_page_replay",
		"privacy_rejection",
		"protocol_nfc_rejection",
		"scoped_idempotency",
		"timestamp_normalization",
	}
	if len(classCoverage) != len(requiredClasses) {
		return errors.New("report does not cover exactly the required case classes")
	}
	for _, class := range requiredClasses {
		if _, present := classCoverage[class]; !present {
			return fmt.Errorf("report is missing required class %q", class)
		}
	}
	if (generated.Status == "fail") != anyFailure {
		return errors.New("report status does not match case statuses")
	}
	return nil
}

func writeFileAtomically(path string, content []byte) error {
	directory := filepath.Dir(path)
	if err := os.MkdirAll(directory, 0o755); err != nil {
		return err
	}
	temporary, err := os.CreateTemp(directory, ".conformance-report-*.tmp")
	if err != nil {
		return err
	}
	temporaryPath := temporary.Name()
	cleanup := true
	defer func() {
		if cleanup {
			_ = os.Remove(temporaryPath)
		}
	}()
	if err := temporary.Chmod(0o644); err != nil {
		_ = temporary.Close()
		return err
	}
	if _, err := temporary.Write(content); err != nil {
		_ = temporary.Close()
		return err
	}
	if err := temporary.Sync(); err != nil {
		_ = temporary.Close()
		return err
	}
	if err := temporary.Close(); err != nil {
		return err
	}
	if err := os.Rename(temporaryPath, path); err != nil {
		return err
	}
	cleanup = false
	return nil
}

func boundedFailureMessage(failures []string) string {
	message := strings.Join(failures, "; ")
	if len(message) <= 512 {
		return message
	}
	return message[:509] + "..."
}

func hasDuplicateStrings(values []string) bool {
	for index := 1; index < len(values); index++ {
		if values[index] == values[index-1] {
			return true
		}
	}
	return false
}

func addFailure(failures *[]string, condition bool, message string) {
	if !condition {
		*failures = append(*failures, message)
	}
}

func canonicalEqual(left []byte, right []byte) bool {
	return bytes.Equal(left, right)
}
