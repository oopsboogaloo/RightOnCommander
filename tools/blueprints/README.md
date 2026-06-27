# Ship blueprints (parser input)

`elite-ships.asm` holds the `VERTEX` / `EDGE` / `FACE` macro data for the first batch of
hulls, in the bbcelite blueprint format. It is the input to `tools/bbcelite_to_mesh.py`,
which generates the renderer meshes in `src/content/meshes/`.

## Provenance & licensing

The geometry is extracted from [Mark Moxon's annotated BBC Elite source](https://www.bbcelite.com)
(disc version) and ultimately derives from Acornsoft **Elite** (1984, David Braben & Ian Bell).
It is included here as homage, consistent with the project's tribute nature. The formal
IP/licensing sanity-check is tracked as **T9.6** in `tasks.md`.

## Regenerating

```sh
python3 tools/bbcelite_to_mesh.py            # blueprints -> src/content/meshes/*.json
python3 tools/test_meshes.py                 # validate the generated meshes
```

The committed meshes must match the parser output; CI regenerates and diffs to enforce this.
