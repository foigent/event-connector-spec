# Third-party notices

Existing vendored license files are preserved byte-for-byte:

| Component | Version / use | License and retained text |
| --- | --- | --- |
| `golang.org/x/text` | v0.31.0, v1 Go implementation | BSD-3-Clause; [license](implementations/go/vendor/golang.org/x/text/LICENSE) |
| `golang.org/x/text` | v0.31.0, source-neutral v2 Go implementation | BSD-3-Clause; [license](implementations/source-neutral-v2/go/vendor/golang.org/x/text/LICENSE) |
| `golang.org/x/text` | v0.14.0, schema audit | BSD-3-Clause; [license](tools/schema-audit/vendor/golang.org/x/text/LICENSE) |
| `github.com/santhosh-tekuri/jsonschema/v6` | v6.0.2, schema audit | Apache-2.0; [license](tools/schema-audit/vendor/github.com/santhosh-tekuri/jsonschema/v6/LICENSE) |
| Go runtime and standard library | Go 1.24.3 builds | BSD-style; [license](LICENSES/Go-LICENSE) |

Project-owned material uses the root Apache-2.0 license. These third-party
components keep their original copyright and notices. Deno, Node.js, Python,
CI actions and operating systems are separately supplied tools with their own
licenses; this file does not license those tools or claim to inventory a
future container image. Recheck the actual build before distributing it.

See [licensing and preserved distributions](docs/LICENSING.md) for the material
that accompanies consumer snapshots and compiled conformance tools.
