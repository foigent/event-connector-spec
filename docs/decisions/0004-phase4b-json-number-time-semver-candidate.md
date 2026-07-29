# Decision 0004: Phase 4B JSON-number, timestamp, and SemVer candidate

- Status: HOLD, superseded by Decision 0005
- Date: 2026-07-30
- Decision parent: commit
  `64a41440f1df7b2581af86090b72f02f5f2bbf53`, tree
  `19d62ed8f1ed282771d10deabc31454b65c6056e`
- Released protocol examined: `v1.1.2`,
  `sha256:0b414d5d59e5a7ca5c05505cb58d7992c544537da1c84a57256ec205618d9cd1`
- Candidate SDK successor: `0.1.0-candidate.3`
- Proposed protocol classification:
  `V1_1_3_ERRATUM_CANDIDATE_NOT_BINDING`

> Do not use this decision as current authority. Independent Source Owner
> review found an omitted released lower-bound divergence and insufficient
> normative evidence for the proposed erratum classification. Decision 0005
> records the corrected major-version disposition.

## Decision

Use one exact safe-integer value profile in the successor SDK candidate:

1. accept any syntactically valid JSON number token whose exact mathematical
   value is an integer from `-9007199254740991` through
   `9007199254740991`;
2. accept fraction and exponent spellings when they reduce exactly to such an
   integer;
3. emit the shortest base-10 integer form with no fraction or exponent;
4. preserve existing behavior by canonicalizing every zero spelling,
   including `-0`, to `0`;
5. reject non-integral values and values outside the safe-integer range before
   wire-object validation.

Use one exact timestamp boundary in the successor SDK candidate:

1. accept syntactically and calendrically valid RFC 3339 inputs whose lexical
   year is `0000` through `9999`;
2. normalize the instant to UTC without losing nonzero sub-microsecond
   precision;
3. require the normalized result to remain in the same four-digit
   `0000`–`9999` year range;
4. emit exactly `YYYY-MM-DDTHH:MM:SS.ffffffZ`;
5. reject normalization below year `0000` or above year `9999`.

These rules replace candidate.2's narrower lexical-integer and
`0001`–`9999` choices. They do not modify any released protocol, Schema,
fixture, manifest, runner, report, release manifest, or product pin.

## Verified implementation matrix

The following behavior was executed directly against the unchanged released
implementations.

| Boundary | Released Go | Released TypeScript | Successor candidate |
| --- | --- | --- | --- |
| `1.0` | accepts, emits `1` | rejects | accepts, emits `1` |
| `1e6` | accepts, emits `1000000` | rejects | accepts, emits `1000000` |
| `1.5e1` | accepts, emits `15` | rejects | accepts, emits `15` |
| `1.5` | rejects | rejects | rejects |
| `9007199254740992` | rejects | rejects | rejects |
| `-0` | accepts, emits `0` | accepts, emits `0` | accepts, emits `0` |
| year `0000` | accepts | accepts | accepts |
| offset normalizes into year `0000` | accepts | accepts | accepts |
| offset normalizes into year `10000` | accepts and emits five digits | rejects | rejects |

The released Go probe passed after encoding the observed matrix. The released
TypeScript behavior was executed through its public strict JSON and timestamp
functions. Candidate.2 is not an authority for either disputed boundary.

External normative checks:

- RFC 8785 defines JCS number serialization through ECMAScript serialization
  after JSON parsing and recommends string representation for values needing
  greater precision:
  <https://www.rfc-editor.org/rfc/rfc8785.html>;
- RFC 3339 defines `date-fullyear` as exactly four digits and explicitly
  covers years `0000` through `9999`:
  <https://www.rfc-editor.org/rfc/rfc3339.html>;
- verified RFC 8785 erratum 7920 recommends rejecting negative zero with
  `SHOULD`, not `MUST`:
  <https://www.rfc-editor.org/errata/eid7920>.

Relevant unchanged source evidence:

- protocol prose:
  `spec/protocol-v1.md`,
  SHA-256
  `56e0bf210f110839403ab653936ffc9fb41236b39846f697d8536c816ed2c45f`;
- released vector bundle:
  `vectors/canonical-vector-bundle.v1.json`,
  SHA-256
  `50fc8e8be08c37381611d6423e29780894741fb108fc4569df7c895452e5d4db`;
- Go JSON:
  `implementations/go/internal/conformance/json.go`,
  SHA-256
  `a9649dcd9a799b0fa0f256d32986b2183cc16d443766a16101081ccf3114816f`;
- Go time:
  `implementations/go/internal/conformance/core.go`,
  SHA-256
  `b667aabb311ff5a84f8a48eec02a7a6c68e5726482d895323c20e87cde956842`;
- TypeScript JSON:
  `implementations/typescript/src/json.ts`,
  SHA-256
  `8cb99cbae47fb8764f650d8c00426f1268f78bf575808c2ecd0eb875cbd23cef`;
- TypeScript time:
  `implementations/typescript/src/protocol.ts`,
  SHA-256
  `27fc666ff3314364f5b020944d91816a6592e69601459ee80b276fd6757bfe3e`.

## Why this is an erratum candidate rather than an automatic v2

The released prose already requires RFC 8785 canonical Envelope bytes and a
safe-integer implementation profile. Under that value-oriented rule,
fraction or exponent syntax does not create a different canonical value when
it reduces exactly to a safe integer. The Go runner implements that behavior;
the TypeScript runner's token-shape rejection is an unvectored implementation
restriction.

The released timestamp prose already requires exact four-digit `YYYY` UTC
output. RFC 3339's four-digit year grammar includes `0000`. Both released
runners accept that lower boundary. Go's five-digit year `10000` output
violates the frozen output shape; TypeScript already rejects it.

Therefore the proposed `v1.1.3` classification repairs two implementation
divergences against existing normative text without changing:

- any existing positive input's canonical bytes or hash;
- any released Schema or vector result;
- identity, idempotency, hash-domain, cursor, Checkpoint, provenance, M0, or
  product compatibility semantics.

This classification is not self-authorizing. If joint protocol review decides
that the existing prose did not already determine these boundaries, the
versioning rule in `spec/protocol-v1.md` requires a major version because
canonicalization meaning would then be changing. Until that review is
accepted, `v1.1.3` remains a label for a non-binding erratum candidate only.

## Candidate vectors

`sdk/candidate-wire-boundary-vectors.v1.json` is the only active
candidate.3 boundary matrix. It covers:

- integral fraction and exponent spellings;
- maximum and minimum safe-integer values;
- non-integral and out-of-range rejection;
- preserved negative-zero canonicalization;
- year `0000`, lower-offset and upper-offset normalization boundaries;
- missing-zone and precision-loss rejection.

The older `sdk/candidate-negative-vectors.v1.json` remains historical
candidate.2 evidence until the successor implementation replaces its test
references. It is not an additional semantic authority.

## Successor implementation obligations

Candidate.3 must:

- consume the active vector file from both languages;
- use exact decimal arithmetic for number admission and never round through
  binary floating point;
- apply the same parser profile before structural wire validation;
- reject any UTC result that cannot be emitted with exactly four year digits;
- keep released runners and released vector files unchanged;
- report any disagreement as a candidate failure, not choose a language as
  authority.

## Non-authorization

This decision does not authorize:

- a `v1.1.3` release, tag, manifest, or immutable release-vector change;
- package publication or product adoption;
- product dependency, registry, pin, runtime, data, Cursor, Checkpoint, M0, or
  EvidenceStore changes;
- push, PR, merge, deployment, or external write.
