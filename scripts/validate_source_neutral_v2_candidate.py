#!/usr/bin/env python3

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
PREDECESSOR_COMMIT = "fd82aeca9877bea8064b25c365a3cdcdd0bb3d16"
PREDECESSOR_TREE = "d316d6ada678066ed7679a772856aea6157d869d"
PREDECESSOR_CONTENT_DIGEST = (
    "sha256:da5b1bf863aa467a64771b5236bb916b96c73c4043ed347c44eafb03d8682813"
)
PREDECESSOR_RELEASE_DIGEST = (
    "sha256:0b414d5d59e5a7ca5c05505cb58d7992c544537da1c84a57256ec205618d9cd1"
)
XINSIGHT_ORIGIN_MAIN_COMMIT = "e6c1bd3e3d6e6433b5e5717dedd50488dcf521ee"
XINSIGHT_ORIGIN_MAIN_TREE = "1da84e19b81d52697acedc01f60446782e058023"
XINSIGHT_CANDIDATE_COMMIT = "d1ae3fe76057c9ff37f2fb7e870f2190c47b3745"
XINSIGHT_CANDIDATE_TREE = "79cabc9f4c7b5b425e3fc09590af5bd07af87047"
V1_XINSIGHT_SEED_SHA = (
    "sha256:5cd40aa6c0256a70ad7317c05e078759685e0469be77a3e960a976adc3158e8e"
)
V1_UNIROUTER_MATRIX_SHA = (
    "sha256:03fb035134b173165e6a03f348d40a58fe1d28d82c24bacb1dec553c8b769c89"
)
V1_LITELLM_MATRIX_SHA = (
    "sha256:3b0a2c5e3bfa89dc060299fa0b4351edcd33d92b2702cf95c99b1f26b51dd4ec"
)
SOURCE_SCHEMA_SHA = (
    "sha256:b5f4da5b586ca4d34af716d52215955c843e5b824f7af7fdbc9a1dfda728b29a"
)
OPENINFERENCE_SOURCE_SHA = (
    "sha256:533e33c2e02a6a67632107ae99f3993eee1a1da39835029521a4c3fe0ceb4708"
)
OPENINFERENCE_IDEMPOTENCY = (
    "sha256:7e955832524e293df668d87d39c5a17303916c25b2e8ff87b5fbf4ca8bac851b"
)
OPENINFERENCE_ENVELOPE_HASH = (
    "sha256:02dc4475ff08b58ded11359de849f23c0b1d2dd378d376adfe6c2f09e7ea6819"
)
EXPECTED_V1_M0 = [
    (
        "4805a534-a614-5d51-a116-1537e5ba48ba",
        "sha256:0318866b5d0ecdb6ac9f7fdd0e695f447bcdb9b1ed3dd57c225a1950a76f645a",
    ),
    (
        "faa85223-b1c8-5fc8-be7f-5a5efef2fcb6",
        "sha256:64e14030ebe55b5c877230b2618ed47e80dc5a2494fd777ed312d6aea27a4c65",
    ),
    (
        "ae69fd56-ee75-5bab-b5b3-f094239d4d4b",
        "sha256:d8ee3f703ebbd49e152eb14f36e253d050bdcbbab2eb64de9625dcdc13b318f3",
    ),
    (
        "16b110d9-4240-51b3-8b59-6ebc2c4e692f",
        "sha256:ab5ff4c276c1d982e6037dbb9ad4343144481ef28bbbcba82b285be355e0f993",
    ),
    (
        "2f86fbc5-ac47-5358-9834-ca52f4d91ed9",
        "sha256:584c92345473b37f972f745c2e8fe7f6ff2516ebebaefa56b22e2df3a0626ef4",
    ),
    (
        "b1bf7b19-a0d1-50cb-aa7f-3fe0b5d087a4",
        "sha256:5fbf54535f992d35f157f884c4b997f905b6f4351e54919927d1b087458c4230",
    ),
    (
        "b65ee756-50ec-541e-a264-722226432e3f",
        "sha256:e4c8e0b7482f7c1dcc61fe3716eefd31d9258de966db333ab67170b68f6af29f",
    ),
    (
        "cd0fc10f-d55d-55b5-aff3-aff2113f574f",
        "sha256:7e296d27a29310196b1dfa9b221621d91a13d60d04e5cd1e74492cd55220cd33",
    ),
    (
        "f10aa91b-ea77-5898-85eb-89c070e3a3a5",
        "sha256:65661cda523749491642a1d12b7e1238ec0ba2f43619e8cff8cf530daa81189a",
    ),
    (
        "f0594e43-4332-5ff0-8e2f-3ef1c1b54ee4",
        "sha256:c7fbc46f495bc7e0ed671c2efd9fe3f3b00aee153f3d9ad078092f38a685a994",
    ),
]
EXPECTED_V1_GAP_ROWS = [
    "74e50795-3003-5efc-8a98-dd19d8bc5899",
    "3bc0c29f-8cca-50e8-8a09-1c718758b9d9",
    "61262359-2e96-5f02-80c6-c220ed8f4b87",
    "bdb22b2b-c200-5fb3-81e4-ca00b418f527",
    "e5a2a60f-f512-576d-85dd-2d1936fc508f",
    "db524c57-e83b-545d-8f28-a081e27ebb84",
    "d3628041-c661-5d09-8bee-7a192acd908b",
    "3abba0ce-cca9-59c8-80b0-e1f977c59bf0",
]
EXPECTED_V1_PROVENANCE = [
    "bf802b1c-df9c-54a3-82e6-03b691e79afa",
    "bd6d6519-88d2-578e-8aff-1c66932cd4e2",
]
EXPECTED_OPENINFERENCE_M0 = [
    (
        "c70b878d-21a0-57fa-90c7-92c989907e37",
        "sha256:dba2c158b78533ab174ece5bae4b7298968b3e9fa2d398d3ab6a2af134193a46",
    ),
    (
        "3b54f6a2-f303-55d7-8a5c-8808a9a61ed3",
        "sha256:62e94aba0f167b21deaa8d87def230a0df7b938b81ebcb398e20a757e5a8cfba",
    ),
    (
        "d295a54e-bd67-572f-aadf-7b7ae3e2abba",
        "sha256:4e3f1e8964aa1119450af0c7842fc724be836efcadadf9258f6349d9df164116",
    ),
    (
        "daa55d31-a996-53c9-8454-6851cf246cb1",
        "sha256:a164079825e5ae1d5a70ef0b543f2766ddbd5c8069ac4d4bc4375b5b6cecafc0",
    ),
    (
        "264babaf-3080-5fea-b391-d1c22cd50c33",
        "sha256:00eac75af3083ddcad31c1d0f4abd217dd8d4bcf614dafd4d6174e61f958cd67",
    ),
]


