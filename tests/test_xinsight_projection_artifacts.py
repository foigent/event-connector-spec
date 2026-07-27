import hashlib
import json
import os
import re
import subprocess
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
EXACT_B8_COMMIT = "404d1d753801fd32185eea8163d6a8f839c22a89"
EXACT_B8_TREE = "9aa5fe3f0e830631dc355d51c654928f97bdbd88"
STABLE_COMPATIBILITY_SHA256 = (
    "d22374a34e4f496cc05f7e56e7538cd2f3fc4bb3d9428cd9ac38883a81a909b5"
)
B8_ARTIFACT_SHA256 = {
    "spec/protocol-v1.md":
        "3a0aac41075fde6645c9d07d80416142e4b8de110a0ff429ad96c7df974ed88e",
    "schemas/event-envelope.v1.schema.json":
        "6942e85d9b5d8b08ff9828b970c317596394184ef29908cbf2b8fc792187cf26",
    "schemas/model-request-completed.v1.schema.json":
        "ea0ea7354f3d9f435bb86a34eb28284e4297e5a2d1a3d22a23058c7dcc514dc6",
    "schemas/capture-gap.v1.schema.json":
        "1a5be69da99f62033ceadf05f66d45296d1d5f8b662830f77c0fc6af49edaec8",
    "schemas/connector-lifecycle.v1.schema.json":
        "bd5c730587041ddc7ad6f66bca4deca35edf5f9b5b92b761ac53701f37e18d5e",
    "schemas/connector-manifest.v1.schema.json":
        "a6f43b37477002ab836a4d9ea7c4e462675cd4313f0637c0733cd98675fc0adf",
    "schemas/connector-checkpoint.v1.schema.json":
        "8be2fd290d6db8d288a9b10ac6d9aa0b55a66ff21ea0fb55ac0af2d1b66bf800",
    "schemas/connector-error.v1.schema.json":
        "f449ba6314f1f730be5a0b188dc6d2cc2704e8f5d84a4eebecac576221e4ca56",
    "schemas/event-batch.v1.schema.json":
        "8e2133922bcb77cf032309290593665df1bf56cfa47e433dd573d0e42f36eef9",
    "schemas/operational-receipt.v1.schema.json":
        "3c3b99e009e208456039d3bfe26d84af7e3f1af23589e7fa62a1e1a61e0fb3c6",
    "manifests/foigent.unirouter.completed-execution-1.0.0.json":
        "1d8b70dab02900e9d033ed0de9a5ce0c646d3556b80440a67354367eb83091f7",
    "catalog/domain-catalog.v1.json":
        "93d4c55dd181a7e168d17b90bc8527b89e6d2e3c1eac0549bd7a34e1857e3a06",
    "vectors/canonical-vector-bundle.v1.json":
        "98659630f3e1238d2684c2b4cba728334f4bdace67ff033652676d9d505caf33",
    "fixtures/golden-fixture-bundle.v1.json":
        "b56de610d4444b655e3f700e61ec490caa1fc1d8658db1660192686c0fc1a268",
    "conformance/conformance-contract.v1.json":
        "f3ae834265170ff22088943283fd23dcb562bc2308571ccc722414c2c896dc23",
    "conformance/reports/go-v1.json":
        "b80d90f62804b64a49396df51cc98dbdd37378f91f02483b76a2200cd0f9aea2",
    "conformance/reports/typescript-v1.json":
        "fb4bbfd8ab14f1175e31bdb28e1240dc9a84e6effcec28c95c59595e87723d57",
}


def load_json(name):
    with (MAPPINGS / name).open(encoding="utf-8") as stream:
        return json.load(stream)


def canonical_json_bytes(value):
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


def git_blob(worktree, tree, path):
    result = subprocess.run(
        ["git", "-C", str(worktree), "show", f"{tree}:{path}"],
        check=True,
        capture_output=True,
    )
    return result.stdout


