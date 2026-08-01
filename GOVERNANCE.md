# Governance

## 1. Authority

`foigent/event-connector-spec` is the unique editable authority for the Foigent shared event protocol and Connector conformance contracts.

Product repositories may pin or generate read-only copies from an immutable release. They must not maintain competing editable definitions.

The repository administrator is a technical custodian. Administrative access does not grant unilateral semantic authority.

## 2. Decision roles

Every semantic protocol release requires recorded approval from all three roles:

1. **Source Domain Owner** — owns source facts, source identity, coverage, terminal semantics, and source-side compatibility.
2. **Projection / Consumer Owner** — owns lossless projection into the consuming product model, consumer identity/hash compatibility, and read-model behavior.
3. **Coordinator** — owns cross-product coherence, scope, versioning, evidence sufficiency, and final disposition.

One person or GitHub account may temporarily perform more than one operational action, but the three review roles and their evidence remain distinct.

## 3. Change classes

### Semantic changes

Examples: field meaning, requiredness, identity, idempotency, hash domain, canonicalization, time or numeric rules, retry/conflict semantics, coverage, or compatibility guarantees.

Required:

- Source Owner approval;
- Projection Owner approval;
- Coordinator approval;
- compatible or intentionally breaking cross-language vectors;
- an explicit SemVer decision.

### Non-semantic changes

Examples: spelling, formatting, links, or tooling that cannot affect generated artifacts or conformance outcomes.

Required:

- normal repository review;
- proof that generated artifacts and digests are unchanged when applicable.

A change is semantic whenever classification is uncertain.

## 4. Release model

A binding protocol version exists only when all of the following are present:

- an immutable SemVer tag;
- a canonical release manifest;
- SHA-256 digests for every released artifact;
- Source Owner, Projection Owner, and Coordinator approval evidence;
- passing independent conformance results required by that release;
- compatibility classification and supported version matrix.

Rules:

- tags and released artifacts are immutable;
- the same version must never identify different bytes;
- optional backward-compatible additions require at least a minor version;
- changes to meaning, identity, hash, canonicalization, required fields, or compatibility require a major version unless the prior version was explicitly pre-1.0 experimental and the manifest declares the break;
- release candidates are not binding releases.

## 5. Product consumption

Each product repository must pin:

- exact protocol version;
- release manifest digest;
- required Schema/vector/conformance bundle digests;
- product-local projection or source mapping digest where applicable.

Pins belong in product registry, CI lock, status, or non-event-linked receipts. Mutable delivery cursor, high-watermark, retry, page observation, and ingestion state must never enter event identity, event hash, or item-linked import provenance.

## 6. Review enforcement

Role-to-GitHub-account mapping is not yet encoded as `CODEOWNERS`; inventing a team mapping would create false assurance. Until an approved mapping exists:

- every semantic PR must record the three role approvals and exact evidence digests in the PR body;
- the release manifest must carry the same approval identities;
- the Coordinator must fail closed if any role or digest is missing;
- repository administration alone cannot approve a semantic release.

Future branch protection or CODEOWNERS automation may enforce the process, but it must preserve these role semantics.

## 7. Bootstrap boundary

The initial governance files were committed directly to `main` under explicit B7 authorization solely to establish the authority repository. They freeze no protocol Schema, fixture, SDK, conformance vector, or runtime behavior.

After bootstrap, protocol semantics must flow through reviewed pull requests.

## 8. Current boundary

Protocol `2.0.1` remains the immediate immutable Binding predecessor. A
`2.0.2` patch-compatible CI portability fix may assemble release content only
after exact Source Owner, Projection Owner and Coordinator candidate review.
That candidate gate is now satisfied over one exact candidate identity; the
assembled release content remains non-Binding. It becomes Binding only with
three fresh final approvals over the same release-content digest, a canonical
`releases/v2.0.2/release-manifest.json`, and an immutable `v2.0.2` tag over
the same bytes. No `2.0.1` approval may be reused.

Authority history validation remains in the Authority Release Kit. Product
composite actions consume only the snapshot-safe Consumer Conformance Kit and
the strict product-pin verifier; they require neither Git history nor a
credential for the private authority repository.

Neither the `2.0.2` assembly nor a later shared protocol release authorizes
product repository migration, runtime extraction, deployment, credentials,
traffic, Cursor/Checkpoint, or database changes.
