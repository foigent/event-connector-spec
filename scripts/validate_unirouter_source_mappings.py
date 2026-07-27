#!/usr/bin/env python3
"""Validate UniRouter Source-owned B9 exact B8 release-candidate mappings."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any, Iterable


FORMAT = "foigent.source-mapping-release-candidate.v1"
STATUS = "B9_EXACT_B8_RELEASE_CANDIDATE"
WORK_ITEM = "FV-FOIGENT-EVENT-CONNECTOR-PLATFORM-V1-20260726"
AUTHORITY_REPOSITORY = "https://github.com/foigent/event-connector-spec"
AUTHORITY_REPOSITORY_ID = 1313391565
B8_COMMIT = "404d1d753801fd32185eea8163d6a8f839c22a89"
B8_TREE = "9aa5fe3f0e830631dc355d51c654928f97bdbd88"
SOURCE_REPOSITORY = "https://github.com/foigent/unirouter.git"
SOURCE_COMMIT = "bf91ea63a16952bb2925afd5438233cac597dcc1"
SOURCE_TREE = "ddadc277fbede49fac0cbc1cc561203312432ac3"
V3_SHA256 = "f52c4a1f21232d3c209ff3de3e4e63da41d53e139e7ef13648db57fe4257311f"

SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")
SHA256_REF_PATTERN = re.compile(r"^sha256:[0-9a-f]{64}$")

B8_ARTIFACTS = {
    "protocol_text": (
        "spec/protocol-v1.md",
        "3a0aac41075fde6645c9d07d80416142e4b8de110a0ff429ad96c7df974ed88e",
    ),
    "event_envelope_schema": (
        "schemas/event-envelope.v1.schema.json",
        "6942e85d9b5d8b08ff9828b970c317596394184ef29908cbf2b8fc792187cf26",
    ),
    "model_request_completed_schema": (
        "schemas/model-request-completed.v1.schema.json",
        "ea0ea7354f3d9f435bb86a34eb28284e4297e5a2d1a3d22a23058c7dcc514dc6",
    ),
    "capture_gap_schema": (
        "schemas/capture-gap.v1.schema.json",
        "1a5be69da99f62033ceadf05f66d45296d1d5f8b662830f77c0fc6af49edaec8",
    ),
    "connector_lifecycle_schema": (
        "schemas/connector-lifecycle.v1.schema.json",
        "bd5c730587041ddc7ad6f66bca4deca35edf5f9b5b92b761ac53701f37e18d5e",
    ),
    "connector_manifest_schema": (
        "schemas/connector-manifest.v1.schema.json",
        "a6f43b37477002ab836a4d9ea7c4e462675cd4313f0637c0733cd98675fc0adf",
    ),
    "event_batch_schema": (
        "schemas/event-batch.v1.schema.json",
        "8e2133922bcb77cf032309290593665df1bf56cfa47e433dd573d0e42f36eef9",
    ),
    "connector_checkpoint_schema": (
        "schemas/connector-checkpoint.v1.schema.json",
        "8be2fd290d6db8d288a9b10ac6d9aa0b55a66ff21ea0fb55ac0af2d1b66bf800",
    ),
    "connector_error_schema": (
        "schemas/connector-error.v1.schema.json",
        "f449ba6314f1f730be5a0b188dc6d2cc2704e8f5d84a4eebecac576221e4ca56",
    ),
    "operational_receipt_schema": (
        "schemas/operational-receipt.v1.schema.json",
        "3c3b99e009e208456039d3bfe26d84af7e3f1af23589e7fa62a1e1a61e0fb3c6",
    ),
    "reference_connector_manifest": (
        "manifests/foigent.unirouter.completed-execution-1.0.0.json",
        "1d8b70dab02900e9d033ed0de9a5ce0c646d3556b80440a67354367eb83091f7",
    ),
    "source_seed_index": (
        "reference/unirouter/source-seeds.v1.json",
        "5d75d1b1ddf596ae1b3ab3c2690e652e9f6d1b2aef93755c7553552f71f39981",
    ),
    "cursor_expired_fixture": (
        "fixtures/source/unirouter/error-cursor-expired.json",
        "9f85ec830e0e61d0ac75656a980793d6d5c4020265d42ed192693659e1540437",
    ),
}

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
    "release_candidate_status",
    "work_item_id",
    "authority",
    "protocol_text_baseline",
    "source_baseline",
    "b8_authority",
    "source_evidence",
}

KIND_KEYS = {
    "unirouter.source-snapshot-to-model-request-completed": {
        "coverage",
        "event_semantics",
        "envelope_construction",
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
        "portable_connector",
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

REQUIRED_B8_PINS = {
    "unirouter.source-snapshot-to-model-request-completed": {
        "protocol_text",
        "event_envelope_schema",
        "model_request_completed_schema",
        "capture_gap_schema",
        "event_batch_schema",
        "connector_checkpoint_schema",
        "reference_connector_manifest",
        "source_seed_index",
    },
    "unirouter.source-lifecycle-to-shared-axes": {
        "protocol_text",
        "connector_lifecycle_schema",
        "connector_checkpoint_schema",
        "connector_error_schema",
        "operational_receipt_schema",
        "reference_connector_manifest",
        "cursor_expired_fixture",
    },
    "unirouter.connector-identity-to-source-local": {
        "protocol_text",
        "connector_manifest_schema",
        "reference_connector_manifest",
        "event_envelope_schema",
        "event_batch_schema",
        "connector_checkpoint_schema",
    },
    "unirouter.source-contract-seeds": {
        "protocol_text",
        "model_request_completed_schema",
        "reference_connector_manifest",
        "source_seed_index",
    },
}

LEGACY_MARKERS = (
    "semantic:",
    "foigent.source-mapping-candidate.v1",
    "B9_SOURCE_CANDIDATE_NOT_BINDING",
    '"semantic_refs_only"',
    '"shared_wire_paths_defined"',
    '"shared_schema_artifacts_created"',
    '"portable_connector_candidate"',
    '"shared_candidate_wire"',
    "B8 has not supplied",
    "B8 has not frozen",
)

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

EXPECTED_IDENTITY_MAPPING_IDS = {
    "producer_instance",
    "project_connection",
    "credential",
    "source_internal_terminal",
    "source_feed_sequence",
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
    """Raised when a release-candidate mapping fails closed."""


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


def load_json_bytes_strict(blob: bytes, where: str) -> dict[str, Any]:
    try:
        value = json.loads(blob.decode("utf-8"), object_pairs_hook=_reject_duplicate_pairs)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValidationError(f"{where}: invalid UTF-8 JSON: {exc}") from exc
    if not isinstance(value, dict):
        raise ValidationError(f"{where}: top-level JSON value must be an object")
    return value


def assert_no_legacy_text(text: str, where: str) -> None:
    for marker in LEGACY_MARKERS:
        if marker in text:
            raise ValidationError(f"{where}: legacy marker survives: {marker}")


def _require_exact_keys(value: dict[str, Any], expected: set[str], where: str) -> None:
    actual = set(value)
    if actual != expected:
        raise ValidationError(
            f"{where}: key mismatch missing={sorted(expected - actual)} "
            f"extra={sorted(actual - expected)}"
        )


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


def _run_git(repo: Path, *args: str, binary: bool = False) -> Any:
    result = subprocess.run(
        ["git", "-C", str(repo), *args],
        check=False,
        capture_output=True,
    )
    if result.returncode != 0:
        error = result.stderr.decode("utf-8", errors="replace").strip()
        raise ValidationError(f"Git evidence command failed: {' '.join(args)}: {error}")
    if binary:
        return result.stdout
    return result.stdout.decode("utf-8").strip()


def _resolve_pointer(document: Any, pointer: str, where: str) -> Any:
    if pointer == "":
        return document
    if not pointer.startswith("/"):
        raise ValidationError(f"{where}: invalid JSON pointer {pointer!r}")
    current = document
    for raw_token in pointer[1:].split("/"):
        token = raw_token.replace("~1", "/").replace("~0", "~")
        if isinstance(current, dict):
            if token not in current:
                raise ValidationError(f"{where}: unresolved JSON pointer {pointer!r}")
            current = current[token]
        elif isinstance(current, list):
            if not token.isdigit() or int(token) >= len(current):
                raise ValidationError(f"{where}: unresolved JSON pointer {pointer!r}")
            current = current[int(token)]
        else:
            raise ValidationError(f"{where}: unresolved JSON pointer {pointer!r}")
    return current


def _walk_dicts(value: Any) -> Iterable[dict[str, Any]]:
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from _walk_dicts(child)
    elif isinstance(value, list):
        for child in value:
            yield from _walk_dicts(child)


def validate_common(payload: dict[str, Any], expected_kind: str, where: str) -> None:
    _require_exact_keys(payload, COMMON_KEYS | KIND_KEYS[expected_kind], where)
    if payload["artifact_format"] != FORMAT:
        raise ValidationError(f"{where}: wrong artifact_format")
    if payload["artifact_kind"] != expected_kind:
        raise ValidationError(f"{where}: wrong artifact_kind")
    if payload["release_candidate_status"] != STATUS:
        raise ValidationError(f"{where}: wrong release_candidate_status")
    if payload["work_item_id"] != WORK_ITEM:
        raise ValidationError(f"{where}: wrong work_item_id")
    if payload["authority"] != {
        "repository": AUTHORITY_REPOSITORY,
        "repository_id": AUTHORITY_REPOSITORY_ID,
        "owner_role": "UniRouter Source Domain Owner",
    }:
        raise ValidationError(f"{where}: wrong authority identity")
    if payload["protocol_text_baseline"] != {
        "joint_candidate_v3_sha256": V3_SHA256,
        "disposition": "incorporated_by_exact_b8_authority_reference",
    }:
        raise ValidationError(f"{where}: wrong protocol text baseline")
    if payload["source_baseline"] != {
        "repository": SOURCE_REPOSITORY,
        "commit": SOURCE_COMMIT,
        "tree": SOURCE_TREE,
    }:
        raise ValidationError(f"{where}: wrong UniRouter source baseline")

    b8 = payload["b8_authority"]
    _require_exact_keys(
        b8,
        {"repository", "repository_id", "commit", "tree", "binding", "artifact_pins"},
        f"{where}.b8_authority",
    )
    if {key: b8[key] for key in ("repository", "repository_id", "commit", "tree", "binding")} != {
        "repository": AUTHORITY_REPOSITORY,
        "repository_id": AUTHORITY_REPOSITORY_ID,
        "commit": B8_COMMIT,
        "tree": B8_TREE,
        "binding": "exact_git_object_bytes",
    }:
        raise ValidationError(f"{where}: wrong exact B8 authority identity")
    pins = b8["artifact_pins"]
    if not isinstance(pins, dict) or set(pins) != REQUIRED_B8_PINS[expected_kind]:
        raise ValidationError(f"{where}: wrong relevant B8 artifact pin set")
    for key, pin in pins.items():
        if key not in B8_ARTIFACTS or not isinstance(pin, dict):
            raise ValidationError(f"{where}: unknown B8 artifact pin {key}")
        required = {"path", "sha256"}
        if not required.issubset(pin) or not set(pin).issubset(required | {"schema_id"}):
            raise ValidationError(f"{where}: malformed B8 artifact pin {key}")
        expected_path, expected_digest = B8_ARTIFACTS[key]
        if pin["path"] != expected_path or pin["sha256"] != f"sha256:{expected_digest}":
            raise ValidationError(f"{where}: wrong B8 artifact identity for {key}")
        if not SHA256_REF_PATTERN.fullmatch(pin["sha256"]):
            raise ValidationError(f"{where}: malformed B8 SHA-256 for {key}")

    evidence = _require_nonempty_strings(payload["source_evidence"], f"{where}.source_evidence")
    for path in evidence:
        candidate = Path(path)
        if candidate.is_absolute() or ".." in candidate.parts:
            raise ValidationError(f"{where}: Source evidence path must be repository-relative: {path}")
    assert_no_legacy_text(json.dumps(payload, ensure_ascii=False, sort_keys=True), where)


def validate_source_snapshot_mapping(payload: dict[str, Any], where: str) -> None:
    construction = payload["envelope_construction"]
    _require_exact_keys(
        construction,
        {"declared_fields", "identity_rule", "hash_rules", "provenance_profile"},
        f"{where}.envelope_construction",
    )
    declared_fields = construction["declared_fields"]
    declared_paths = _unique_field(
        declared_fields,
        "wire_json_path",
        f"{where}.envelope_construction.declared_fields",
    )
    if declared_paths != {
        "/spec_version",
        "/schema_ref",
        "/schema_version",
        "/producer/product",
        "/producer/connector_id",
        "/producer/connector_version",
        "/subject/type",
        "/actor/type",
        "/data_policy/payload_capture_mode",
        "/data_policy/raw_payload_present",
        "/provenance/adapter_fidelity",
    }:
        raise ValidationError(f"{where}: declared Envelope field set mismatch")
    for index, item in enumerate(declared_fields):
        _require_exact_keys(
            item,
            {"wire_json_path", "value", "provenance", "b8_artifact_bindings"},
            f"{where}.envelope_construction.declared_fields[{index}]",
        )
        if item["provenance"] != "declared" or not item["b8_artifact_bindings"]:
            raise ValidationError(f"{where}: declared Envelope field lacks exact binding")
    identity = construction["identity_rule"]
    if identity.get("tuple_json_paths") != [
        "/producer/product",
        "/producer/instance",
        "/scope/tenant_ref or absent",
        "/scope/org_ref",
        "/scope/project_ref",
        "/event_type",
        "/event_id",
    ]:
        raise ValidationError(f"{where}: scoped identity tuple changed")
    if identity.get("tenant_wire_rule") != (
        "The /scope/tenant_ref field is absent; its idempotency input is exactly four zero bytes."
    ):
        raise ValidationError(f"{where}: absent-tenant LP rule changed")
    if identity.get("component_encoding") != (
        "uint32 big-endian byte length followed by exact UTF-8 bytes"
    ):
        raise ValidationError(f"{where}: identity LP encoding changed")
    if identity.get("domain_prefix") != "ASCII foigent.event-idempotency.v1":
        raise ValidationError(f"{where}: idempotency domain changed")
    if identity.get("output") != "sha256:<lowercase SHA-256 hex>":
        raise ValidationError(f"{where}: idempotency output changed")
    hash_rules = construction["hash_rules"]
    if hash_rules.get("source_hash", {}).get("wire_json_path") != "/integrity/source_hash":
        raise ValidationError(f"{where}: Source hash destination changed")
    if hash_rules.get("envelope_hash", {}).get("wire_json_path") != "/integrity/envelope_hash":
        raise ValidationError(f"{where}: Envelope hash destination changed")
    if "envelope_hash absent" not in hash_rules["envelope_hash"].get("input", ""):
        raise ValidationError(f"{where}: Envelope hash input boundary missing")
    provenance = construction["provenance_profile"]
    if provenance.get("adapter_fidelity") != "F2":
        raise ValidationError(f"{where}: adapter fidelity changed")
    expected_groups = {
        "actor": "declared",
        "correlation": "direct",
        "data_policy": "declared",
        "identity": "direct",
        "payload.capture_gaps": "direct",
        "payload.money": "direct",
        "payload.terminal": "direct",
        "payload.timeline_complete": "direct",
        "payload.usage": "direct",
        "scope": "direct",
        "subject": "derived",
        "time.occurred_at": "derived",
        "time.terminal_at": "direct",
    }
    if provenance.get("field_groups") != expected_groups:
        raise ValidationError(f"{where}: provenance profile changed")

    mappings = payload["field_mappings"]
    if _unique_field(mappings, "source_pointer", f"{where}.field_mappings") != EXPECTED_SOURCE_POINTERS:
        raise ValidationError(f"{where}: Source pointer set mismatch")
    if len(mappings) != 28:
        raise ValidationError(f"{where}: unexpected field mapping count")
    for index, item in enumerate(mappings):
        _require_exact_keys(
            item,
            {
                "mapping_id",
                "source_pointer",
                "target_classification",
                "shared_json_paths",
                "b8_artifact_bindings",
                "provenance",
                "wire_transform",
                "compatibility",
            },
            f"{where}.field_mappings[{index}]",
        )
        if item["target_classification"].startswith("shared_"):
            _require_nonempty_strings(item["shared_json_paths"], f"{where}.field_mappings[{index}]")
            if not item["b8_artifact_bindings"]:
                raise ValidationError(f"{where}: shared field lacks exact B8 binding")
        elif item["shared_json_paths"]:
            raise ValidationError(f"{where}: non-wire field claims a shared JSON path")

    wrappers = payload["feed_wrapper_mappings"]
    if _unique_field(wrappers, "source_field", f"{where}.feed_wrapper_mappings") != EXPECTED_WRAPPER_FIELDS:
        raise ValidationError(f"{where}: Feed wrapper mapping set mismatch")
    for index, item in enumerate(wrappers):
        _require_exact_keys(
            item,
            {
                "source_field",
                "target_classification",
                "shared_json_paths",
                "b8_artifact_bindings",
                "provenance",
                "rule",
            },
            f"{where}.feed_wrapper_mappings[{index}]",
        )
        if item["target_classification"].startswith("shared_"):
            _require_nonempty_strings(item["shared_json_paths"], f"{where}.feed_wrapper_mappings[{index}]")
        elif item["shared_json_paths"]:
            raise ValidationError(f"{where}: non-wire wrapper claims a shared JSON path")

    exclusions = payload["delivery_exclusions"]
    if _unique_field(exclusions, "source_field", f"{where}.delivery_exclusions") != EXPECTED_EXCLUDED_FIELDS:
        raise ValidationError(f"{where}: delivery exclusion set mismatch")
    event = payload["event_semantics"]
    if event.get("event_type") != "model.request.completed":
        raise ValidationError(f"{where}: wrong event type")
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
    if _unique_field(mappings, "mapping_id", f"{where}.axis_mappings") != EXPECTED_LIFECYCLE_MAPPING_IDS:
        raise ValidationError(f"{where}: lifecycle mapping set mismatch")
    by_id = {item["mapping_id"]: item for item in mappings}
    for index, item in enumerate(mappings):
        allowed = {
            "mapping_id",
            "local_fact",
            "target_classification",
            "shared_bindings",
            "projection",
            "authority",
            "note",
        }
        if not set(item).issubset(allowed) or not (allowed - {"note"}).issubset(item):
            raise ValidationError(f"{where}.axis_mappings[{index}]: invalid mapping keys")
        if item["target_classification"].startswith("product_local") and item["shared_bindings"]:
            raise ValidationError(f"{where}: product-local lifecycle fact claims a shared binding")
    if by_id["runtime_health_unrepresented"]["projection"] != "explicitly_unmapped":
        raise ValidationError(f"{where}: runtime health must remain explicitly unmapped")
    if any("value" in binding for binding in by_id["runtime_health_unrepresented"]["shared_bindings"]):
        raise ValidationError(f"{where}: unmapped runtime health claims a fixed value")
    if by_id["outbox_processed"]["projection"] != "requires_destination_evidence":
        raise ValidationError(f"{where}: Outbox row absence cannot prove convergence")
    if by_id["receiver_acknowledged_sequence"]["shared_bindings"]:
        raise ValidationError(f"{where}: Source acknowledgement cannot become shared Checkpoint")
    _require_nonempty_strings(payload["combination_rules"], f"{where}.combination_rules")
    exclusions = _require_nonempty_strings(payload["explicit_exclusions"], f"{where}.explicit_exclusions")
    if "UniRouter Outbox and Feed materialization states as Connector /processing values" not in exclusions:
        raise ValidationError(f"{where}: missing processing-axis exclusion")


def validate_connector_identity_mapping(payload: dict[str, Any], where: str) -> None:
    portable = payload["portable_connector"]
    _require_exact_keys(portable, {"manifest_artifact_key", "fields"}, f"{where}.portable_connector")
    if portable["manifest_artifact_key"] != "reference_connector_manifest":
        raise ValidationError(f"{where}: wrong portable Connector Manifest")
    fields = portable["fields"]
    paths = _unique_field(fields, "json_path", f"{where}.portable_connector.fields")
    required_paths = {
        "/connector_id",
        "/connector_version",
        "/connector_class",
        "/direction",
        "/source_product",
        "/event_identity_profile",
        "/supported_source_schemas/0/schema_id",
        "/supported_source_schemas/0/sha256",
        "/emitted_event_schemas/0/event_type",
        "/emitted_event_schemas/0/schema_ref",
        "/emitted_event_schemas/0/schema_version",
        "/transport/mode",
        "/delivery/guarantee",
        "/bootstrap/mode",
        "/checkpoint/strategy",
        "/compatibility/retention",
        "/compatibility/source_revision",
        "/payload_policy/payload_capture_mode",
        "/required_capabilities/0",
    }
    if paths != required_paths:
        raise ValidationError(f"{where}: portable Connector field set mismatch")

    mappings = payload["source_local_identity_mappings"]
    if _unique_field(mappings, "mapping_id", f"{where}.source_local_identity_mappings") != EXPECTED_IDENTITY_MAPPING_IDS:
        raise ValidationError(f"{where}: Source-local identity mapping set mismatch")
    by_id = {item["mapping_id"]: item for item in mappings}
    for index, item in enumerate(mappings):
        _require_exact_keys(
            item,
            {
                "mapping_id",
                "source_local_identity",
                "target_classification",
                "b8_bindings",
                "exact_rule",
                "binding",
                "not_equal_to",
            },
            f"{where}.source_local_identity_mappings[{index}]",
        )
        if item["target_classification"].startswith("product_local") and item["b8_bindings"]:
            raise ValidationError(f"{where}: product-local identity claims a shared binding")
    if not by_id["producer_instance"]["b8_bindings"]:
        raise ValidationError(f"{where}: producer instance lacks exact B8 binding")

    read_surface = payload["read_surface"]
    if (
        read_surface.get("method"),
        read_surface.get("route"),
        read_surface.get("page_schema"),
        read_surface.get("capability"),
    ) != (
        "GET",
        "/api/v1/integrations/xinsight/completed-executions",
        "xinsight.completed-execution-feed.v1",
        "xinsight.feed.read",
    ):
        raise ValidationError(f"{where}: current read surface changed")
    routes = payload["product_local_control_routes"]
    actual_routes = {(route.get("method"), route.get("route")) for route in routes}
    if actual_routes != EXPECTED_CONTROL_ROUTES or len(routes) != len(EXPECTED_CONTROL_ROUTES):
        raise ValidationError(f"{where}: product-local control route set mismatch")
    exclusions = set(_require_nonempty_strings(payload["identity_exclusions"], f"{where}.identity_exclusions"))
    for required in {"raw credential or verifier", "page cursor or high-watermark", "payload hash"}:
        if required not in exclusions:
            raise ValidationError(f"{where}: missing identity exclusion {required}")


def validate_source_seeds(payload: dict[str, Any], where: str) -> None:
    seeds = payload["seeds"]
    if _unique_field(seeds, "seed_id", f"{where}.seeds") != set(EXPECTED_SEEDS):
        raise ValidationError(f"{where}: Source seed ID set mismatch")
    for index, seed in enumerate(seeds):
        _require_exact_keys(
            seed,
            {"seed_id", "path", "sha256", "b8_index_bindings", "role"},
            f"{where}.seeds[{index}]",
        )
        expected_path, expected_sha = EXPECTED_SEEDS[seed["seed_id"]]
        if seed["path"] != expected_path or seed["sha256"] != expected_sha:
            raise ValidationError(f"{where}: wrong identity for seed {seed['seed_id']}")
        if not SHA256_PATTERN.fullmatch(seed["sha256"]):
            raise ValidationError(f"{where}: malformed Source SHA-256")
    precision = payload["source_type_precision"]
    if precision.get("token_counter_go_type") != "int":
        raise ValidationError(f"{where}: current token counter Go type changed")
    if precision.get("token_counter_persistence_type") != "PostgreSQL INTEGER in usage_finalization_journal":
        raise ValidationError(f"{where}: current token persistence type changed")
    if precision.get("source_schema_upper_bound") != "not declared":
        raise ValidationError(f"{where}: Source Schema upper-bound evidence overstated")
    if precision.get("shared_wire") != "canonical decimal string in 0..9223372036854775807":
        raise ValidationError(f"{where}: wrong exact B8 counter wire")
    if precision.get("shared_schema_binding") != {
        "artifact_key": "model_request_completed_schema",
        "json_path": "/$defs/int64Decimal",
    }:
        raise ValidationError(f"{where}: wrong exact counter Schema binding")
    if _unique_field(
        payload["boundary_requirements"],
        "requirement_id",
        f"{where}.boundary_requirements",
    ) != EXPECTED_BOUNDARY_IDS:
        raise ValidationError(f"{where}: boundary requirement set mismatch")
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


def verify_source_git(
    artifacts: dict[str, dict[str, Any]],
    source_repo: Path,
) -> dict[str, int | bool]:
    if _run_git(source_repo, "rev-parse", SOURCE_COMMIT) != SOURCE_COMMIT:
        raise ValidationError("UniRouter commit identity mismatch")
    if _run_git(source_repo, "rev-parse", f"{SOURCE_COMMIT}^{{tree}}") != SOURCE_TREE:
        raise ValidationError("UniRouter tree identity mismatch")
    seeds = artifacts["source-contract-seeds.v1.json"]["seeds"]
    for seed in seeds:
        blob = _run_git(source_repo, "show", f"{SOURCE_COMMIT}:{seed['path']}", binary=True)
        if hashlib.sha256(blob).hexdigest() != seed["sha256"]:
            raise ValidationError(f"Source seed SHA mismatch for {seed['path']}")
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
        "source_seed_bytes_verified": len(seeds),
        "source_evidence_paths_verified": len(evidence_paths),
    }


def _verify_manifest_value(document: dict[str, Any], item: dict[str, Any], where: str) -> None:
    actual = _resolve_pointer(document, item["json_path"], where)
    if actual != item["value"]:
        raise ValidationError(
            f"{where}: exact Manifest value mismatch at {item['json_path']}: "
            f"expected={item['value']!r} actual={actual!r}"
        )


def _verify_schema_values(schema_node: Any, item: dict[str, Any], where: str) -> None:
    if not isinstance(schema_node, dict):
        raise ValidationError(f"{where}: Schema binding does not resolve to an object")
    values: list[Any] = []
    if "value" in item:
        values.append(item["value"])
    if "values" in item:
        if not isinstance(item["values"], list) or not item["values"]:
            raise ValidationError(f"{where}: values must be a nonempty list")
        values.extend(item["values"])
    for value in values:
        if "const" in schema_node and value != schema_node["const"]:
            raise ValidationError(f"{where}: value {value!r} violates Schema const")
        if "enum" in schema_node and value not in schema_node["enum"]:
            raise ValidationError(f"{where}: value {value!r} violates Schema enum")
        if isinstance(value, str):
            pattern = schema_node.get("pattern")
            if isinstance(pattern, str) and re.fullmatch(pattern, value) is None:
                raise ValidationError(f"{where}: value {value!r} violates Schema pattern")
            maximum = schema_node.get("maxLength")
            if isinstance(maximum, int) and len(value) > maximum:
                raise ValidationError(f"{where}: value {value!r} violates Schema maxLength")


def verify_b8_git(
    artifacts: dict[str, dict[str, Any]],
    b8_repo: Path,
) -> dict[str, int | bool]:
    if _run_git(b8_repo, "rev-parse", B8_COMMIT) != B8_COMMIT:
        raise ValidationError("B8 commit identity mismatch")
    if _run_git(b8_repo, "rev-parse", f"{B8_COMMIT}^{{tree}}") != B8_TREE:
        raise ValidationError("B8 tree identity mismatch")

    declared_keys = {
        key
        for payload in artifacts.values()
        for key in payload["b8_authority"]["artifact_pins"]
    }
    documents: dict[str, dict[str, Any]] = {}
    for key in sorted(declared_keys):
        path, expected_digest = B8_ARTIFACTS[key]
        blob = _run_git(b8_repo, "show", f"{B8_COMMIT}:{path}", binary=True)
        if hashlib.sha256(blob).hexdigest() != expected_digest:
            raise ValidationError(f"B8 artifact SHA mismatch for {path}")
        if path.endswith(".json"):
            documents[key] = load_json_bytes_strict(blob, f"{B8_COMMIT}:{path}")

    binding_count = 0
    for filename, payload in artifacts.items():
        local_pins = payload["b8_authority"]["artifact_pins"]
        for item in _walk_dicts(payload):
            key = item.get("artifact_key")
            if not isinstance(key, str):
                continue
            if key not in local_pins:
                raise ValidationError(f"{filename}: binding uses unpinned B8 artifact {key}")
            for pointer_key in ("json_path", "schema_json_path"):
                pointer = item.get(pointer_key)
                if pointer is None:
                    continue
                if key not in documents:
                    raise ValidationError(f"{filename}: JSON pointer targets non-JSON artifact {key}")
                resolved = _resolve_pointer(documents[key], pointer, f"{filename}:{key}")
                if pointer_key == "json_path" and "value" in item:
                    if resolved != item["value"]:
                        raise ValidationError(
                            f"{filename}:{key}: exact value mismatch at {pointer}"
                        )
                if pointer_key == "schema_json_path":
                    _verify_schema_values(resolved, item, f"{filename}:{key}:{pointer}")
                binding_count += 1

    identity = artifacts["connector-identity-to-source-local.v1.json"]
    manifest = documents["reference_connector_manifest"]
    for item in identity["portable_connector"]["fields"]:
        _verify_manifest_value(manifest, item, "portable_connector")
        binding_count += 1
    for item in identity["read_surface"]["b8_manifest_bindings"]:
        _verify_manifest_value(manifest, item, "read_surface")
        binding_count += 1

    seeds = artifacts["source-contract-seeds.v1.json"]["seeds"]
    for seed in seeds:
        expected_path = seed["path"]
        expected_sha = f"sha256:{seed['sha256']}"
        index_values = [
            _resolve_pointer(
                documents[binding["artifact_key"]],
                binding["json_path"],
                f"seed:{seed['seed_id']}",
            )
            for binding in seed["b8_index_bindings"]
        ]
        if expected_path not in index_values or expected_sha not in index_values:
            raise ValidationError(f"seed:{seed['seed_id']}: B8 index does not pin exact path and SHA")

    return {
        "b8_commit_verified": True,
        "b8_tree_verified": True,
        "b8_artifact_bytes_verified": len(declared_keys),
        "b8_json_path_bindings_verified": binding_count,
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
    b8_repo: Path | None = None,
    joint_candidate: Path | None = None,
) -> dict[str, Any]:
    actual_files = {path.name for path in mapping_dir.glob("*.json")}
    if actual_files != set(ARTIFACT_FILES):
        raise ValidationError(
            "Mapping artifact file set mismatch "
            f"missing={sorted(set(ARTIFACT_FILES) - actual_files)} "
            f"extra={sorted(actual_files - set(ARTIFACT_FILES))}"
        )
    artifacts: dict[str, dict[str, Any]] = {}
    for filename, expected_kind in ARTIFACT_FILES.items():
        payload = load_json_strict(mapping_dir / filename)
        validate_artifact(payload, expected_kind, filename)
        artifacts[filename] = payload
    readme = mapping_dir / "README.md"
    try:
        assert_no_legacy_text(readme.read_text(encoding="utf-8"), str(readme))
    except OSError as exc:
        raise ValidationError(f"Cannot read mapping README: {exc}") from exc

    result: dict[str, Any] = {
        "status": "ok",
        "release_candidate_status": STATUS,
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
        "b8_git_verified": False,
        "joint_candidate_verified": False,
    }
    if source_repo is not None:
        result.update(verify_source_git(artifacts, source_repo))
        result["source_git_verified"] = True
    if b8_repo is not None:
        result.update(verify_b8_git(artifacts, b8_repo))
        result["b8_git_verified"] = True
    if joint_candidate is not None:
        result["joint_candidate_verified"] = verify_joint_candidate(joint_candidate)
    return result


def _default_mapping_dir() -> Path:
    return Path(__file__).resolve().parents[1] / "mappings" / "unirouter"


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate UniRouter Source B9 exact B8 release-candidate mappings."
    )
    parser.add_argument("--mapping-dir", type=Path, default=_default_mapping_dir())
    parser.add_argument(
        "--source-repo",
        type=Path,
        help="Optional UniRouter repository; reads only exact pinned Git objects.",
    )
    parser.add_argument(
        "--b8-repo",
        type=Path,
        help="Optional authority repository; reads only exact pinned B8 Git objects.",
    )
    parser.add_argument(
        "--joint-candidate",
        type=Path,
        help="Optional Joint Candidate V3 file for historical text-baseline digest verification.",
    )
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    try:
        result = validate_directory(
            args.mapping_dir,
            source_repo=args.source_repo,
            b8_repo=args.b8_repo,
            joint_candidate=args.joint_candidate,
        )
    except ValidationError as exc:
        print(f"validation failed: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
