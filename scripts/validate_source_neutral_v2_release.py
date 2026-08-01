#!/usr/bin/env python3

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import validate_source_neutral_v2_candidate as candidate


ROOT = Path(__file__).resolve().parents[1]
REVIEWED_CANDIDATE_COMMIT = "61e21ee6988814f2d4a785bcf1723f5ce9dc49b1"
REVIEWED_CANDIDATE_TREE = "9c152180d9132fa279c75b8b6cc4cfaac895d411"
REVIEWED_CANDIDATE_CONTENT_DIGEST = (
    "sha256:25a19cd9aad2b86cf9108a634fdfacd98bba7e3d6ee4d7e013bb95ec3aaf02ba"
)
BINDING_CONTRACT_SHA = (
    "sha256:f820936448590144156c2e499134eb4b3142ca0265275b6e9bdf1e5cd7855e14"
)
BINDING_VECTOR_SHA = (
    "sha256:9e50bb4570dcc1ff07157ad6198641e937357b641ae052cddcb3420b52ad11ed"
)
OPENINFERENCE_PROJECTION_PATH = (
    "mappings/xinsight/openinference-span-to-m0-m0.1-v2.json"
)
FINAL_IMPLEMENTATION_VERSION = "2.0.0+independent.1"
PREDECESSOR_MANIFEST_SHA = (
    "sha256:4a0800e0117e351606e91177bac0beb3276dbfcdc22bd6a6718bdcdec1d6289d"
)
CANDIDATE_REVIEW_SHAS = {
    "reviews/candidates/v2.0.1-rc.1/source-owner-review.md":
        "sha256:89e1e58dbfedeacc94e5073bf9ad295f23079bb132074e18a51b3cff4da9f5ff",
    "reviews/candidates/v2.0.1-rc.1/projection-owner-review.md":
        "sha256:7392bc406bdf5d1252f2e6f45a221713068542b7cbe76e6795de06afab33e18a",
    "reviews/candidates/v2.0.1-rc.1/coordinator-review.md":
        "sha256:922e42ec8c4ed0d6db7f07f80355ff3208ec6fc49b5482cc707f9e1240864e01",
}

PATCH_TOOLING_COMPONENTS = {
    "authority_readme",
    "governance",
    "shared_ci_action",
    "authority_ci_workflow",
    "conformance_kit_runner",
    "release_builder",
    "source_neutral_release_validator",
    "source_neutral_release_tests",
    "candidate_archive_tests",
    "product_pin_verifier",
    "openinference_connector_manifest",
}


def require(condition: bool, message: str) -> None:
    candidate.require(condition, message)


def verify_candidate_archive() -> int:
    path = ROOT / "docs/candidates/v2.0.1-rc.1/candidate-manifest.json"
    manifest = candidate.load_json_strict(path)
    content_hash_input = {
        key: manifest[key]
        for key in [
            "candidate_manifest_version",
            "protocol_version",
            "protocol_status",
            "authority",
            "predecessor",
            "reviewed_candidate",
            "candidate_reviews",
            "compatibility",
            "components",
        ]
    }
    digest = "sha256:" + hashlib.sha256(
        candidate.canonical_bytes(content_hash_input)
    ).hexdigest()
    require(
        digest == manifest["content_digest"],
        "candidate content digest changed",
    )
    require(
        manifest["protocol_version"] == "2.0.1"
        and manifest["protocol_status"] == "not_binding",
        "candidate version or status changed",
    )
    require(
        manifest["reviewed_candidate"]
        == {
            "commit": REVIEWED_CANDIDATE_COMMIT,
            "tree": REVIEWED_CANDIDATE_TREE,
            "content_digest": REVIEWED_CANDIDATE_CONTENT_DIGEST,
        },
        "reviewed candidate identity changed",
    )
    require(
        manifest["compatibility"]
        == "PATCH_COMPATIBLE_METADATA_INTEGRITY_ERRATUM",
        "candidate compatibility class changed",
    )
    require(
        manifest["predecessor"]
        == {
            "protocol_version": "2.0.0",
            "tag": "v2.0.0",
            "tag_commit": "a8ab25ef8c8dd1c12d073ec0cf23c376f5741744",
            "tree": "981e2516154610c172c6a1607795512ad9c69f30",
            "content_digest": "sha256:4231062a50b0334eda7f67e07200faf5e71261b2a8cf27ecd375529ec84f8b69",
            "release_digest": "sha256:aa9537a8779758af1227ba42371e75ab5aeafc84d5b73c4cdff35320481aa3f9",
        },
        "candidate predecessor identity changed",
    )
    require(
        manifest["approvals"]
        == {
            "source_domain_owner": "candidate_confirmed_non_binding",
            "projection_owner": "candidate_confirmed_non_binding",
            "coordinator": "candidate_confirmed_non_binding",
        },
        "candidate review gate changed",
    )
    require(
        manifest["boundary"]
        == {
            "binding_release": False,
            "immutable_tag": "absent",
            "product_adoption": "not_authorized",
            "runtime_mutation": "none",
        },
        "candidate boundary changed",
    )
    for name, component in manifest["components"].items():
        require(
            candidate.sha256(ROOT / component["path"]) == component["sha256"],
            f"candidate component changed: {name}",
        )
    for relative, expected in CANDIDATE_REVIEW_SHAS.items():
        require(candidate.sha256(ROOT / relative) == expected, f"candidate review changed: {relative}")
    require(
        {
            review["path"]: review["sha256"]
            for review in manifest["candidate_reviews"].values()
        }
        == CANDIDATE_REVIEW_SHAS,
        "candidate review archive changed",
    )
    return len(manifest["components"])


