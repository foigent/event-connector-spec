from __future__ import annotations

import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import validate_source_neutral_v2_candidate as semantic_candidate  # noqa: E402
import validate_source_neutral_v2_0_2_candidate as release  # noqa: E402


class SourceNeutralV202CandidateTests(unittest.TestCase):
    def test_repository_candidate_validates(self) -> None:
        result = release.validate()
        self.assertEqual("pass", result["status"])
        self.assertEqual("2.0.2", result["protocol_version"])
        self.assertEqual(
            "release_content_candidate_not_binding",
            result["protocol_status"],
        )
        self.assertEqual("2.0.1", result["semantic_base_version"])
        self.assertEqual(
            "patch_compatible_ci_portability_fix",
            result["compatibility"],
        )
        self.assertEqual(94, result["immediate_predecessor_components_verified"])
        self.assertGreaterEqual(result["candidate_components_verified"], 100)
        self.assertGreaterEqual(
            result["preserved_predecessor_components_verified"],
            85,
        )
        self.assertEqual(10, result["v1_m0_id_hash_pairs"])
        self.assertEqual(8, result["v1_gap_rows"])
        self.assertEqual(2, result["v1_provenance_ids"])
        self.assertEqual(5, result["openinference_m0_id_hash_pairs"])
        self.assertEqual(4, result["openinference_gap_events"])
        self.assertEqual(83, result["conformance_cases"])
        self.assertEqual(29, result["conformance_classes"])
        self.assertEqual("not_authorized", result["product_migration"])
        self.assertEqual("none", result["runtime_mutation"])

    def test_semantic_component_mutation_fails_closed(self) -> None:
        predecessor = semantic_candidate.load_json_strict(
            ROOT / release.PREDECESSOR_PATH
        )
        target = predecessor["components"]["event_envelope_schema"]["path"]

        def drifted_sha(path: Path) -> str:
            if path == ROOT / target:
                return "sha256:" + ("0" * 64)
            return semantic_candidate.sha256(path)

        with self.assertRaisesRegex(
            semantic_candidate.ValidationError,
            "changed preserved v2.0.1 component: event_envelope_schema",
        ):
            release.verify_patch_compatibility(drifted_sha)

    def test_v1_1_2_current_compatibility_allowlist_is_narrow(self) -> None:
        self.assertEqual(
            {"authority_ci_workflow"},
            release.V1_1_2_CURRENT_TREE_PATCH_COMPONENTS,
        )
        self.assertEqual(56, release.verify_v1_1_2_current_compatibility())

        target = ROOT / "schemas/event-envelope.v1.schema.json"

        def drifted_sha(path: Path) -> str:
            if path == target:
                return "sha256:" + ("0" * 64)
            return semantic_candidate.sha256(path)

        with self.assertRaisesRegex(
            semantic_candidate.ValidationError,
            "v1.1.2 current compatibility changed: schemas/event-envelope.v1.schema.json",
        ):
            release.verify_v1_1_2_current_compatibility(drifted_sha)

    def test_candidate_is_non_binding_and_has_no_product_authority(self) -> None:
        manifest = semantic_candidate.load_json_strict(ROOT / release.CANDIDATE_PATH)
        self.assertEqual("not_binding", manifest["protocol_status"])
        self.assertFalse(manifest["boundary"]["binding_release"])
        self.assertEqual("absent", manifest["boundary"]["immutable_tag"])
        self.assertEqual(
            "not_authorized",
            manifest["boundary"]["product_adoption"],
        )
        self.assertEqual("none", manifest["boundary"]["runtime_mutation"])
        self.assertEqual(
            {
                "source_domain_owner": "candidate_confirmed_non_binding",
                "projection_owner": "candidate_confirmed_non_binding",
                "coordinator": "candidate_confirmed_non_binding",
            },
            manifest["approvals"],
        )


if __name__ == "__main__":
    unittest.main()
