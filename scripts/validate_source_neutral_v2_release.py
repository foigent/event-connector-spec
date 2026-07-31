#!/usr/bin/env python3

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import validate_source_neutral_v2_candidate as candidate


ROOT = Path(__file__).resolve().parents[1]
CANDIDATE_CONTENT_DIGEST = (
    "sha256:420847a10d0febddd1fd8fcd03b74761f00c4162dd1ebfed1ad3e164925993aa"
)
CANDIDATE_MANIFEST_SHA = (
    "sha256:ee046d1e06cbb3ab98a8565737ecd76ce71423be68e22d6f4f7b916ffcbb4b91"
)
BINDING_CONTRACT_SHA = (
    "sha256:f820936448590144156c2e499134eb4b3142ca0265275b6e9bdf1e5cd7855e14"
)
BINDING_VECTOR_SHA = (
    "sha256:9e50bb4570dcc1ff07157ad6198641e937357b641ae052cddcb3420b52ad11ed"
)
FINAL_IMPLEMENTATION_VERSION = "2.0.0+independent.1"
PREDECESSOR_MANIFEST_SHA = (
    "sha256:e7637eb3162e4076f991588c54cbeb083bcf39d8795587c2594ea45940a9b750"
)
CANDIDATE_REVIEW_SHAS = {
    "reviews/candidates/v2.0.0-rc.1/source-owner-review.md":
        "sha256:f09ab63b939ed0595c1ba2877856038acc2edd3c4129f09da169293288907582",
    "reviews/candidates/v2.0.0-rc.1/projection-owner-review.md":
        "sha256:56c50149c70758b2df3f029934a45b6185cf2fd2bba7b916420ecb53c0941e9a",
    "reviews/candidates/v2.0.0-rc.1/coordinator-review.md":
        "sha256:a80a7a3fa111923c35bac9a3d299bb66c31f035b93cbcd8373bbe773221d1cd8",
}


def require(condition: bool, message: str) -> None:
    candidate.require(condition, message)


def verify_candidate_archive() -> int:
    path = ROOT / "docs/candidates/v2.0.0-rc.1/candidate-manifest.json"
    manifest = candidate.load_json_strict(path)
    require(candidate.sha256(path) == CANDIDATE_MANIFEST_SHA, "candidate manifest bytes changed")
    content_hash_input = {
        key: manifest[key]
        for key in [
            "candidate_manifest_version",
            "protocol_version",
            "protocol_status",
            "authority",
            "predecessor",
            "components",
        ]
    }
    digest = "sha256:" + hashlib.sha256(
        candidate.canonical_bytes(content_hash_input)
    ).hexdigest()
    require(
        digest == manifest["content_digest"] == CANDIDATE_CONTENT_DIGEST,
        "candidate content digest changed",
    )
    require(manifest["protocol_status"] == "not_binding", "candidate status changed")
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
    require(len(manifest["components"]) == 60, "candidate component count changed")
    for relative, expected in CANDIDATE_REVIEW_SHAS.items():
        require(candidate.sha256(ROOT / relative) == expected, f"candidate review changed: {relative}")
    return len(manifest["components"])


def verify_predecessor_manifest() -> int:
    path = ROOT / "releases/v1.1.2/release-manifest.json"
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
        == candidate.PREDECESSOR_CONTENT_DIGEST,
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
        == candidate.PREDECESSOR_RELEASE_DIGEST,
        "predecessor release digest changed",
    )
    require(len(release["components"]) == 57, "predecessor component count changed")
    return len(release["components"])


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


def validate() -> dict[str, Any]:
    candidate_components = verify_candidate_archive()
    predecessor_components = verify_predecessor_manifest()
    require(
        candidate.verify_predecessor_release() == predecessor_components,
        "current v1 compatibility base differs from the immutable predecessor",
    )
    candidate.verify_v1_xinsight_seed()
    candidate.verify_openinference_vectors()
    candidate.verify_operational_receipt_contract()
    verify_binding_artifacts()
    verify_product_compatibility()
    cases, classes = candidate.verify_reports()
    return {
        "status": "pass",
        "protocol_version": "2.0.0",
        "protocol_status": "binding",
        "candidate_components_verified": candidate_components,
        "predecessor_components_verified": predecessor_components,
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
