package conformance

import (
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"math/big"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"golang.org/x/text/unicode/norm"
)

const (
	idempotencyDomain = "foigent.event-idempotency.v1"
	maxInt64Decimal   = "9223372036854775807"
)

var (
	canonicalDecimalPattern = regexp.MustCompile(`^(0|[1-9][0-9]*)$`)
	positiveDecimalPattern  = regexp.MustCompile(`^[1-9][0-9]*$`)
	timestampPattern        = regexp.MustCompile(`^([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2})(?:\.([0-9]{1,9}))?(Z|[+-][0-9]{2}:[0-9]{2})$`)
)

type normalizedTimestamp struct {
	Valid      bool
	Normalized string
	ErrorCode  string
}

type replayInput struct {
	Identity      string
	EnvelopeHash  string
	InjectedError string
}

type replayPageResult struct {
	Outcomes           []string
	CheckpointAdvances bool
}

type replayState struct {
	accepted map[string]string
}

func newReplayState() *replayState {
	return &replayState{accepted: make(map[string]string)}
}

func sha256Reference(input []byte) string {
	sum := sha256.Sum256(input)
	return "sha256:" + hex.EncodeToString(sum[:])
}

func buildIdentityInput(
	producerProduct string,
	producerInstance string,
	tenantRef *string,
	orgRef string,
	projectRef string,
	eventType string,
	eventID string,
) ([]byte, error) {
	opaqueValues := []struct {
		name  string
		value string
	}{
		{name: "producer.instance", value: producerInstance},
		{name: "event_id", value: eventID},
	}
	for _, field := range opaqueValues {
		if field.value == "" {
			return nil, fmt.Errorf("%s must not be empty", field.name)
		}
		if !utf8.ValidString(field.value) {
			return nil, fmt.Errorf("%s is not valid UTF-8", field.name)
		}
	}

	protocolValues := []struct {
		name  string
		value string
	}{
		{name: "producer.product", value: producerProduct},
		{name: "event_type", value: eventType},
	}
	for _, field := range protocolValues {
		if field.value == "" || !utf8.ValidString(field.value) {
			return nil, fmt.Errorf("%s must be nonempty valid UTF-8", field.name)
		}
		if !isNFC(field.value) {
			return nil, fmt.Errorf("%s must already be NFC", field.name)
		}
	}
	if !isCanonicalPositiveDecimal(orgRef) {
		return nil, errors.New("scope.org_ref is not a canonical positive decimal")
	}
	if !isCanonicalPositiveDecimal(projectRef) {
		return nil, errors.New("scope.project_ref is not a canonical positive decimal")
	}
	if tenantRef != nil {
		if *tenantRef == "" {
			return nil, errors.New("present scope.tenant_ref must not be empty")
		}
		if !utf8.ValidString(*tenantRef) {
			return nil, errors.New("scope.tenant_ref is not valid UTF-8")
		}
	}

	output := make([]byte, 0, len(idempotencyDomain)+128)
	output = append(output, idempotencyDomain...)
	var err error
	for _, value := range []string{producerProduct, producerInstance} {
		output, err = appendLPUTF8(output, value)
		if err != nil {
			return nil, err
		}
	}
	if tenantRef == nil {
		output = append(output, 0, 0, 0, 0)
	} else {
		output, err = appendLPUTF8(output, *tenantRef)
		if err != nil {
			return nil, err
		}
	}
	for _, value := range []string{orgRef, projectRef, eventType, eventID} {
		output, err = appendLPUTF8(output, value)
		if err != nil {
			return nil, err
		}
	}
	return output, nil
}

func appendLPUTF8(destination []byte, value string) ([]byte, error) {
	if !utf8.ValidString(value) {
		return nil, errors.New("LP_UTF8 value is not valid UTF-8")
	}
	if uint64(len(value)) > math.MaxUint32 {
		return nil, errors.New("LP_UTF8 value exceeds uint32 byte length")
	}
	var length [4]byte
	binary.BigEndian.PutUint32(length[:], uint32(len(value)))
	destination = append(destination, length[:]...)
	destination = append(destination, value...)
	return destination, nil
}

func isCanonicalPositiveDecimal(value string) bool {
	return len(value) <= 20 && positiveDecimalPattern.MatchString(value)
}

func isValidInt64Decimal(value string) bool {
	if len(value) == 0 || len(value) > len(maxInt64Decimal) {
		return false
	}
	if !canonicalDecimalPattern.MatchString(value) {
		return false
	}
	parsed := new(big.Int)
	if _, ok := parsed.SetString(value, 10); !ok {
		return false
	}
	return parsed.Sign() >= 0 && parsed.Cmp(big.NewInt(math.MaxInt64)) <= 0
}

func isValidMicroAmount(value string) bool {
	if len(value) == 0 || len(value) > 19 || !canonicalDecimalPattern.MatchString(value) {
		return false
	}
	parsed := new(big.Int)
	_, ok := parsed.SetString(value, 10)
	return ok && parsed.Sign() >= 0
}

func normalizeMicrosecondTimestamp(input string) normalizedTimestamp {
	match := timestampPattern.FindStringSubmatch(input)
	if match == nil {
		return normalizedTimestamp{ErrorCode: "invalid_timestamp"}
	}
	fraction := match[2]
	if len(fraction) > 6 && strings.Trim(fraction[6:], "0") != "" {
		return normalizedTimestamp{ErrorCode: "timestamp_precision_loss"}
	}
	instant, err := time.Parse(time.RFC3339Nano, input)
	if err != nil {
		return normalizedTimestamp{ErrorCode: "invalid_timestamp"}
	}
	if instant.Nanosecond()%1000 != 0 {
		return normalizedTimestamp{ErrorCode: "timestamp_precision_loss"}
	}
	return normalizedTimestamp{
		Valid:      true,
		Normalized: instant.UTC().Format("2006-01-02T15:04:05.000000Z"),
	}
}

func isNFC(value string) bool {
	return utf8.ValidString(value) && norm.NFC.IsNormalString(value)
}

func (state *replayState) apply(identity string, envelopeHash string) string {
	acceptedHash, exists := state.accepted[identity]
	if !exists {
		state.accepted[identity] = envelopeHash
		return "inserted"
	}
	if acceptedHash == envelopeHash {
		return "duplicate_noop"
	}
	return "conflict"
}

func (state *replayState) processPage(items []replayInput) replayPageResult {
	result := replayPageResult{Outcomes: make([]string, 0, len(items))}
	for _, item := range items {
		if item.InjectedError != "" {
			result.Outcomes = append(result.Outcomes, item.InjectedError)
			return result
		}
		outcome := state.apply(item.Identity, item.EnvelopeHash)
		result.Outcomes = append(result.Outcomes, outcome)
		if outcome == "conflict" {
			return result
		}
	}
	result.CheckpointAdvances = true
	return result
}
