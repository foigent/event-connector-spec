// Package canonical implements the source-neutral byte rules of the Foigent
// Event & Connector Protocol. It performs no network, filesystem, credential,
// persistence, registry, or runtime work.
package canonical

import (
	"bytes"
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
	DefaultMaxBytes = 8 * 1024 * 1024
	DefaultMaxDepth = 64

	idempotencyDomain = "foigent.event-idempotency.v1"
	maxInt64Decimal   = "9223372036854775807"
)

var (
	canonicalDecimalPattern = regexp.MustCompile(`^(0|[1-9][0-9]*)$`)
	positiveDecimalPattern  = regexp.MustCompile(`^[1-9][0-9]*$`)
	timestampPattern        = regexp.MustCompile(`^([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2})(?:\.([0-9]{1,9}))?(Z|[+-][0-9]{2}:[0-9]{2})$`)
)

type Kind uint8

const (
	Null Kind = iota
	Boolean
	String
	Number
	Array
	Object
)

type Limits struct {
	MaxBytes int
	MaxDepth int
}

func DefaultLimits() Limits {
	return Limits{MaxBytes: DefaultMaxBytes, MaxDepth: DefaultMaxDepth}
}

// Value is a lossless protocol JSON AST. NumberText retains an already
// validated safe-integer input token until canonical emission normalizes it.
type Value struct {
	Kind       Kind
	Bool       bool
	Text       string
	NumberText string
	Items      []Value
	Members    map[string]Value
}

type Identity struct {
	ProducerProduct  string
	ProducerInstance string
	TenantRef        *string
	OrgRef           string
	ProjectRef       string
	EventType        string
	EventID          string
}

type TimestampResult struct {
	Normalized string
	ErrorCode  string
}

func Parse(data []byte, limits Limits) (Value, error) {
	if err := validateLimits(data, limits); err != nil {
		return Value{}, err
	}
	parsed, err := parseStrictJSONLimited(data, limits.MaxDepth)
	if err != nil {
		return Value{}, err
	}
	return exportValue(parsed), nil
}

func Canonicalize(data []byte, limits Limits) ([]byte, error) {
	if err := validateLimits(data, limits); err != nil {
		return nil, err
	}
	value, err := parseStrictJSONLimited(data, limits.MaxDepth)
	if err != nil {
		return nil, err
	}
	var output bytes.Buffer
	if err := appendCanonicalJSON(&output, value); err != nil {
		return nil, err
	}
	return output.Bytes(), nil
}

func CanonicalizeValue(value Value) ([]byte, error) {
	internal, err := importValue(value)
	if err != nil {
		return nil, err
	}
	var output bytes.Buffer
	if err := appendCanonicalJSON(&output, internal); err != nil {
		return nil, err
	}
	return output.Bytes(), nil
}

func Clone(value Value) Value {
	cloned := value
	if value.Items != nil {
		cloned.Items = make([]Value, len(value.Items))
		for index, item := range value.Items {
			cloned.Items[index] = Clone(item)
		}
	}
	if value.Members != nil {
		cloned.Members = make(map[string]Value, len(value.Members))
		for key, member := range value.Members {
			cloned.Members[key] = Clone(member)
		}
	}
	return cloned
}

func SHA256(data []byte) string {
	sum := sha256.Sum256(data)
	return "sha256:" + hex.EncodeToString(sum[:])
}

func SourceHash(exactSourceBytes []byte) string {
	return SHA256(exactSourceBytes)
}

func BuildIdentityInput(identity Identity) ([]byte, error) {
	for _, field := range []struct {
		name  string
		value string
	}{
		{"producer.instance", identity.ProducerInstance},
		{"event_id", identity.EventID},
	} {
		if field.value == "" || !utf8.ValidString(field.value) {
			return nil, fmt.Errorf("%s must be nonempty valid UTF-8", field.name)
		}
	}
	for _, field := range []struct {
		name  string
		value string
	}{
		{"producer.product", identity.ProducerProduct},
		{"event_type", identity.EventType},
	} {
		if field.value == "" || !utf8.ValidString(field.value) {
			return nil, fmt.Errorf("%s must be nonempty valid UTF-8", field.name)
		}
		if !IsNFC(field.value) {
			return nil, fmt.Errorf("%s must already be NFC", field.name)
		}
	}
	if !IsCanonicalPositiveDecimal(identity.OrgRef) {
		return nil, errors.New("scope.org_ref is not a canonical positive decimal")
	}
	if !IsCanonicalPositiveDecimal(identity.ProjectRef) {
		return nil, errors.New("scope.project_ref is not a canonical positive decimal")
	}
	if identity.TenantRef != nil {
		if *identity.TenantRef == "" || !utf8.ValidString(*identity.TenantRef) {
			return nil, errors.New("present scope.tenant_ref must be nonempty valid UTF-8")
		}
	}

	output := []byte(idempotencyDomain)
	var err error
	for _, value := range []string{identity.ProducerProduct, identity.ProducerInstance} {
		output, err = appendLPUTF8(output, value)
		if err != nil {
			return nil, err
		}
	}
	if identity.TenantRef == nil {
		output = append(output, 0, 0, 0, 0)
	} else {
		output, err = appendLPUTF8(output, *identity.TenantRef)
		if err != nil {
			return nil, err
		}
	}
	for _, value := range []string{identity.OrgRef, identity.ProjectRef, identity.EventType, identity.EventID} {
		output, err = appendLPUTF8(output, value)
		if err != nil {
			return nil, err
		}
	}
	return output, nil
}

