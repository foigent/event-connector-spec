#!/usr/bin/env python3
"""Validate the bounded UniRouter Source-owned B9 mapping candidates."""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any


FORMAT = "foigent.source-mapping-candidate.v1"
STATUS = "B9_SOURCE_CANDIDATE_NOT_BINDING"
WORK_ITEM = "FV-FOIGENT-EVENT-CONNECTOR-PLATFORM-V1-20260726"
AUTHORITY_REPOSITORY = "https://github.com/foigent/event-connector-spec"
AUTHORITY_REPOSITORY_ID = 1313391565
SOURCE_REPOSITORY = "https://github.com/foigent/unirouter.git"
SOURCE_COMMIT = "bf91ea63a16952bb2925afd5438233cac597dcc1"
SOURCE_TREE = "ddadc277fbede49fac0cbc1cc561203312432ac3"
V3_SHA256 = "f52c4a1f21232d3c209ff3de3e4e63da41d53e139e7ef13648db57fe4257311f"

SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")

ARTIFACT_FILES = {
    "source-snapshot-to-model-request-completed.v1.json":
        "unirouter.source-snapshot-to-model-request-completed",
    "source-lifecycle-to-shared-axes.v1.json":
        "unirouter.source-lifecycle-to-shared-axes",
    "connector-identity-to-source-local.v1.json":
        "unirouter.connector-identity-to-source-local",
    "source-contract-seeds.v1.json":
        "unirouter.source-contract-seeds",
}

COMMON_KEYS = {
    "artifact_format",
    "artifact_kind",
    "candidate_status",
    "work_item_id",
    "authority",
    "joint_candidate",
    "source_baseline",
    "b8_boundary",
    "source_evidence",
}

KIND_KEYS = {
    "unirouter.source-snapshot-to-model-request-completed": {
        "coverage",
        "event_semantics",
        "field_mappings",
        "feed_wrapper_mappings",
        "gap_profile",
        "delivery_exclusions",
    },
    "unirouter.source-lifecycle-to-shared-axes": {
        "axis_mappings",
        "combination_rules",
        "explicit_exclusions",
    },
    "unirouter.connector-identity-to-source-local": {
        "portable_connector_candidate",
        "source_local_identity_mappings",
        "read_surface",
        "product_local_control_routes",
        "identity_exclusions",
        "compatibility_invariants",
    },
    "unirouter.source-contract-seeds": {
        "seeds",
        "source_type_precision",
        "boundary_requirements",
        "runtime_nonclaims",
    },
}

EXPECTED_SOURCE_POINTERS = {
    "/schema_version",
    "/request_id",
    "/org_id",
    "/project_id",
    "/terminal/status",
    "/terminal/available_at",
    "/usage/model",
    "/usage/prompt_tokens",
    "/usage/uncached_prompt_tokens",
    "/usage/cache_read_tokens",
    "/usage/cache_creation_tokens",
    "/usage/completion_tokens",
    "/usage/source",
    "/usage/authority",
    "/usage/purpose",
    "/usage/finality",
    "/usage/contract_version",
    "/usage/estimate_version",
    "/usage/cache_usage_schema",
    "/usage/cache_usage_status",
    "/money/schema",
    "/money/currency",
    "/money/amount_scale",
    "/money/calculated_cost_micros",
    "/money/charged_cost_micros",
    "/money/pricing_version",
    "/capture_gaps/*/source",
    "/capture_gaps/*/reason",
}

EXPECTED_WRAPPER_FIELDS = {
    "FeedPage.source_instance",
    "FeedItem.request_id",
    "FeedItem.terminal_available_at",
    "FeedItem.revision",
    "FeedItem.timeline_complete",
    "FeedItem.snapshot_sha256",
    "FeedItem.snapshot",
}

EXPECTED_EXCLUDED_FIELDS = {
    "FeedPage.generated_at",
    "FeedPage.next_cursor",
    "FeedPage.high_watermark",
    "FeedPage.has_more",
    "connection.acknowledged_sequence",
}