def verify_predecessor_manifest() -> int:
    path = ROOT / "releases/v2.0.0/release-manifest.json"
    release = candidate.load_json_strict(path)
    require(candidate.sha256(path) == PREDECESSOR_MANIFEST_SHA, "predecessor manifest bytes changed")
    release_digest = release["release_digest"]
    content_digest = release["content_digest"]
    approvals = release["approvals"]
    content_hash_input = {
        key: value
        for key, value in release.items()
        if key not in {"release_digest", "content_digest", "approvals"}
    }
    calculated_content = "sha256:" + hashlib.sha256(
        candidate.canonical_bytes(content_hash_input)
    ).hexdigest()
    require(
        calculated_content
        == content_digest
        == "sha256:4231062a50b0334eda7f67e07200faf5e71261b2a8cf27ecd375529ec84f8b69",
        "predecessor content digest changed",
    )
    for approval in approvals:
        evidence = ROOT / approval["evidence"]["path"]
        require(candidate.sha256(evidence) == approval["evidence"]["sha256"], "predecessor approval changed")
        require(approval["reviewed_content_digest"] == content_digest, "predecessor approval digest changed")
    release_hash_input = {
        **content_hash_input,
        "content_digest": content_digest,
        "approvals": approvals,
    }
    calculated_release = "sha256:" + hashlib.sha256(
        candidate.canonical_bytes(release_hash_input)
    ).hexdigest()
    require(
        calculated_release
        == release_digest
        == "sha256:aa9537a8779758af1227ba42371e75ab5aeafc84d5b73c4cdff35320481aa3f9",
        "predecessor release digest changed",
    )
    require(
        release["protocol_version"] == "2.0.0"
        and release["authority"]["tag"] == "v2.0.0",
        "immediate predecessor identity changed",
    )
    require(len(release["components"]) == 93, "predecessor component count changed")
    return len(release["components"])