class ValidationError(RuntimeError):
    pass


def sha256(path: Path) -> str:
    return "sha256:" + hashlib.sha256(path.read_bytes()).hexdigest()


def load_json_strict(path: Path) -> Any:
    def pairs(values: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in values:
            if key in result:
                raise ValidationError(f"{path}: duplicate JSON key {key!r}")
            result[key] = value
        return result

    try:
        return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=pairs)
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        raise ValidationError(f"{path}: invalid UTF-8 JSON: {error}") from error


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValidationError(message)


def verify_predecessor_release() -> int:
    release_path = ROOT / "releases/v1.1.2/release-manifest.json"
    release = load_json_strict(release_path)
    require(release["protocol_version"] == "1.1.2", "wrong predecessor version")
    require(
        release["content_digest"] == PREDECESSOR_CONTENT_DIGEST,
        "wrong predecessor content digest",
    )
    require(
        release["release_digest"] == PREDECESSOR_RELEASE_DIGEST,
        "wrong predecessor release digest",
    )
    for component in release["components"].values():
        path = ROOT / component["path"]
        require(path.is_file(), f"predecessor component absent: {component['path']}")
        require(
            sha256(path) == component["sha256"],
            f"predecessor component changed: {component['path']}",
        )
    return len(release["components"])


