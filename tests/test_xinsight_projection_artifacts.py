import hashlib
import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MAPPINGS = ROOT / "mappings" / "xinsight"
SOURCE_SYSTEM_ID = "11111111-1111-1111-1111-111111111111"
ADAPTER_MANIFEST_ID = "22222222-2222-4222-8222-222222222224"
SOURCE_INSTANCE = "unirouter-development"
M0_SCHEMA = "m0.1"
SOURCE_SCHEMA = "unirouter.completed-execution.v1"
CANONICAL_DECIMAL = re.compile(r"^(0|[1-9][0-9]{0,18})$")
MAX_INT64 = 9223372036854775807


def load_json(name):
    with (MAPPINGS / name).open(encoding="utf-8") as stream:
        return json.load(stream)


def adapter_deterministic_uuid(value):
    raw = bytearray(hashlib.sha256(value.encode("utf-8")).digest()[:16])
    raw[6] = (raw[6] & 0x0F) | 0x50
    raw[8] = (raw[8] & 0x3F) | 0x80
    hexed = raw.hex()
    return (
        f"{hexed[0:8]}-{hexed[8:12]}-{hexed[12:16]}-"
        f"{hexed[16:20]}-{hexed[20:32]}"
    )


def mapped_event_id(source_ref, event_type, source_event_id):
    return adapter_deterministic_uuid(
        "\x00".join(
            [
                "xinsight-unirouter-event-v2",
                SOURCE_SYSTEM_ID,
                ADAPTER_MANIFEST_ID,
                source_ref,
                event_type,
                source_event_id,
            ]
        )
    )


def db_deterministic_uuid(value):
    hexed = hashlib.sha256(value.encode("utf-8")).hexdigest()
    return (
        f"{hexed[0:8]}-{hexed[8:12]}-5{hexed[13:16]}-"
        f"8{hexed[17:20]}-{hexed[20:32]}"
    )


def import_cursor(source_ref):
    parts = source_ref.split(":")
    return ":".join(parts[-2:]) if len(parts) >= 4 else source_ref


def base_event(source_ref, source_event_id, source_event_type, event_type, stage,
               severity, terminal_at):
    return {
        "id": mapped_event_id(source_ref, event_type, source_event_id),
        "schema_version": M0_SCHEMA,
        "source_system_id": SOURCE_SYSTEM_ID,
        "adapter_manifest_id": ADAPTER_MANIFEST_ID,
        "source_type": "unirouter",
        "source_event_id": source_event_id,
        "source_event_type": source_event_type,
        "source_ref": source_ref,
        "idempotency_key": (
            f"adapter-unirouter:{SOURCE_SYSTEM_ID}:{source_ref}:"
            f"{event_type}:{source_event_id}"
        ),
        "import_cursor": import_cursor(source_ref),
        "event_type": event_type,
        "stage": stage,
        "severity": severity,
        "capture_mode": "api_import",
        "occurred_at": terminal_at,
        "observed_at": terminal_at,
    }


def compact(values):
    return {
        key: value
        for key, value in values.items()
        if value is not None
        and value != ""
        and value != {}
        and value != []
    }