def verify_patch_compatibility() -> None:
    predecessor = candidate.load_json_strict(
        ROOT / "releases/v2.0.0/release-manifest.json"
    )
    for name, component in predecessor["components"].items():
        if name in PATCH_TOOLING_COMPONENTS:
            continue
        require(
            candidate.sha256(ROOT / component["path"]) == component["sha256"],
            f"v2.0.1 changed preserved v2.0.0 component: {name}",
        )

    manifest_path = (
        ROOT / "manifests/foigent.openinference.otlp-spans-1.0.0.json"
    )
    current_bytes = manifest_path.read_bytes()
    require(
        candidate.sha256(manifest_path)
        == "sha256:363123d5837741ed78c134e305593d3fd0fdf68040cebff068d3f76d5bc62a1b",
        "corrected OpenInference Manifest bytes changed",
    )
    corrected = (
        b"sha256:d5abcabffeb8bb368e5c188b7ed5179b5674092e9421af2c38e548bfdbec7077"
    )
    stale = (
        b"sha256:b374f7a03c73b6fa94d9fab96ce20d819d4e1471f77d2e4c908df1297c1e49b2"
    )
    require(current_bytes.count(corrected) == 1, "corrected nested digest is not unique")
    reconstructed_predecessor = current_bytes.replace(corrected, stale)
    require(
        "sha256:" + hashlib.sha256(reconstructed_predecessor).hexdigest()
        == predecessor["components"]["openinference_connector_manifest"]["sha256"]
        == "sha256:6f7665c580aeed86ab8b05775e00bc3bb93a7fde947589c0c4d0d967d4f0217b",
        "OpenInference Manifest differs from v2.0.0 by more than the nested digest",
    )


def verify_control_error_spec(spec: str) -> None:
    normalized = " ".join(spec.split())
    require(
        "a lifecycle/control Error binds `error.operation` exactly to the outer "
        "Receipt operation" in normalized,
        "stable spec lost exact control Error operation binding",
    )
    require(
        "lifecycle/control Error phase is `activate` for `activate`, `status` "
        "for `pause`/`resume`/`start`/`rotate`, and `shutdown` for "
        "`stop`/`retire`" in normalized,
        "stable spec control Error phase mapping changed",
    )
    require(
        "lifecycle/control Error recovery is limited to `automatic_retry`, "
        "`restart`, `reauthorize`, `operator_repair`, or `none`" in normalized,
        "stable spec control Error recovery domain changed",
    )
    require(
        "`explicit_resync`, `resubmit_request`, and `reimport_bundle` are forbidden"
        in normalized,
        "stable spec no longer forbids data-plane control Error recovery",
    )
    require(
        "Error phase, operation, and recovery match the outer operation exactly"
        not in normalized,
        "stable spec retains contradictory control Error equality",
    )


def verify_binding_artifacts() -> None:
    spec = (ROOT / "spec/protocol-v2.md").read_text(encoding="utf-8")
    require("Version: `2.0.0`" in spec, "stable v2 protocol version absent")
    require("immutable `v2.0.0`" in spec, "immutable release authority absent")
    require("NOT_BINDING" not in spec, "stable v2 spec retains candidate status")
    require(
        "Protocol release is not product migration" in spec,
        "product adoption boundary absent",
    )
    verify_control_error_spec(spec)

    contract_path = ROOT / "conformance/source-neutral-conformance-contract.v2.json"
    vector_path = ROOT / "vectors/source-neutral-vector-bundle.v2.json"
    contract = candidate.load_json_strict(contract_path)
    vector = candidate.load_json_strict(vector_path)
    require(candidate.sha256(contract_path) == BINDING_CONTRACT_SHA, "binding contract changed")
    require(candidate.sha256(vector_path) == BINDING_VECTOR_SHA, "binding vector changed")
    require(
        contract["protocol_version"] == vector["protocol_version"] == "2.0.0",
        "binding protocol version mismatch",
    )
    require(
        contract["protocol_status"] == vector["protocol_status"] == "binding",
        "binding protocol status mismatch",
    )
    require(
        vector["conformance_contract"]
        == {
            "path": "conformance/source-neutral-conformance-contract.v2.json",
            "sha256": BINDING_CONTRACT_SHA,
        },
        "vector contract pin changed",
    )

    for implementation in ["go", "typescript"]:
        path = (
            ROOT
            / f"implementations/source-neutral-v2/{implementation}/implementation-manifest.v2.json"
        )
        manifest = candidate.load_json_strict(path)
        require(manifest["protocol_version"] == "2.0.0", "implementation protocol changed")
        require(manifest["protocol_status"] == "binding", "implementation status changed")
        require(manifest["implementation"] == implementation, "implementation identity changed")

        report = candidate.load_json_strict(
            ROOT / f"conformance/reports/{implementation}-source-neutral-v2.json"
        )
        require(report["bundle_sha256"] == BINDING_VECTOR_SHA, "report bundle pin changed")
        require(
            report["implementation_version"] == FINAL_IMPLEMENTATION_VERSION,
            "final implementation version changed",
        )
        require(report["status"] == "pass", "binding report did not pass")
        require(len(report["cases"]) == 83, "binding report case count changed")

    transition = candidate.load_json_strict(
        ROOT / "compatibility/v1-to-v2-source-neutral-matrix.json"
    )
    require(
        transition["predecessor"]
        == {
            "protocol_version": "1.1.2",
            "tag_commit": candidate.PREDECESSOR_COMMIT,
            "tree": candidate.PREDECESSOR_TREE,
            "content_digest": candidate.PREDECESSOR_CONTENT_DIGEST,
        },
        "v1 predecessor identity changed",
    )
    require(
        transition["release"]
        == {"protocol_version": "2.0.0", "status": "binding"},
        "v2 release identity changed",
    )
    require("candidate" not in transition, "candidate-only transition status survived")


