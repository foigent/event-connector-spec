package conformance

import (
	"bytes"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"sort"
	"strconv"
	"strings"
	"unicode/utf16"
	"unicode/utf8"
)

const maxSafeInteger = int64(9007199254740991)

type jsonKind uint8

const (
	jsonNull jsonKind = iota
	jsonBoolean
	jsonString
	jsonNumber
	jsonArray
	jsonObject
)

type jsonMember struct {
	key   string
	value jsonValue
}

type jsonValue struct {
	kind    jsonKind
	boolean bool
	text    string
	array   []jsonValue
	object  []jsonMember
}

type duplicateJSONKeyError struct {
	key string
}

func (e *duplicateJSONKeyError) Error() string {
	return fmt.Sprintf("duplicate JSON object key %q", e.key)
}

func isDuplicateJSONKey(err error) bool {
	var duplicate *duplicateJSONKeyError
	return errors.As(err, &duplicate)
}

type jsonParser struct {
	data  []byte
	index int
}

func parseStrictJSON(data []byte) (jsonValue, error) {
	if !utf8.Valid(data) {
		return jsonValue{}, errors.New("JSON input is not valid UTF-8")
	}
	parser := jsonParser{data: data}
	parser.skipSpace()
	value, err := parser.parseValue()
	if err != nil {
		return jsonValue{}, err
	}
	parser.skipSpace()
	if parser.index != len(parser.data) {
		return jsonValue{}, fmt.Errorf("unexpected JSON content at byte %d", parser.index)
	}
	return value, nil
}

func canonicalizeJSON(data []byte) ([]byte, error) {
	value, err := parseStrictJSON(data)
	if err != nil {
		return nil, err
	}
	var output bytes.Buffer
	if err := appendCanonicalJSON(&output, value); err != nil {
		return nil, err
	}
	return output.Bytes(), nil
}

func (p *jsonParser) parseValue() (jsonValue, error) {
	if p.index >= len(p.data) {
		return jsonValue{}, errors.New("unexpected end of JSON input")
	}
	switch p.data[p.index] {
	case 'n':
		if err := p.consumeLiteral("null"); err != nil {
			return jsonValue{}, err
		}
		return jsonValue{kind: jsonNull}, nil
	case 't':
		if err := p.consumeLiteral("true"); err != nil {
			return jsonValue{}, err
		}
		return jsonValue{kind: jsonBoolean, boolean: true}, nil
	case 'f':
		if err := p.consumeLiteral("false"); err != nil {
			return jsonValue{}, err
		}
		return jsonValue{kind: jsonBoolean}, nil
	case '"':
		value, err := p.parseString()
		if err != nil {
			return jsonValue{}, err
		}
		return jsonValue{kind: jsonString, text: value}, nil
	case '[':
		return p.parseArray()
	case '{':
		return p.parseObject()
	default:
		if p.data[p.index] == '-' || isASCIIDigit(p.data[p.index]) {
			number, err := p.parseNumber()
			if err != nil {
				return jsonValue{}, err
			}
			return jsonValue{kind: jsonNumber, text: number}, nil
		}
		return jsonValue{}, fmt.Errorf("invalid JSON token at byte %d", p.index)
	}
}

func (p *jsonParser) parseArray() (jsonValue, error) {
	p.index++
	p.skipSpace()
	if p.consumeByte(']') {
		return jsonValue{kind: jsonArray, array: []jsonValue{}}, nil
	}

	values := make([]jsonValue, 0)
	for {
		p.skipSpace()
		value, err := p.parseValue()
		if err != nil {
			return jsonValue{}, err
		}
		values = append(values, value)
		p.skipSpace()
		if p.consumeByte(']') {
			return jsonValue{kind: jsonArray, array: values}, nil
		}
		if !p.consumeByte(',') {
			return jsonValue{}, fmt.Errorf("expected ',' or ']' at byte %d", p.index)
		}
	}
}