EXPECTED_LIFECYCLE_MAPPING_IDS = {
    "project_connection_absent",
    "project_connection_paused",
    "project_connection_active",
    "global_feed_unconfigured",
    "global_feed_disabled",
    "global_feed_enabled",
    "credential_missing",
    "credential_staged",
    "credential_active",
    "credential_revoked",
    "outbox_pending",
    "outbox_claimed",
    "outbox_retry_wait",
    "outbox_dead_letter",
    "outbox_processed",
    "feed_item_ready",
    "feed_duplicate",
    "feed_conflict",
    "receiver_acknowledged_sequence",
    "cursor_outside_retention",
    "runtime_health_unrepresented",
}

EXPECTED_BOUNDARY_IDS = {
    "request_id_byte_bounds",
    "scope_decimal",
    "counter_decimal_boundaries",
    "prompt_partition",
    "money_forms",
    "terminal_time",
    "terminal_status",
    "gap_set_and_order",
    "snapshot_hash",
    "wrapper_binding",
    "unicode_boundary",
    "duplicate_keys",
    "prohibited_raw_fields",
    "cursor_exclusion",
    "duplicate_and_conflict",
}

EXPECTED_SEEDS = {
    "source_schema": (
        "contracts/completed-execution/v1/unirouter.completed-execution.v1.schema.json",
        "4ae2897d4f8470c38624dfe21c54d72eaf6d995d2c9578c4420c94d244424fb2",
    ),
    "settled_fixture": (
        "contracts/completed-execution/v1/fixtures/valid-settled.json",
        "5e9eda0a2630d52c5589d38b8ec480604c47c2cc77391b75a57b2a159db6dd27",
    ),
    "cancelled_fixture": (
        "contracts/completed-execution/v1/fixtures/valid-cancelled.json",
        "31cbfeb23968c07d158b591c28efb3dd40cffba1fd6d1fd4202f43d63bfe9f2d",
    ),
}

EXPECTED_CONTROL_ROUTES = {
    ("GET", "/api/v1/data-exchange/xinsight/connections/{project_id}"),
    ("POST", "/api/v1/data-exchange/xinsight/connections/{project_id}/pause"),
    ("POST", "/api/v1/data-exchange/xinsight/connections/{project_id}/resume"),
    ("POST", "/api/v1/data-exchange/xinsight/connections/{project_id}/credentials"),
    ("POST", "/api/v1/data-exchange/xinsight/connections/{project_id}/credentials/activate"),
    ("POST", "/api/v1/data-exchange/xinsight/connections/{project_id}/credentials/{credential_id}/revoke"),
    ("POST", "/api/v1/data-exchange/xinsight/connections/{project_id}/rotation/prepare"),
    ("POST", "/api/v1/data-exchange/xinsight/connections/{project_id}/rotation/activate"),
    ("POST", "/api/v1/data-exchange/xinsight/connections/{project_id}/rotation/cancel"),
}


class ValidationError(ValueError):
    """Raised when a mapping candidate violates its bounded format."""