def verify_product_compatibility() -> None:
    matrix_path = (
        ROOT
        / "compatibility/foigent-openinference-bounded-export-1.0.0-to-xinsight-m0.1.json"
    )
    matrix = candidate.load_json_strict(matrix_path)
    candidate.verify_openinference_compatibility(matrix)
    consumer = matrix["consumer_baseline"]
    require(
        consumer["reviewed_origin_main_commit"] == candidate.XINSIGHT_ORIGIN_MAIN_COMMIT
        and consumer["reviewed_origin_main_tree"] == candidate.XINSIGHT_ORIGIN_MAIN_TREE,
        "reviewed X-Insight origin/main identity changed",
    )
    require(
        consumer["candidate_commit"] == candidate.XINSIGHT_CANDIDATE_COMMIT
        and consumer["candidate_tree"] == candidate.XINSIGHT_CANDIDATE_TREE,
        "reviewed X-Insight product candidate identity changed",
    )
    require(
        matrix["source_baseline"]["source_schema"]["sha256"] == candidate.SOURCE_SCHEMA_SHA,
        "compatibility matrix Source Schema pin changed",
    )
    require(
        candidate.sha256(ROOT / matrix["source_baseline"]["source_schema"]["path"])
        == candidate.SOURCE_SCHEMA_SHA,
        "OpenInference Source Schema bytes changed",
    )

    manifest = candidate.load_json_strict(
        ROOT / "manifests/foigent.openinference.otlp-spans-1.0.0.json"
    )
    verify_openinference_manifest_projection_reference(manifest)
    require(manifest["manifest_version"] == "foigent.connector-manifest.v2", "wrong Manifest version")
    require(
        manifest["transport"]["mode"]
        == manifest["delivery"]["mode"]
        == manifest["state_progression"]["mode"]
        == "bounded_offline",
        "OpenInference mode changed",
    )
    require(
        manifest["state_progression"]["checkpoint"] == "not_applicable",
        "OpenInference Manifest fabricates a Checkpoint",
    )
    require(
        manifest["supported_source_schemas"][0]["sha256"] == candidate.SOURCE_SCHEMA_SHA,
        "Manifest Source Schema pin changed",
    )
    require(
        manifest["compatibility"]["reference_compatibility_vector_bundle"]["sha256"]
        == candidate.sha256(matrix_path),
        "Manifest compatibility matrix pin is stale",
    )

    catalog = candidate.load_json_strict(ROOT / "catalog/domain-catalog.v2.json")
    require(catalog["catalog_version"] == "foigent.domain-catalog.v2", "domain catalog version changed")
    observability = next(
        domain for domain in catalog["domains"] if domain["domain"] == "observability"
    )
    registration = observability["event_types"][0]
    require(
        {
            "event_type": registration["event_type"],
            "schema_ref": registration["schema_ref"],
            "schema_version": registration["schema_version"],
        }
        == manifest["emitted_event_schemas"][0],
        "Manifest event declaration differs from domain catalog",
    )
    require(
        candidate.sha256(ROOT / registration["payload_schema_path"])
        == "sha256:b40e06b7ddc0f5c2800aa81c7562f3d79e35074fd9ba692cb663741491e2c0ce",
        "OpenInference payload Schema bytes changed",
    )

    projection = candidate.load_json_strict(
        ROOT / "mappings/xinsight/openinference-span-to-m0-m0.1-v2.json"
    )
    baseline = projection["consumer_baseline"]
    require(
        baseline["reviewed_origin_main_commit"] == candidate.XINSIGHT_ORIGIN_MAIN_COMMIT
        and baseline["reviewed_origin_main_tree"] == candidate.XINSIGHT_ORIGIN_MAIN_TREE,
        "projection origin/main baseline changed",
    )
    require(
        baseline["commit"] == candidate.XINSIGHT_CANDIDATE_COMMIT
        and baseline["tree"] == candidate.XINSIGHT_CANDIDATE_TREE,
        "projection candidate baseline changed",
    )
    require(
        baseline["preserved_dirty_checkout_head"] == candidate.XINSIGHT_PRESERVED_DIRTY_HEAD
        and baseline["preserved_dirty_checkout_tree"] == candidate.XINSIGHT_PRESERVED_DIRTY_TREE,
        "preserved dirty checkout identity changed",
    )
    require(len(baseline["preserved_dirty_checkout_tree"]) == 40, "dirty tree identity is truncated")
    require(
        projection["activation_gate"]["status"] == "blocked_product_migration_required",
        "X-Insight activation gate opened",
    )
    require(
        "parent presence is resolved by trace_id + parent_span_id rather than a batch-global span_id lookup"
        in projection["activation_gate"]["must_pass_before_activation"],
        "trace-scoped parent migration gate absent",
    )
    excluded = projection["provenance"]["mutable_delivery_excluded"]
    for name in [
        "cursor",
        "high_watermark",
        "request_id",
        "bundle_id",
        "bundle_sha256",
        "retry_state",
        "receipt_time",
        "ingestion_time",
    ]:
        require(name in excluded, f"mutable delivery exclusion absent: {name}")
    require(
        "must never contain a delivery Cursor" in projection["main_event"]["$.import_cursor"],
        "product-local import_cursor boundary changed",
    )


