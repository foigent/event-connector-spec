package conformance

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
)

const (
	expectedBundleSHA256             = "sha256:98659630f3e1238d2684c2b4cba728334f4bdace67ff033652676d9d505caf33"
	expectedGoldenBundleSHA256       = "sha256:b56de610d4444b655e3f700e61ec490caa1fc1d8658db1660192686c0fc1a268"
	expectedConformanceContractSHA   = "sha256:f3ae834265170ff22088943283fd23dcb562bc2308571ccc722414c2c896dc23"
	expectedConformanceReportSchema  = "sha256:42048fbf5a5edc2ca4476727563ab41e96a8fb6d3788d446e0e0d7c4154a31a7"
	expectedSourceSeedIndexSHA256    = "sha256:5d75d1b1ddf596ae1b3ab3c2690e652e9f6d1b2aef93755c7553552f71f39981"
	expectedSourceSchemaSHA256       = "sha256:4ae2897d4f8470c38624dfe21c54d72eaf6d995d2c9578c4420c94d244424fb2"
	expectedBundleVersion            = "foigent.canonical-vector-bundle.v1"
	expectedGoldenBundleVersion      = "foigent.golden-fixture-bundle.v1"
	expectedProtocolCandidate        = "1.0.0-rc.1"
	reportVersion                    = "foigent.conformance-report.v1"
	implementationName               = "go"
	implementationVersion            = "1.0.0-rc.1+independent.1"
	expectedReferenceConnector       = "foigent.unirouter.completed-execution"
	expectedReferenceSourceSeedIndex = "reference/unirouter/source-seeds.v1.json"
)

const (
	ExitPass            = 0
	ExitInvalidArtifact = 2
	ExitMismatch        = 3
	ExitInternalFailure = 4
)

type vectorBundle struct {
	BundleVersion           string                  `json:"bundle_version"`
	ProtocolCandidate       string                  `json:"protocol_candidate"`
	GoldenFixtureBundlePath string                  `json:"golden_fixture_bundle_path"`
	ReferenceMappingContext referenceMappingContext `json:"reference_mapping_context"`
	CanonicalEnvelopes      []canonicalEnvelopeCase `json:"canonical_envelopes"`
	Idempotency             []idempotencyCase       `json:"idempotency"`
	DecimalStrings          []decimalStringCase     `json:"decimal_strings"`
	Timestamps              []timestampCase         `json:"timestamps"`
	Unicode                 []unicodeCase           `json:"unicode"`
	StrictJSON              []strictJSONCase        `json:"strict_json"`
	CaptureGaps             captureGapProfile       `json:"capture_gaps"`
	Replay                  []replayCase            `json:"replay"`
}

type referenceMappingContext struct {
	ProducerProduct    string `json:"producer_product"`
	ProducerInstance   string `json:"producer_instance"`
	ConnectorID        string `json:"connector_id"`
	ConnectorVersion   string `json:"connector_version"`
	AdapterFidelity    string `json:"adapter_fidelity"`
	PayloadCaptureMode string `json:"payload_capture_mode"`
	RawPayloadPresent  bool   `json:"raw_payload_present"`
	SourceRevision     string `json:"source_revision"`
	TimelineComplete   bool   `json:"timeline_complete"`
}

type canonicalEnvelopeCase struct {
	CaseID          string `json:"case_id"`
	SourceInputPath string `json:"source_input_path"`
	InputPath       string `json:"input_path"`
	CanonicalBytes  int    `json:"canonical_bytes"`
	EnvelopeHash    string `json:"envelope_hash"`
}

type idempotencyCase struct {
	CaseID           string  `json:"case_id"`
	ProducerProduct  string  `json:"producer_product"`
	ProducerInstance string  `json:"producer_instance"`
	TenantRef        *string `json:"tenant_ref"`
	OrgRef           string  `json:"org_ref"`
	ProjectRef       string  `json:"project_ref"`
	EventType        string  `json:"event_type"`
	EventID          string  `json:"event_id"`
	EventIDUTF8Hex   string  `json:"event_id_utf8_hex,omitempty"`
	IdentityInputHex string  `json:"identity_input_hex"`
	IdempotencyKey   string  `json:"idempotency_key"`
}

type decimalStringCase struct {
	CaseID            string `json:"case_id"`
	Value             string `json:"value"`
	ValidInt64Counter bool   `json:"valid_int64_counter"`
}

type timestampCase struct {
	CaseID     string `json:"case_id"`
	InputClass string `json:"input_class"`
	Input      string `json:"input"`
	Normalized string `json:"normalized,omitempty"`
	Valid      bool   `json:"valid"`
	ErrorCode  string `json:"error_code,omitempty"`
}

type unicodeCase struct {
	CaseID  string `json:"case_id"`
	Class   string `json:"class"`
	Value   string `json:"value"`
	UTF8Hex string `json:"utf8_hex,omitempty"`
	Valid   bool   `json:"valid"`
}

type strictJSONCase struct {
	CaseID    string `json:"case_id"`
	RawJSON   string `json:"raw_json"`
	Valid     bool   `json:"valid"`
	ErrorCode string `json:"error_code"`
}

type captureGapProfile struct {
	RequiredOrder      []string `json:"required_order"`
	ReasonCode         string   `json:"reason_code"`
	GapType            string   `json:"gap_type"`
	Severity           string   `json:"severity"`
	PayloadCaptureMode string   `json:"payload_capture_mode"`
}

