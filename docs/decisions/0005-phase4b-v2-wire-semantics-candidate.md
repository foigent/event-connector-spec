# Decision 0005: Phase 4B v2 wire-semantics candidate

- Status: candidate, non-binding
- Date: 2026-07-30
- Supersedes: Decision 0004
- Decision parent under review:
  `4e1372bd834fa898816fa750deb595da2d43fbde`, tree
  `6e375f73cb456d2c00322ff86f7697c7d22a39c9`
- Candidate SDK successor: `0.1.0-candidate.3`
- Protocol disposition: `V2_SEMANTICS_CANDIDATE_NOT_BINDING`

## Corrected decision

Keep every released `v1.1.2` protocol, implementation, Schema, fixture,
vector, report, manifest, and product pin unchanged.

Candidate.3 may implement the following future-major semantic profile for
local comparison only:

1. parse a syntactically valid JSON number token with exact decimal
   arithmetic;
2. accept it only if its exact mathematical value is an integer in
   `[-9007199254740991, 9007199254740991]`;
3. emit the shortest base-10 integer, with all accepted zero spellings emitted
   as `0`;
4. accept valid timestamp input years `0000` through `9999`;
5. normalize to UTC microseconds and reject any result below year `0000` or
   above year `9999`;
6. emit only `YYYY-MM-DDTHH:MM:SS.ffffffZ`.

This exact-decimal rule is not treated as a `v1.1.3` erratum. The released
protocol says RFC 8785 and constrains concrete wire fields, but it does not
unambiguously define this generic exact-decimal admission profile. RFC 8785's
IEEE-754/ECMAScript parsing and serialization model is not equivalent:
rounding can turn a mathematically non-integral decimal token into an integer
value. The frozen versioning rule therefore keeps the major-version gate
active.

This decision does not assign or release version `2.0.0`. It says only that
binding adoption of these semantics would require the major-version process,
new normative prose, released discriminator vectors, migration guidance, and
both product owners' acceptance.

## Complete released behavior matrix

Direct probes against unchanged released implementations establish:

| Input | Released Go | Released TypeScript |
| --- | --- | --- |
| `1.0` | parse/canonicalize to `1` | strict parse rejects |
| `1e6` | parse/canonicalize to `1000000` | strict parse rejects |
| `1.5e1` | parse/canonicalize to `15` | strict parse rejects |
| `1.5` | strict parse retains token; canonicalization rejects | strict parse rejects |
| `9007199254740992` | strict parse retains token; canonicalization rejects | strict parse returns bigint; canonicalization rejects |
| `-0` | parse/canonicalize to `0` | parse/canonicalize to `0` |
| `0000-01-01T00:00:00Z` | accepts year `0000` | accepts year `0000` |
| `0001-01-01T00:00:00+23:59` | normalizes into year `0000` | same |
| `0000-01-01T00:00:00+00:01` | emits `-0001-12-31T23:59:00.000000Z` | rejects |
| `9999-12-31T23:59:59-23:59` | emits `10000-01-01T23:58:59.000000Z` | rejects |

The time correction in Decision 0002 now records both the lower and upper
released divergences. A four-digit future profile rejects both expanded-year
outputs. That choice is compatible with RFC 3339's `4DIGIT` grammar, but its
binding protocol version remains governed separately from this local SDK
candidate.

## Discriminator vectors

`sdk/candidate-wire-boundary-vectors.v1.json` is candidate.3's sole active
boundary matrix. In addition to basic fraction, exponent, safe-range and
year-edge cases, it distinguishes:

- exact-decimal admission from IEEE rounding with
  `1.0000000000000001`;
- zero spellings `-0`, `-0.0`, and `-0e10`;
- unsafe values hidden behind fraction or exponent notation;
- normalization below year `0000` and above year `9999`.

The historical candidate.2 negative vector is not a second authority.

## Compatibility and migration gate

No product may silently reinterpret released v1 input under this profile.
Future binding work must decide whether to:

- expose separate v1 and v2 canonical profiles; or
- migrate both products to a new major protocol release with explicit
  producer/consumer negotiation.

Until then candidate.3 is a local implementation and conformance experiment,
not a compatible product dependency.

## Non-authorization

This decision does not authorize:

- a v2 release, tag, release manifest, or released-vector change;
- package publication or product adoption;
- product dependency, registry, runtime, data, Cursor, Checkpoint, M0, or
  EvidenceStore changes;
- push, PR, merge, deployment, or any external write.
