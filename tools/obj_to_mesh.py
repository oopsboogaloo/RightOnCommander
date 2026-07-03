#!/usr/bin/env python3
"""obj_to_mesh.py — convert a Blender-authored Wavefront OBJ into the renderer's mesh JSON.

The bbcelite hulls come from `bbcelite_to_mesh.py`; this is the companion for *bespoke* hulls we
model ourselves (e.g. the rock-hermit boss, which has no Elite blueprint — the original game just
reused the asteroid). It reads an `.obj` exported from Blender, maps it into the game's axes,
normalises it into the unit-ish box the renderer expects, and emits the same
`{vertices, edges, faces:{loop,normal}, details}` schema as the generated ships.

Keep the source model low-poly and FLAT-SHADED (Elite style): the renderer draws every edge of
every visible face, so triangulated or subdivided models turn into a mess of wire. Export OBJ with
**Triangulate Faces OFF** so quads / n-gons survive as single flat panels. Model the docking bay as
real geometry (a recessed pocket) rather than a painted outline so it survives as wireframe.

Game axes: +x right, +y up, +z forward (up-screen, away from the player); the player-facing
direction is -z. Blender's default OBJ export is already Y-up, so vertices usually come in with the
right up-axis; use --rotx/--roty/--rotz (degrees, applied X then Y then Z) to aim the docking bay
toward the player (-z), and preview to confirm.

Run offline; the JSON output is committed data the sim loads.

    python3 tools/obj_to_mesh.py hermit.obj --name rock_hermit --roty 180
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

FLOAT_PRECISION = 6
MESH_DIR = Path(__file__).resolve().parent.parent / "src" / "content" / "meshes"

Vec = tuple[float, float, float]


# ---- OBJ parsing ------------------------------------------------------------------------------

def parse_obj(text: str) -> tuple[list[Vec], list[list[int]], list[tuple[int, int]]]:
    """Return (vertices, face-loops, line-segments) with 0-based vertex indices.

    `f` polygons become face loops (any length ≥ 3). `l` polylines become explicit line segments,
    offered as decorative `details`. Texture/normal indices in `v/vt/vn` face refs are ignored.
    """
    verts: list[Vec] = []
    faces: list[list[int]] = []
    lines: list[tuple[int, int]] = []

    def idx(token: str) -> int:
        i = int(token.split("/")[0])
        return i - 1 if i > 0 else len(verts) + i  # OBJ allows negative (relative) indices

    for raw in text.splitlines():
        s = raw.strip()
        if not s or s.startswith("#"):
            continue
        tag, *rest = s.split()
        if tag == "v" and len(rest) >= 3:
            verts.append((float(rest[0]), float(rest[1]), float(rest[2])))
        elif tag == "f" and len(rest) >= 3:
            faces.append([idx(t) for t in rest])
        elif tag == "l" and len(rest) >= 2:
            pts = [idx(t) for t in rest]
            for a, b in zip(pts, pts[1:]):
                lines.append((a, b))
    return verts, faces, lines


# ---- geometry ---------------------------------------------------------------------------------

def rotate(v: Vec, rx: float, ry: float, rz: float) -> Vec:
    x, y, z = v
    for axis, ang in (("x", rx), ("y", ry), ("z", rz)):
        if ang == 0.0:
            continue
        c, s = math.cos(ang), math.sin(ang)
        if axis == "x":
            y, z = y * c - z * s, y * s + z * c
        elif axis == "y":
            x, z = x * c + z * s, -x * s + z * c
        else:
            x, y = x * c - y * s, x * s + y * c
    return (x, y, z)


def normalise(verts: list[Vec], target: float) -> list[Vec]:
    """Centre on the bounding-box middle and scale so the largest half-extent == `target`."""
    lo = [min(v[i] for v in verts) for i in range(3)]
    hi = [max(v[i] for v in verts) for i in range(3)]
    mid = [(lo[i] + hi[i]) / 2 for i in range(3)]
    half = max((hi[i] - lo[i]) / 2 for i in range(3)) or 1.0
    k = target / half
    return [tuple((v[i] - mid[i]) * k for i in range(3)) for v in verts]


def recess_direction(verts: list[Vec], frac: float = 0.72) -> Vec:
    """Unit direction of the docking bay: the mean direction of the recessed (pulled-in) vertices.

    A modelled bay is a pocket, so its rim/floor vertices sit well inside the hull radius; their
    average direction from the centre is where the bay opening points.
    """
    rad = [math.sqrt(sum(c * c for c in v)) for v in verts]
    rmax = max(rad) or 1.0
    inward = [verts[i] for i in range(len(verts)) if rad[i] < rmax * frac]
    if not inward:
        raise SystemExit("obj_to_mesh: --align-recess found no recess (no pulled-in vertices)")
    d = [sum(v[i] for v in inward) / len(inward) for i in range(3)]
    mag = math.sqrt(sum(c * c for c in d)) or 1.0
    return (d[0] / mag, d[1] / mag, d[2] / mag)


def align_to(verts: list[Vec], src: Vec, dst: Vec) -> list[Vec]:
    """Rotate every vertex by the rotation that maps unit `src` onto unit `dst` (Rodrigues)."""
    dot = sum(src[i] * dst[i] for i in range(3))
    if dot > 0.999999:
        return verts
    axis = (
        src[1] * dst[2] - src[2] * dst[1],
        src[2] * dst[0] - src[0] * dst[2],
        src[0] * dst[1] - src[1] * dst[0],
    )
    amag = math.sqrt(sum(c * c for c in axis))
    if amag < 1e-9:  # antiparallel: pick any perpendicular axis for the 180° turn
        axis = (1.0, 0.0, 0.0) if abs(src[0]) < 0.9 else (0.0, 1.0, 0.0)
        axis = (
            src[1] * axis[2] - src[2] * axis[1],
            src[2] * axis[0] - src[0] * axis[2],
            src[0] * axis[1] - src[1] * axis[0],
        )
        amag = math.sqrt(sum(c * c for c in axis))
    kx, ky, kz = (c / amag for c in axis)
    ang = math.acos(max(-1.0, min(1.0, dot)))
    c, s = math.cos(ang), math.sin(ang)
    out: list[Vec] = []
    for v in verts:  # v*c + (k×v)*s + k*(k·v)*(1-c)
        kv = kx * v[0] + ky * v[1] + kz * v[2]
        cross = (ky * v[2] - kz * v[1], kz * v[0] - kx * v[2], kx * v[1] - ky * v[0])
        out.append(tuple(v[i] * c + cross[i] * s + (kx, ky, kz)[i] * kv * (1 - c) for i in range(3)))
    return out


def face_normal(loop: list[int], verts: list[Vec], flip: bool) -> Vec:
    """Unit normal from the loop winding (Newell's method — robust for non-planar n-gons)."""
    nx = ny = nz = 0.0
    for a, b in zip(loop, loop[1:] + loop[:1]):
        ax, ay, az = verts[a]
        bx, by, bz = verts[b]
        nx += (ay - by) * (az + bz)
        ny += (az - bz) * (ax + bx)
        nz += (ax - bx) * (ay + by)
    mag = math.sqrt(nx * nx + ny * ny + nz * nz) or 1.0
    s = (-1.0 if flip else 1.0) / mag
    return (nx * s, ny * s, nz * s)


def unique_edges(faces: list[list[int]]) -> list[tuple[int, int]]:
    seen: set[tuple[int, int]] = set()
    out: list[tuple[int, int]] = []
    for loop in faces:
        for a, b in zip(loop, loop[1:] + loop[:1]):
            key = (a, b) if a < b else (b, a)
            if a != b and key not in seen:
                seen.add(key)
                out.append(key)
    return out


def find_detail_face(seg: tuple[int, int], faces: list[list[int]], verts: list[Vec]) -> int:
    """Which face plane a decorative line segment lies on (for cull-aware drawing); 0 if unclear."""
    a, b = verts[seg[0]], verts[seg[1]]
    best, best_err = 0, float("inf")
    for fi, loop in enumerate(faces):
        n = face_normal(loop, verts, False)
        p0 = verts[loop[0]]
        da = sum(n[i] * (a[i] - p0[i]) for i in range(3))
        db = sum(n[i] * (b[i] - p0[i]) for i in range(3))
        err = abs(da) + abs(db)
        if err < best_err:
            best, best_err = fi, err
    return best if best_err < 1e-3 else 0


# ---- emit -------------------------------------------------------------------------------------

def r(x: float) -> float:
    x = round(x, FLOAT_PRECISION)
    return 0.0 if x == 0 else x  # avoid "-0.0"


def build_mesh(args: argparse.Namespace) -> dict:
    verts, faces, lines = parse_obj(Path(args.input).read_text())
    if not faces:
        raise SystemExit("obj_to_mesh: no `f` faces found — export with faces, not just edges")

    rx, ry, rz = (math.radians(a) for a in (args.rotx, args.roty, args.rotz))
    verts = [rotate(v, rx, ry, rz) for v in verts]
    verts = normalise(verts, args.target_extent)
    if args.align_recess:
        # Aim the docking bay at the player (world -z) and centre it on the roll axis, so it stays
        # put and faces forward as the hull rolls (bank). [ROC-DCKG-3]
        verts = align_to(verts, recess_direction(verts), (0.0, 0.0, -1.0))

    edges = unique_edges(faces)
    mesh_faces = [
        {"loop": loop, "normal": dict(zip("xyz", (r(c) for c in face_normal(loop, verts, args.flip_normals))))}
        for loop in faces
    ]
    details = [
        {"edge": list(seg), "faces": [fi, fi]}
        for seg in lines
        for fi in [find_detail_face(seg, faces, verts)]
    ]
    return {
        "name": args.name,
        "source": args.source or f"blender {Path(args.input).name}",
        "vertices": [{"x": r(v[0]), "y": r(v[1]), "z": r(v[2])} for v in verts],
        "edges": [list(e) for e in edges],
        "faces": mesh_faces,
        "details": details,
    }


def main() -> None:
    ap = argparse.ArgumentParser(description="Convert a Blender OBJ into renderer mesh JSON.")
    ap.add_argument("input", help="input .obj (Triangulate Faces OFF)")
    ap.add_argument("--name", required=True, help="mesh name / output basename")
    ap.add_argument("--out", help="output path (default src/content/meshes/<name>.json)")
    ap.add_argument("--source", help="provenance string stored in the mesh")
    ap.add_argument("--target-extent", type=float, default=0.313725,
                    help="largest half-extent after normalising (default matches the asteroid)")
    ap.add_argument("--rotx", type=float, default=0.0, help="degrees about X, applied first")
    ap.add_argument("--roty", type=float, default=0.0, help="degrees about Y")
    ap.add_argument("--rotz", type=float, default=0.0, help="degrees about Z, applied last")
    ap.add_argument("--flip-normals", action="store_true", help="flip if the hull renders inside-out")
    ap.add_argument("--align-recess", action="store_true",
                    help="rotate so the modelled docking bay (a recess) faces the player (-z) on the roll axis")
    args = ap.parse_args()

    mesh = build_mesh(args)
    out = Path(args.out) if args.out else MESH_DIR / f"{args.name}.json"
    out.write_text(json.dumps(mesh, indent=2) + "\n")
    print(f"wrote {out}  ({len(mesh['vertices'])} verts, {len(mesh['edges'])} edges, "
          f"{len(mesh['faces'])} faces, {len(mesh['details'])} details)")


if __name__ == "__main__":
    main()