type replayCase struct {
	CaseID               string  `json:"case_id"`
	FirstOutcome         *string `json:"first_outcome,omitempty"`
	ReplayOutcome        *string `json:"replay_outcome,omitempty"`
	CheckpointAdvances   bool    `json:"checkpoint_advances"`
	FirstItem            *string `json:"first_item,omitempty"`
	SecondItem           *string `json:"second_item,omitempty"`
	NextAttemptFirstItem *string `json:"next_attempt_first_item,omitempty"`
}

type goldenFixtureBundle struct {
	BundleVersion       string             `json:"bundle_version"`
	ProtocolCandidate   string             `json:"protocol_candidate"`
	ReferenceConnector  string             `json:"reference_connector"`
	SourceSeedIndex     sourceSeedIndexRef `json:"source_seed_index"`
	Cases               []goldenCase       `json:"cases"`
	NegativeSourceSeeds []negativeSeed     `json:"negative_source_seeds"`
}

type sourceSeedIndexRef struct {
	Path               string `json:"path"`
	SourceSchemaSHA256 string `json:"source_schema_sha256"`
}

type goldenCase struct {
	CaseID          string              `json:"case_id"`
	SourceFixture   goldenSourceFixture `json:"source_fixture"`
	SharedHashInput goldenSharedInput   `json:"shared_hash_input"`
	Expected        goldenExpected      `json:"expected"`
}

type goldenSourceFixture struct {
	UpstreamPath string `json:"upstream_path"`
	ReleasePath  string `json:"release_path"`
	SHA256       string `json:"sha256"`
}

type goldenSharedInput struct {
	Path              string `json:"path"`
	FileSHA256        string `json:"file_sha256"`
	EnvelopeHashField string `json:"envelope_hash_field"`
}

type goldenExpected struct {
	CanonicalBytes  int    `json:"canonical_bytes"`
	EnvelopeHash    string `json:"envelope_hash"`
	IdempotencyKey  string `json:"idempotency_key"`
	TerminalStatus  string `json:"terminal_status"`
	CaptureGapCount int    `json:"capture_gap_count"`
}

type negativeSeed struct {
	CaseID        string         `json:"case_id"`
	UpstreamPath  string         `json:"upstream_path"`
	ReleasePath   string         `json:"release_path"`
	SHA256        string         `json:"sha256"`
	ExpectedError connectorError `json:"expected_error"`
}

type sourceSeedIndex struct {
	SeedVersion      string            `json:"seed_version"`
	SourceRepository string            `json:"source_repository"`
	SourceCommit     string            `json:"source_commit"`
	SourceTree       string            `json:"source_tree"`
	Schema           sourceSeed        `json:"schema"`
	Fixtures         []namedSourceSeed `json:"fixtures"`
	CopyPolicy       string            `json:"copy_policy"`
}

type sourceSeed struct {
	Path   string `json:"path"`
	SHA256 string `json:"sha256"`
}

type namedSourceSeed struct {
	Name   string `json:"name"`
	Path   string `json:"path"`
	SHA256 string `json:"sha256"`
}

type connectorError struct {
	ErrorVersion      string `json:"error_version"`
	Category          string `json:"category"`
	Code              string `json:"code"`
	Phase             string `json:"phase"`
	Operation         string `json:"operation"`
	Retryable         bool   `json:"retryable"`
	RetryAfterSeconds *int   `json:"retry_after_seconds,omitempty"`
	SafeMessage       string `json:"safe_message"`
	Recovery          string `json:"recovery"`
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

type Summary struct {
	Status    string
	CaseCount int
}

type sourceSnapshot struct {
	SchemaVersion string         `json:"schema_version"`
	RequestID     string         `json:"request_id"`
	OrgID         int64          `json:"org_id"`
	ProjectID     int64          `json:"project_id"`
	Terminal      sourceTerminal `json:"terminal"`
	Usage         sourceUsage    `json:"usage"`
	Money         sourceMoney    `json:"money"`
	CaptureGaps   []sourceGap    `json:"capture_gaps"`
}

type sourceTerminal struct {
	Status      string `json:"status"`
	AvailableAt string `json:"available_at"`
}

type sourceUsage struct {
	Model                string  `json:"model"`
	PromptTokens         int64   `json:"prompt_tokens"`
	UncachedPromptTokens int64   `json:"uncached_prompt_tokens"`
	CacheReadTokens      int64   `json:"cache_read_tokens"`
	CacheCreationTokens  int64   `json:"cache_creation_tokens"`
	CompletionTokens     int64   `json:"completion_tokens"`
	Source               string  `json:"source"`
	Authority            string  `json:"authority"`
	Purpose              string  `json:"purpose"`
	Finality             string  `json:"finality"`
	ContractVersion      string  `json:"contract_version"`
	EstimateVersion      *string `json:"estimate_version,omitempty"`
	CacheUsageSchema     string  `json:"cache_usage_schema"`
	CacheUsageStatus     string  `json:"cache_usage_status"`
}

type sourceMoney struct {
	Schema               string `json:"schema"`
	Currency             string `json:"currency"`
	AmountScale          int64  `json:"amount_scale"`
	CalculatedCostMicros string `json:"calculated_cost_micros"`
	ChargedCostMicros    string `json:"charged_cost_micros"`
	PricingVersion       string `json:"pricing_version"`
}

type sourceGap struct {
	Source string `json:"source"`
	Reason string `json:"reason"`
}

type sourceCursorError struct {
	Error struct {
		Code      string `json:"code"`
		Message   string `json:"message"`
		Retryable bool   `json:"retryable"`
	} `json:"error"`
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
		if err == nil {
			return errors.New("unexpected trailing JSON value")
		}
		return err
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
