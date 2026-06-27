#!/usr/bin/env python3
"""bbcelite_to_mesh.py — convert bbcelite ship blueprints into mesh JSON. [tasks T1.1, design §16]

Parses the ``VERTEX`` / ``EDGE`` / ``FACE`` macro blueprints used by Mark Moxon's annotated
BBC Elite source (https://www.bbcelite.com), normalises the Elite ±255 coordinate box, and
emits ``src/content/meshes/<ship>.json`` for the software-3D renderer.

Elite blueprints store a normal per face but *no* explicit vertex loop, so this tool
reconstructs each face's polygon from the boundary edges that reference it (edges whose two
face fields differ), ordering the vertices around the face plane and winding them to agree
with the stored normal — which is what the renderer's back-face cull and painter sort need.

Provenance: the geometry derives from Acornsoft Elite (1984, Bell & Braben) via the bbcelite
project. It is used here as homage; see tasks.md T9.6 for the IP/licensing sanity-check.

Run offline; the JSON output is committed data that the sim loads.
"""

from __future__ import annotations

import argparse
import json
import math
import re
from pathlib import Path

# Map the Elite ±255 coordinate box into roughly [-1, 1], preserving relative ship sizes.
NORM_DIVISOR = 255.0
FLOAT_PRECISION = 6

# Default manifest: output mesh name -> bbcelite ship label root.
DEFAULT_SHIPS: dict[str, str] = {
    "sidewinder": "SHIP_SIDEWINDER",
    "cobra_mk3": "SHIP_COBRA_MK_3",
    "asp_mk2": "SHIP_ASP_MK_2",
    "fer_de_lance": "SHIP_FER_DE_LANCE",
    "krait": "SHIP_KRAIT",
    "mamba": "SHIP_MAMBA",
    "gecko": "SHIP_GECKO",
    "adder": "SHIP_ADDER",
    "viper": "SHIP_VIPER",
    "coriolis": "SHIP_CORIOLIS",
    "thargoid": "SHIP_THARGOID",
}

_VERTICES_LABEL = re.compile(r"^\.(SHIP_[A-Z0-9_]+)_VERTICES\s*$")

Vec3 = tuple[float, float, float]


class Blueprint:
    """Raw parsed blueprint for one ship (integer values straight from the macros)."""

    def __init__(self, root: str) -> None:
        self.root = root
        self.vertices: list[tuple[int, ...]] = []  # (x, y, z, f1, f2, f3, f4, vis)
        self.edges: list[tuple[int, ...]] = []  # (v1, v2, f1, f2, vis)
        self.faces: list[tuple[int, ...]] = []  # (nx, ny, nz, vis)


def _macro_args(line: str, keyword: str) -> list[int] | None:
    """Return the integer arguments of a VERTEX/EDGE/FACE macro line, or None."""
    code = line.split("\\", 1)[0].strip()  # drop the trailing "\ comment"
    if not code.startswith(keyword):
        return None
    rest = code[len(keyword):].strip()
    if not rest:
        return None
    return [int(tok.strip()) for tok in rest.split(",") if tok.strip() != ""]


def parse_blueprints(text: str) -> dict[str, Blueprint]:
    """Extract every ship blueprint from a blob of bbcelite assembly source."""
    lines = text.splitlines()
    ships: dict[str, Blueprint] = {}

    for start, line in enumerate(lines):
        m = _VERTICES_LABEL.match(line.strip())
        if not m:
            continue
        root = m.group(1)
        if root in ships:
            continue  # first occurrence wins (ships repeat across disc cargo files)
        ships[root] = _parse_one(lines, start, root)

    return ships


def _parse_one(lines: list[str], start: int, root: str) -> Blueprint:
    bp = Blueprint(root)
    edges_label = f".{root}_EDGES"
    faces_label = f".{root}_FACES"
    section = "V"

    for raw in lines[start + 1:]:
        stripped = raw.strip()
        if stripped == edges_label:
            section = "E"
            continue
        if stripped == faces_label:
            section = "F"
            continue
        if stripped.startswith("."):
            break  # reached the next labelled block — this ship is done

        if section == "V":
            args = _macro_args(stripped, "VERTEX")
            if args is not None:
                bp.vertices.append(tuple(args))
        elif section == "E":
            args = _macro_args(stripped, "EDGE")
            if args is not None:
                bp.edges.append(tuple(args))
        else:
            args = _macro_args(stripped, "FACE")
            if args is not None:
                bp.faces.append(tuple(args))

    return bp


# --- small vector helpers ----------------------------------------------------

def _sub(a: Vec3, b: Vec3) -> Vec3:
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def _cross(a: Vec3, b: Vec3) -> Vec3:
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def _dot(a: Vec3, b: Vec3) -> float:
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def _length(a: Vec3) -> float:
    return math.sqrt(_dot(a, a))


def _normalize(a: Vec3) -> Vec3:
    n = _length(a)
    return (a[0] / n, a[1] / n, a[2] / n) if n > 0 else (0.0, 0.0, 0.0)


