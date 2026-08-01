#!/usr/bin/env python3

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any, Callable

import validate_source_neutral_v2_candidate as semantic_candidate
import validate_source_neutral_v2_release as v2_0_1_validator


ROOT = Path(__file__).resolve().parents[1]
CANDIDATE_PATH = Path(
    "docs/candidates/v2.0.2-rc.1/candidate-manifest.json"
)
PREDECESSOR_PATH = Path("releases/v2.0.1/release-manifest.json")
PREDECESSOR_MANIFEST_SHA = (
    "sha256:fa097dfa08ba318334f78f4690f65247f080e86fde5695742b3ad49aaeba6a60"
)
PREDECESSOR_CONTENT_DIGEST = (
    "sha256:b3fd6a0651ca2c501bb8040f89945f57abb16fc5e01476c0efe4356e46b08e3e"
)
PREDECESSOR_RELEASE_DIGEST = (
    "sha256:b21e719b6dd0653aa93479aef64832d2e598c780c0e1804b84e34fbe658ac777"
)
PATCH_TOOLING_COMPONENTS = {
    "authority_readme",
    "governance",
    "shared_ci_action",
    "authority_ci_workflow",
    "conformance_kit_runner",
    "release_builder",
    "product_pin_verifier",
}
V1_1_2_CURRENT_TREE_PATCH_COMPONENTS = {"authority_ci_workflow"}


def require(condition: bool, message: str) -> None:
    semantic_candidate.require(condition, message)


def verify_v1_1_2_current_compatibility(
    sha256_fn: Callable[[Path], str] = semantic_candidate.sha256,
) -> int:
    release = semantic_candidate.load_json_strict(
        ROOT / "releases/v1.1.2/release-manifest.json"
    )
    require(release["protocol_version"] == "1.1.2", "wrong v1.1.2 version")
    require(
        release["content_digest"] == semantic_candidate.PREDECESSOR_CONTENT_DIGEST,
        "wrong v1.1.2 content digest",
    )
    require(
        release["release_digest"] == semantic_candidate.PREDECESSOR_RELEASE_DIGEST,
        "wrong v1.1.2 release digest",
    )
    preserved = 0
    for name, component in release["components"].items():
        if name in V1_1_2_CURRENT_TREE_PATCH_COMPONENTS:
            continue
        path = ROOT / component["path"]
        require(path.is_file(), f"v1.1.2 component absent: {component['path']}")
        require(
            sha256_fn(path) == component["sha256"],
            f"v1.1.2 current compatibility changed: {component['path']}",
        )
        preserved += 1
    return preserved


def verify_v2_0_1_predecessor_manifest() -> int:
    path = ROOT / PREDECESSOR_PATH
    release = semantic_candidate.load_json_strict(path)
    require(
        semantic_candidate.sha256(path) == PREDECESSOR_MANIFEST_SHA,
        "v2.0.1 predecessor manifest bytes changed",
    )
    require(
        release["protocol_version"] == "2.0.1"
        and release["authority"]
        == {
            "repository": "https://github.com/foigent/event-connector-spec",
            "repository_id": 1313391565,
            "tag": "v2.0.1",
        },
        "v2.0.1 predecessor authority changed",
    )
    content_hash_input = {
        key: value
        for key, value in release.items()
        if key not in {"release_digest", "content_digest", "approvals"}
    }
    calculated_content = "sha256:" + hashlib.sha256(
        semantic_candidate.canonical_bytes(content_hash_input)
    ).hexdigest()
    require(
        calculated_content
        == release["content_digest"]
        == PREDECESSOR_CONTENT_DIGEST,
        "v2.0.1 predecessor content digest changed",
    )
    approvals = release["approvals"]
    require(
        [approval["role"] for approval in approvals]
        == ["source_domain_owner", "projection_owner", "coordinator"],
        "v2.0.1 predecessor approval roles changed",
    )
    for approval in approvals:
        evidence = ROOT / approval["evidence"]["path"]
        require(
            semantic_candidate.sha256(evidence)
            == approval["evidence"]["sha256"],
            f"v2.0.1 predecessor approval changed: {approval['role']}",
        )
        require(
            approval["reviewed_content_digest"]
            == PREDECESSOR_CONTENT_DIGEST,
            f"v2.0.1 predecessor approval digest changed: {approval['role']}",
        )
    release_hash_input = {
        **content_hash_input,
        "content_digest": PREDECESSOR_CONTENT_DIGEST,
        "approvals": approvals,
    }
    calculated_release = "sha256:" + hashlib.sha256(
        semantic_candidate.canonical_bytes(release_hash_input)
    ).hexdigest()
    require(
        calculated_release
        == release["release_digest"]
        == PREDECESSOR_RELEASE_DIGEST,
        "v2.0.1 predecessor release digest changed",
    )
    require(len(release["components"]) == 94, "v2.0.1 component count changed")
    return len(release["components"])


