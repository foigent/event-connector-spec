// Package compatibility validates one caller-supplied, digest-pinned catalog.
// It contains no compiled compatibility tuples and performs no activation.
package compatibility

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"regexp"

	"github.com/foigent/event-connector-spec/sdk/go/canonical"
)

const (
	CatalogSHA256      = "sha256:57c02943a7b1b569f4431890cabc5877dae0f84a88c7427fa8f2986956174226"
	ProtocolVersion    = "1.1.2"
	AuthorityCommit    = "fd82aeca9877bea8064b25c365a3cdcdd0bb3d16"
	ProtocolReleaseSHA = "sha256:0b414d5d59e5a7ca5c05505cb58d7992c544537da1c84a57256ec205618d9cd1"
	catalogVersion     = "foigent.event-connector-sdk-compatibility.v1"
	unknownCombination = "fail_closed"
)

var shaPattern = regexp.MustCompile(`^sha256:[0-9a-f]{64}$`)

type Pin struct {
	Consumer                 string `json:"consumer"`
	ConnectorID              string `json:"connector_id"`
	ConnectorVersion         string `json:"connector_version"`
	SourceRevision           string `json:"source_revision"`
	ProtocolVersion          string `json:"protocol_version"`
	ProtocolReleaseDigest    string `json:"protocol_release_digest"`
	ManifestSchemaSHA256     string `json:"manifest_schema_sha256"`
	ReferenceManifestSHA256  string `json:"reference_manifest_sha256"`
	ProjectionContractSHA256 string `json:"projection_contract_sha256"`
}

type Catalog struct {
	pins []Pin
}

type catalogWire struct {
	MatrixVersion string `json:"matrix_version"`
	SDKCandidate  struct {
		ProtocolVersion string `json:"protocol_version"`
		AuthorityCommit string `json:"authority_commit"`
		ReleaseDigest   string `json:"release_digest"`
	} `json:"sdk_candidate"`
	Supported          []Pin  `json:"supported"`
	UnknownCombination string `json:"unknown_combination"`
}

func Load(data []byte) (Catalog, error) {
	if canonical.SHA256(data) != CatalogSHA256 {
		return Catalog{}, errors.New("compatibility catalog digest mismatch")
	}
	if _, err := canonical.Parse(data, canonical.DefaultLimits()); err != nil {
		return Catalog{}, fmt.Errorf("compatibility catalog is not strict JSON: %w", err)
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	var wire catalogWire
	if err := decoder.Decode(&wire); err != nil {
		return Catalog{}, fmt.Errorf("decode compatibility catalog: %w", err)
	}
	if err := requireEOF(decoder); err != nil {
		return Catalog{}, err
	}
	if wire.MatrixVersion != catalogVersion ||
		wire.SDKCandidate.ProtocolVersion != ProtocolVersion ||
		wire.SDKCandidate.AuthorityCommit != AuthorityCommit ||
		wire.SDKCandidate.ReleaseDigest != ProtocolReleaseSHA ||
		wire.UnknownCombination != unknownCombination {
		return Catalog{}, errors.New("compatibility catalog authority metadata mismatch")
	}
	if len(wire.Supported) == 0 {
		return Catalog{}, errors.New("compatibility catalog contains no supported tuples")
	}
	seen := make(map[Pin]struct{}, len(wire.Supported))
	for _, pin := range wire.Supported {
		if err := validatePinShape(pin); err != nil {
			return Catalog{}, err
		}
		if _, duplicate := seen[pin]; duplicate {
			return Catalog{}, errors.New("compatibility catalog contains a duplicate tuple")
		}
		seen[pin] = struct{}{}
	}
	return Catalog{pins: append([]Pin(nil), wire.Supported...)}, nil
}

func (catalog Catalog) Pins() []Pin {
	return append([]Pin(nil), catalog.pins...)
}

func (catalog Catalog) Validate(candidate Pin) error {
	for _, supported := range catalog.pins {
		if candidate == supported {
			return nil
		}
	}
	return fmt.Errorf(
		"unsupported compatibility tuple consumer=%q connector=%q connector_version=%q protocol=%q",
		candidate.Consumer,
		candidate.ConnectorID,
		candidate.ConnectorVersion,
		candidate.ProtocolVersion,
	)
}

func ValidateReleasedSourceRevision(revision string) error {
	if revision != "1" {
		return fmt.Errorf("unsupported released Source revision %q", revision)
	}
	return nil
}

func validatePinShape(pin Pin) error {
	for name, value := range map[string]string{
		"consumer":          pin.Consumer,
		"connector_id":      pin.ConnectorID,
		"connector_version": pin.ConnectorVersion,
		"source_revision":   pin.SourceRevision,
		"protocol_version":  pin.ProtocolVersion,
	} {
		if value == "" {
			return fmt.Errorf("compatibility pin %s must not be empty", name)
		}
	}
	for name, value := range map[string]string{
		"protocol_release_digest":    pin.ProtocolReleaseDigest,
		"manifest_schema_sha256":     pin.ManifestSchemaSHA256,
		"reference_manifest_sha256":  pin.ReferenceManifestSHA256,
		"projection_contract_sha256": pin.ProjectionContractSHA256,
	} {
		if !shaPattern.MatchString(value) {
			return fmt.Errorf("compatibility pin %s is not a lowercase SHA-256 reference", name)
		}
	}
	return nil
}

func requireEOF(decoder *json.Decoder) error {
	var extra any
	if err := decoder.Decode(&extra); err == io.EOF {
		return nil
	} else if err != nil {
		return fmt.Errorf("decode compatibility catalog trailing content: %w", err)
	}
	return errors.New("compatibility catalog contains multiple JSON values")
}