def build_terminal_event(seed):
    snapshot = seed["source_snapshot_facts"]
    request_id = snapshot["request_id"]
    terminal_at = snapshot["terminal"]["available_at"]
    status = snapshot["terminal"]["status"]
    usage = snapshot["usage"]
    money = snapshot["money"]
    source_ref = (
        f"unirouter:{SOURCE_INSTANCE}:completed_execution:{request_id}"
    )
    if status == "settled":
        event_type, severity, outcome_status = (
            "billing.execution.settled",
            "info",
            "success",
        )
    else:
        event_type, severity, outcome_status = (
            "billing.execution.cancelled",
            "warning",
            "failure",
        )
    event = base_event(
        source_ref,
        request_id,
        "completed_execution",
        event_type,
        "billing",
        severity,
        terminal_at,
    )
    event.update(
        {
            "source_version": SOURCE_SCHEMA,
            "source_event_hash": (
                "sha256:" + seed["source_fixture"]["sha256"]
            ),
            "request_id": request_id,
            "org_ref": f"org-{snapshot['org_id']}",
            "project_ref": f"project-{snapshot['project_id']}",
            "payload_capture_mode": "metadata_only",
            "correlation": {"request_id": request_id},
            "identity": {
                "org_id": f"org-{snapshot['org_id']}",
                "project_id": f"project-{snapshot['project_id']}",
                "actor_type": "system",
            },
            "capability": {
                "capability_type": "model_call",
                "model": usage["model"],
                "extensions": {
                    "usage_authority": usage["authority"],
                },
            },
            "usage": {
                "prompt_tokens": usage["prompt_tokens"],
                "completion_tokens": usage["completion_tokens"],
                "total_tokens": (
                    usage["prompt_tokens"] + usage["completion_tokens"]
                ),
                "cost_micros": money["charged_cost_micros"],
                "currency": money["currency"],
                "amount_scale": money["amount_scale"],
                "money_schema": money["schema"],
                "usage_source": usage["source"],
                "usage_confidence": usage["finality"],
                "extensions": compact(
                    {
                        "uncached_prompt_tokens": usage[
                            "uncached_prompt_tokens"
                        ],
                        "cache_read_tokens": usage["cache_read_tokens"],
                        "cache_creation_tokens": usage[
                            "cache_creation_tokens"
                        ],
                        "usage_purpose": usage["purpose"],
                        "usage_contract_version": usage["contract_version"],
                        "usage_estimate_version": usage["estimate_version"],
                        "cache_usage_schema": usage["cache_usage_schema"],
                        "cache_usage_status": usage["cache_usage_status"],
                        "calculated_cost_micros": money[
                            "calculated_cost_micros"
                        ],
                        "pricing_version": money["pricing_version"],
                    }
                ),
            },
            "outcome": {
                "outcome_status": outcome_status,
                "extensions": {"terminal_status": status},
            },
            "payload_policy": {
                "payload_capture_mode": "metadata_only",
                "redaction_state": "not_applicable",
            },
            "field_provenance": {
                "correlation": "direct",
                "identity": "direct",
                "capability": "direct",
                "usage": "direct",
                "outcome": "direct",
                "payload_policy": "declared",
            },
            "raw_source_excerpt": compact(
                {
                    "terminal_status": status,
                    "usage_source": usage["source"],
                    "usage_authority": usage["authority"],
                    "usage_purpose": usage["purpose"],
                    "usage_finality": usage["finality"],
                    "usage_contract_version": usage["contract_version"],
                    "usage_estimate_version": usage["estimate_version"],
                    "cache_usage_schema": usage["cache_usage_schema"],
                    "cache_usage_status": usage["cache_usage_status"],
                    "calculated_cost_micros": money[
                        "calculated_cost_micros"
                    ],
                    "pricing_version": money["pricing_version"],
                }
            ),
        }
    )
    return event


def build_gap_event(seed, gap):
    snapshot = seed["source_snapshot_facts"]
    request_id = snapshot["request_id"]
    source = gap["source"]
    terminal_at = snapshot["terminal"]["available_at"]
    source_event_id = f"{request_id}:gap:{source}"
    source_ref = (
        f"unirouter:{SOURCE_INSTANCE}:completed_execution:{request_id}:"
        f"gap:{source}"
    )
    event = base_event(
        source_ref,
        source_event_id,
        "completed_execution_capture_gap",
        "gap.capture.detected",
        "gap",
        "warning",
        terminal_at,
    )
    event.update(
        {
            "source_version": SOURCE_SCHEMA,
            "source_event_hash": (
                "sha256:" + seed["source_fixture"]["sha256"]
            ),
            "request_id": request_id,
            "org_ref": f"org-{snapshot['org_id']}",
            "project_ref": f"project-{snapshot['project_id']}",
            "payload_capture_mode": "none",
            "correlation": {"request_id": request_id},
            "identity": {
                "org_id": f"org-{snapshot['org_id']}",
                "project_id": f"project-{snapshot['project_id']}",
                "actor_type": "system",
            },
            "payload_policy": {
                "payload_capture_mode": "none",
                "redaction_state": "not_applicable",
            },
            "field_provenance": {
                "correlation": "direct",
                "identity": "direct",
                "payload_policy": "not_applicable",
                "extensions": {"capture_gap": "direct"},
            },
            "raw_source_excerpt": {
                "capture_gap": "not_available_from_source",
                "gap_source": source,
                "reason": gap["reason"],
            },
        }
    )
    return event