def verify_openinference_manifest_projection_reference(
    manifest: dict[str, Any],
) -> None:
    reference = manifest.get("compatibility", {}).get(
        "reference_projection_contract"
    )
    require(
        isinstance(reference, dict),
        "OpenInference Manifest projection contract reference is absent",
    )
    require(
        reference.get("path") == OPENINFERENCE_PROJECTION_PATH,
        "OpenInference Manifest projection contract path changed",
    )
    require(
        reference.get("sha256")
        == candidate.sha256(ROOT / OPENINFERENCE_PROJECTION_PATH),
        "OpenInference Manifest projection contract pin is stale",
    )


def validate() -> dict[str, Any]:
    candidate_components = verify_candidate_archive()
    immediate_predecessor_components = verify_predecessor_manifest()
    v1_predecessor_components = candidate.verify_predecessor_release()
    candidate.verify_v1_xinsight_seed()
    candidate.verify_openinference_vectors()
    candidate.verify_operational_receipt_contract()
    verify_binding_artifacts()
    verify_product_compatibility()
    verify_patch_compatibility()
    cases, classes = candidate.verify_reports()
    return {
        "status": "pass",
        "protocol_version": "2.0.1",
        "protocol_status": "release_content_candidate",
        "semantic_base_version": "2.0.0",
        "compatibility": "patch_compatible_metadata_integrity_erratum",
        "candidate_components_verified": candidate_components,
        "immediate_predecessor_components_verified": immediate_predecessor_components,
        "v1_predecessor_components_verified": v1_predecessor_components,
        "v1_m0_id_hash_pairs": 10,
        "v1_gap_rows": 8,
        "v1_provenance_ids": 2,
        "openinference_m0_id_hash_pairs": 5,
        "openinference_gap_events": 4,
        "conformance_cases": cases,
        "conformance_classes": classes,
        "product_migration": "not_authorized",
        "runtime_mutation": "none",
    }


def main() -> None:
    print(json.dumps(validate(), sort_keys=True, separators=(",", ":")))


if __name__ == "__main__":
    main()