def instance_leaf_paths(value, path="$"):
    if isinstance(value, dict):
        paths = set()
        for key, child in value.items():
            paths.update(instance_leaf_paths(child, f"{path}.{key}"))
        return paths
    if isinstance(value, list):
        paths = set()
        for child in value:
            paths.update(instance_leaf_paths(child, f"{path}[*]"))
        return paths
    return {path}


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

    def test_release_component_status_and_exact_authority_pins(self):
        for artifact in (
            self.projection,
            self.lifecycle,
            self.identity,
            self.bundle,
        ):
            self.assertEqual(artifact["status"], "B9_RELEASE_COMPONENT")
            authority = artifact["baseline"]["b8_authority"]
            self.assertEqual(authority["commit"], EXACT_B8_COMMIT)
            self.assertEqual(authority["tree"], EXACT_B8_TREE)
        review = (
            ROOT
            / "reviews"
            / "2026-07-27-xinsight-projection-owner-b9-candidate.md"
        ).read_text(encoding="utf-8")
        self.assertIn(
            "PROJECTION_OWNER_B9_RELEASE_CANDIDATE_CONFIRM", review
        )
        text = "\n".join(
            [
                *(path.read_text(encoding="utf-8")
                  for path in sorted(MAPPINGS.iterdir())
                  if path.suffix in {".json", ".md"}),
                review,
            ]
        )
        for forbidden in (
            "B9_CANDIDATE_NOT_BINDING",
            "WAITING_FOR_EXACT_B8",
            "not yet authored",
            "not-yet-supplied",
            "do not yet exist",
            "no shared Checkpoint Schema exists",
            "b8_wire_path_or_enum",
            "no_shared_schema_claim",
            "\"input_candidate\"",
            "shared_payload_schema_candidate",
        ):
            self.assertNotIn(forbidden, text)

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
                "$.producer.instance",
                "$.event_id",
                "$.correlation.request_ref",
                "$.scope.org_ref",
                "$.scope.project_ref",
                "$.payload.terminal.status",
                "$.time.terminal_at",
                "$.payload.usage.model",
                "$.payload.usage.prompt_tokens",
                "$.payload.usage.completion_tokens",
                "$.payload.usage.uncached_prompt_tokens",
                "$.payload.usage.cache_read_tokens",
                "$.payload.usage.cache_creation_tokens",
                "$.payload.usage.source",
                "$.payload.usage.authority",
                "$.payload.usage.purpose",
                "$.payload.usage.finality",
                "$.payload.usage.contract_version",
                "$.payload.usage.estimate_version",
                "$.payload.usage.cache_usage_schema",
                "$.payload.usage.cache_usage_status",
                "$.payload.money.calculated_cost_micros",
                "$.payload.money.charged_cost_micros",
                "$.payload.money.pricing_version",
                "$.integrity.source_hash",
                "$.integrity.envelope_hash",
                "$.identity.source_revision",
                "$.identity.idempotency_key",
                "$.payload.timeline_complete",
                "$.data_policy.payload_capture_mode",
            }.issubset(mapped_paths)
        )
        capture = self.projection["capture_mode_separation"]
        self.assertEqual(
            capture["manifest_ingestion_capture_mode"]["json_path"],
            "$.payload_policy.ingestion_capture_mode",
        )
        self.assertEqual(
            capture["manifest_ingestion_capture_mode"]["value"],
            "api_import",
        )
        self.assertEqual(
            capture["payload_capture_mode"]["parent_value"], "metadata_only"
        )
        self.assertEqual(
            capture["payload_capture_mode"]["gap_value"], "none"
        )
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
        manifest_paths = {
            path
            for group in self.identity["manifest_path_bindings"]
            for path in group["json_paths"]
        }
        self.assertIn("$.coverage.included[*]", manifest_paths)
        self.assertIn("$.coverage.excluded[*]", manifest_paths)
        self.assertIn("$.instance_binding.comparison", manifest_paths)
        self.assertIn(
            "$.payload_policy.ingestion_capture_mode", manifest_paths
        )
        self.assertIn(
            "$.compatibility.reference_projection_contract.sha256",
            manifest_paths,
        )

    def test_lifecycle_mapping_preserves_orthogonal_axes_and_read_gap(self):
        axes = {
            item["shared_axis"]: item
            for item in self.lifecycle["shared_axes_to_current_local_state"]
        }
        self.assertEqual(
            set(axes),
            {
                "configuration",
                "authentication",
                "transport",
                "processing",
                "checkpoint",
                "health",
            },
        )
        expected_values = {
            "configuration": ["unconfigured", "configured", "retired"],
            "authentication": [
                "absent", "staged", "valid", "revoked", "error",
            ],
            "transport": [
                "stopped", "starting", "ready", "backoff", "error",
            ],
            "processing": [
                "inactive", "idle", "polling", "committing", "backoff",
                "stopping", "error",
            ],
            "checkpoint": ["absent", "bootstrap", "steady", "error"],
            "health": [
                "unknown", "healthy", "degraded", "permanent_error",
                "stopped", "retired",
            ],
        }
        for axis, values in expected_values.items():
            self.assertEqual(axes[axis]["shared_json_path"], f"$.{axis}")
            self.assertEqual(axes[axis]["shared_values"], values)
        self.assertEqual(
            self.lifecycle["shared_document_control"]["required_value"],
            "foigent.connector-lifecycle.v1",
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
        checkpoint_paths = {
            item["shared_json_path"]
            for item in self.lifecycle["checkpoint_schema_projection"]
        }
        self.assertEqual(
            checkpoint_paths,
            {
                "$.checkpoint_version",
                "$.connector_id",
                "$.connector_version",
                "$.producer_instance",
                "$.cursor",
                "$.high_watermark",
                "$.phase",
                "$.updated_at",
            },
        )
        self.assertEqual(
            self.lifecycle["event_batch_projection"][
                "mutable_delivery_paths"
            ],
            [
                "$.generated_at",
                "$.next_cursor",
                "$.high_watermark",
                "$.has_more",
            ],
        )

    def test_exact_b8_git_tree_artifacts_and_input_coverage(self):
        reference = os.environ.get("FOIGENT_B8_REFERENCE_WORKTREE")
        if not reference:
            self.skipTest("FOIGENT_B8_REFERENCE_WORKTREE not supplied")
        requested_tree = os.environ.get("FOIGENT_B8_TREE", EXACT_B8_TREE)
        self.assertEqual(requested_tree, EXACT_B8_TREE)
        resolved_tree = subprocess.run(
            [
                "git", "-C", reference, "rev-parse",
                f"{EXACT_B8_COMMIT}^{{tree}}",
            ],
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
        self.assertEqual(resolved_tree, EXACT_B8_TREE)
        blobs = {}
        for path, expected in B8_ARTIFACT_SHA256.items():
            blob = git_blob(reference, EXACT_B8_TREE, path)
            blobs[path] = blob
            self.assertEqual(hashlib.sha256(blob).hexdigest(), expected, path)

        manifest = json.loads(
            blobs[
                "manifests/"
                "foigent.unirouter.completed-execution-1.0.0.json"
            ]
        )
        manifest_leaves = instance_leaf_paths(manifest)
        manifest_bindings = {
            path
            for group in self.identity["manifest_path_bindings"]
            for path in group["json_paths"]
        }
        self.assertEqual(manifest_leaves - manifest_bindings, set())
        coverage_binding = self.identity["coverage_binding"]
        self.assertEqual(
            coverage_binding["included"], manifest["coverage"]["included"][0]
        )
        self.assertEqual(
            coverage_binding["excluded"], manifest["coverage"]["excluded"]
        )
        portable = self.identity["portable_identity"]
        self.assertEqual(portable["connector_id"], manifest["connector_id"])
        self.assertEqual(
            portable["connector_version"], manifest["connector_version"]
        )
        self.assertEqual(portable["class"], manifest["connector_class"])
        self.assertEqual(portable["direction"], manifest["direction"])

        settled = json.loads(
            git_blob(
                reference,
                EXACT_B8_TREE,
                "fixtures/shared/settled-envelope.hash-input.json",
            )
        )
        envelope_leaves = instance_leaf_paths(settled)
        coverage = self.projection["authoritative_input_coverage"]
        covered_paths = set().union(
            coverage["mapped_or_derived_into_current_m0"],
            coverage["validated_control_only_not_persisted_as_shared_values"],
            coverage["reference_profile_absent"],
        )

        def covered(leaf):
            return any(
                leaf == path or leaf.startswith(path + ".")
                for path in covered_paths
            )

        self.assertEqual(
            {leaf for leaf in envelope_leaves if not covered(leaf)},
            set(),
        )

        vectors = json.loads(
            blobs["vectors/canonical-vector-bundle.v1.json"]
        )
        golden = json.loads(
            blobs["fixtures/golden-fixture-bundle.v1.json"]
        )
        manifest_identity = manifest["event_identity_profile"]
        context = self.bundle["projection_context"]
        self.assertEqual(
            context["shared_identity"]["profile"], manifest_identity
        )
        self.assertEqual(
            context["producer_product"],
            vectors["reference_mapping_context"]["producer_product"],
        )
        canonical = {
            item["case_id"]: item
            for item in vectors["canonical_envelopes"]
        }
        idempotency = {
            item["case_id"]: item
            for item in vectors["idempotency"]
        }
        golden_cases = {
            item["case_id"]: item
            for item in golden["cases"]
        }
        case_bindings = {
            "valid-settled": (
                "reference-settled", "absent-tenant-settled"
            ),
            "valid-cancelled": (
                "reference-cancelled", "absent-tenant-cancelled"
            ),
        }
        for seed_name, (golden_id, idempotency_id) in (
            case_bindings.items()
        ):
            binding = context["shared_vector_bindings"][seed_name]
            self.assertEqual(binding["golden_case_id"], golden_id)
            self.assertEqual(
                binding["shared_canonical_bytes"],
                canonical[golden_id]["canonical_bytes"],
            )
            self.assertEqual(
                binding["shared_envelope_hash"],
                canonical[golden_id]["envelope_hash"],
            )
            self.assertEqual(
                binding["shared_idempotency_key"],
                idempotency[idempotency_id]["idempotency_key"],
            )
            self.assertEqual(
                binding["shared_identity_input_hex"],
                idempotency[idempotency_id]["identity_input_hex"],
            )
            self.assertEqual(
                binding["shared_hash_input_file_sha256"],
                golden_cases[golden_id]["shared_hash_input"]["file_sha256"],
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
        self.assertEqual(context["producer_product"], "unirouter")
        self.assertEqual(
            context["shared_identity"]["profile"],
            "foigent.unirouter.model-request-completed-id.v1",
        )
        expected = {
            "valid-settled": (
                4596,
                "sha256:c2822f0d940c01de77e2e06af1a5f6e1fd10fc66269be20fceb0939150c17b2e",
                "sha256:0d11f98f981427b7bcf175e82294511ca42981c0ecea8e02f841c3777743d1d2",
            ),
            "valid-cancelled": (
                4629,
                "sha256:d342a560ade558edc557f2cd645a526178958540a012ceabe9ca7047e916796c",
                "sha256:c31445c779ffec9dae8cbc7f1f0344722a4e0fb696a366b2e321f58d0d07fbab",
            ),
        }
        for name, values in expected.items():
            vector = context["shared_vector_bindings"][name]
            self.assertEqual(vector["shared_canonical_bytes"], values[0])
            self.assertEqual(vector["shared_idempotency_key"], values[1])
            self.assertEqual(vector["shared_envelope_hash"], values[2])

    def test_compatibility_seed_payload_is_byte_stable(self):
        stable = {
            key: self.bundle[key]
            for key in (
                "synthetic_only",
                "seeds",
                "compatibility_totals",
                "cross_seed_read_model",
            )
        }
        self.assertEqual(
            hashlib.sha256(canonical_json_bytes(stable)).hexdigest(),
            STABLE_COMPATIBILITY_SHA256,
        )


if __name__ == "__main__":
    unittest.main()