def _newell_normal(loop: list[int], pts: list[Vec3]) -> Vec3:
    """Robust polygon normal via Newell's method (handles non-planar slop)."""
    nx = ny = nz = 0.0
    m = len(loop)
    for i in range(m):
        a = pts[loop[i]]
        b = pts[loop[(i + 1) % m]]
        nx += (a[1] - b[1]) * (a[2] + b[2])
        ny += (a[2] - b[2]) * (a[0] + b[0])
        nz += (a[0] - b[0]) * (a[1] + b[1])
    return (nx, ny, nz)


def _face_loop(face_index: int, bp: Blueprint, pts: list[Vec3], normal: Vec3) -> list[int]:
    """Reconstruct the ordered vertex loop of a face from its boundary edges."""
    vids: set[int] = set()
    for v1, v2, f1, f2, _vis in bp.edges:
        if f1 == f2:
            continue  # decorative edge lying within a single face — not a boundary
        if f1 == face_index or f2 == face_index:
            vids.add(v1)
            vids.add(v2)
    if len(vids) < 3:
        # Fallback: vertices that list this face in their membership fields.
        vids = {i for i, v in enumerate(bp.vertices) if face_index in v[3:7]}
    if len(vids) < 3:
        return sorted(vids)

    members = sorted(vids)
    centroid = (
        sum(pts[i][0] for i in members) / len(members),
        sum(pts[i][1] for i in members) / len(members),
        sum(pts[i][2] for i in members) / len(members),
    )

    n = _normalize(normal)
    if n == (0.0, 0.0, 0.0):
        n = _normalize(_newell_normal(members, pts))

    # Build an in-plane basis (u, v) perpendicular to the normal.
    ref = (1.0, 0.0, 0.0) if abs(n[0]) < 0.9 else (0.0, 1.0, 0.0)
    u = _normalize(_cross(n, ref))
    v = _cross(n, u)

    def angle(i: int) -> float:
        rel = _sub(pts[i], centroid)
        return math.atan2(_dot(rel, v), _dot(rel, u))

    ordered = sorted(members, key=angle)

    # Wind so the loop's geometric normal agrees with the (stored) face normal.
    if _dot(_newell_normal(ordered, pts), n) < 0:
        ordered.reverse()

    return ordered


def _round(x: float) -> float:
    r = round(x, FLOAT_PRECISION)
    return 0.0 if r == 0 else r  # avoid "-0.0" in JSON


def build_mesh(name: str, bp: Blueprint) -> dict:
    """Turn a raw blueprint into the renderer's mesh JSON structure."""
    pts: list[Vec3] = [(v[0], v[1], v[2]) for v in bp.vertices]

    vertices = [
        {"x": _round(x / NORM_DIVISOR), "y": _round(y / NORM_DIVISOR), "z": _round(z / NORM_DIVISOR)}
        for (x, y, z) in pts
    ]
    edges = [[e[0], e[1]] for e in bp.edges]

    faces = []
    for fi, (nx, ny, nz, _vis) in enumerate(bp.faces):
        normal = _normalize((float(nx), float(ny), float(nz)))
        loop = _face_loop(fi, bp, pts, (float(nx), float(ny), float(nz)))
        if normal == (0.0, 0.0, 0.0):
            normal = _normalize(_newell_normal(loop, pts))
        faces.append(
            {
                "loop": loop,
                "normal": {"x": _round(normal[0]), "y": _round(normal[1]), "z": _round(normal[2])},
            }
        )

    return {
        "name": name,
        "source": f"bbcelite {bp.root}",
        "vertices": vertices,
        "edges": edges,
        "faces": faces,
    }


def load_sources(paths: list[Path]) -> dict[str, Blueprint]:
    files: list[Path] = []
    for p in sorted(paths):
        if p.is_dir():
            files.extend(sorted(p.glob("*.asm")))
        else:
            files.append(p)
    merged: dict[str, Blueprint] = {}
    for f in files:
        for root, bp in parse_blueprints(f.read_text()).items():
            merged.setdefault(root, bp)
    return merged


def main() -> int:
    repo = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(description="Convert bbcelite blueprints to mesh JSON.")
    parser.add_argument(
        "inputs",
        nargs="*",
        type=Path,
        default=[repo / "tools" / "blueprints"],
        help="Blueprint .asm files or directories (default: tools/blueprints/).",
    )
    parser.add_argument(
        "-o",
        "--out",
        type=Path,
        default=repo / "src" / "content" / "meshes",
        help="Output directory for mesh JSON (default: src/content/meshes/).",
    )
    args = parser.parse_args()

    blueprints = load_sources(args.inputs)
    args.out.mkdir(parents=True, exist_ok=True)

    missing = []
    for name, root in DEFAULT_SHIPS.items():
        bp = blueprints.get(root)
        if bp is None:
            missing.append(f"{name} ({root})")
            continue
        mesh = build_mesh(name, bp)
        (args.out / f"{name}.json").write_text(json.dumps(mesh, indent=2) + "\n")
        print(f"  {name:14s} {len(mesh['vertices']):3d} vertices  "
              f"{len(mesh['edges']):3d} edges  {len(mesh['faces']):3d} faces")

    if missing:
        print("MISSING blueprints: " + ", ".join(missing))
        return 1
    print(f"Wrote {len(DEFAULT_SHIPS)} meshes to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