def verify_v1_xinsight_seed() -> None:
    seed_path = ROOT / "mappings/xinsight/completed-execution-compatibility-seed-v1.json"
    require(sha256(seed_path) == V1_XINSIGHT_SEED_SHA, "v1 X-Insight seed changed")
    seed = load_json_strict(seed_path)
    totals = seed["compatibility_totals"]
    require(
        totals
        == {
            "m0_events": 10,
            "m0_terminal_events": 2,
            "m0_gap_events": 8,
            "first_class_gap_rows": 8,
            "import_provenance_records": 2,
            "events_linked_to_import_provenance": 10,
        },
        "v1 compatibility totals changed",
    )
    m0_pairs = [
        (event["id"], event["event_hash"])
        for case in seed["seeds"]
        for event in case["m0_events"]
    ]
    gap_rows = [
        gap["id"] for case in seed["seeds"] for gap in case["gap_rows"]
    ]
    provenance = [case["import_provenance"]["id"] for case in seed["seeds"]]
    require(m0_pairs == EXPECTED_V1_M0, "v1 M0 ids or hashes changed")
    require(gap_rows == EXPECTED_V1_GAP_ROWS, "v1 Gap row identities changed")
    require(
        provenance == EXPECTED_V1_PROVENANCE,
        "v1 provenance identities changed",
    )
    read_models = [case["read_model"] for case in seed["seeds"]]
    require(
        [(entry["outcome"], entry["event_count"], entry["gap_count"]) for entry in read_models]
        == [("success", 5, 4), ("failure", 5, 4)],
        "v1 read-model expectations changed",
    )
    require(
        sha256(
            ROOT
            / "compatibility/foigent-unirouter-completed-execution-1.0.0-to-xinsight-m0.1.json"
        )
        == V1_UNIROUTER_MATRIX_SHA,
        "v1 UniRouter compatibility matrix changed",
    )
    require(
        sha256(
            ROOT
            / "compatibility/foigent-litellm-spend-logs-1.0.0-to-xinsight-m0.1.json"
        )
        == V1_LITELLM_MATRIX_SHA,
        "v1 LiteLLM compatibility matrix changed",
    )


def verify_openinference_compatibility(matrix: dict[str, Any]) -> None:
    require(
        matrix["status"] == "candidate_product_migration_required",
        "OpenInference matrix must remain migration-gated",
    )
    shared = matrix["shared_event"]
    require(shared["source_hash"] == OPENINFERENCE_SOURCE_SHA, "Source hash changed")
    require(
        shared["idempotency_key"] == OPENINFERENCE_IDEMPOTENCY,
        "shared idempotency changed",
    )
    require(
        shared["envelope_hash"] == OPENINFERENCE_ENVELOPE_HASH,
        "Envelope hash changed",
    )
    require(shared["parent_observed_at"] == "absent", "observed_at boundary changed")
    require(
        shared["occurred_at"] == shared["terminal_at"],
        "occurred_at must remain the terminal_at alias",
    )
    seed = matrix["current_m0_compatibility_seed"]
    observed = [(seed["main_event"]["id"], seed["main_event"]["event_hash"])]
    observed.extend((item["id"], item["event_hash"]) for item in seed["gap_events"])
    require(observed == EXPECTED_OPENINFERENCE_M0, "OpenInference M0 ids or hashes changed")
    require(seed["event_count"] == 5, "OpenInference M0 event count changed")
    require(seed["gap_event_count"] == 4, "OpenInference Gap count changed")
    require(
        seed["read_model_expectations"]
        == {
            "trace_id": "0123456789abcdef0123456789abcdef",
            "span_id": "0123456789abcdef",
            "session_id": "session-source-01",
            "model": "model-a",
            "provider": "provider-a",
            "prompt_tokens": 7,
            "completion_tokens": 4,
            "total_tokens": 11,
        },
        "OpenInference read-model expectations changed",
    )
    gate = matrix["product_migration_gate"]
    require(gate["status"] == "fail_closed", "product migration gate opened")
    require(
        gate["required_state"]["checkpoint"] == "not_applicable",
        "bounded-offline Checkpoint boundary changed",
    )
    preserved = matrix["v1_reference_connector_preservation"]
    require(
        preserved["compatibility_seed"]["sha256"] == V1_XINSIGHT_SEED_SHA,
        "matrix does not pin the v1 X-Insight seed",
    )
    require(
        preserved["unirouter_matrix"]["sha256"] == V1_UNIROUTER_MATRIX_SHA,
        "matrix does not pin the UniRouter compatibility matrix",
    )
    require(
        preserved["litellm_matrix"]["sha256"] == V1_LITELLM_MATRIX_SHA,
        "matrix does not pin the LiteLLM compatibility matrix",
    )


