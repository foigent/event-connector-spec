from __future__ import annotations

import copy
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import validate_source_neutral_v2_candidate as validator  # noqa: E402
import validate_source_neutral_v2_release as release_validator  # noqa: E402


class SourceNeutralV2CandidateTests(unittest.TestCase):
    def test_exact_candidate_archive_remains_non_binding(self) -> None:
        self.assertEqual(66, release_validator.verify_candidate_archive())

    def test_strict_loader_rejects_nested_duplicate_keys(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "duplicate.json"
            path.write_text(
                '{"outer":{"field":"first","field":"second"}}\n',
                encoding="utf-8",
            )
            with self.assertRaisesRegex(
                validator.ValidationError,
                "duplicate JSON key",
            ):
                validator.load_json_strict(path)

    def test_openinference_event_identity_mutation_fails_closed(self) -> None:
        path = (
            ROOT
            / "compatibility/foigent-openinference-bounded-export-1.0.0-to-xinsight-m0.1.json"
        )
        matrix = copy.deepcopy(validator.load_json_strict(path))
        matrix["current_m0_compatibility_seed"]["main_event"]["event_hash"] = (
            "sha256:" + ("0" * 64)
        )
        with self.assertRaisesRegex(
            validator.ValidationError,
            "OpenInference M0 ids or hashes changed",
        ):
            validator.verify_openinference_compatibility(matrix)

    def test_product_migration_gate_mutation_fails_closed(self) -> None:
        path = (
            ROOT
            / "compatibility/foigent-openinference-bounded-export-1.0.0-to-xinsight-m0.1.json"
        )
        matrix = copy.deepcopy(validator.load_json_strict(path))
        matrix["product_migration_gate"]["status"] = "ready"
        with self.assertRaisesRegex(
            validator.ValidationError,
            "migration gate opened",
        ):
            validator.verify_openinference_compatibility(matrix)


if __name__ == "__main__":
    unittest.main()
