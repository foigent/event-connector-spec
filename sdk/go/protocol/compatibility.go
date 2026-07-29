package protocol

import "fmt"

const (
	SDKProtocolVersion = "1.1.2"
	SDKAuthorityCommit = "fd82aeca9877bea8064b25c365a3cdcdd0bb3d16"
	SDKReleaseDigest   = "sha256:0b414d5d59e5a7ca5c05505cb58d7992c544537da1c84a57256ec205618d9cd1"
)

type CompatibilityPin struct {
	Consumer                 string
	ConnectorID              string
	ConnectorVersion         string
	SourceRevision           string
	ProtocolVersion          string
	ProtocolReleaseDigest    string
	ManifestSchemaSHA256     string
	ReferenceManifestSHA256  string
	ProjectionContractSHA256 string
}

var supportedCompatibilityPins = []CompatibilityPin{
	{
		Consumer:                 "xinsight-reference",
		ConnectorID:              "foigent.unirouter.completed-execution",
		ConnectorVersion:         "1.0.0",
		SourceRevision:           "1",
		ProtocolVersion:          "1.0.0",
		ProtocolReleaseDigest:    "sha256:aaeb5b37b94a1fd603048d77b2180fa88be1ddbd6eeea6a1369edf0cea9c5e2b",
		ManifestSchemaSHA256:     "sha256:a6f43b37477002ab836a4d9ea7c4e462675cd4313f0637c0733cd98675fc0adf",
		ReferenceManifestSHA256:  "sha256:a3bc97bd5d5c7aab6452de9518be0b00f62776877deb431a91c175da5287de79",
		ProjectionContractSHA256: "sha256:c812a9c70d55ad0413650218eab6f968fd44974e1e7d77a147d58f62e18e8b03",
	},
	{
		Consumer:                 "xinsight-litellm",
		ConnectorID:              "foigent.litellm.spend-logs",
		ConnectorVersion:         "1.0.0",
		SourceRevision:           "1",
		ProtocolVersion:          "1.1.2",
		ProtocolReleaseDigest:    SDKReleaseDigest,
		ManifestSchemaSHA256:     "sha256:59c405086310d0dfb2aaff37e55d73853e04319e6ccf659c66f98d8ba704a205",
		ReferenceManifestSHA256:  "sha256:86a10565a8c66abe5b31d6c39e853cebf5e9b90721d6784ea0bf7c28d2c20693",
		ProjectionContractSHA256: "sha256:72bb90b6a5ddf0f44f7773a7378c0f7f458438f9fc1363d31a65602c0547f088",
	},
	{
		Consumer:                 "unirouter-reference-runtime",
		ConnectorID:              "foigent.unirouter.completed-execution",
		ConnectorVersion:         "1.0.0",
		SourceRevision:           "1",
		ProtocolVersion:          "1.1.0",
		ProtocolReleaseDigest:    "sha256:3bb10a544ace17d3b6c4a44e19048c45c557eba19ad79d9cea81728336658c4d",
		ManifestSchemaSHA256:     "sha256:59c405086310d0dfb2aaff37e55d73853e04319e6ccf659c66f98d8ba704a205",
		ReferenceManifestSHA256:  "sha256:a3bc97bd5d5c7aab6452de9518be0b00f62776877deb431a91c175da5287de79",
		ProjectionContractSHA256: "sha256:c812a9c70d55ad0413650218eab6f968fd44974e1e7d77a147d58f62e18e8b03",
	},
}

func SupportedCompatibilityPins() []CompatibilityPin {
	return append([]CompatibilityPin(nil), supportedCompatibilityPins...)
}

func ValidateCompatibilityPin(candidate CompatibilityPin) error {
	for _, supported := range supportedCompatibilityPins {
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
