# Decision 0003: Protocol v2.0.0 release assembly

Status: accepted by the exact three-role approvals recorded in
`releases/v2.0.0/release-manifest.json`; authoritative only at immutable tag
`v2.0.0`.

## Context

The source-neutral v2 release candidate was frozen at:

- candidate commit `fc5ae57d21ca389ca5a73f6c95382a9874ed7152`;
- candidate tree `8a446c8404254198e648c1fd81c4ea52aad3a5ea`;
- candidate content digest
  `sha256:420847a10d0febddd1fd8fcd03b74761f00c4162dd1ebfed1ad3e164925993aa`;
- 83 cross-language cases and 29 required classes.

The candidate and its role reviews remain historical, non-binding evidence.
Their approvals cannot be inherited by a release whose component bytes differ.

## Decision

Release `2.0.0` promotes the reviewed source-neutral semantics into one
canonical release assembly:

- stable protocol specification `spec/protocol-v2.md`;
- Binding contract, vector, implementation manifests, and deterministic Go
  and TypeScript reports;
- v2 Schemas, Reference Connector Manifest, mappings, fixtures, and
  compatibility matrices;
- release validator, product pin verifier, shared action, and authority CI;
- canonical release manifest with one exact content digest and three new
  role-specific approvals.

The authority CI runs the complete source-neutral v2 kit, which also reruns
the preserved v1 suite. A successful candidate-only or v1-only run is
insufficient for release.

## Compatibility

The release retains the v1.1.2 predecessor identity and fails closed on any
change to:

- the 10 existing X-Insight M0 IDs/hashes;
- eight first-class Gap row identities;
- two import provenance identities;
- settled/cancelled read-model expectations;
- existing UniRouter and LiteLLM compatibility matrices;
- the five OpenInference M0 IDs/hashes and four Gap Events;
- Event identity, Source hash, Envelope hash, canonicalization, capture-mode
  separation, mutable-delivery exclusions, and product migration gates.

## Boundary

This release changes shared protocol authority only. It does not authorize or
perform product repository migration, runtime deployment, traffic, credentials,
Cursor/Checkpoint mutation, database mutation, or an OTLP receiver.