func (p *jsonParser) parseObject() (jsonValue, error) {
	p.index++
	p.skipSpace()
	if p.consumeByte('}') {
		return jsonValue{kind: jsonObject, object: []jsonMember{}}, nil
	}

	members := make([]jsonMember, 0)
	keys := make(map[string]struct{})
	for {
		p.skipSpace()
		if p.index >= len(p.data) || p.data[p.index] != '"' {
			return jsonValue{}, fmt.Errorf("expected object key at byte %d", p.index)
		}
		key, err := p.parseString()
		if err != nil {
			return jsonValue{}, err
		}
		if _, exists := keys[key]; exists {
			return jsonValue{}, &duplicateJSONKeyError{key: key}
		}
		keys[key] = struct{}{}

		p.skipSpace()
		if !p.consumeByte(':') {
			return jsonValue{}, fmt.Errorf("expected ':' at byte %d", p.index)
		}
		p.skipSpace()
		value, err := p.parseValue()
		if err != nil {
			return jsonValue{}, err
		}
		members = append(members, jsonMember{key: key, value: value})

		p.skipSpace()
		if p.consumeByte('}') {
			return jsonValue{kind: jsonObject, object: members}, nil
		}
		if !p.consumeByte(',') {
			return jsonValue{}, fmt.Errorf("expected ',' or '}' at byte %d", p.index)
		}
	}
}

func (p *jsonParser) parseString() (string, error) {
	if !p.consumeByte('"') {
		return "", fmt.Errorf("expected string at byte %d", p.index)
	}

	var output strings.Builder
	for p.index < len(p.data) {
		next := p.data[p.index]
		switch {
		case next == '"':
			p.index++
			return output.String(), nil
		case next == '\\':
			p.index++
			if p.index >= len(p.data) {
				return "", errors.New("unterminated JSON escape")
			}
			escape := p.data[p.index]
			p.index++
			switch escape {
			case '"', '\\', '/':
				output.WriteByte(escape)
			case 'b':
				output.WriteByte('\b')
			case 'f':
				output.WriteByte('\f')
			case 'n':
				output.WriteByte('\n')
			case 'r':
				output.WriteByte('\r')
			case 't':
				output.WriteByte('\t')
			case 'u':
				r, err := p.parseUnicodeEscape()
				if err != nil {
					return "", err
				}
				output.WriteRune(r)
			default:
				return "", fmt.Errorf("invalid JSON escape \\%c", escape)
			}
		case next < 0x20:
			return "", fmt.Errorf("unescaped control character at byte %d", p.index)
		case next < utf8.RuneSelf:
			output.WriteByte(next)
			p.index++
		default:
			r, size := utf8.DecodeRune(p.data[p.index:])
			if r == utf8.RuneError && size == 1 {
				return "", fmt.Errorf("invalid UTF-8 in string at byte %d", p.index)
			}
			output.Write(p.data[p.index : p.index+size])
			p.index += size
		}
	}
	return "", errors.New("unterminated JSON string")
}

func (p *jsonParser) parseUnicodeEscape() (rune, error) {
	first, err := p.parseHex16()
	if err != nil {
		return 0, err
	}
	if first >= 0xD800 && first <= 0xDBFF {
		if p.index+2 > len(p.data) || p.data[p.index] != '\\' || p.data[p.index+1] != 'u' {
			return 0, errors.New("unpaired high surrogate in JSON string")
		}
		p.index += 2
		second, err := p.parseHex16()
		if err != nil {
			return 0, err
		}
		if second < 0xDC00 || second > 0xDFFF {
			return 0, errors.New("high surrogate is not followed by a low surrogate")
		}
		return utf16.DecodeRune(rune(first), rune(second)), nil
	}
	if first >= 0xDC00 && first <= 0xDFFF {
		return 0, errors.New("unpaired low surrogate in JSON string")
	}
	return rune(first), nil
}

