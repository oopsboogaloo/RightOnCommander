#!/usr/bin/env python3
"""Validation for the generated ship meshes. [tasks T1.1 done-when]

Asserts known vertex/edge/face counts for several ships and that every mesh is structurally
sound (edge and face-loop indices in range, loops are real polygons, normals are unit length).

Run standalone:  python3 tools/test_meshes.py
Also discoverable by pytest.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

MESH_DIR = Path(__file__).resolve().parent.parent / "src" / "content" / "meshes"

# Canonical bbcelite counts (vertices, edges, faces) for a spot-check of >= 2 ships.
KNOWN_COUNTS = {
    "sidewinder": (10, 15, 7),
    "viper": (15, 20, 7),
    "coriolis": (16, 28, 14),
    "krait": (17, 21, 6),
    "asteroid": (9, 21, 14),
    "splinter": (4, 6, 4),
    "canister": (10, 15, 7),
}


def _load(name: str) -> dict:
    return json.loads((MESH_DIR / f"{name}.json").read_text())


def test_known_counts() -> None:
    for name, (nv, ne, nf) in KNOWN_COUNTS.items():
        mesh = _load(name)
        assert len(mesh["vertices"]) == nv, f"{name}: vertices {len(mesh['vertices'])} != {nv}"
        assert len(mesh["edges"]) == ne, f"{name}: edges {len(mesh['edges'])} != {ne}"
        assert len(mesh["faces"]) == nf, f"{name}: faces {len(mesh['faces'])} != {nf}"


def test_all_meshes_structurally_valid() -> None:
    files = sorted(MESH_DIR.glob("*.json"))
    assert files, f"no meshes found in {MESH_DIR}"

    for f in files:
        mesh = json.loads(f.read_text())
        nv = len(mesh["vertices"])
        assert nv >= 3, f"{f.name}: too few vertices"

        # Vertices are normalised into the unit-ish box.
        for v in mesh["vertices"]:
            for axis in ("x", "y", "z"):
                assert -1.5 <= v[axis] <= 1.5, f"{f.name}: vertex {axis}={v[axis]} out of range"

        # Every edge references valid vertices.
        for a, b in mesh["edges"]:
            assert 0 <= a < nv and 0 <= b < nv, f"{f.name}: edge ({a},{b}) out of range"
            assert a != b, f"{f.name}: degenerate edge ({a},{b})"

        # Every face loop is a real polygon with in-range, distinct indices and a unit normal.
        for i, face in enumerate(mesh["faces"]):
            loop = face["loop"]
            assert len(loop) >= 3, f"{f.name}: face {i} loop too short: {loop}"
            assert len(set(loop)) == len(loop), f"{f.name}: face {i} loop has duplicates: {loop}"
            for idx in loop:
                assert 0 <= idx < nv, f"{f.name}: face {i} index {idx} out of range"
            n = face["normal"]
            mag = math.sqrt(n["x"] ** 2 + n["y"] ** 2 + n["z"] ** 2)
            assert abs(mag - 1.0) < 1e-3, f"{f.name}: face {i} normal not unit ({mag})"


if __name__ == "__main__":
    test_known_counts()
    test_all_meshes_structurally_valid()
    print("All mesh checks passed.")
