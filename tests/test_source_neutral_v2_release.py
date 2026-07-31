from __future__ import annotations

import copy
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import validate_source_neutral_v2_candidate as candidate  # noqa: E402
import validate_source_neutral_v2_release as release  # noqa: E402


class SourceNeutralV2ReleaseTests(unittest.TestCase):
    def test_repository_release_content_validates(self) -> None:
        result = release.validate()
        self.assertEqual("pass", result["status"])
        self.assertEqual("2.0.0", result["protocol_version"])
        self.assertEqual("binding", result["protocol_status"])
        self.assertEqual(60, result["candidate_components_verified"])
        self.assertEqual(57, result["predecessor_components_verified"])
        self.assertEqual(10, result["v1_m0_id_hash_pairs"])
        self.assertEqual(8, result["v1_gap_rows"])
        self.assertEqual(2, result["v1_provenance_ids"])
        self.assertEqual(5, result["openinference_m0_id_hash_pairs"])
        self.assertEqual(4, result["openinference_gap_events"])
        self.assertEqual(83, result["conformance_cases"])
        self.assertEqual(29, result["conformance_classes"])
        self.assertEqual("not_authorized", result["product_migration"])
        self.assertEqual("none", result["runtime_mutation"])

    def test_binding_status_mutation_fails_closed(self) -> None:
        path = ROOT / "vectors/source-neutral-vector-bundle.v2.json"
        vector = copy.deepcopy(candidate.load_json_strict(path))
        vector["protocol_status"] = "not_binding"
        self.assertNotEqual("binding", vector["protocol_status"])
        with self.assertRaisesRegex(candidate.ValidationError, "binding vector changed"):
            original = release.BINDING_VECTOR_SHA
            try:
                release.BINDING_VECTOR_SHA = "sha256:" + ("0" * 64)
                release.verify_binding_artifacts()
            finally:
                release.BINDING_VECTOR_SHA = original

    def test_openinference_identity_mutation_fails_closed(self) -> None:
        path = (
            ROOT
            / "compatibility/foigent-openinference-bounded-export-1.0.0-to-xinsight-m0.1.json"
        )
        matrix = copy.deepcopy(candidate.load_json_strict(path))
        matrix["current_m0_compatibility_seed"]["main_event"]["event_hash"] = (
            "sha256:" + ("0" * 64)
        )
        with self.assertRaisesRegex(
            candidate.ValidationError,
            "OpenInference M0 ids or hashes changed",
        ):
            candidate.verify_openinference_compatibility(matrix)

    def test_product_migration_gate_mutation_fails_closed(self) -> None:
        path = (
            ROOT
            / "compatibility/foigent-openinference-bounded-export-1.0.0-to-xinsight-m0.1.json"
        )
        matrix = copy.deepcopy(candidate.load_json_strict(path))
        matrix["product_migration_gate"]["status"] = "ready"
        with self.assertRaisesRegex(candidate.ValidationError, "migration gate opened"):
            candidate.verify_openinference_compatibility(matrix)

    def test_candidate_archive_remains_exact_and_non_binding(self) -> None:
        self.assertEqual(60, release.verify_candidate_archive())

    def test_control_error_spec_drift_fails_closed(self) -> None:
        spec = (ROOT / "spec/protocol-v2.md").read_text(encoding="utf-8")
        drifted = spec.replace(
            "`pause`/`resume`/`start`/`rotate`, and `shutdown`",
            "`pause`, and `shutdown`",
        )
        self.assertNotEqual(spec, drifted)
        with self.assertRaisesRegex(
            candidate.ValidationError,
            "control Error phase mapping changed",
        ):
            release.verify_control_error_spec(drifted)


if __name__ == "__main__":
    unittest.main()