def _reject_duplicate_pairs(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValidationError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def load_json_strict(path: Path) -> dict[str, Any]:
    try:
        with path.open("r", encoding="utf-8") as handle:
            value = json.load(handle, object_pairs_hook=_reject_duplicate_pairs)
    except (OSError, json.JSONDecodeError) as exc:
        raise ValidationError(f"{path}: invalid JSON: {exc}") from exc
    if not isinstance(value, dict):
        raise ValidationError(f"{path}: top-level JSON value must be an object")
    return value


def _require_exact_keys(value: dict[str, Any], expected: set[str], where: str) -> None:
    actual = set(value)
    if actual != expected:
        missing = sorted(expected - actual)
        extra = sorted(actual - expected)
        raise ValidationError(f"{where}: key mismatch missing={missing} extra={extra}")


def _require_nonempty_strings(values: Any, where: str) -> list[str]:
    if not isinstance(values, list) or not values:
        raise ValidationError(f"{where}: expected nonempty list")
    if any(not isinstance(value, str) or not value for value in values):
        raise ValidationError(f"{where}: every entry must be a nonempty string")
    return values


def _unique_field(items: Any, field: str, where: str) -> set[str]:
    if not isinstance(items, list) or not items:
        raise ValidationError(f"{where}: expected nonempty list")
    values: list[str] = []
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            raise ValidationError(f"{where}[{index}]: expected object")
        value = item.get(field)
        if not isinstance(value, str) or not value:
            raise ValidationError(f"{where}[{index}].{field}: expected nonempty string")
        values.append(value)
    if len(values) != len(set(values)):
        raise ValidationError(f"{where}: duplicate {field}")
    return set(values)


def validate_common(payload: dict[str, Any], expected_kind: str, where: str) -> None:
    expected_keys = COMMON_KEYS | KIND_KEYS[expected_kind]
    _require_exact_keys(payload, expected_keys, where)
    if payload["artifact_format"] != FORMAT:
        raise ValidationError(f"{where}: wrong artifact_format")
    if payload["artifact_kind"] != expected_kind:
        raise ValidationError(f"{where}: wrong artifact_kind")
    if payload["candidate_status"] != STATUS:
        raise ValidationError(f"{where}: wrong candidate_status")
    if payload["work_item_id"] != WORK_ITEM:
        raise ValidationError(f"{where}: wrong work_item_id")

    authority = payload["authority"]
    if authority != {
        "repository": AUTHORITY_REPOSITORY,
        "repository_id": AUTHORITY_REPOSITORY_ID,
        "owner_role": "UniRouter Source Domain Owner",
    }:
        raise ValidationError(f"{where}: wrong authority identity")

    joint_candidate = payload["joint_candidate"]
    if joint_candidate != {
        "status": "THREE_PARTY_TEXT_ALIGNED_NON_BINDING",
        "sha256": V3_SHA256,
    }:
        raise ValidationError(f"{where}: wrong Joint Candidate V3 identity")

    source_baseline = payload["source_baseline"]
    if source_baseline != {
        "repository": SOURCE_REPOSITORY,
        "commit": SOURCE_COMMIT,
        "tree": SOURCE_TREE,
    }:
        raise ValidationError(f"{where}: wrong UniRouter source baseline")

    b8_boundary = payload["b8_boundary"]
    _require_exact_keys(
        b8_boundary,
        {
            "semantic_refs_only",
            "shared_wire_paths_defined",
            "shared_schema_artifacts_created",
            "statement",
        },
        f"{where}.b8_boundary",
    )
    if b8_boundary["semantic_refs_only"] is not True:
        raise ValidationError(f"{where}: semantic_refs_only must be true")
    if b8_boundary["shared_wire_paths_defined"] is not False:
        raise ValidationError(f"{where}: shared_wire_paths_defined must be false")
    if b8_boundary["shared_schema_artifacts_created"] is not False:
        raise ValidationError(f"{where}: shared_schema_artifacts_created must be false")
    if not isinstance(b8_boundary["statement"], str) or not b8_boundary["statement"]:
        raise ValidationError(f"{where}: missing B8 boundary statement")

    evidence = _require_nonempty_strings(payload["source_evidence"], f"{where}.source_evidence")
    for path in evidence:
        candidate = Path(path)
        if candidate.is_absolute() or ".." in candidate.parts:
            raise ValidationError(f"{where}: Source evidence path must be repository-relative: {path}")


def validate_source_snapshot_mapping(payload: dict[str, Any], where: str) -> None:
    field_mappings = payload["field_mappings"]
    mapping_ids = _unique_field(field_mappings, "mapping_id", f"{where}.field_mappings")
    if len(mapping_ids) != len(EXPECTED_SOURCE_POINTERS):
        raise ValidationError(f"{where}: unexpected field mapping count")
    pointers = _unique_field(field_mappings, "source_pointer", f"{where}.field_mappings")
    if pointers != EXPECTED_SOURCE_POINTERS:
        raise ValidationError(
            f"{where}: Source pointer mismatch "
            f"missing={sorted(EXPECTED_SOURCE_POINTERS - pointers)} "
            f"extra={sorted(pointers - EXPECTED_SOURCE_POINTERS)}"
        )
    for index, item in enumerate(field_mappings):
        _require_exact_keys(
            item,
            {
                "mapping_id",
                "source_pointer",
                "shared_semantic_ref",
                "provenance",
                "wire_transform",
                "compatibility",
            },
            f"{where}.field_mappings[{index}]",
        )
        if not item["shared_semantic_ref"].startswith("semantic:"):
            raise ValidationError(f"{where}: shared target must remain a semantic ref")

    wrappers = payload["feed_wrapper_mappings"]
    wrapper_fields = _unique_field(wrappers, "source_field", f"{where}.feed_wrapper_mappings")
    if wrapper_fields != EXPECTED_WRAPPER_FIELDS:
        raise ValidationError(f"{where}: Feed wrapper mapping set mismatch")
    for index, item in enumerate(wrappers):
        _require_exact_keys(
            item,
            {"source_field", "shared_semantic_ref", "provenance", "rule"},
            f"{where}.feed_wrapper_mappings[{index}]",
        )
        if not item["shared_semantic_ref"].startswith("semantic:"):
            raise ValidationError(f"{where}: wrapper target must remain a semantic ref")

    exclusions = payload["delivery_exclusions"]
    excluded_fields = _unique_field(exclusions, "source_field", f"{where}.delivery_exclusions")
    if excluded_fields != EXPECTED_EXCLUDED_FIELDS:
        raise ValidationError(f"{where}: delivery exclusion set mismatch")

    event = payload["event_semantics"]
    if event.get("event_type") != "model.request.completed":
        raise ValidationError(f"{where}: wrong shared event type")
    if event.get("terminal_statuses") != ["settled", "cancelled"]:
        raise ValidationError(f"{where}: wrong terminal statuses")
    if event.get("parent_observed_at") != "absent":
        raise ValidationError(f"{where}: parent observed_at must be absent")

    gap = payload["gap_profile"]
    if gap.get("source_order") != [
        "call_log",
        "request_trace",
        "client_ip_presence",
        "upstream_error_presence",
    ]:
        raise ValidationError(f"{where}: wrong Source gap order")
    if gap.get("shared_order") != [
        "call_log",
        "client_ip_presence",
        "request_trace",
        "upstream_error_presence",
    ]:
        raise ValidationError(f"{where}: wrong shared gap order")
    if gap.get("reason_code") != "not_available_at_billing_terminal":
        raise ValidationError(f"{where}: wrong gap reason")


def validate_lifecycle_mapping(payload: dict[str, Any], where: str) -> None:
    mappings = payload["axis_mappings"]
    mapping_ids = _unique_field(mappings, "mapping_id", f"{where}.axis_mappings")
    if mapping_ids != EXPECTED_LIFECYCLE_MAPPING_IDS:
        raise ValidationError(
            f"{where}: lifecycle mapping mismatch "
            f"missing={sorted(EXPECTED_LIFECYCLE_MAPPING_IDS - mapping_ids)} "
            f"extra={sorted(mapping_ids - EXPECTED_LIFECYCLE_MAPPING_IDS)}"
        )
    axes = set()
    by_id = {}
    for index, item in enumerate(mappings):
        allowed = {
            "mapping_id",
            "local_fact",
            "shared_axis_semantic",
            "shared_state_semantic",
            "projection",
            "authority",
            "note",
        }
        if not set(item).issubset(allowed) or not (allowed - {"note"}).issubset(item):
            raise ValidationError(f"{where}.axis_mappings[{index}]: invalid mapping keys")
        axes.add(item["shared_axis_semantic"])
        by_id[item["mapping_id"]] = item
    if axes != {"configuration", "authentication", "transport", "processing", "checkpoint", "health"}:
        raise ValidationError(f"{where}: lifecycle axes do not match V3 orthogonal concerns")
    if by_id["runtime_health_unrepresented"]["shared_state_semantic"] != "no_direct_projection":
        raise ValidationError(f"{where}: runtime health must remain explicitly unmapped")
    if by_id["outbox_processed"]["projection"] != "requires_destination_evidence":
        raise ValidationError(f"{where}: Outbox row absence cannot prove convergence")
    _require_nonempty_strings(payload["combination_rules"], f"{where}.combination_rules")
    _require_nonempty_strings(payload["explicit_exclusions"], f"{where}.explicit_exclusions")


def validate_connector_identity_mapping(payload: dict[str, Any], where: str) -> None:
    expected_portable = {
        "connector_id": "foigent.unirouter.completed-execution",
        "connector_version": "1.0.0",
        "class": "integration",
        "direction": "source",
        "event_type": "model.request.completed",
        "event_identity_profile": "foigent.unirouter.model-request-completed-id.v1",
        "source_payload_schema": "unirouter.completed-execution.v1",
        "shared_payload_schema": "foigent://events/model/request-completed/v1",
        "transport": "https_pull",
        "capability": "xinsight.feed.read",
        "delivery": "at_least_once",
        "bootstrap": "activation_forward",
        "checkpoint": "opaque_cursor",
        "retention": "7d",
        "source_revision": "1",
        "payload_capture_mode": "metadata_only",
    }
    if payload["portable_connector_candidate"] != expected_portable:
        raise ValidationError(f"{where}: portable Connector candidate mismatch")

    local_mappings = payload["source_local_identity_mappings"]
    refs = _unique_field(
        local_mappings,
        "portable_semantic_ref",
        f"{where}.source_local_identity_mappings",
    )
    if len(refs) != 5 or any(not ref.startswith("semantic:") for ref in refs):
        raise ValidationError(f"{where}: Source-local identity mapping set mismatch")

    read_surface = payload["read_surface"]
    if read_surface.get("method") != "GET":
        raise ValidationError(f"{where}: wrong read method")
    if read_surface.get("route") != "/api/v1/integrations/xinsight/completed-executions":
        raise ValidationError(f"{where}: wrong read route")
    if read_surface.get("page_schema") != "xinsight.completed-execution-feed.v1":
        raise ValidationError(f"{where}: wrong page Schema")
    if read_surface.get("capability") != "xinsight.feed.read":
        raise ValidationError(f"{where}: wrong capability")

    routes = payload["product_local_control_routes"]
    actual_routes = set()
    for index, route in enumerate(routes):
        _require_exact_keys(
            route,
            {"method", "route", "operation"},
            f"{where}.product_local_control_routes[{index}]",
        )
        actual_routes.add((route["method"], route["route"]))
    if actual_routes != EXPECTED_CONTROL_ROUTES or len(routes) != len(EXPECTED_CONTROL_ROUTES):
        raise ValidationError(f"{where}: product-local control route set mismatch")

    exclusions = set(_require_nonempty_strings(payload["identity_exclusions"], f"{where}.identity_exclusions"))
    for required in {"raw credential or verifier", "page cursor or high-watermark", "payload hash"}:
        if required not in exclusions:
            raise ValidationError(f"{where}: missing identity exclusion {required}")


def validate_source_seeds(payload: dict[str, Any], where: str) -> None:
    seeds = payload["seeds"]
    seed_ids = _unique_field(seeds, "seed_id", f"{where}.seeds")
    if seed_ids != set(EXPECTED_SEEDS):
        raise ValidationError(f"{where}: Source seed ID set mismatch")
    for index, seed in enumerate(seeds):
        _require_exact_keys(seed, {"seed_id", "path", "sha256", "role"}, f"{where}.seeds[{index}]")
        expected_path, expected_sha = EXPECTED_SEEDS[seed["seed_id"]]
        if seed["path"] != expected_path or seed["sha256"] != expected_sha:
            raise ValidationError(f"{where}: wrong identity for seed {seed['seed_id']}")
        if not SHA256_PATTERN.fullmatch(seed["sha256"]):
            raise ValidationError(f"{where}: malformed SHA-256 for seed {seed['seed_id']}")

    precision = payload["source_type_precision"]
    if precision.get("token_counter_go_type") != "int":
        raise ValidationError(f"{where}: current token counter Go type must be recorded as int")
    if precision.get("token_counter_persistence_type") != "PostgreSQL INTEGER in usage_finalization_journal":
        raise ValidationError(f"{where}: current token persistence type mismatch")
    if precision.get("source_schema_upper_bound") != "not declared":
        raise ValidationError(f"{where}: Source Schema upper-bound evidence is overstated")
    if precision.get("shared_candidate_wire") != "canonical decimal string in 0..9223372036854775807":
        raise ValidationError(f"{where}: wrong V3 counter wire")

    requirements = payload["boundary_requirements"]
    requirement_ids = _unique_field(
        requirements,
        "requirement_id",
        f"{where}.boundary_requirements",
    )
    if requirement_ids != EXPECTED_BOUNDARY_IDS:
        raise ValidationError(f"{where}: boundary/negative requirement set mismatch")
    for index, requirement in enumerate(requirements):
        _require_exact_keys(
            requirement,
            {"requirement_id", "requirement", "reason"},
            f"{where}.boundary_requirements[{index}]",
        )
    _require_nonempty_strings(payload["runtime_nonclaims"], f"{where}.runtime_nonclaims")


VALIDATORS = {
    "unirouter.source-snapshot-to-model-request-completed": validate_source_snapshot_mapping,
    "unirouter.source-lifecycle-to-shared-axes": validate_lifecycle_mapping,
    "unirouter.connector-identity-to-source-local": validate_connector_identity_mapping,
    "unirouter.source-contract-seeds": validate_source_seeds,
}


def validate_artifact(payload: dict[str, Any], expected_kind: str, where: str = "artifact") -> None:
    validate_common(payload, expected_kind, where)
    VALIDATORS[expected_kind](payload, where)


def _run_git(source_repo: Path, *args: str, binary: bool = False) -> Any:
    command = ["git", "-C", str(source_repo), *args]
    result = subprocess.run(command, check=False, capture_output=True)
    if result.returncode != 0:
        error = result.stderr.decode("utf-8", errors="replace").strip()
        raise ValidationError(f"Git evidence command failed: {' '.join(args)}: {error}")
    if binary:
        return result.stdout
    return result.stdout.decode("utf-8").strip()


def verify_source_git(
    artifacts: dict[str, dict[str, Any]],
    source_repo: Path,
) -> dict[str, int | bool]:
    if not source_repo.is_dir():
        raise ValidationError(f"Source repository does not exist: {source_repo}")
    resolved_commit = _run_git(source_repo, "rev-parse", SOURCE_COMMIT)
    if resolved_commit != SOURCE_COMMIT:
        raise ValidationError("UniRouter commit identity mismatch")
    resolved_tree = _run_git(source_repo, "rev-parse", f"{SOURCE_COMMIT}^{{tree}}")
    if resolved_tree != SOURCE_TREE:
        raise ValidationError("UniRouter tree identity mismatch")

    seed_payload = artifacts["source-contract-seeds.v1.json"]
    verified_seeds = 0
    for seed in seed_payload["seeds"]:
        blob = _run_git(source_repo, "show", f"{SOURCE_COMMIT}:{seed['path']}", binary=True)
        actual = hashlib.sha256(blob).hexdigest()
        if actual != seed["sha256"]:
            raise ValidationError(
                f"Source seed SHA mismatch for {seed['path']}: "
                f"expected={seed['sha256']} actual={actual}"
            )
        verified_seeds += 1

    evidence_paths = {
        path
        for payload in artifacts.values()
        for path in payload["source_evidence"]
    }
    for path in sorted(evidence_paths):
        _run_git(source_repo, "cat-file", "-e", f"{SOURCE_COMMIT}:{path}")
    return {
        "source_commit_verified": True,
        "source_tree_verified": True,
        "source_seed_bytes_verified": verified_seeds,
        "source_evidence_paths_verified": len(evidence_paths),
    }


def verify_joint_candidate(path: Path) -> bool:
    try:
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
    except OSError as exc:
        raise ValidationError(f"Cannot read Joint Candidate V3: {exc}") from exc
    if digest != V3_SHA256:
        raise ValidationError(
            f"Joint Candidate V3 SHA mismatch expected={V3_SHA256} actual={digest}"
        )
    return True


def validate_directory(
    mapping_dir: Path,
    source_repo: Path | None = None,
    joint_candidate: Path | None = None,
) -> dict[str, Any]:
    artifacts: dict[str, dict[str, Any]] = {}
    actual_json_files = {path.name for path in mapping_dir.glob("*.json")}
    if actual_json_files != set(ARTIFACT_FILES):
        raise ValidationError(
            "Mapping artifact file set mismatch "
            f"missing={sorted(set(ARTIFACT_FILES) - actual_json_files)} "
            f"extra={sorted(actual_json_files - set(ARTIFACT_FILES))}"
        )
    for filename, expected_kind in ARTIFACT_FILES.items():
        path = mapping_dir / filename
        payload = load_json_strict(path)
        validate_artifact(payload, expected_kind, filename)
        artifacts[filename] = payload

    result: dict[str, Any] = {
        "status": "ok",
        "artifact_count": len(artifacts),
        "field_mapping_count": len(
            artifacts["source-snapshot-to-model-request-completed.v1.json"]["field_mappings"]
        ),
        "lifecycle_mapping_count": len(
            artifacts["source-lifecycle-to-shared-axes.v1.json"]["axis_mappings"]
        ),
        "source_identity_mapping_count": len(
            artifacts["connector-identity-to-source-local.v1.json"][
                "source_local_identity_mappings"
            ]
        ),
        "source_seed_count": len(artifacts["source-contract-seeds.v1.json"]["seeds"]),
        "source_git_verified": False,
        "joint_candidate_verified": False,
    }
    if source_repo is not None:
        result.update(verify_source_git(artifacts, source_repo))
        result["source_git_verified"] = True
    if joint_candidate is not None:
        result["joint_candidate_verified"] = verify_joint_candidate(joint_candidate)
    return result


def _default_mapping_dir() -> Path:
    return Path(__file__).resolve().parents[1] / "mappings" / "unirouter"


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate UniRouter Source-owned B9 mapping candidates."
    )
    parser.add_argument(
        "--mapping-dir",
        type=Path,
        default=_default_mapping_dir(),
        help="Directory containing the four UniRouter mapping JSON artifacts.",
    )
    parser.add_argument(
        "--source-repo",
        type=Path,
        help="Optional local UniRouter repository used only to verify pinned Git objects.",
    )
    parser.add_argument(
        "--joint-candidate",
        type=Path,
        help="Optional exact Joint Candidate V3 file used only for SHA-256 verification.",
    )
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    try:
        result = validate_directory(
            args.mapping_dir,
            source_repo=args.source_repo,
            joint_candidate=args.joint_candidate,
        )
    except ValidationError as exc:
        print(f"validation failed: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