def verify_candidate_manifest() -> int:
    path = ROOT / CANDIDATE_PATH
    manifest = semantic_candidate.load_json_strict(path)
    content_hash_input = {
        key: manifest[key]
        for key in [
            "candidate_manifest_version",
            "protocol_version",
            "protocol_status",
            "authority",
            "predecessor",
            "compatibility",
            "components",
        ]
    }
    calculated = "sha256:" + hashlib.sha256(
        semantic_candidate.canonical_bytes(content_hash_input)
    ).hexdigest()
    require(calculated == manifest["content_digest"], "candidate digest changed")
    require(
        manifest["protocol_version"] == "2.0.2"
        and manifest["protocol_status"] == "not_binding",
        "candidate version or status changed",
    )
    require(
        manifest["predecessor"]
        == {
            "protocol_version": "2.0.1",
            "tag": "v2.0.1",
            "tag_object": "c24531c24955bc700133387dd7352a88e5ba82be",
            "tag_commit": "0cbb6417858d12d6a99ff3b517bd59a122bc7e2c",
            "tree": "f967929dd98c5f34cd42fce4aa21489b72b000e0",
            "manifest_sha256": PREDECESSOR_MANIFEST_SHA,
            "content_digest": PREDECESSOR_CONTENT_DIGEST,
            "release_digest": PREDECESSOR_RELEASE_DIGEST,
        },
        "candidate predecessor changed",
    )
    require(
        manifest["compatibility"] == "PATCH_COMPATIBLE_CI_PORTABILITY_FIX",
        "candidate compatibility changed",
    )
    require(
        manifest["approvals"]
        == {
            "source_domain_owner": "required",
            "projection_owner": "separate_exact_digest_review_required",
            "coordinator": "required",
        },
        "candidate review boundary changed",
    )
    require(
        manifest["boundary"]
        == {
            "binding_release": False,
            "immutable_tag": "absent",
            "product_adoption": "not_authorized",
            "runtime_mutation": "none",
        },
        "candidate product/runtime boundary changed",
    )
    paths = [component["path"] for component in manifest["components"].values()]
    require(len(paths) == len(set(paths)), "candidate component paths are not unique")
    for name, component in manifest["components"].items():
        require(
            semantic_candidate.sha256(ROOT / component["path"])
            == component["sha256"],
            f"candidate component changed: {name}",
        )
    return len(manifest["components"])


def verify_patch_compatibility(
    sha256_fn: Callable[[Path], str] = semantic_candidate.sha256,
) -> int:
    predecessor = semantic_candidate.load_json_strict(ROOT / PREDECESSOR_PATH)
    preserved = 0
    for name, component in predecessor["components"].items():
        if name in PATCH_TOOLING_COMPONENTS:
            continue
        require(
            sha256_fn(ROOT / component["path"]) == component["sha256"],
            f"v2.0.2 changed preserved v2.0.1 component: {name}",
        )
        preserved += 1
    return preserved


