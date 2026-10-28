#!/usr/bin/env python3
"""Validate source tone settings. Standard library only; not hosted CMS verification."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

PRESETS = frozenset(("noktern", "balansert", "spiss", "spissplus"))
OVERRIDES = PRESETS | frozenset(("inherit",))
ROLES = ("heroPreset", "servicePreset", "explanationPreset", "faqPreset")
REQUIRED = frozenset(("defaultPreset", *ROLES))
ALLOWED = REQUIRED | {"editorNotes"}


def validate_settings(config: object) -> list[str]:
    """Return errors without changing the input. An unrecognized field is invalid."""
    if not isinstance(config, dict):
        return ["Config must be a JSON object"]
    errors: list[str] = []
    missing = REQUIRED - config.keys()
    unknown = config.keys() - ALLOWED
    if missing:
        errors.append("Missing keys: " + ", ".join(sorted(missing)))
    if unknown:
        errors.append("Unknown keys: " + ", ".join(sorted(unknown)))
    if not isinstance(config.get("defaultPreset"), str) or config.get("defaultPreset") not in PRESETS:
        errors.append("defaultPreset must be noktern, balansert, spiss or spissplus")
    for role in ROLES:
        if not isinstance(config.get(role), str) or config.get(role) not in OVERRIDES:
            errors.append(role + " must be inherit or a supported preset")
    note = config.get("editorNotes")
    # Optional CMS text may be omitted, null or empty after clearing it.
    if note is not None and (not isinstance(note, str) or len(note) > 2000):
        errors.append("editorNotes must be null or text <= 2000 characters")
    return errors


def resolved_preset(config: dict[str, str | None], role: str) -> str:
    """Resolve an editorial preference, not permission to use it in sensitive copy."""
    if role not in ROLES:
        raise ValueError("Unknown role: " + role)
    errors = validate_settings(config)
    if errors:
        raise ValueError("; ".join(errors))
    value = config[role]
    return config["defaultPreset"] if value == "inherit" else value


def unique_object(pairs: list[tuple[str, object]]) -> dict[str, object]:
    """Reject ambiguous JSON settings instead of silently keeping the last value."""
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON key: " + key)
        result[key] = value
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate Git-backed editorial tone settings")
    parser.add_argument("config", type=Path, help="Path to CONTENT-TONE.json")
    args = parser.parse_args()
    try:
        data = json.loads(args.config.read_text(encoding="utf-8"), object_pairs_hook=unique_object)
    except (OSError, ValueError) as exc:
        print("FAIL:", exc)
        return 1
    errors = validate_settings(data)
    if errors:
        print("FAIL:", "; ".join(errors))
        return 1
    print("PASS: valid tone settings; content is not automatically rewritten")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