def build_events(seed):
    gaps = sorted(
        seed["source_snapshot_facts"]["capture_gaps"],
        key=lambda gap: gap["source"],
    )
    return [build_terminal_event(seed)] + [
        build_gap_event(seed, gap) for gap in gaps
    ]


def m0_event_hash(event):
    encoded = json.dumps(
        event,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return "sha256:" + hashlib.sha256(encoded).hexdigest()


def provenance_id(provenance):
    values = [
        "import_provenance",
        SOURCE_SYSTEM_ID,
        ADAPTER_MANIFEST_ID,
        provenance["integration_mode"],
        provenance["proof_class"],
        provenance["assurance_mode"],
        provenance["source_artifact_sha256"],
        provenance["approval_manifest_sha256"],
        provenance["exchange_id"],
        provenance["source_revision"],
        provenance["imported_revision"],
        provenance["source_watermark"],
        provenance["import_watermark"],
        "true" if provenance["timeline_complete"] else "false",
        provenance["source_generated_at"] or "",
        provenance["source_terminal_at"],
    ]
    if provenance["source_payload_sha256"]:
        values.extend(
            [
                "source_payload_sha256",
                provenance["source_payload_sha256"],
            ]
        )
    return db_deterministic_uuid("\x00".join(values))


def execution_id(request_id):
    value = (
        "xinsight-execution-v1"
        + "\x00"
        + SOURCE_SYSTEM_ID
        + "\x00"
        + request_id
    )
    return "xe1_" + hashlib.sha256(value.encode("utf-8")).hexdigest()


class XInsightProjectionArtifactTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.projection = load_json(
            "model-request-completed-to-m0-m0.1-v1.json"
        )
        cls.lifecycle = load_json(
            "connector-lifecycle-to-current-xinsight-v1.json"
        )
        cls.identity = load_json(
            "portable-connector-identity-to-current-xinsight-v1.json"
        )
        cls.bundle = load_json(
            "completed-execution-compatibility-seed-v1.json"
        )

    def test_projection_baseline_and_mutable_exclusions(self):
        baseline = self.projection["baseline"]
        self.assertEqual(
            baseline["joint_candidate_v3_sha256"],
            "f52c4a1f21232d3c209ff3de3e4e63da41d53e139e7ef13648db57fe4257311f",
        )
        self.assertEqual(
            baseline["xinsight_commit"],
            "c27b39f67b0e72de7f60975ff8b0e94dfc05520f",
        )
        self.assertEqual(
            baseline["xinsight_tree"],
            "16a4930f014c35531b01cc4bd44c25bd29a53ae8",
        )
        excluded = set(
            self.projection["mutable_delivery_exclusions"]["fields"]
        )
        for required in {
            "delivery cursor",
            "high-watermark",
            "page observation time",
            "receive time",
            "retry/backoff state",
            "consumer ingestion time",
        }:
            self.assertIn(required, excluded)
        self.assertEqual(
            self.projection["m0_identity_and_hash"]["event_hash"][
                "excluded_fields"
            ],
            ["event_hash", "ingested_at"],
        )
        mapped_paths = {
            item["shared_path"]
            for item in self.projection["parent_event_projection"]
        }
        self.assertTrue(
            {
                "producer.instance",
                "event_id",
                "scope.org_ref",
                "scope.project_ref",
                "terminal.status",
                "terminal_at",
                "usage.model",
                "usage.prompt_tokens",
                "usage.completion_tokens",
                "usage.uncached_prompt_tokens",
                "usage.cache_read_tokens",
                "usage.cache_creation_tokens",
                "usage.source",
                "usage.authority",
                "usage.purpose",
                "usage.finality",
                "usage.contract_version",
                "usage.estimate_version",
                "usage.cache_usage_schema",
                "usage.cache_usage_status",
                "money.calculated_cost_micros",
                "money.charged_cost_micros",
                "money.pricing_version",
                "integrity.source_hash",
                "source_revision",
                "timeline_complete",
                "payload_capture_mode",
            }.issubset(mapped_paths)
        )
        capture = self.projection["capture_mode_separation"]
        self.assertIsNone(
            capture["shared_ingestion_capture_mode"][
                "b8_wire_path_or_enum"
            ]
        )
        self.assertEqual(
            capture["payload_capture_mode"]["parent"], "metadata_only"
        )
        self.assertEqual(capture["payload_capture_mode"]["gap"], "none")
        shared_gap_provenance = self.projection["gap_projection"][
            "shared_field_provenance"
        ]
        self.assertEqual(shared_gap_provenance["affected_claim"], "direct")
        self.assertTrue(
            shared_gap_provenance["gap_id"].startswith("derived")
        )
        self.assertTrue(
            shared_gap_provenance["gap_type"].startswith("declared")
        )

    def test_portable_identity_is_explicitly_product_local(self):
        self.assertEqual(
            self.identity["portable_identity"]["connector_id"],
            "foigent.unirouter.completed-execution",
        )
        registry = self.identity["xinsight_local_registry"]
        self.assertEqual(registry["source_system"]["id"], SOURCE_SYSTEM_ID)
        self.assertEqual(
            registry["adapter_manifest"]["id"], ADAPTER_MANIFEST_ID
        )
        self.assertEqual(
            registry["projection_profile"]["id"],
            "xinsight.foigent-envelope-to-m0.unirouter-completed-execution.v1",
        )
        self.assertGreaterEqual(
            len(self.identity["identity_non_substitution_rules"]), 5
        )

    def test_lifecycle_mapping_preserves_orthogonal_axes_and_read_gap(self):
        axes = {
            item["shared_axis"]
            for item in self.lifecycle["shared_axes_to_current_local_state"]
        }
        self.assertEqual(
            axes,
            {
                "configuration",
                "authentication",
                "transport",
                "processing",
                "checkpoint",
                "health",
            },
        )
        self.assertEqual(
            self.lifecycle["read_model_projection"][
                "current_connector_lifecycle_api"
            ],
            None,
        )
        self.assertEqual(
            self.lifecycle["read_model_projection"][
                "current_connector_lifecycle_ui"
            ],
            None,
        )
        transitions = {
            item["operation"]: item
            for item in self.lifecycle["current_transition_projection"]
        }
        self.assertEqual(
            transitions["MarkFailure(retryable=true)"][
                "worker_status_after"
            ],
            "backoff",
        )
        self.assertEqual(
            transitions["MarkFailure(retryable=false)"][
                "worker_status_after"
            ],
            "error",
        )
        self.assertIn(
            "No cursor or high-watermark change",
            transitions["MarkPollStarted"]["checkpoint_effect"],
        )

    def test_exact_m0_event_ids_hashes_refs_and_idempotency(self):
        event_count = 0
        for seed in self.bundle["seeds"]:
            generated = build_events(seed)
            expected = seed["m0_events"]
            self.assertEqual(len(generated), 5)
            self.assertEqual(len(expected), 5)
            for actual, pin in zip(generated, expected):
                event_count += 1
                for field in (
                    "id",
                    "event_type",
                    "source_event_type",
                    "source_event_id",
                    "source_ref",
                    "idempotency_key",
                    "import_cursor",
                    "payload_capture_mode",
                    "field_provenance",
                ):
                    self.assertEqual(
                        actual[field],
                        pin[field],
                        f"{seed['name']} {pin['role']} field={field}",
                    )
                self.assertEqual(
                    m0_event_hash(actual),
                    pin["event_hash"],
                    f"{seed['name']} {pin['role']} hash",
                )
        self.assertEqual(event_count, 10)

    def test_exact_gap_rows(self):
        row_count = 0
        for seed in self.bundle["seeds"]:
            gaps_by_event = {
                event["id"]: event
                for event in seed["m0_events"]
                if event["role"].startswith("gap:")
            }
            self.assertEqual(len(seed["gap_rows"]), 4)
            for row in seed["gap_rows"]:
                row_count += 1
                event = gaps_by_event[row["evidence_event_id"]]
                self.assertEqual(
                    row["id"],
                    db_deterministic_uuid(
                        "capture_gap:" + row["evidence_event_id"]
                    ),
                )
                self.assertEqual(
                    row["affected_claim"], event["role"].split(":", 1)[1]
                )
                self.assertEqual(
                    row["gap_type"], "not_available_from_source"
                )
                self.assertEqual(row["candidate_gap_types"], [])
                self.assertEqual(
                    row["gap_reason"],
                    "not_available_at_billing_terminal",
                )
        self.assertEqual(row_count, 8)

    def test_exact_import_provenance_ids_and_linkage(self):
        for seed in self.bundle["seeds"]:
            provenance = seed["import_provenance"]
            self.assertEqual(provenance["id"], provenance_id(provenance))
            self.assertEqual(
                provenance["linked_event_ids"],
                [event["id"] for event in seed["m0_events"]],
            )
            self.assertEqual(provenance["source_watermark"], "")
            self.assertEqual(provenance["import_watermark"], "")
            self.assertIsNone(provenance["source_generated_at"])
            self.assertTrue(provenance["timeline_complete"])

    def test_shared_numeric_and_time_projection_is_lossless_for_seeds(self):
        for seed in self.bundle["seeds"]:
            source = seed["source_snapshot_facts"]
            shared = seed["shared_projection_facts"]
            for field in (
                "prompt_tokens",
                "uncached_prompt_tokens",
                "cache_read_tokens",
                "cache_creation_tokens",
                "completion_tokens",
            ):
                wire = shared[field]
                self.assertRegex(wire, CANONICAL_DECIMAL)
                self.assertLessEqual(int(wire), MAX_INT64)
                self.assertEqual(int(wire), source["usage"][field])
            self.assertEqual(shared["occurred_at"], shared["terminal_at"])
            self.assertIsNone(shared["observed_at"])
            self.assertEqual(
                shared["capture_gaps_sorted"],
                sorted(
                    gap["source"] for gap in source["capture_gaps"]
                ),
            )

    def test_read_model_identity_and_stable_expectations(self):
        for seed in self.bundle["seeds"]:
            read_model = seed["read_model"]
            self.assertEqual(
                read_model["execution_id"],
                execution_id(seed["source_snapshot_facts"]["request_id"]),
            )
            self.assertEqual(read_model["event_count"], 5)
            self.assertEqual(read_model["gap_count"], 4)
            self.assertTrue(read_model["has_gaps"])
            self.assertEqual(
                read_model["payload_capture_modes"],
                ["metadata_only", "none"],
            )
            self.assertEqual(
                read_model["freshness"]["sync_state"], "gap"
            )
            self.assertEqual(
                read_model["timeline_order_when_ingested_at_equal"],
                sorted(event["id"] for event in seed["m0_events"]),
            )
            self.assertIn(
                "ingested_at",
                read_model["operational_times_not_pinned"],
            )
        ordered = self.bundle["cross_seed_read_model"][
            "search_order_by_last_effective_at_desc"
        ]
        self.assertEqual(
            ordered,
            [
                self.bundle["seeds"][1]["read_model"]["execution_id"],
                self.bundle["seeds"][0]["read_model"]["execution_id"],
            ],
        )

    def test_bundle_totals_and_b6_boundary(self):
        self.assertEqual(
            self.bundle["compatibility_totals"],
            {
                "m0_events": 10,
                "m0_terminal_events": 2,
                "m0_gap_events": 8,
                "first_class_gap_rows": 8,
                "import_provenance_records": 2,
                "events_linked_to_import_provenance": 10,
            },
        )
        context = self.bundle["projection_context"]
        self.assertIsNone(context["producer_product"])
        self.assertIsNone(context["shared_canonical_bytes"])
        self.assertIsNone(context["shared_identity"])
        self.assertIsNone(context["shared_idempotency"])
        self.assertIsNone(context["shared_envelope_hash"])


if __name__ == "__main__":
    unittest.main()
