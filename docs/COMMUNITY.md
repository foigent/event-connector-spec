# Community contribution guide

English is the primary language for guides, Issue/PR titles and release
summaries. Simplified Chinese questions and contributions are welcome; use
`.zh-CN.md` for translations and link both versions. Maintainers can help
summarize substantial Chinese discussions in English.

## Choose a bounded contribution

- Documentation: identify the unclear step, expected explanation and links.
- Contract questions: name the release, exact field and a synthetic example.
- Negative vectors: show the behavior that must be rejected and the affected
  implementations. Discuss semantic changes before editing vectors.

Follow [the existing protocol contribution rules](../CONTRIBUTING.md) and
[governance](../GOVERNANCE.md). Their semantic-change evidence and release
approvals remain applicable. A wording fix does not require inventing a new
protocol version, but release-bound files must not be rewritten.

## Validate

Use Go 1.24.3, Deno 2.7.13, Node.js and Python 3. Run the
[consumer kit](../scripts/run-source-neutral-v2-consumer-kit.sh) from the
repository root as shown on the [community homepage](../.github/README.md).
It checks current v2 and preserved v1 compatibility without product credentials.
The authority CI additionally verifies immutable predecessor tags and release
history through its existing Authority Release Kit. Report which kit ran;
consumer conformance is not a new release approval or product runtime result.

No live service, signing key, customer payload or paid provider call belongs in
ordinary contribution tests. Preserve existing vendor licenses and fixture
provenance. Do not weaken a validator to accommodate an unexplained mismatch.

## Contribution license and contact

Project-owned contributions use [Apache-2.0](../LICENSE). Sign off your own
commits under the [Developer Certificate of Origin 1.1](https://developercertificate.org/):

```sh
git commit -s -m "docs: clarify a connector field"
```

The sign-off certifies your right to submit the work; copyright is not
transferred. No automated DCO gate is claimed. Use
[Issues](https://github.com/foigent/event-connector-spec/issues) for ordinary
questions and proposals, [Security](../SECURITY.md) for vulnerabilities and
[Code of Conduct](../CODE_OF_CONDUCT.md) for participation concerns.
