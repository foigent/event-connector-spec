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


def require(condition: bool, message: str) -> None:
    semantic_candidate.require(condition, message)


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
            "reviewed_candidate",
            "candidate_reviews",
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
        manifest["reviewed_candidate"]
        == {
            "commit": "6f729d9a3cf819e5c538ba8bd3a16a85cdc42967",
            "tree": "5fb49fb450257dd1c40e33f6f8358e6dd434a367",
            "manifest_sha256": "sha256:5900f60eea16a2d3e66751d57a4e34e814db8b974dbbfdee32529894669f8d02",
            "content_digest": "sha256:d58e09d80a07184d1c5053ee8de082546ac2f2b88c6c2cde3de97273a860bed7",
        },
        "reviewed candidate identity changed",
    )
    expected_reviews = {
        "source_domain_owner": {
            "path": "reviews/candidates/v2.0.2-rc.1/source-owner-review.md",
            "commit": "e1c2b5966c24dcac67662a768e8e19114f4a959c",
            "tree": "f7e3383fcbdf6a6b149d3f8fd1a7b29e147b3773",
            "sha256": "sha256:a2ae89adfa40a3a92ec2a453b2dfffefce1b7381c5340f4c673555941ca3a65f",
            "status": "SOURCE_OWNER_V2_0_2_PORTABILITY_CANDIDATE_CONFIRM_NON_BINDING",
        },
        "projection_owner": {
            "path": "reviews/candidates/v2.0.2-rc.1/projection-owner-review.md",
            "commit": "140dc19f8455ba38949b2b81a356767ccb070792",
            "tree": "1891bee63c60394ae39d24829f575ed67c4a18d7",
            "sha256": "sha256:7f42849f6c7be89b54228c21f533ab41216c8b46de77226186230229ca95d4ed",
            "status": "PROJECTION_OWNER_V2_0_2_PORTABILITY_CANDIDATE_CONFIRM_NON_BINDING",
        },
        "coordinator": {
            "path": "reviews/candidates/v2.0.2-rc.1/coordinator-review.md",
            "commit": "be63f837ae9e442a255da607ac9d35290be1a5eb",
            "tree": "0d20561130c4d90936bcc08e4b1c6c45c78542ad",
            "sha256": "sha256:5d7e16053a641797c03ffecef783e37eb43e5f01c8dcdef42052b20e3ed74429",
            "status": "COORDINATOR_V2_0_2_PORTABILITY_CANDIDATE_CONFIRM_NON_BINDING",
        },
    }
    require(
        manifest["candidate_reviews"] == expected_reviews,
        "candidate review identities changed",
    )
    for role, review in expected_reviews.items():
        evidence = ROOT / review["path"]
        require(
            semantic_candidate.sha256(evidence) == review["sha256"],
            f"candidate review bytes changed: {role}",
        )
    require(
        manifest["compatibility"] == "PATCH_COMPATIBLE_CI_PORTABILITY_FIX",
        "candidate compatibility changed",
    )
    require(
        manifest["approvals"]
        == {
            "source_domain_owner": "candidate_confirmed_non_binding",
            "projection_owner": "candidate_confirmed_non_binding",
            "coordinator": "candidate_confirmed_non_binding",
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
        "THREE_ROLE_CANDIDATE_CONFIRMED_RELEASE_CONTENT_NOT_BINDING",
        "PATCH_COMPATIBLE_CI_PORTABILITY_FIX",
        "Product migration: `NOT_AUTHORIZED`",
        "Runtime mutation: `NONE`",
        "snapshot without `.git`",
        "a2ae89adfa40a3a92ec2a453b2dfffefce1b7381c5340f4c673555941ca3a65f",
        "7f42849f6c7be89b54228c21f533ab41216c8b46de77226186230229ca95d4ed",
        "5d7e16053a641797c03ffecef783e37eb43e5f01c8dcdef42052b20e3ed74429",
        "Fresh three-role final approval is required",
    ]:
        require(required in normalized, f"candidate decision lost {required}")


def verify_preserved_semantics() -> dict[str, int]:
    v2_0_1_validator.verify_predecessor_manifest()
    semantic_candidate.verify_predecessor_release()
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
        "protocol_status": "release_content_candidate_not_binding",
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
