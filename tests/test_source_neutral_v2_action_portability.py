from __future__ import annotations

import re
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class SourceNeutralV2ActionPortabilityTests(unittest.TestCase):
    def test_generic_ci_uses_only_current_v1_compatibility_scope(self) -> None:
        workflow = (ROOT / ".github/workflows/ci.yml").read_text()
        self.assertIn("run-v1-compatibility-current-kit.sh", workflow)
        self.assertNotIn("run-conformance-kit.sh", workflow)

    def test_composite_action_uses_snapshot_safe_consumer_kit(self) -> None:
        action = (ROOT / "actions/source-neutral-v2/action.yml").read_text()
        self.assertIn("run-source-neutral-v2-consumer-kit.sh", action)
        self.assertNotIn("run-source-neutral-v2-release-kit.sh", action)
        self.assertIn("--release", action)

    def test_snapshot_safe_kits_have_no_git_dependency(self) -> None:
        for relative in [
            "scripts/run-source-neutral-v2-consumer-kit.sh",
            "scripts/run-source-neutral-v2-current-release-kit.sh",
        ]:
            script = (ROOT / relative).read_text()
            self.assertIsNone(
                re.search(r"(^|[^a-zA-Z0-9_-])git([^-a-zA-Z0-9_]|$)", script),
                relative,
            )
            self.assertNotIn("predecessor-kit.sh", script)
        current = (
            ROOT / "scripts/run-source-neutral-v2-current-release-kit.sh"
        ).read_text()
        self.assertIn("build-source-neutral-v2-release-manifest.mjs", current)
        self.assertIn("run-v1-compatibility-current-kit.sh", current)

    def test_authority_release_kit_retains_predecessor_history(self) -> None:
        release = (
            ROOT / "scripts/run-source-neutral-v2-release-kit.sh"
        ).read_text()
        self.assertIn("run-v1.1.2-predecessor-kit.sh", release)
        self.assertIn("run-v2.0.0-predecessor-kit.sh", release)
        self.assertIn("run-v2.0.1-predecessor-kit.sh", release)
        self.assertIn("run-source-neutral-v2-current-release-kit.sh", release)

    def test_shell_entrypoints_parse(self) -> None:
        for relative in [
            "scripts/run-source-neutral-v2-consumer-kit.sh",
            "scripts/run-source-neutral-v2-current-release-kit.sh",
            "scripts/run-v1-compatibility-current-kit.sh",
            "scripts/run-source-neutral-v2-action-snapshot-kit.sh",
            "scripts/run-v2.0.1-predecessor-kit.sh",
            "scripts/run-source-neutral-v2-release-kit.sh",
        ]:
            subprocess.run(
                ["bash", "-n", str(ROOT / relative)],
                check=True,
                cwd=ROOT,
            )


if __name__ == "__main__":
    unittest.main()