def verify_portability_boundary() -> None:
    action = (ROOT / "actions/source-neutral-v2/action.yml").read_text()
    consumer = (
        ROOT / "scripts/run-source-neutral-v2-consumer-kit.sh"
    ).read_text()
    current = (
        ROOT / "scripts/run-source-neutral-v2-current-release-kit.sh"
    ).read_text()
    authority = (
        ROOT / "scripts/run-source-neutral-v2-release-kit.sh"
    ).read_text()
    workflow = (ROOT / ".github/workflows/source-neutral-v2.yml").read_text()
    generic_workflow = (ROOT / ".github/workflows/ci.yml").read_text()
    release_builder = (
        ROOT / "scripts/build-source-neutral-v2-release-manifest.mjs"
    ).read_text()

    require(
        "run-source-neutral-v2-consumer-kit.sh" in action
        and "run-source-neutral-v2-release-kit.sh" not in action
        and "--release" in action,
        "composite action is not snapshot-safe consumer mode",
    )
    command_pattern = re.compile(r"(^|[^a-zA-Z0-9_-])git([^-a-zA-Z0-9_]|$)")
    for label, script in [("consumer", consumer), ("current", current)]:
        require(
            command_pattern.search(script) is None,
            f"{label} kit has a Git dependency",
        )
        require("predecessor-kit.sh" not in script, f"{label} kit invokes history")
    for required in [
        "run-v1.1.2-predecessor-kit.sh",
        "run-v2.0.0-predecessor-kit.sh",
        "run-v2.0.1-predecessor-kit.sh",
        "run-source-neutral-v2-current-release-kit.sh",
    ]:
        require(required in authority, f"Authority Kit lost {required}")
    require(
        "run-source-neutral-v2-release-kit.sh" in workflow
        and "run-source-neutral-v2-action-snapshot-kit.sh" in workflow,
        "Authority CI lost release or snapshot verification",
    )
    require(
        "run-v1-compatibility-current-kit.sh" in generic_workflow
        and "run-conformance-kit.sh" not in generic_workflow,
        "generic current-tree CI is not scoped to current v1/LiteLLM compatibility",
    )
    require(
        'generic_current_tree_ci_workflow: ".github/workflows/ci.yml"'
        in release_builder,
        "release content does not bind generic current-tree CI",
    )
    for required in [
        'protocol_version: "2.0.1"',
        'tag: "v2.0.1"',
        'tag_commit: "0cbb6417858d12d6a99ff3b517bd59a122bc7e2c"',
        'tree: "f967929dd98c5f34cd42fce4aa21489b72b000e0"',
        PREDECESSOR_CONTENT_DIGEST,
        PREDECESSOR_RELEASE_DIGEST,
    ]:
        require(required in release_builder, f"release predecessor link lost: {required}")


def verify_candidate_decision() -> None:
    decision = (
        ROOT
        / "docs/decisions/0005-composite-action-snapshot-portability-candidate.md"
    ).read_text()
    normalized = " ".join(decision.split())
    for required in [
        "CANDIDATE_NOT_BINDING",
        "PATCH_COMPATIBLE_CI_PORTABILITY_FIX",
        "Product migration: `NOT_AUTHORIZED`",
        "Runtime mutation: `NONE`",
        "snapshot without `.git`",
        "run-v1-compatibility-current-kit.sh",
        "run-conformance-kit.sh` remains byte-exact",
        "Fresh Projection, Source and Coordinator review is required",
    ]:
        require(required in normalized, f"candidate decision lost {required}")


def verify_preserved_semantics() -> dict[str, int]:
    v2_0_1_validator.verify_predecessor_manifest()
    verify_v1_1_2_current_compatibility()
    semantic_candidate.verify_v1_xinsight_seed()
    semantic_candidate.verify_openinference_vectors()
    semantic_candidate.verify_operational_receipt_contract()
    v2_0_1_validator.verify_binding_artifacts()
    v2_0_1_validator.verify_product_compatibility()
    v2_0_1_validator.verify_patch_compatibility()
    cases, classes = semantic_candidate.verify_reports()
    return {"conformance_cases": cases, "conformance_classes": classes}


def validate() -> dict[str, Any]:
    predecessor_semantics = verify_preserved_semantics()
    predecessor_components = verify_v2_0_1_predecessor_manifest()
    candidate_components = verify_candidate_manifest()
    preserved_components = verify_patch_compatibility()
    verify_portability_boundary()
    verify_candidate_decision()
    return {
        "status": "pass",
        "protocol_version": "2.0.2",
        "protocol_status": "candidate_not_binding",
        "semantic_base_version": "2.0.1",
        "compatibility": "patch_compatible_ci_portability_fix",
        "candidate_components_verified": candidate_components,
        "immediate_predecessor_components_verified": predecessor_components,
        "preserved_predecessor_components_verified": preserved_components,
        "v1_m0_id_hash_pairs": 10,
        "v1_gap_rows": 8,
        "v1_provenance_ids": 2,
        "openinference_m0_id_hash_pairs": 5,
        "openinference_gap_events": 4,
        "conformance_cases": predecessor_semantics["conformance_cases"],
        "conformance_classes": predecessor_semantics["conformance_classes"],
        "product_migration": "not_authorized",
        "runtime_mutation": "none",
    }


def main() -> None:
    print(json.dumps(validate(), sort_keys=True, separators=(",", ":")))


if __name__ == "__main__":
    main()
