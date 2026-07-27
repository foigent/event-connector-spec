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

    def test_repository_mapping_candidates_validate(self) -> None:
        result = validator.validate_directory(self.mapping_dir)
        self.assertEqual("ok", result["status"])
        self.assertEqual(4, result["artifact_count"])
        self.assertEqual(28, result["field_mapping_count"])
        self.assertEqual(21, result["lifecycle_mapping_count"])
        self.assertEqual(5, result["source_identity_mapping_count"])
        self.assertEqual(3, result["source_seed_count"])
        self.assertFalse(result["source_git_verified"])

    def test_strict_loader_rejects_duplicate_keys(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "duplicate.json"
            path.write_text('{"artifact_kind":"first","artifact_kind":"second"}\n', encoding="utf-8")
            with self.assertRaisesRegex(validator.ValidationError, "duplicate JSON key"):
                validator.load_json_strict(path)

    def test_seed_identity_mutation_fails_closed(self) -> None:
        path = self.mapping_dir / "source-contract-seeds.v1.json"
        payload = validator.load_json_strict(path)
        mutated = copy.deepcopy(payload)
        mutated["seeds"][0]["sha256"] = "0" * 64
        with self.assertRaisesRegex(validator.ValidationError, "wrong identity"):
            validator.validate_artifact(
                mutated,
                "unirouter.source-contract-seeds",
                "mutated-seeds",
            )

    def test_b8_schema_invention_is_rejected_as_unknown_mapping_key(self) -> None:
        path = self.mapping_dir / "source-snapshot-to-model-request-completed.v1.json"
        payload = validator.load_json_strict(path)
        mutated = copy.deepcopy(payload)
        mutated["event_envelope_schema"] = {"type": "object"}
        with self.assertRaisesRegex(validator.ValidationError, "key mismatch"):
            validator.validate_artifact(
                mutated,
                "unirouter.source-snapshot-to-model-request-completed",
                "invented-b8",
            )

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

    def test_joint_candidate_when_explicitly_supplied(self) -> None:
        candidate = os.environ.get("JOINT_CANDIDATE_V3")
        if not candidate:
            self.skipTest("JOINT_CANDIDATE_V3 not supplied")
        self.assertTrue(validator.verify_joint_candidate(Path(candidate)))


if __name__ == "__main__":
    unittest.main()