def verify_reports() -> tuple[int, int]:
    go = load_json_strict(ROOT / "conformance/reports/go-source-neutral-v2.json")
    typescript = load_json_strict(
        ROOT / "conformance/reports/typescript-source-neutral-v2.json"
    )
    for implementation, report in [("go", go), ("typescript", typescript)]:
        require(report["implementation"] == implementation, "wrong report implementation")
        require(report["status"] == "pass", f"{implementation} report did not pass")
        require(len(report["cases"]) == 39, f"{implementation} case count changed")
    go_comparable = {key: value for key, value in go.items() if key not in {
        "implementation", "implementation_version"
    }}
    ts_comparable = {
        key: value
        for key, value in typescript.items()
        if key not in {"implementation", "implementation_version"}
    }
    require(go_comparable == ts_comparable, "cross-language report bytes differ")
    classes = sorted(
        {
            class_name
            for case in go["cases"]
            for class_name in case["case_classes"]
        }
    )
    require(len(classes) == 23, "source-neutral case-class coverage changed")
    return len(go["cases"]), len(classes)


def validate() -> dict[str, Any]:
    predecessor_components = verify_predecessor_release()
    verify_v1_xinsight_seed()
    decision = (ROOT / "docs/decisions/0002-source-neutral-transport-completeness-v2-candidate.md").read_text(
        encoding="utf-8"
    )
    spec = (ROOT / "spec/protocol-v2-candidate.md").read_text(encoding="utf-8")
    require("NOT_BINDING" in decision, "decision lost non-binding status")
    require("NOT_BINDING" in spec, "protocol candidate lost non-binding status")
    require(
        not (ROOT / "releases/v2.0.0/release-manifest.json").exists(),
        "a Binding v2 release manifest is not authorized",
    )
    matrix_path = (
        ROOT
        / "compatibility/foigent-openinference-bounded-export-1.0.0-to-xinsight-m0.1.json"
    )
    matrix = load_json_strict(matrix_path)
    verify_openinference_compatibility(matrix)
    consumer = matrix["consumer_baseline"]
    require(
        consumer["reviewed_origin_main_commit"] == XINSIGHT_ORIGIN_MAIN_COMMIT
        and consumer["reviewed_origin_main_tree"] == XINSIGHT_ORIGIN_MAIN_TREE,
        "reviewed X-Insight origin/main identity changed",
    )
    require(
        consumer["candidate_commit"] == XINSIGHT_CANDIDATE_COMMIT
        and consumer["candidate_tree"] == XINSIGHT_CANDIDATE_TREE,
        "reviewed X-Insight candidate identity changed",
    )
    require(
        matrix["source_baseline"]["source_schema"]["sha256"] == SOURCE_SCHEMA_SHA,
        "compatibility matrix Source Schema pin changed",
    )
    require(
        sha256(ROOT / matrix["source_baseline"]["source_schema"]["path"])
        == SOURCE_SCHEMA_SHA,
        "OpenInference Source Schema bytes changed",
    )
    manifest = load_json_strict(
        ROOT / "manifests/foigent.openinference.otlp-spans-1.0.0.json"
    )
    require(
        manifest["manifest_version"] == "foigent.connector-manifest.v2",
        "wrong OpenInference Manifest version",
    )
    require(
        manifest["transport"]["mode"]
        == manifest["delivery"]["mode"]
        == manifest["state_progression"]["mode"]
        == "bounded_offline",
        "OpenInference reference mode is not bounded_offline",
    )
    require(
        manifest["state_progression"]["checkpoint"] == "not_applicable",
        "OpenInference Manifest fabricates a Checkpoint",
    )
    require(
        manifest["supported_source_schemas"][0]["sha256"] == SOURCE_SCHEMA_SHA,
        "Manifest Source Schema pin changed",
    )
    require(
        manifest["compatibility"]["reference_compatibility_vector_bundle"]["sha256"]
        == sha256(matrix_path),
        "Manifest compatibility matrix pin is stale",
    )
    catalog = load_json_strict(ROOT / "catalog/domain-catalog.v2.json")
    require(
        catalog["catalog_version"] == "foigent.domain-catalog.v2",
        "wrong candidate domain catalog version",
    )
    observability = next(
        domain for domain in catalog["domains"] if domain["domain"] == "observability"
    )
    event_registration = observability["event_types"][0]
    emitted = manifest["emitted_event_schemas"][0]
    require(
        {
            "event_type": event_registration["event_type"],
            "schema_ref": event_registration["schema_ref"],
            "schema_version": event_registration["schema_version"],
        }
        == emitted,
        "Manifest event declaration differs from the domain catalog",
    )
    require(
        sha256(ROOT / event_registration["payload_schema_path"])
        == "sha256:b40e06b7ddc0f5c2800aa81c7562f3d79e35074fd9ba692cb663741491e2c0ce",
        "OpenInference payload Schema bytes changed",
    )
    source_registration = next(
        record
        for record in catalog["record_schemas"]
        if record["record_type"] == "openinference_sanitized_span"
    )
    require(
        source_registration["source_schema_id"]
        == manifest["supported_source_schemas"][0]["schema_id"],
        "Manifest Source declaration differs from the domain catalog",
    )
    require(
        sha256(ROOT / source_registration["schema_path"]) == SOURCE_SCHEMA_SHA,
        "domain catalog Source Schema bytes changed",
    )
    projection = load_json_strict(
        ROOT / "mappings/xinsight/openinference-span-to-m0-m0.1-v2.json"
    )
    projection_baseline = projection["consumer_baseline"]
    require(
        projection_baseline["reviewed_origin_main_commit"]
        == XINSIGHT_ORIGIN_MAIN_COMMIT
        and projection_baseline["reviewed_origin_main_tree"]
        == XINSIGHT_ORIGIN_MAIN_TREE,
        "projection origin/main baseline changed",
    )
    require(
        projection_baseline["commit"] == XINSIGHT_CANDIDATE_COMMIT
        and projection_baseline["tree"] == XINSIGHT_CANDIDATE_TREE,
        "projection candidate baseline changed",
    )
    require(
        projection["activation_gate"]["status"]
        == "blocked_product_migration_required",
        "X-Insight activation gate opened",
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
        "must never contain a delivery Cursor"
        in projection["main_event"]["$.import_cursor"],
        "product-local import_cursor boundary changed",
    )
    transition = load_json_strict(
        ROOT / "compatibility/v1-to-v2-source-neutral-matrix.json"
    )
    require(
        transition["predecessor"]
        == {
            "protocol_version": "1.1.2",
            "tag_commit": PREDECESSOR_COMMIT,
            "tree": PREDECESSOR_TREE,
            "content_digest": PREDECESSOR_CONTENT_DIGEST,
        },
        "v1 predecessor identity changed",
    )
    require(
        transition["candidate"]
        == {"protocol_version": "2.0.0", "status": "not_binding"},
        "v2 candidate identity changed",
    )
    cases, classes = verify_reports()
    return {
        "status": "pass",
        "protocol_status": "not_binding",
        "predecessor_components_verified": predecessor_components,
        "v1_m0_id_hash_pairs": 10,
        "v1_gap_rows": 8,
        "v1_provenance_ids": 2,
        "openinference_m0_id_hash_pairs": 5,
        "openinference_gap_events": 4,
        "conformance_cases": cases,
        "conformance_classes": classes,
        "runtime_mutation": "none",
    }


def main() -> None:
    print(json.dumps(validate(), sort_keys=True, separators=(",", ":")))


if __name__ == "__main__":
    main()
