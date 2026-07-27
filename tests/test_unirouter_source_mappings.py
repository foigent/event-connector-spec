from __future__ import annotations

import copy
import os
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import validate_unirouter_source_mappings as validator  # noqa: E402


class UniRouterSourceMappingTests(unittest.TestCase):
    def setUp(self) -> None:
        self.mapping_dir = ROOT / "mappings" / "unirouter"

    def _load_artifacts(self) -> dict[str, dict]:
        return {
            filename: validator.load_json_strict(self.mapping_dir / filename)
            for filename in validator.ARTIFACT_FILES
        }

    def test_repository_release_candidate_mappings_validate(self) -> None:
        result = validator.validate_directory(self.mapping_dir)
        self.assertEqual("ok", result["status"])
        self.assertEqual(validator.STATUS, result["release_candidate_status"])
        self.assertEqual(4, result["artifact_count"])
        self.assertEqual(28, result["field_mapping_count"])
        self.assertEqual(21, result["lifecycle_mapping_count"])
        self.assertEqual(5, result["source_identity_mapping_count"])
        self.assertEqual(3, result["source_seed_count"])
        self.assertFalse(result["source_git_verified"])
        self.assertFalse(result["b8_git_verified"])

    def test_strict_loader_rejects_nested_duplicate_keys(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "duplicate.json"
            path.write_text(
                '{"outer":{"field":"first","field":"second"}}\n',
                encoding="utf-8",
            )
            with self.assertRaisesRegex(validator.ValidationError, "duplicate JSON key"):
                validator.load_json_strict(path)

    def test_source_seed_identity_mutation_fails_closed(self) -> None:
        payload = validator.load_json_strict(
            self.mapping_dir / "source-contract-seeds.v1.json"
        )
        mutated = copy.deepcopy(payload)
        mutated["seeds"][0]["sha256"] = "0" * 64
        with self.assertRaisesRegex(validator.ValidationError, "wrong identity"):
            validator.validate_artifact(
                mutated,
                "unirouter.source-contract-seeds",
                "mutated-seeds",
            )

    def test_legacy_symbolic_placeholder_fails_closed(self) -> None:
        payload = validator.load_json_strict(
            self.mapping_dir / "source-snapshot-to-model-request-completed.v1.json"
        )
        mutated = copy.deepcopy(payload)
        mutated["field_mappings"][0]["compatibility"] = (
            "semantic:obsolete.placeholder"
        )
        with self.assertRaisesRegex(validator.ValidationError, "legacy marker"):
            validator.validate_artifact(
                mutated,
                "unirouter.source-snapshot-to-model-request-completed",
                "legacy-placeholder",
            )

    def test_exact_b8_digest_mutation_fails_closed(self) -> None:
        payload = validator.load_json_strict(
            self.mapping_dir / "connector-identity-to-source-local.v1.json"
        )
        mutated = copy.deepcopy(payload)
        mutated["b8_authority"]["artifact_pins"]["reference_connector_manifest"][
            "sha256"
        ] = "sha256:" + ("0" * 64)
        with self.assertRaisesRegex(validator.ValidationError, "wrong B8 artifact identity"):
            validator.validate_artifact(
                mutated,
                "unirouter.connector-identity-to-source-local",
                "mutated-b8-digest",
            )

    def test_product_local_lifecycle_cannot_claim_shared_binding(self) -> None:
        payload = validator.load_json_strict(
            self.mapping_dir / "source-lifecycle-to-shared-axes.v1.json"
        )
        mutated = copy.deepcopy(payload)
        target = next(
            item
            for item in mutated["axis_mappings"]
            if item["mapping_id"] == "outbox_pending"
        )
        target["shared_bindings"] = [
            {
                "artifact_key": "connector_lifecycle_schema",
                "wire_json_path": "/processing",
                "schema_json_path": "/properties/processing",
                "value": "polling",
            }
        ]
        with self.assertRaisesRegex(validator.ValidationError, "product-local"):
            validator.validate_artifact(
                mutated,
                "unirouter.source-lifecycle-to-shared-axes",
                "invented-processing-projection",
            )

    def test_absent_tenant_identity_encoding_mutation_fails_closed(self) -> None:
        payload = validator.load_json_strict(
            self.mapping_dir / "source-snapshot-to-model-request-completed.v1.json"
        )
        mutated = copy.deepcopy(payload)
        mutated["envelope_construction"]["identity_rule"]["tenant_wire_rule"] = (
            "omit tenant bytes"
        )
        with self.assertRaisesRegex(validator.ValidationError, "absent-tenant LP rule"):
            validator.validate_artifact(
                mutated,
                "unirouter.source-snapshot-to-model-request-completed",
                "mutated-tenant-encoding",
            )

    def test_no_obsolete_boundary_wording_survives_deliverables(self) -> None:
        paths = list(self.mapping_dir.glob("*.json")) + [
            self.mapping_dir / "README.md",
            ROOT
            / "reviews"
            / "unirouter-source-owner-b9-release-candidate-2026-07-27.md",
        ]
        for path in paths:
            text = path.read_text(encoding="utf-8")
            validator.assert_no_legacy_text(text, str(path))

    def test_source_git_objects_when_explicitly_supplied(self) -> None:
        source_repo = os.environ.get("UNIROUTER_SOURCE_REPO")
        if not source_repo:
            self.skipTest("UNIROUTER_SOURCE_REPO not supplied")
        result = validator.validate_directory(
            self.mapping_dir,
            source_repo=Path(source_repo),
        )
        self.assertTrue(result["source_git_verified"])
        self.assertTrue(result["source_commit_verified"])
        self.assertTrue(result["source_tree_verified"])
        self.assertEqual(3, result["source_seed_bytes_verified"])
        self.assertGreater(result["source_evidence_paths_verified"], 0)

    def test_b8_git_objects_paths_and_values_when_explicitly_supplied(self) -> None:
        b8_repo = os.environ.get("B8_AUTHORITY_REPO")
        if not b8_repo:
            self.skipTest("B8_AUTHORITY_REPO not supplied")
        result = validator.validate_directory(
            self.mapping_dir,
            b8_repo=Path(b8_repo),
        )
        self.assertTrue(result["b8_git_verified"])
        self.assertTrue(result["b8_commit_verified"])
        self.assertTrue(result["b8_tree_verified"])
        self.assertEqual(13, result["b8_artifact_bytes_verified"])
        self.assertGreaterEqual(result["b8_json_path_bindings_verified"], 100)

    def test_exact_manifest_value_mismatch_fails_when_b8_supplied(self) -> None:
        b8_repo = os.environ.get("B8_AUTHORITY_REPO")
        if not b8_repo:
            self.skipTest("B8_AUTHORITY_REPO not supplied")
        artifacts = self._load_artifacts()
        identity = copy.deepcopy(
            artifacts["connector-identity-to-source-local.v1.json"]
        )
        identity["portable_connector"]["fields"][0]["value"] = "wrong.connector"
        artifacts["connector-identity-to-source-local.v1.json"] = identity
        with self.assertRaisesRegex(validator.ValidationError, "Manifest value mismatch"):
            validator.verify_b8_git(artifacts, Path(b8_repo))

    def test_exact_lifecycle_enum_mismatch_fails_when_b8_supplied(self) -> None:
        b8_repo = os.environ.get("B8_AUTHORITY_REPO")
        if not b8_repo:
            self.skipTest("B8_AUTHORITY_REPO not supplied")
        artifacts = self._load_artifacts()
        lifecycle = copy.deepcopy(
            artifacts["source-lifecycle-to-shared-axes.v1.json"]
        )
        target = next(
            item
            for item in lifecycle["axis_mappings"]
            if item["mapping_id"] == "project_connection_paused"
        )
        target["shared_bindings"][0]["value"] = "paused"
        artifacts["source-lifecycle-to-shared-axes.v1.json"] = lifecycle
        with self.assertRaisesRegex(validator.ValidationError, "violates Schema enum"):
            validator.verify_b8_git(artifacts, Path(b8_repo))

    def test_joint_candidate_when_explicitly_supplied(self) -> None:
        candidate = os.environ.get("JOINT_CANDIDATE_V3")
        if not candidate:
            self.skipTest("JOINT_CANDIDATE_V3 not supplied")
        self.assertTrue(validator.verify_joint_candidate(Path(candidate)))


if __name__ == "__main__":
    unittest.main()
