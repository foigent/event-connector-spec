# Licensing and preserved distributions

On 2026-10-10 the project owner approved Apache-2.0 for the project-owned source,
documentation, schemas, fixtures and test tools in this repository, matching
UniRouter. This grant includes the project-owned material in the preserved
historical sources below; it does not claim that older archives already
contained license files or change any historical artifact bytes.

- Protocol/action carrier `ad8fe7a38c9d7335657630baa8670dd07556b98c`,
  tree `288fa23b0591b6ed2953e14bc4a9d3571e2839ac`.
- Canonical protocol release `2.0.2` and its retained predecessor compatibility
  sources, including the v1 `1.1.2` baseline.

Read the full [Apache-2.0 license](../LICENSE), [NOTICE](../NOTICE) and
[third-party notices](../THIRD_PARTY_NOTICES.md). Material identified as third
party retains its own license and attribution. This grant does not relicense
dependencies, grant trademark rights or provide a hosted-service commitment.

## Supply the license materials with historical artifacts

A newer repository LICENSE is not inserted into an older source archive,
binary or pinned action snapshot. When redistributing a preserved artifact,
provide these files alongside it, retaining their relative layout in a separate
license-materials directory:

- `LICENSE`, `NOTICE`, `THIRD_PARTY_NOTICES.md`, `docs/LICENSING.md`;
- `LICENSES/Go-LICENSE`;
- the unchanged vendored license files listed in `THIRD_PARTY_NOTICES.md`,
  where applicable.

Bind that accompanying directory to the exact licensed repository commit and
the historical artifact identity in the distribution description. Do not claim
that it changes the original release manifest, signature or archive digest.
A public download must make the complete accompanying license materials
available and verify the association before announcement.

New CI carrier commits can include these files while preserving all released
protocol and artifact bytes. Carrier identity and canonical release identity
are different: updating a checkout/action pin does not rewrite the protocol
version, product pin, historical source identity or release digest.

This preparation changes licensing and community documentation only. Actual
public access and license-material delivery require publication verification.