func IdempotencyKey(identity Identity) (string, error) {
	input, err := BuildIdentityInput(identity)
	if err != nil {
		return "", err
	}
	return SHA256(input), nil
}

func IsCanonicalPositiveDecimal(value string) bool {
	return len(value) <= 20 && positiveDecimalPattern.MatchString(value)
}

func IsValidInt64Decimal(value string) bool {
	if len(value) == 0 || len(value) > len(maxInt64Decimal) || !canonicalDecimalPattern.MatchString(value) {
		return false
	}
	parsed := new(big.Int)
	if _, ok := parsed.SetString(value, 10); !ok {
		return false
	}
	return parsed.Sign() >= 0 && parsed.Cmp(big.NewInt(math.MaxInt64)) <= 0
}

func IsValidMicroAmount(value string) bool {
	if len(value) == 0 || len(value) > 19 || !canonicalDecimalPattern.MatchString(value) {
		return false
	}
	parsed := new(big.Int)
	_, ok := parsed.SetString(value, 10)
	return ok && parsed.Sign() >= 0
}

func NormalizeMicrosecondTimestamp(input string) TimestampResult {
	match := timestampPattern.FindStringSubmatch(input)
	if match == nil {
		return TimestampResult{ErrorCode: "invalid_timestamp"}
	}
	if strings.HasPrefix(match[1], "0000-") {
		return TimestampResult{ErrorCode: "invalid_timestamp"}
	}
	fraction := match[2]
	if len(fraction) > 6 && strings.Trim(fraction[6:], "0") != "" {
		return TimestampResult{ErrorCode: "timestamp_precision_loss"}
	}
	instant, err := time.Parse(time.RFC3339Nano, input)
	if err != nil {
		return TimestampResult{ErrorCode: "invalid_timestamp"}
	}
	utc := instant.UTC()
	if utc.Year() < 1 || utc.Year() > 9999 {
		return TimestampResult{ErrorCode: "invalid_timestamp"}
	}
	if instant.Nanosecond()%1000 != 0 {
		return TimestampResult{ErrorCode: "timestamp_precision_loss"}
	}
	return TimestampResult{Normalized: utc.Format("2006-01-02T15:04:05.000000Z")}
}

func IsNFC(value string) bool {
	return utf8.ValidString(value) && norm.NFC.IsNormalString(value)
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

func validateLimits(data []byte, limits Limits) error {
	if limits.MaxBytes <= 0 || limits.MaxDepth <= 0 {
		return errors.New("JSON limits must be positive")
	}
	if len(data) > limits.MaxBytes {
		return fmt.Errorf("JSON input exceeds %d bytes", limits.MaxBytes)
	}
	return nil
}

func exportValue(value jsonValue) Value {
	result := Value{Kind: Kind(value.kind), Bool: value.boolean}
	switch value.kind {
	case jsonString:
		result.Text = value.text
	case jsonNumber:
		result.NumberText = value.text
	case jsonArray:
		result.Items = make([]Value, len(value.array))
		for index, item := range value.array {
			result.Items[index] = exportValue(item)
		}
	case jsonObject:
		result.Members = make(map[string]Value, len(value.object))
		for _, member := range value.object {
			result.Members[member.key] = exportValue(member.value)
		}
	}
	return result
}

func importValue(value Value) (jsonValue, error) {
	internal := jsonValue{kind: jsonKind(value.Kind), boolean: value.Bool}
	switch value.Kind {
	case Null, Boolean:
		return internal, nil
	case String:
		internal.text = value.Text
	case Number:
		internal.text = value.NumberText
	case Array:
		internal.array = make([]jsonValue, len(value.Items))
		for index, item := range value.Items {
			converted, err := importValue(item)
			if err != nil {
				return jsonValue{}, err
			}
			internal.array[index] = converted
		}
	case Object:
		internal.object = make([]jsonMember, 0, len(value.Members))
		for key, member := range value.Members {
			if !utf8.ValidString(key) {
				return jsonValue{}, errors.New("JSON object key is not valid UTF-8")
			}
			converted, err := importValue(member)
			if err != nil {
				return jsonValue{}, err
			}
			internal.object = append(internal.object, jsonMember{key: key, value: converted})
		}
	default:
		return jsonValue{}, errors.New("unsupported JSON value kind")
	}
	return internal, nil
}