func (p *jsonParser) parseHex16() (uint16, error) {
	if p.index+4 > len(p.data) {
		return 0, errors.New("short Unicode escape in JSON string")
	}
	raw := p.data[p.index : p.index+4]
	p.index += 4
	decoded := make([]byte, 2)
	if _, err := hex.Decode(decoded, raw); err != nil {
		return 0, fmt.Errorf("invalid Unicode escape %q", raw)
	}
	return uint16(decoded[0])<<8 | uint16(decoded[1]), nil
}

func (p *jsonParser) parseNumber() (string, error) {
	start := p.index
	if p.consumeByte('-') && p.index >= len(p.data) {
		return "", errors.New("incomplete JSON number")
	}

	if p.consumeByte('0') {
		if p.index < len(p.data) && isASCIIDigit(p.data[p.index]) {
			return "", fmt.Errorf("leading zero in JSON number at byte %d", p.index)
		}
	} else {
		if p.index >= len(p.data) || p.data[p.index] < '1' || p.data[p.index] > '9' {
			return "", fmt.Errorf("invalid JSON number at byte %d", p.index)
		}
		for p.index < len(p.data) && isASCIIDigit(p.data[p.index]) {
			p.index++
		}
	}

	if p.consumeByte('.') {
		fractionStart := p.index
		for p.index < len(p.data) && isASCIIDigit(p.data[p.index]) {
			p.index++
		}
		if p.index == fractionStart {
			return "", errors.New("JSON fraction has no digits")
		}
	}
	if p.index < len(p.data) && (p.data[p.index] == 'e' || p.data[p.index] == 'E') {
		p.index++
		if p.index < len(p.data) && (p.data[p.index] == '+' || p.data[p.index] == '-') {
			p.index++
		}
		exponentStart := p.index
		for p.index < len(p.data) && isASCIIDigit(p.data[p.index]) {
			p.index++
		}
		if p.index == exponentStart {
			return "", errors.New("JSON exponent has no digits")
		}
	}
	return string(p.data[start:p.index]), nil
}

func (p *jsonParser) consumeLiteral(literal string) error {
	if !bytes.HasPrefix(p.data[p.index:], []byte(literal)) {
		return fmt.Errorf("invalid JSON literal at byte %d", p.index)
	}
	p.index += len(literal)
	return nil
}

func (p *jsonParser) consumeByte(expected byte) bool {
	if p.index < len(p.data) && p.data[p.index] == expected {
		p.index++
		return true
	}
	return false
}

func (p *jsonParser) skipSpace() {
	for p.index < len(p.data) {
		switch p.data[p.index] {
		case ' ', '\t', '\n', '\r':
			p.index++
		default:
			return
		}
	}
}

func appendCanonicalJSON(output *bytes.Buffer, value jsonValue) error {
	switch value.kind {
	case jsonNull:
		output.WriteString("null")
	case jsonBoolean:
		if value.boolean {
			output.WriteString("true")
		} else {
			output.WriteString("false")
		}
	case jsonString:
		appendCanonicalString(output, value.text)
	case jsonNumber:
		number, err := canonicalSafeInteger(value.text)
		if err != nil {
			return err
		}
		output.WriteString(number)
	case jsonArray:
		output.WriteByte('[')
		for index, item := range value.array {
			if index > 0 {
				output.WriteByte(',')
			}
			if err := appendCanonicalJSON(output, item); err != nil {
				return err
			}
		}
		output.WriteByte(']')
	case jsonObject:
		members := append([]jsonMember(nil), value.object...)
		sort.Slice(members, func(left, right int) bool {
			return compareUTF16(members[left].key, members[right].key) < 0
		})
		output.WriteByte('{')
		for index, member := range members {
			if index > 0 {
				output.WriteByte(',')
			}
			appendCanonicalString(output, member.key)
			output.WriteByte(':')
			if err := appendCanonicalJSON(output, member.value); err != nil {
				return err
			}
		}
		output.WriteByte('}')
	default:
		return errors.New("unsupported JSON value")
	}
	return nil
}

func appendCanonicalString(output *bytes.Buffer, value string) {
	output.WriteByte('"')
	for _, r := range value {
		switch r {
		case '"':
			output.WriteString(`\"`)
		case '\\':
			output.WriteString(`\\`)
		case '\b':
			output.WriteString(`\b`)
		case '\t':
			output.WriteString(`\t`)
		case '\n':
			output.WriteString(`\n`)
		case '\f':
			output.WriteString(`\f`)
		case '\r':
			output.WriteString(`\r`)
		default:
			if r < 0x20 {
				fmt.Fprintf(output, `\u%04x`, r)
			} else {
				output.WriteRune(r)
			}
		}
	}
	output.WriteByte('"')
}

func compareUTF16(left string, right string) int {
	leftUnits := utf16.Encode([]rune(left))
	rightUnits := utf16.Encode([]rune(right))
	limit := len(leftUnits)
	if len(rightUnits) < limit {
		limit = len(rightUnits)
	}
	for index := 0; index < limit; index++ {
		if leftUnits[index] < rightUnits[index] {
			return -1
		}
		if leftUnits[index] > rightUnits[index] {
			return 1
		}
	}
	switch {
	case len(leftUnits) < len(rightUnits):
		return -1
	case len(leftUnits) > len(rightUnits):
		return 1
	default:
		return 0
	}
}

func canonicalSafeInteger(raw string) (string, error) {
	if len(raw) > 1024 {
		return "", errors.New("JSON number exceeds safe profile input limit")
	}

	negative := false
	if strings.HasPrefix(raw, "-") {
		negative = true
		raw = raw[1:]
	}
	mantissa := raw
	exponent := int64(0)
	if position := strings.IndexAny(mantissa, "eE"); position >= 0 {
		exponentRaw := mantissa[position+1:]
		mantissa = mantissa[:position]
		parsed, err := strconv.ParseInt(exponentRaw, 10, 32)
		if err != nil {
			return "", errors.New("JSON number exponent exceeds safe profile")
		}
		exponent = parsed
	}

	fractionDigits := int64(0)
	if position := strings.IndexByte(mantissa, '.'); position >= 0 {
		fractionDigits = int64(len(mantissa) - position - 1)
		mantissa = mantissa[:position] + mantissa[position+1:]
	}
	mantissa = strings.TrimLeft(mantissa, "0")
	if mantissa == "" {
		return "0", nil
	}

	integer := new(big.Int)
	if _, ok := integer.SetString(mantissa, 10); !ok {
		return "", errors.New("invalid JSON number")
	}
	scale := exponent - fractionDigits
	switch {
	case scale > 20:
		return "", errors.New("JSON number is outside the safe-integer profile")
	case scale >= 0:
		integer.Mul(integer, decimalPower(scale))
	case -scale > 1024:
		return "", errors.New("JSON number is not an integer")
	default:
		divisor := decimalPower(-scale)
		quotient, remainder := new(big.Int), new(big.Int)
		quotient.QuoRem(integer, divisor, remainder)
		if remainder.Sign() != 0 {
			return "", errors.New("non-integral JSON number is outside the safe-integer profile")
		}
		integer = quotient
	}

	if negative {
		integer.Neg(integer)
	}
	maximum := big.NewInt(maxSafeInteger)
	absolute := new(big.Int).Abs(new(big.Int).Set(integer))
	if absolute.Cmp(maximum) > 0 {
		return "", errors.New("JSON number is outside the safe-integer profile")
	}
	if integer.Sign() == 0 {
		return "0", nil
	}
	return integer.String(), nil
}

func decimalPower(exponent int64) *big.Int {
	return new(big.Int).Exp(big.NewInt(10), big.NewInt(exponent), nil)
}

func isASCIIDigit(value byte) bool {
	return value >= '0' && value <= '9'
}
