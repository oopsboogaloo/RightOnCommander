\ ============================================================================
\ Right on Commander — ship blueprints (parser input for bbcelite_to_mesh.py)
\
\ VERTEX / EDGE / FACE macro data for the first batch of hulls, extracted from
\ Mark Moxon's annotated BBC Elite source (https://www.bbcelite.com), disc
\ version. Geometry derives from Acornsoft Elite (1984, Bell & Braben) and is
\ used here as homage; see tasks.md T9.6 for the IP/licensing sanity-check.
\
\ Boa/Cobra Mk I/Moray/Shuttle/Worm/Chameleon/Iguana below are extracted from
\ Mark Moxon's Elite-A source (github.com/markmoxon/elite-a-source-code-bbc-micro),
\ an expanded fan variant of BBC Elite with a larger ship roster; kept the
\ upstream "Mod: Code removed/added for Elite-A" diff comments intact so the
\ Elite-A-specific edits stay visible (the parser already ignores backslash-
\ prefixed VERTEX/EDGE/FACE lines as disabled/replaced source).
\
\ Values are the original integers (Elite ±255 coordinate box). Regenerate
\ meshes with:  python3 tools/bbcelite_to_mesh.py
\ ============================================================================

.SHIP_SIDEWINDER_VERTICES

      \    x,    y,    z, face1, face2, face3, face4, visibility
 VERTEX  -32,    0,   36,    0,    1,    4,    5,   31
 VERTEX   32,    0,   36,    0,    2,    5,    6,   31
 VERTEX   64,    0,  -28,    2,    3,    6,    6,   31
 VERTEX  -64,    0,  -28,    1,    3,    4,    4,   31
 VERTEX    0,   16,  -28,    0,    1,    2,    3,   31
 VERTEX    0,  -16,  -28,    3,    4,    5,    6,   31
 VERTEX  -12,    6,  -28,    3,    3,    3,    3,   15
 VERTEX   12,    6,  -28,    3,    3,    3,    3,   15
 VERTEX   12,   -6,  -28,    3,    3,    3,    3,   12
 VERTEX  -12,   -6,  -28,    3,    3,    3,    3,   12

.SHIP_SIDEWINDER_EDGES

    \ vertex1, vertex2, face1, face2, visibility
 EDGE    0,    1,    0,    5,   31
 EDGE    1,    2,    2,    6,   31
 EDGE    1,    4,    0,    2,   31
 EDGE    0,    4,    0,    1,   31
 EDGE    0,    3,    1,    4,   31
 EDGE    3,    4,    1,    3,   31
 EDGE    2,    4,    2,    3,   31
 EDGE    3,    5,    3,    4,   31
 EDGE    2,    5,    3,    6,   31
 EDGE    1,    5,    5,    6,   31
 EDGE    0,    5,    4,    5,   31
 EDGE    6,    7,    3,    3,   15
 EDGE    7,    8,    3,    3,   12
 EDGE    6,    9,    3,    3,   12
 EDGE    8,    9,    3,    3,   12

.SHIP_SIDEWINDER_FACES

    \ normal_x, normal_y, normal_z, visibility
 FACE    0,   32,    8,   31
 FACE  -12,   47,    6,   31
 FACE   12,   47,    6,   31
 FACE    0,    0, -112,   31
 FACE  -12,  -47,    6,   31
 FACE    0,  -32,    8,   31
 FACE   12,  -47,    6,   31

.SHIP_COBRA_MK_3_VERTICES

      \    x,    y,    z, face1, face2, face3, face4, visibility
 VERTEX   32,    0,   76,   15,   15,   15,   15,   31
 VERTEX  -32,    0,   76,   15,   15,   15,   15,   31
 VERTEX    0,   26,   24,   15,   15,   15,   15,   31
 VERTEX -120,   -3,   -8,    3,    7,   10,   10,   31
 VERTEX  120,   -3,   -8,    4,    8,   12,   12,   31
 VERTEX  -88,   16,  -40,   15,   15,   15,   15,   31
 VERTEX   88,   16,  -40,   15,   15,   15,   15,   31
 VERTEX  128,   -8,  -40,    8,    9,   12,   12,   31
 VERTEX -128,   -8,  -40,    7,    9,   10,   10,   31
 VERTEX    0,   26,  -40,    5,    6,    9,    9,   31
 VERTEX  -32,  -24,  -40,    9,   10,   11,   11,   31
 VERTEX   32,  -24,  -40,    9,   11,   12,   12,   31
 VERTEX  -36,    8,  -40,    9,    9,    9,    9,   20
 VERTEX   -8,   12,  -40,    9,    9,    9,    9,   20
 VERTEX    8,   12,  -40,    9,    9,    9,    9,   20
 VERTEX   36,    8,  -40,    9,    9,    9,    9,   20
 VERTEX   36,  -12,  -40,    9,    9,    9,    9,   20
 VERTEX    8,  -16,  -40,    9,    9,    9,    9,   20
 VERTEX   -8,  -16,  -40,    9,    9,    9,    9,   20
 VERTEX  -36,  -12,  -40,    9,    9,    9,    9,   20
 VERTEX    0,    0,   76,    0,   11,   11,   11,    6
 VERTEX    0,    0,   90,    0,   11,   11,   11,   31
 VERTEX  -80,   -6,  -40,    9,    9,    9,    9,    8
 VERTEX  -80,    6,  -40,    9,    9,    9,    9,    8
 VERTEX  -88,    0,  -40,    9,    9,    9,    9,    6
 VERTEX   80,    6,  -40,    9,    9,    9,    9,    8
 VERTEX   88,    0,  -40,    9,    9,    9,    9,    6
 VERTEX   80,   -6,  -40,    9,    9,    9,    9,    8

.SHIP_COBRA_MK_3_EDGES

    \ vertex1, vertex2, face1, face2, visibility
 EDGE    0,    1,    0,   11,   31
 EDGE    0,    4,    4,   12,   31
 EDGE    1,    3,    3,   10,   31
 EDGE    3,    8,    7,   10,   31
 EDGE    4,    7,    8,   12,   31
 EDGE    6,    7,    8,    9,   31
 EDGE    6,    9,    6,    9,   31
 EDGE    5,    9,    5,    9,   31
 EDGE    5,    8,    7,    9,   31
 EDGE    2,    5,    1,    5,   31
 EDGE    2,    6,    2,    6,   31
 EDGE    3,    5,    3,    7,   31
 EDGE    4,    6,    4,    8,   31
 EDGE    1,    2,    0,    1,   31
 EDGE    0,    2,    0,    2,   31
 EDGE    8,   10,    9,   10,   31
 EDGE   10,   11,    9,   11,   31
 EDGE    7,   11,    9,   12,   31
 EDGE    1,   10,   10,   11,   31
 EDGE    0,   11,   11,   12,   31
 EDGE    1,    5,    1,    3,   29
 EDGE    0,    6,    2,    4,   29
 EDGE   20,   21,    0,   11,    6
 EDGE   12,   13,    9,    9,   20
 EDGE   18,   19,    9,    9,   20
 EDGE   14,   15,    9,    9,   20
 EDGE   16,   17,    9,    9,   20
 EDGE   15,   16,    9,    9,   19
 EDGE   14,   17,    9,    9,   17
 EDGE   13,   18,    9,    9,   19
 EDGE   12,   19,    9,    9,   19
 EDGE    2,    9,    5,    6,   30
 EDGE   22,   24,    9,    9,    6
 EDGE   23,   24,    9,    9,    6
 EDGE   22,   23,    9,    9,    8
 EDGE   25,   26,    9,    9,    6
 EDGE   26,   27,    9,    9,    6
 EDGE   25,   27,    9,    9,    8

.SHIP_COBRA_MK_3_FACES

    \ normal_x, normal_y, normal_z, visibility
 FACE    0,   62,   31,   31
 FACE  -18,   55,   16,   31
 FACE   18,   55,   16,   31
 FACE  -16,   52,   14,   31
 FACE   16,   52,   14,   31
 FACE  -14,   47,    0,   31
 FACE   14,   47,    0,   31
 FACE  -61,  102,    0,   31
 FACE   61,  102,    0,   31
 FACE    0,    0,  -80,   31
 FACE   -7,  -42,    9,   31
 FACE    0,  -30,    6,   31
 FACE    7,  -42,    9,   31

.SHIP_ASP_MK_2_VERTICES

      \    x,    y,    z, face1, face2, face3, face4, visibility
 VERTEX    0,  -18,    0,    1,    0,    2,    2,   22
 VERTEX    0,   -9,  -45,    2,    1,   11,   11,   31
 VERTEX   43,    0,  -45,    6,    1,   11,   11,   31
 VERTEX   69,   -3,    0,    6,    1,    9,    7,   31
 VERTEX   43,  -14,   28,    1,    0,    7,    7,   31
 VERTEX  -43,    0,  -45,    5,    2,   11,   11,   31
 VERTEX  -69,   -3,    0,    5,    2,   10,    8,   31
 VERTEX  -43,  -14,   28,    2,    0,    8,    8,   31
 VERTEX   26,   -7,   73,    4,    0,    9,    7,   31
 VERTEX  -26,   -7,   73,    4,    0,   10,    8,   31
 VERTEX   43,   14,   28,    4,    3,    9,    6,   31
 VERTEX  -43,   14,   28,    4,    3,   10,    5,   31
 VERTEX    0,    9,  -45,    5,    3,   11,    6,   31
 VERTEX  -17,    0,  -45,   11,   11,   11,   11,   10
 VERTEX   17,    0,  -45,   11,   11,   11,   11,    9
 VERTEX    0,   -4,  -45,   11,   11,   11,   11,   10
 VERTEX    0,    4,  -45,   11,   11,   11,   11,    8
 VERTEX    0,   -7,   73,    4,    0,    4,    0,   10
 VERTEX    0,   -7,   83,    4,    0,    4,    0,   10

.SHIP_ASP_MK_2_EDGES

    \ vertex1, vertex2, face1, face2, visibility
 EDGE    0,    1,    2,    1,   22
 EDGE    0,    4,    1,    0,   22
 EDGE    0,    7,    2,    0,   22
 EDGE    1,    2,   11,    1,   31
 EDGE    2,    3,    6,    1,   31
 EDGE    3,    8,    9,    7,   16
 EDGE    8,    9,    4,    0,   31
 EDGE    6,    9,   10,    8,   16
 EDGE    5,    6,    5,    2,   31
 EDGE    1,    5,   11,    2,   31
 EDGE    3,    4,    7,    1,   31
 EDGE    4,    8,    7,    0,   31
 EDGE    6,    7,    8,    2,   31
 EDGE    7,    9,    8,    0,   31
 EDGE    2,   12,   11,    6,   31
 EDGE    5,   12,   11,    5,   31
 EDGE   10,   12,    6,    3,   22
 EDGE   11,   12,    5,    3,   22
 EDGE   10,   11,    4,    3,   22
 EDGE    6,   11,   10,    5,   31
 EDGE    9,   11,   10,    4,   31
 EDGE    3,   10,    9,    6,   31
 EDGE    8,   10,    9,    4,   31
 EDGE   13,   15,   11,   11,   10
 EDGE   15,   14,   11,   11,    9
 EDGE   14,   16,   11,   11,    8
 EDGE   16,   13,   11,   11,    8
 EDGE   18,   17,    4,    0,   10

.SHIP_ASP_MK_2_FACES

    \ normal_x, normal_y, normal_z, visibility
 FACE    0,  -35,    5,   31
 FACE    8,  -38,   -7,   31
 FACE   -8,  -38,   -7,   31
 FACE    0,   24,   -1,   22
 FACE    0,   43,   19,   31
 FACE   -6,   28,   -2,   31
 FACE    6,   28,   -2,   31
 FACE   59,  -64,   31,   31
 FACE  -59,  -64,   31,   31
 FACE   80,   46,   50,   31
 FACE  -80,   46,   50,   31
 FACE    0,    0,  -90,   31

.SHIP_FER_DE_LANCE_VERTICES

      \    x,    y,    z, face1, face2, face3, face4, visibility
 VERTEX    0,  -14,  108,    1,    0,    9,    5,   31
 VERTEX  -40,  -14,   -4,    2,    1,    9,    9,   31
 VERTEX  -12,  -14,  -52,    3,    2,    9,    9,   31
 VERTEX   12,  -14,  -52,    4,    3,    9,    9,   31
 VERTEX   40,  -14,   -4,    5,    4,    9,    9,   31
 VERTEX  -40,   14,   -4,    1,    0,    6,    2,   28
 VERTEX  -12,    2,  -52,    3,    2,    7,    6,   28
 VERTEX   12,    2,  -52,    4,    3,    8,    7,   28
 VERTEX   40,   14,   -4,    4,    0,    8,    5,   28
 VERTEX    0,   18,  -20,    6,    0,    8,    7,   15
 VERTEX   -3,  -11,   97,    0,    0,    0,    0,   11
 VERTEX  -26,    8,   18,    0,    0,    0,    0,    9
 VERTEX  -16,   14,   -4,    0,    0,    0,    0,   11
 VERTEX    3,  -11,   97,    0,    0,    0,    0,   11
 VERTEX   26,    8,   18,    0,    0,    0,    0,    9
 VERTEX   16,   14,   -4,    0,    0,    0,    0,   11
 VERTEX    0,  -14,  -20,    9,    9,    9,    9,   12
 VERTEX  -14,  -14,   44,    9,    9,    9,    9,   12
 VERTEX   14,  -14,   44,    9,    9,    9,    9,   12

.SHIP_FER_DE_LANCE_EDGES

    \ vertex1, vertex2, face1, face2, visibility
 EDGE    0,    1,    9,    1,   31
 EDGE    1,    2,    9,    2,   31
 EDGE    2,    3,    9,    3,   31
 EDGE    3,    4,    9,    4,   31
 EDGE    0,    4,    9,    5,   31
 EDGE    0,    5,    1,    0,   28
 EDGE    5,    6,    6,    2,   28
 EDGE    6,    7,    7,    3,   28
 EDGE    7,    8,    8,    4,   28
 EDGE    0,    8,    5,    0,   28
 EDGE    5,    9,    6,    0,   15
 EDGE    6,    9,    7,    6,   11
 EDGE    7,    9,    8,    7,   11
 EDGE    8,    9,    8,    0,   15
 EDGE    1,    5,    2,    1,   14
 EDGE    2,    6,    3,    2,   14
 EDGE    3,    7,    4,    3,   14
 EDGE    4,    8,    5,    4,   14
 EDGE   10,   11,    0,    0,    8
 EDGE   11,   12,    0,    0,    9
 EDGE   10,   12,    0,    0,   11
 EDGE   13,   14,    0,    0,    8
 EDGE   14,   15,    0,    0,    9
 EDGE   13,   15,    0,    0,   11
 EDGE   16,   17,    9,    9,   12
 EDGE   16,   18,    9,    9,   12
 EDGE   17,   18,    9,    9,    8

.SHIP_FER_DE_LANCE_FACES

    \ normal_x, normal_y, normal_z, visibility
 FACE    0,   24,    6,   28
 FACE  -68,    0,   24,   31
 FACE  -63,    0,  -37,   31
 FACE    0,    0, -104,   31
 FACE   63,    0,  -37,   31
 FACE   68,    0,   24,   31
 FACE  -12,   46,  -19,   28
 FACE    0,   45,  -22,   28
 FACE   12,   46,  -19,   28
 FACE    0,  -28,    0,   31

.SHIP_KRAIT_VERTICES

      \    x,    y,    z, face1, face2, face3, face4, visibility
 VERTEX    0,    0,   96,    1,    0,    3,    2,   31
 VERTEX    0,   18,  -48,    3,    0,    5,    4,   31
 VERTEX    0,  -18,  -48,    2,    1,    5,    4,   31
 VERTEX   90,    0,   -3,    1,    0,    4,    4,   31
 VERTEX  -90,    0,   -3,    3,    2,    5,    5,   31
 VERTEX   90,    0,   87,    1,    0,    1,    1,   30
 VERTEX  -90,    0,   87,    3,    2,    3,    3,   30
 VERTEX    0,    5,   53,    0,    0,    3,    3,    9
 VERTEX    0,    7,   38,    0,    0,    3,    3,    6
 VERTEX  -18,    7,   19,    3,    3,    3,    3,    9
 VERTEX   18,    7,   19,    0,    0,    0,    0,    9
 VERTEX   18,   11,  -39,    4,    4,    4,    4,    8
 VERTEX   18,  -11,  -39,    4,    4,    4,    4,    8
 VERTEX   36,    0,  -30,    4,    4,    4,    4,    8
 VERTEX  -18,   11,  -39,    5,    5,    5,    5,    8
 VERTEX  -18,  -11,  -39,    5,    5,    5,    5,    8
 VERTEX  -36,    0,  -30,    5,    5,    5,    5,    8

.SHIP_KRAIT_EDGES

    \ vertex1, vertex2, face1, face2, visibility
 EDGE    0,    1,    3,    0,   31
 EDGE    0,    2,    2,    1,   31
 EDGE    0,    3,    1,    0,   31
 EDGE    0,    4,    3,    2,   31
 EDGE    1,    4,    5,    3,   31
 EDGE    4,    2,    5,    2,   31
 EDGE    2,    3,    4,    1,   31
 EDGE    3,    1,    4,    0,   31
 EDGE    3,    5,    1,    0,   30
 EDGE    4,    6,    3,    2,   30
 EDGE    1,    2,    5,    4,    8
 EDGE    7,   10,    0,    0,    9
 EDGE    8,   10,    0,    0,    6
 EDGE    7,    9,    3,    3,    9
 EDGE    8,    9,    3,    3,    6
 EDGE   11,   13,    4,    4,    8
 EDGE   13,   12,    4,    4,    8
 EDGE   12,   11,    4,    4,    7
 EDGE   14,   15,    5,    5,    7
 EDGE   15,   16,    5,    5,    8
 EDGE   16,   14,    5,    5,    8

.SHIP_KRAIT_FACES

    \ normal_x, normal_y, normal_z, visibility
 FACE    3,   24,    3,   31
 FACE    3,  -24,    3,   31
 FACE   -3,  -24,    3,   31
 FACE   -3,   24,    3,   31
 FACE   38,    0,  -77,   31
 FACE  -38,    0,  -77,   31

.SHIP_MAMBA_VERTICES

      \    x,    y,    z, face1, face2, face3, face4, visibility
 VERTEX    0,    0,   64,    0,    1,    2,    3,   31
 VERTEX  -64,   -8,  -32,    0,    2,    4,    4,   31
 VERTEX  -32,    8,  -32,    1,    2,    4,    4,   30
 VERTEX   32,    8,  -32,    1,    3,    4,    4,   30
 VERTEX   64,   -8,  -32,    0,    3,    4,    4,   31
 VERTEX   -4,    4,   16,    1,    1,    1,    1,   14
 VERTEX    4,    4,   16,    1,    1,    1,    1,   14
 VERTEX    8,    3,   28,    1,    1,    1,    1,   13
 VERTEX   -8,    3,   28,    1,    1,    1,    1,   13
 VERTEX  -20,   -4,   16,    0,    0,    0,    0,   20
 VERTEX   20,   -4,   16,    0,    0,    0,    0,   20
 VERTEX  -24,   -7,  -20,    0,    0,    0,    0,   20
 VERTEX  -16,   -7,  -20,    0,    0,    0,    0,   16
 VERTEX   16,   -7,  -20,    0,    0,    0,    0,   16
 VERTEX   24,   -7,  -20,    0,    0,    0,    0,   20
 VERTEX   -8,    4,  -32,    4,    4,    4,    4,   13
 VERTEX    8,    4,  -32,    4,    4,    4,    4,   13
 VERTEX    8,   -4,  -32,    4,    4,    4,    4,   14
 VERTEX   -8,   -4,  -32,    4,    4,    4,    4,   14
 VERTEX  -32,    4,  -32,    4,    4,    4,    4,    7
 VERTEX   32,    4,  -32,    4,    4,    4,    4,    7
 VERTEX   36,   -4,  -32,    4,    4,    4,    4,    7
 VERTEX  -36,   -4,  -32,    4,    4,    4,    4,    7
 VERTEX  -38,    0,  -32,    4,    4,    4,    4,    5
 VERTEX   38,    0,  -32,    4,    4,    4,    4,    5

.SHIP_MAMBA_EDGES

    \ vertex1, vertex2, face1, face2, visibility
 EDGE    0,    1,    0,    2,   31
 EDGE    0,    4,    0,    3,   31
 EDGE    1,    4,    0,    4,   31
 EDGE    1,    2,    2,    4,   30
 EDGE    2,    3,    1,    4,   30
 EDGE    3,    4,    3,    4,   30
 EDGE    5,    6,    1,    1,   14
 EDGE    6,    7,    1,    1,   12
 EDGE    7,    8,    1,    1,   13
 EDGE    5,    8,    1,    1,   12
 EDGE    9,   11,    0,    0,   20
 EDGE    9,   12,    0,    0,   16
 EDGE   10,   13,    0,    0,   16
 EDGE   10,   14,    0,    0,   20
 EDGE   13,   14,    0,    0,   14
 EDGE   11,   12,    0,    0,   14
 EDGE   15,   16,    4,    4,   13
 EDGE   17,   18,    4,    4,   14
 EDGE   15,   18,    4,    4,   12
 EDGE   16,   17,    4,    4,   12
 EDGE   20,   21,    4,    4,    7
 EDGE   20,   24,    4,    4,    5
 EDGE   21,   24,    4,    4,    5
 EDGE   19,   22,    4,    4,    7
 EDGE   19,   23,    4,    4,    5
 EDGE   22,   23,    4,    4,    5
 EDGE    0,    2,    1,    2,   30
 EDGE    0,    3,    1,    3,   30

.SHIP_MAMBA_FACES

    \ normal_x, normal_y, normal_z, visibility
 FACE    0,  -24,    2,   30
 FACE    0,   24,    2,   30
 FACE  -32,   64,   16,   30
 FACE   32,   64,   16,   30
 FACE    0,    0, -127,   30

.SHIP_GECKO_VERTICES

      \    x,    y,    z, face1, face2, face3, face4, visibility
 VERTEX  -10,   -4,   47,    3,    0,    5,    4,   31
 VERTEX   10,   -4,   47,    1,    0,    3,    2,   31
 VERTEX  -16,    8,  -23,    5,    0,    7,    6,   31
 VERTEX   16,    8,  -23,    1,    0,    8,    7,   31
 VERTEX  -66,    0,   -3,    5,    4,    6,    6,   31
 VERTEX   66,    0,   -3,    2,    1,    8,    8,   31
 VERTEX  -20,  -14,  -23,    4,    3,    7,    6,   31
 VERTEX   20,  -14,  -23,    3,    2,    8,    7,   31
 VERTEX   -8,   -6,   33,    3,    3,    3,    3,   16
 VERTEX    8,   -6,   33,    3,    3,    3,    3,   17
 VERTEX   -8,  -13,  -16,    3,    3,    3,    3,   16
 VERTEX    8,  -13,  -16,    3,    3,    3,    3,   17

.SHIP_GECKO_EDGES

    \ vertex1, vertex2, face1, face2, visibility
 EDGE    0,    1,    3,    0,   31
 EDGE    1,    5,    2,    1,   31
 EDGE    5,    3,    8,    1,   31
 EDGE    3,    2,    7,    0,   31
 EDGE    2,    4,    6,    5,   31
 EDGE    4,    0,    5,    4,   31
 EDGE    5,    7,    8,    2,   31
 EDGE    7,    6,    7,    3,   31
 EDGE    6,    4,    6,    4,   31
 EDGE    0,    2,    5,    0,   29
 EDGE    1,    3,    1,    0,   30
 EDGE    0,    6,    4,    3,   29
 EDGE    1,    7,    3,    2,   30
 EDGE    2,    6,    7,    6,   20
 EDGE    3,    7,    8,    7,   20
 EDGE    8,   10,    3,    3,   16
 EDGE    9,   11,    3,    3,   17

.SHIP_GECKO_FACES

    \ normal_x, normal_y, normal_z, visibility
 FACE    0,   31,    5,   31
 FACE    4,   45,    8,   31
 FACE   25, -108,   19,   31
 FACE    0,  -84,   12,   31
 FACE  -25, -108,   19,   31
 FACE   -4,   45,    8,   31
 FACE  -88,   16, -214,   31
 FACE    0,    0, -187,   31
 FACE   88,   16, -214,   31

.SHIP_ADDER_VERTICES

      \    x,    y,    z, face1, face2, face3, face4, visibility
 VERTEX  -18,    0,   40,    1,    0,   12,   11,   31
 VERTEX   18,    0,   40,    1,    0,    3,    2,   31
 VERTEX   30,    0,  -24,    3,    2,    5,    4,   31
 VERTEX   30,    0,  -40,    5,    4,    6,    6,   31
 VERTEX   18,   -7,  -40,    6,    5,   14,    7,   31
 VERTEX  -18,   -7,  -40,    8,    7,   14,   10,   31
 VERTEX  -30,    0,  -40,    9,    8,   10,   10,   31
 VERTEX  -30,    0,  -24,   10,    9,   12,   11,   31
 VERTEX  -18,    7,  -40,    8,    7,   13,    9,   31
 VERTEX   18,    7,  -40,    6,    4,   13,    7,   31
 VERTEX  -18,    7,   13,    9,    0,   13,   11,   31
 VERTEX   18,    7,   13,    2,    0,   13,    4,   31
 VERTEX  -18,   -7,   13,   10,    1,   14,   12,   31
 VERTEX   18,   -7,   13,    3,    1,   14,    5,   31
 VERTEX  -11,    3,   29,    0,    0,    0,    0,    5
 VERTEX   11,    3,   29,    0,    0,    0,    0,    5
 VERTEX   11,    4,   24,    0,    0,    0,    0,    4
 VERTEX  -11,    4,   24,    0,    0,    0,    0,    4

.SHIP_ADDER_EDGES

    \ vertex1, vertex2, face1, face2, visibility
 EDGE    0,    1,    1,    0,   31
 EDGE    1,    2,    3,    2,    7
 EDGE    2,    3,    5,    4,   31
 EDGE    3,    4,    6,    5,   31
 EDGE    4,    5,   14,    7,   31
 EDGE    5,    6,   10,    8,   31
 EDGE    6,    7,   10,    9,   31
 EDGE    7,    0,   12,   11,    7
 EDGE    3,    9,    6,    4,   31
 EDGE    9,    8,   13,    7,   31
 EDGE    8,    6,    9,    8,   31
 EDGE    0,   10,   11,    0,   31
 EDGE    7,   10,   11,    9,   31
 EDGE    1,   11,    2,    0,   31
 EDGE    2,   11,    4,    2,   31
 EDGE    0,   12,   12,    1,   31
 EDGE    7,   12,   12,   10,   31
 EDGE    1,   13,    3,    1,   31
 EDGE    2,   13,    5,    3,   31
 EDGE   10,   11,   13,    0,   31
 EDGE   12,   13,   14,    1,   31
 EDGE    8,   10,   13,    9,   31
 EDGE    9,   11,   13,    4,   31
 EDGE    5,   12,   14,   10,   31
 EDGE    4,   13,   14,    5,   31
 EDGE   14,   15,    0,    0,    5
 EDGE   15,   16,    0,    0,    3
 EDGE   16,   17,    0,    0,    4
 EDGE   17,   14,    0,    0,    3

.SHIP_ADDER_FACES

    \ normal_x, normal_y, normal_z, visibility
 FACE    0,   39,   10,   31
 FACE    0,  -39,   10,   31
 FACE   69,   50,   13,   31
 FACE   69,  -50,   13,   31
 FACE   30,   52,    0,   31
 FACE   30,  -52,    0,   31
 FACE    0,    0, -160,   31
 FACE    0,    0, -160,   31
 FACE    0,    0, -160,   31
 FACE  -30,   52,    0,   31
 FACE  -30,  -52,    0,   31
 FACE  -69,   50,   13,   31
 FACE  -69,  -50,   13,   31
 FACE    0,   28,    0,   31
 FACE    0,  -28,    0,   31

.SHIP_VIPER_VERTICES

      \    x,    y,    z, face1, face2, face3, face4, visibility
 VERTEX    0,    0,   72,    1,    2,    3,    4,   31
 VERTEX    0,   16,   24,    0,    1,    2,    2,   30
 VERTEX    0,  -16,   24,    3,    4,    5,    5,   30
 VERTEX   48,    0,  -24,    2,    4,    6,    6,   31
 VERTEX  -48,    0,  -24,    1,    3,    6,    6,   31
 VERTEX   24,  -16,  -24,    4,    5,    6,    6,   30
 VERTEX  -24,  -16,  -24,    5,    3,    6,    6,   30
 VERTEX   24,   16,  -24,    0,    2,    6,    6,   31
 VERTEX  -24,   16,  -24,    0,    1,    6,    6,   31
 VERTEX  -32,    0,  -24,    6,    6,    6,    6,   19
 VERTEX   32,    0,  -24,    6,    6,    6,    6,   19
 VERTEX    8,    8,  -24,    6,    6,    6,    6,   19
 VERTEX   -8,    8,  -24,    6,    6,    6,    6,   19
 VERTEX   -8,   -8,  -24,    6,    6,    6,    6,   18
 VERTEX    8,   -8,  -24,    6,    6,    6,    6,   18

.SHIP_VIPER_EDGES

    \ vertex1, vertex2, face1, face2, visibility
 EDGE    0,    3,    2,    4,   31
 EDGE    0,    1,    1,    2,   30
 EDGE    0,    2,    3,    4,   30
 EDGE    0,    4,    1,    3,   31
 EDGE    1,    7,    0,    2,   30
 EDGE    1,    8,    0,    1,   30
 EDGE    2,    5,    4,    5,   30
 EDGE    2,    6,    3,    5,   30
 EDGE    7,    8,    0,    6,   31
 EDGE    5,    6,    5,    6,   30
 EDGE    4,    8,    1,    6,   31
 EDGE    4,    6,    3,    6,   30
 EDGE    3,    7,    2,    6,   31
 EDGE    3,    5,    6,    4,   30
 EDGE    9,   12,    6,    6,   19
 EDGE    9,   13,    6,    6,   18
 EDGE   10,   11,    6,    6,   19
 EDGE   10,   14,    6,    6,   18
 EDGE   11,   14,    6,    6,   16
 EDGE   12,   13,    6,    6,   16

.SHIP_VIPER_FACES

    \ normal_x, normal_y, normal_z, visibility
 FACE    0,   32,    0,   31
 FACE  -22,   33,   11,   31
 FACE   22,   33,   11,   31
 FACE  -22,  -33,   11,   31
 FACE   22,  -33,   11,   31
 FACE    0,  -32,    0,   31
 FACE    0,    0,  -48,   31

.SHIP_CORIOLIS_VERTICES

      \    x,    y,    z, face1, face2, face3, face4, visibility
 VERTEX  160,    0,  160,    0,    1,    2,    6,   31
 VERTEX    0,  160,  160,    0,    2,    3,    8,   31
 VERTEX -160,    0,  160,    0,    3,    4,    7,   31
 VERTEX    0, -160,  160,    0,    1,    4,    5,   31
 VERTEX  160, -160,    0,    1,    5,    6,   10,   31
 VERTEX  160,  160,    0,    2,    6,    8,   11,   31
 VERTEX -160,  160,    0,    3,    7,    8,   12,   31
 VERTEX -160, -160,    0,    4,    5,    7,    9,   31
 VERTEX  160,    0, -160,    6,   10,   11,   13,   31
 VERTEX    0,  160, -160,    8,   11,   12,   13,   31
 VERTEX -160,    0, -160,    7,    9,   12,   13,   31
 VERTEX    0, -160, -160,    5,    9,   10,   13,   31
 VERTEX   10,  -30,  160,    0,    0,    0,    0,   30
 VERTEX   10,   30,  160,    0,    0,    0,    0,   30
 VERTEX  -10,   30,  160,    0,    0,    0,    0,   30
 VERTEX  -10,  -30,  160,    0,    0,    0,    0,   30

.SHIP_CORIOLIS_EDGES

    \ vertex1, vertex2, face1, face2, visibility
 EDGE    0,    3,    0,    1,   31
 EDGE    0,    1,    0,    2,   31
 EDGE    1,    2,    0,    3,   31
 EDGE    2,    3,    0,    4,   31
 EDGE    3,    4,    1,    5,   31
 EDGE    0,    4,    1,    6,   31
 EDGE    0,    5,    2,    6,   31
 EDGE    5,    1,    2,    8,   31
 EDGE    1,    6,    3,    8,   31
 EDGE    2,    6,    3,    7,   31
 EDGE    2,    7,    4,    7,   31
 EDGE    3,    7,    4,    5,   31
 EDGE    8,   11,   10,   13,   31
 EDGE    8,    9,   11,   13,   31
 EDGE    9,   10,   12,   13,   31
 EDGE   10,   11,    9,   13,   31
 EDGE    4,   11,    5,   10,   31
 EDGE    4,    8,    6,   10,   31
 EDGE    5,    8,    6,   11,   31
 EDGE    5,    9,    8,   11,   31
 EDGE    6,    9,    8,   12,   31
 EDGE    6,   10,    7,   12,   31
 EDGE    7,   10,    7,    9,   31
 EDGE    7,   11,    5,    9,   31
 EDGE   12,   13,    0,    0,   30
 EDGE   13,   14,    0,    0,   30
 EDGE   14,   15,    0,    0,   30
 EDGE   15,   12,    0,    0,   30

.SHIP_CORIOLIS_FACES

    \ normal_x, normal_y, normal_z, visibility
 FACE    0,    0,  160,   31
 FACE  107, -107,  107,   31
 FACE  107,  107,  107,   31
 FACE -107,  107,  107,   31
 FACE -107, -107,  107,   31
 FACE    0, -160,    0,   31
 FACE  160,    0,    0,   31
 FACE -160,    0,    0,   31
 FACE    0,  160,    0,   31
 FACE -107, -107, -107,   31
 FACE  107, -107, -107,   31
 FACE  107,  107, -107,   31
 FACE -107,  107, -107,   31
 FACE    0,    0, -160,   31

.SHIP_THARGOID_VERTICES

      \    x,    y,    z, face1, face2, face3, face4, visibility
 VERTEX   32,  -48,   48,    0,    4,    8,    8,   31
 VERTEX   32,  -68,    0,    0,    1,    4,    4,   31
 VERTEX   32,  -48,  -48,    1,    2,    4,    4,   31
 VERTEX   32,    0,  -68,    2,    3,    4,    4,   31
 VERTEX   32,   48,  -48,    3,    4,    5,    5,   31
 VERTEX   32,   68,    0,    4,    5,    6,    6,   31
 VERTEX   32,   48,   48,    4,    6,    7,    7,   31
 VERTEX   32,    0,   68,    4,    7,    8,    8,   31
 VERTEX  -24, -116,  116,    0,    8,    9,    9,   31
 VERTEX  -24, -164,    0,    0,    1,    9,    9,   31
 VERTEX  -24, -116, -116,    1,    2,    9,    9,   31
 VERTEX  -24,    0, -164,    2,    3,    9,    9,   31
 VERTEX  -24,  116, -116,    3,    5,    9,    9,   31
 VERTEX  -24,  164,    0,    5,    6,    9,    9,   31
 VERTEX  -24,  116,  116,    6,    7,    9,    9,   31
 VERTEX  -24,    0,  164,    7,    8,    9,    9,   31
 VERTEX  -24,   64,   80,    9,    9,    9,    9,   30
 VERTEX  -24,   64,  -80,    9,    9,    9,    9,   30
 VERTEX  -24,  -64,  -80,    9,    9,    9,    9,   30
 VERTEX  -24,  -64,   80,    9,    9,    9,    9,   30

.SHIP_THARGOID_EDGES

    \ vertex1, vertex2, face1, face2, visibility
 EDGE    0,    7,    4,    8,   31
 EDGE    0,    1,    0,    4,   31
 EDGE    1,    2,    1,    4,   31
 EDGE    2,    3,    2,    4,   31
 EDGE    3,    4,    3,    4,   31
 EDGE    4,    5,    4,    5,   31
 EDGE    5,    6,    4,    6,   31
 EDGE    6,    7,    4,    7,   31
 EDGE    0,    8,    0,    8,   31
 EDGE    1,    9,    0,    1,   31
 EDGE    2,   10,    1,    2,   31
 EDGE    3,   11,    2,    3,   31
 EDGE    4,   12,    3,    5,   31
 EDGE    5,   13,    5,    6,   31
 EDGE    6,   14,    6,    7,   31
 EDGE    7,   15,    7,    8,   31
 EDGE    8,   15,    8,    9,   31
 EDGE    8,    9,    0,    9,   31
 EDGE    9,   10,    1,    9,   31
 EDGE   10,   11,    2,    9,   31
 EDGE   11,   12,    3,    9,   31
 EDGE   12,   13,    5,    9,   31
 EDGE   13,   14,    6,    9,   31
 EDGE   14,   15,    7,    9,   31
 EDGE   16,   17,    9,    9,   30
 EDGE   18,   19,    9,    9,   30

.SHIP_THARGOID_FACES

    \ normal_x, normal_y, normal_z, visibility
 FACE  103,  -60,   25,   31
 FACE  103,  -60,  -25,   31
 FACE  103,  -25,  -60,   31
 FACE  103,   25,  -60,   31
 FACE   64,    0,    0,   31
 FACE  103,   60,  -25,   31
 FACE  103,   60,   25,   31
 FACE  103,   25,   60,   31
 FACE  103,  -25,   60,   31
 FACE  -48,    0,    0,   31

.SHIP_TRANSPORTER_VERTICES

      \    x,    y,    z, face1, face2, face3, face4, visibility
 VERTEX    0,   10,  -26,    6,    0,    7,    7,   31
 VERTEX  -25,    4,  -26,    1,    0,    7,    7,   31
 VERTEX  -28,   -3,  -26,    1,    0,    2,    2,   31
 VERTEX  -25,   -8,  -26,    2,    0,    3,    3,   31
 VERTEX   26,   -8,  -26,    3,    0,    4,    4,   31
 VERTEX   29,   -3,  -26,    4,    0,    5,    5,   31
 VERTEX   26,    4,  -26,    5,    0,    6,    6,   31
 VERTEX    0,    6,   12,   15,   15,   15,   15,   19
 VERTEX  -30,   -1,   12,    7,    1,    9,    8,   31
 VERTEX  -33,   -8,   12,    2,    1,    9,    3,   31
 VERTEX   33,   -8,   12,    4,    3,   10,    5,   31
 VERTEX   30,   -1,   12,    6,    5,   11,   10,   31
 VERTEX  -11,   -2,   30,    9,    8,   13,   12,   31
 VERTEX  -13,   -8,   30,    9,    3,   13,   13,   31
 VERTEX   14,   -8,   30,   10,    3,   13,   13,   31
 VERTEX   11,   -2,   30,   11,   10,   13,   12,   31
 VERTEX   -5,    6,    2,    7,    7,    7,    7,    7
 VERTEX  -18,    3,    2,    7,    7,    7,    7,    7
 VERTEX   -5,    7,   -7,    7,    7,    7,    7,    7
 VERTEX  -18,    4,   -7,    7,    7,    7,    7,    7
 VERTEX  -11,    6,  -14,    7,    7,    7,    7,    7
 VERTEX  -11,    5,   -7,    7,    7,    7,    7,    7
 VERTEX    5,    7,  -14,    6,    6,    6,    6,    7
 VERTEX   18,    4,  -14,    6,    6,    6,    6,    7
 VERTEX   11,    5,   -7,    6,    6,    6,    6,    7
 VERTEX    5,    6,   -3,    6,    6,    6,    6,    7
 VERTEX   18,    3,   -3,    6,    6,    6,    6,    7
 VERTEX   11,    4,    8,    6,    6,    6,    6,    7
 VERTEX   11,    5,   -3,    6,    6,    6,    6,    7
 VERTEX  -16,   -8,  -13,    3,    3,    3,    3,    6
 VERTEX  -16,   -8,   16,    3,    3,    3,    3,    6
 VERTEX   17,   -8,  -13,    3,    3,    3,    3,    6
 VERTEX   17,   -8,   16,    3,    3,    3,    3,    6
 VERTEX  -13,   -3,  -26,    0,    0,    0,    0,    8
 VERTEX   13,   -3,  -26,    0,    0,    0,    0,    8
 VERTEX    9,    3,  -26,    0,    0,    0,    0,    5
 VERTEX   -8,    3,  -26,    0,    0,    0,    0,    5

.SHIP_TRANSPORTER_EDGES

    \ vertex1, vertex2, face1, face2, visibility
 EDGE    0,    1,    7,    0,   31
 EDGE    1,    2,    1,    0,   31
 EDGE    2,    3,    2,    0,   31
 EDGE    3,    4,    3,    0,   31
 EDGE    4,    5,    4,    0,   31
 EDGE    5,    6,    5,    0,   31
 EDGE    0,    6,    6,    0,   31
 EDGE    0,    7,    7,    6,   16
 EDGE    1,    8,    7,    1,   31
 EDGE    2,    9,    2,    1,   11
 EDGE    3,    9,    3,    2,   31
 EDGE    4,   10,    4,    3,   31
 EDGE    5,   10,    5,    4,   11
 EDGE    6,   11,    6,    5,   31
 EDGE    7,    8,    8,    7,   17
 EDGE    8,    9,    9,    1,   17
 EDGE   10,   11,   10,    5,   17
 EDGE    7,   11,   11,    6,   17
 EDGE    7,   15,   12,   11,   19
 EDGE    7,   12,   12,    8,   19
 EDGE    8,   12,    9,    8,   16
 EDGE    9,   13,    9,    3,   31
 EDGE   10,   14,   10,    3,   31
 EDGE   11,   15,   11,   10,   16
 EDGE   12,   13,   13,    9,   31
 EDGE   13,   14,   13,    3,   31
 EDGE   14,   15,   13,   10,   31
 EDGE   12,   15,   13,   12,   31
 EDGE   16,   17,    7,    7,    7
 EDGE   18,   19,    7,    7,    7
 EDGE   19,   20,    7,    7,    7
 EDGE   18,   20,    7,    7,    7
 EDGE   20,   21,    7,    7,    7
 EDGE   22,   23,    6,    6,    7
 EDGE   23,   24,    6,    6,    7
 EDGE   24,   22,    6,    6,    7
 EDGE   25,   26,    6,    6,    7
 EDGE   26,   27,    6,    6,    7
 EDGE   25,   27,    6,    6,    7
 EDGE   27,   28,    6,    6,    7
 EDGE   29,   30,    3,    3,    6
 EDGE   31,   32,    3,    3,    6
 EDGE   33,   34,    0,    0,    8
 EDGE   34,   35,    0,    0,    5
 EDGE   35,   36,    0,    0,    5
 EDGE   36,   33,    0,    0,    5

.SHIP_TRANSPORTER_FACES

    \ normal_x, normal_y, normal_z, visibility
 FACE    0,    0, -103,   31
 FACE -111,   48,   -7,   31
 FACE -105,  -63,  -21,   31
 FACE    0,  -34,    0,   31
 FACE  105,  -63,  -21,   31
 FACE  111,   48,   -7,   31
 FACE    8,   32,    3,   31
 FACE   -8,   32,    3,   31
 FACE   -8,   34,   11,   19
 FACE  -75,   32,   79,   31
 FACE   75,   32,   79,   31
 FACE    8,   34,   11,   19
 FACE    0,   38,   17,   31
 FACE    0,    0,  121,   31

.SHIP_ASTEROID_VERTICES

      \    x,    y,    z, face1, face2, face3, face4, visibility
 VERTEX    0,   80,    0,   15,   15,   15,   15,   31
 VERTEX  -80,  -10,    0,   15,   15,   15,   15,   31
 VERTEX    0,  -80,    0,   15,   15,   15,   15,   31
 VERTEX   70,  -40,    0,   15,   15,   15,   15,   31
 VERTEX   60,   50,    0,    5,    6,   12,   13,   31
 VERTEX   50,    0,   60,   15,   15,   15,   15,   31
 VERTEX  -40,    0,   70,    0,    1,    2,    3,   31
 VERTEX    0,   30,  -75,   15,   15,   15,   15,   31
 VERTEX    0,  -50,  -60,    8,    9,   10,   11,   31

.SHIP_ASTEROID_EDGES

    \ vertex1, vertex2, face1, face2, visibility
 EDGE    0,    1,    2,    7,   31
 EDGE    0,    4,    6,   13,   31
 EDGE    3,    4,    5,   12,   31
 EDGE    2,    3,    4,   11,   31
 EDGE    1,    2,    3,   10,   31
 EDGE    1,    6,    2,    3,   31
 EDGE    2,    6,    1,    3,   31
 EDGE    2,    5,    1,    4,   31
 EDGE    5,    6,    0,    1,   31
 EDGE    0,    5,    0,    6,   31
 EDGE    3,    5,    4,    5,   31
 EDGE    0,    6,    0,    2,   31
 EDGE    4,    5,    5,    6,   31
 EDGE    1,    8,    8,   10,   31
 EDGE    1,    7,    7,    8,   31
 EDGE    0,    7,    7,   13,   31
 EDGE    4,    7,   12,   13,   31
 EDGE    3,    7,    9,   12,   31
 EDGE    3,    8,    9,   11,   31
 EDGE    2,    8,   10,   11,   31
 EDGE    7,    8,    8,    9,   31

.SHIP_ASTEROID_FACES

    \ normal_x, normal_y, normal_z, visibility
 FACE    9,   66,   81,   31
 FACE    9,  -66,   81,   31
 FACE  -72,   64,   31,   31
 FACE  -64,  -73,   47,   31
 FACE   45,  -79,   65,   31
 FACE  135,   15,   35,   31
 FACE   38,   76,   70,   31
 FACE  -66,   59,  -39,   31
 FACE  -67,  -15,  -80,   31
 FACE   66,  -14,  -75,   31
 FACE  -70,  -80,  -40,   31
 FACE   58, -102,  -51,   31
 FACE   81,    9,  -67,   31
 FACE   47,   94,  -63,   31

.SHIP_SPLINTER_VERTICES

      \    x,    y,    z, face1, face2, face3, face4, visibility
 VERTEX  -24,  -25,   16,    2,    1,    3,    3,   31
 VERTEX    0,   12,  -10,    2,    0,    3,    3,   31
 VERTEX   11,   -6,    2,    1,    0,    3,    3,   31
 VERTEX   12,   42,    7,    1,    0,    2,    2,   31

.SHIP_SPLINTER_EDGES

    \ vertex1, vertex2, face1, face2, visibility
 EDGE    0,    1,    3,    2,   31
 EDGE    1,    2,    3,    0,   31
 EDGE    2,    3,    1,    0,   31
 EDGE    3,    0,    2,    1,   31
 EDGE    0,    2,    3,    1,   31
 EDGE    3,    1,    2,    0,   31

.SHIP_SPLINTER_FACES

    \ normal_x, normal_y, normal_z, visibility
 FACE   35,    0,    4,   31
 FACE    3,    4,    8,   31
 FACE    1,    8,   12,   31
 FACE   18,   12,    0,   31

.SHIP_CANISTER_VERTICES

      \    x,    y,    z, face1, face2, face3, face4, visibility
 VERTEX   24,   16,    0,    0,    1,    5,    5,   31
 VERTEX   24,    5,   15,    0,    1,    2,    2,   31
 VERTEX   24,  -13,    9,    0,    2,    3,    3,   31
 VERTEX   24,  -13,   -9,    0,    3,    4,    4,   31
 VERTEX   24,    5,  -15,    0,    4,    5,    5,   31
 VERTEX  -24,   16,    0,    1,    5,    6,    6,   31
 VERTEX  -24,    5,   15,    1,    2,    6,    6,   31
 VERTEX  -24,  -13,    9,    2,    3,    6,    6,   31
 VERTEX  -24,  -13,   -9,    3,    4,    6,    6,   31
 VERTEX  -24,    5,  -15,    4,    5,    6,    6,   31

.SHIP_CANISTER_EDGES

    \ vertex1, vertex2, face1, face2, visibility
 EDGE    0,    1,    0,    1,   31
 EDGE    1,    2,    0,    2,   31
 EDGE    2,    3,    0,    3,   31
 EDGE    3,    4,    0,    4,   31
 EDGE    0,    4,    0,    5,   31
 EDGE    0,    5,    1,    5,   31
 EDGE    1,    6,    1,    2,   31
 EDGE    2,    7,    2,    3,   31
 EDGE    3,    8,    3,    4,   31
 EDGE    4,    9,    4,    5,   31
 EDGE    5,    6,    1,    6,   31
 EDGE    6,    7,    2,    6,   31
 EDGE    7,    8,    3,    6,   31
 EDGE    8,    9,    4,    6,   31
 EDGE    9,    5,    5,    6,   31

.SHIP_CANISTER_FACES

    \ normal_x, normal_y, normal_z, visibility
 FACE   96,    0,    0,   31
 FACE    0,   41,   30,   31
 FACE    0,  -18,   48,   31
 FACE    0,  -51,    0,   31
 FACE    0,  -18,  -48,   31
 FACE    0,   41,  -30,   31
 FACE  -96,    0,    0,   31

.SHIP_CONSTRICTOR_VERTICES

      \    x,    y,    z, face1, face2, face3, face4, visibility
 VERTEX   20,   -7,   80,     2,      0,    9,     9,         31    \ Vertex 0
 VERTEX  -20,   -7,   80,     1,      0,    9,     9,         31    \ Vertex 1
 VERTEX  -54,   -7,   40,     4,      1,    9,     9,         31    \ Vertex 2
 VERTEX  -54,   -7,  -40,     5,      4,    9,     8,         31    \ Vertex 3
 VERTEX  -20,   13,  -40,     6,      5,    8,     8,         31    \ Vertex 4
 VERTEX   20,   13,  -40,     7,      6,    8,     8,         31    \ Vertex 5
 VERTEX   54,   -7,  -40,     7,      3,    9,     8,         31    \ Vertex 6
 VERTEX   54,   -7,   40,     3,      2,    9,     9,         31    \ Vertex 7
 VERTEX   20,   13,    5,    15,     15,   15,    15,         31    \ Vertex 8
 VERTEX  -20,   13,    5,    15,     15,   15,    15,         31    \ Vertex 9
 VERTEX   20,   -7,   62,     9,      9,    9,     9,         18    \ Vertex 10
 VERTEX  -20,   -7,   62,     9,      9,    9,     9,         18    \ Vertex 11
 VERTEX   25,   -7,  -25,     9,      9,    9,     9,         18    \ Vertex 12
 VERTEX  -25,   -7,  -25,     9,      9,    9,     9,         18    \ Vertex 13
 VERTEX   15,   -7,  -15,     9,      9,    9,     9,         10    \ Vertex 14
 VERTEX  -15,   -7,  -15,     9,      9,    9,     9,         10    \ Vertex 15
 VERTEX    0,   -7,    0,    15,      9,    1,     0,          0    \ Vertex 16

.SHIP_CONSTRICTOR_EDGES

    \ vertex1, vertex2, face1, face2, visibility
 EDGE       0,       1,     9,     0,         31    \ Edge 0
 EDGE       1,       2,     9,     1,         31    \ Edge 1
 EDGE       1,       9,     1,     0,         31    \ Edge 2
 EDGE       0,       8,     2,     0,         31    \ Edge 3
 EDGE       0,       7,     9,     2,         31    \ Edge 4
 EDGE       7,       8,     3,     2,         31    \ Edge 5
 EDGE       2,       9,     4,     1,         31    \ Edge 6
 EDGE       2,       3,     9,     4,         31    \ Edge 7
 EDGE       6,       7,     9,     3,         31    \ Edge 8
 EDGE       6,       8,     7,     3,         31    \ Edge 9
 EDGE       5,       8,     7,     6,         31    \ Edge 10
 EDGE       4,       9,     6,     5,         31    \ Edge 11
 EDGE       3,       9,     5,     4,         31    \ Edge 12
 EDGE       3,       4,     8,     5,         31    \ Edge 13
 EDGE       4,       5,     8,     6,         31    \ Edge 14
 EDGE       5,       6,     8,     7,         31    \ Edge 15
 EDGE       3,       6,     9,     8,         31    \ Edge 16
 EDGE       8,       9,     6,     0,         31    \ Edge 17
 EDGE      10,      12,     9,     9,         18    \ Edge 18
 EDGE      12,      14,     9,     9,          5    \ Edge 19
 EDGE      14,      10,     9,     9,         10    \ Edge 20
 EDGE      11,      15,     9,     9,         10    \ Edge 21
 EDGE      13,      15,     9,     9,          5    \ Edge 22
 EDGE      11,      13,     9,     9,         18    \ Edge 23

.SHIP_CONSTRICTOR_FACES

    \ normal_x, normal_y, normal_z, visibility
 FACE        0,       55,       15,         31      \ Face 0
 FACE      -24,       75,       20,         31      \ Face 1
 FACE       24,       75,       20,         31      \ Face 2
 FACE       44,       75,        0,         31      \ Face 3
 FACE      -44,       75,        0,         31      \ Face 4
 FACE      -44,       75,        0,         31      \ Face 5
 FACE        0,       53,        0,         31      \ Face 6
 FACE       44,       75,        0,         31      \ Face 7
 FACE        0,        0,     -160,         31      \ Face 8
 FACE        0,      -27,        0,         31      \ Face 9

.SHIP_PYTHON_VERTICES

      \    x,    y,    z, face1, face2, face3, face4, visibility
 VERTEX    0,    0,  224,     0,      1,    2,     3,         31    \ Vertex 0
 VERTEX    0,   48,   48,     0,      1,    4,     5,         31    \ Vertex 1
 VERTEX   96,    0,  -16,    15,     15,   15,    15,         31    \ Vertex 2
 VERTEX  -96,    0,  -16,    15,     15,   15,    15,         31    \ Vertex 3
 VERTEX    0,   48,  -32,     4,      5,    8,     9,         31    \ Vertex 4
 VERTEX    0,   24, -112,     9,      8,   12,    12,         31    \ Vertex 5
 VERTEX  -48,    0, -112,     8,     11,   12,    12,         31    \ Vertex 6
 VERTEX   48,    0, -112,     9,     10,   12,    12,         31    \ Vertex 7
 VERTEX    0,  -48,   48,     2,      3,    6,     7,         31    \ Vertex 8
 VERTEX    0,  -48,  -32,     6,      7,   10,    11,         31    \ Vertex 9
 VERTEX    0,  -24, -112,    10,     11,   12,    12,         31    \ Vertex 10

.SHIP_PYTHON_EDGES

    \ vertex1, vertex2, face1, face2, visibility
 EDGE       0,       8,     2,     3,         31    \ Edge 0
 EDGE       0,       3,     0,     2,         31    \ Edge 1
 EDGE       0,       2,     1,     3,         31    \ Edge 2
 EDGE       0,       1,     0,     1,         31    \ Edge 3
 EDGE       2,       4,     9,     5,         31    \ Edge 4
 EDGE       1,       2,     1,     5,         31    \ Edge 5
 EDGE       2,       8,     7,     3,         31    \ Edge 6
 EDGE       1,       3,     0,     4,         31    \ Edge 7
 EDGE       3,       8,     2,     6,         31    \ Edge 8
 EDGE       2,       9,     7,    10,         31    \ Edge 9
 EDGE       3,       4,     4,     8,         31    \ Edge 10
 EDGE       3,       9,     6,    11,         31    \ Edge 11
 EDGE       3,       5,     8,     8,          7    \ Edge 12
 EDGE       3,      10,    11,    11,          7    \ Edge 13
 EDGE       2,       5,     9,     9,          7    \ Edge 14
 EDGE       2,      10,    10,    10,          7    \ Edge 15
 EDGE       2,       7,     9,    10,         31    \ Edge 16
 EDGE       3,       6,     8,    11,         31    \ Edge 17
 EDGE       5,       6,     8,    12,         31    \ Edge 18
 EDGE       5,       7,     9,    12,         31    \ Edge 19
 EDGE       7,      10,    12,    10,         31    \ Edge 20
 EDGE       6,      10,    11,    12,         31    \ Edge 21
 EDGE       4,       5,     8,     9,         31    \ Edge 22
 EDGE       9,      10,    10,    11,         31    \ Edge 23
 EDGE       1,       4,     4,     5,         31    \ Edge 24
 EDGE       8,       9,     6,     7,         31    \ Edge 25

.SHIP_PYTHON_FACES

    \ normal_x, normal_y, normal_z, visibility
 FACE      -27,       40,       11,        31    \ Face 0
 FACE       27,       40,       11,        31    \ Face 1
 FACE      -27,      -40,       11,        31    \ Face 2
 FACE       27,      -40,       11,        31    \ Face 3
 FACE      -19,       38,        0,        31    \ Face 4
 FACE       19,       38,        0,        31    \ Face 5
 FACE      -19,      -38,        0,        31    \ Face 6
 FACE       19,      -38,        0,        31    \ Face 7
 FACE      -25,       37,      -11,        31    \ Face 8
 FACE       25,       37,      -11,        31    \ Face 9
 FACE       25,      -37,      -11,        31    \ Face 10
 FACE      -25,      -37,      -11,        31    \ Face 11
 FACE        0,        0,     -112,        31    \ Face 12

.SHIP_ANACONDA_VERTICES

      \    x,    y,    z, face1, face2, face3, face4, visibility
 VERTEX    0,    7,  -58,     1,      0,    5,     5,         30    \ Vertex 0
 VERTEX  -43,  -13,  -37,     1,      0,    2,     2,         30    \ Vertex 1
 VERTEX  -26,  -47,   -3,     2,      0,    3,     3,         30    \ Vertex 2
 VERTEX   26,  -47,   -3,     3,      0,    4,     4,         30    \ Vertex 3
 VERTEX   43,  -13,  -37,     4,      0,    5,     5,         30    \ Vertex 4
 VERTEX    0,   48,  -49,     5,      1,    6,     6,         30    \ Vertex 5
 VERTEX  -69,   15,  -15,     2,      1,    7,     7,         30    \ Vertex 6
 VERTEX  -43,  -39,   40,     3,      2,    8,     8,         31    \ Vertex 7
 VERTEX   43,  -39,   40,     4,      3,    9,     9,         31    \ Vertex 8
 VERTEX   69,   15,  -15,     5,      4,   10,    10,         30    \ Vertex 9
 VERTEX  -43,   53,  -23,    15,     15,   15,    15,         31    \ Vertex 10
 VERTEX  -69,   -1,   32,     7,      2,    8,     8,         31    \ Vertex 11
 VERTEX    0,    0,  254,    15,     15,   15,    15,         31    \ Vertex 12
 VERTEX   69,   -1,   32,     9,      4,   10,    10,         31    \ Vertex 13
 VERTEX   43,   53,  -23,    15,     15,   15,    15,         31    \ Vertex 14

.SHIP_ANACONDA_EDGES

    \ vertex1, vertex2, face1, face2, visibility
 EDGE       0,       1,     1,     0,         30    \ Edge 0
 EDGE       1,       2,     2,     0,         30    \ Edge 1
 EDGE       2,       3,     3,     0,         30    \ Edge 2
 EDGE       3,       4,     4,     0,         30    \ Edge 3
 EDGE       0,       4,     5,     0,         30    \ Edge 4
 EDGE       0,       5,     5,     1,         29    \ Edge 5
 EDGE       1,       6,     2,     1,         29    \ Edge 6
 EDGE       2,       7,     3,     2,         29    \ Edge 7
 EDGE       3,       8,     4,     3,         29    \ Edge 8
 EDGE       4,       9,     5,     4,         29    \ Edge 9
 EDGE       5,      10,     6,     1,         30    \ Edge 10
 EDGE       6,      10,     7,     1,         30    \ Edge 11
 EDGE       6,      11,     7,     2,         30    \ Edge 12
 EDGE       7,      11,     8,     2,         30    \ Edge 13
 EDGE       7,      12,     8,     3,         31    \ Edge 14
 EDGE       8,      12,     9,     3,         31    \ Edge 15
 EDGE       8,      13,     9,     4,         30    \ Edge 16
 EDGE       9,      13,    10,     4,         30    \ Edge 17
 EDGE       9,      14,    10,     5,         30    \ Edge 18
 EDGE       5,      14,     6,     5,         30    \ Edge 19
 EDGE      10,      14,    11,     6,         30    \ Edge 20
 EDGE      10,      12,    11,     7,         31    \ Edge 21
 EDGE      11,      12,     8,     7,         31    \ Edge 22
 EDGE      12,      13,    10,     9,         31    \ Edge 23
 EDGE      12,      14,    11,    10,         31    \ Edge 24

.SHIP_ANACONDA_FACES

    \ normal_x, normal_y, normal_z, visibility
 FACE        0,      -51,      -49,         30      \ Face 0
 FACE      -51,       18,      -87,         30      \ Face 1
 FACE      -77,      -57,      -19,         30      \ Face 2
 FACE        0,      -90,       16,         31      \ Face 3
 FACE       77,      -57,      -19,         30      \ Face 4
 FACE       51,       18,      -87,         30      \ Face 5
 FACE        0,      111,      -20,         30      \ Face 6
 FACE      -97,       72,       24,         31      \ Face 7
 FACE     -108,      -68,       34,         31      \ Face 8
 FACE      108,      -68,       34,         31      \ Face 9
 FACE       97,       72,       24,         31      \ Face 10
 FACE        0,       94,       18,         31      \ Face 11


.SHIP_BOA_VERTICES

      \    x,    y,    z, face1, face2, face3, face4, visibility
 VERTEX    0,    0,   93,    15,     15,   15,    15,         31    \ Vertex 0
 VERTEX    0,   40,  -87,     2,      0,    3,     3,         24    \ Vertex 1
 VERTEX   38,  -25,  -99,     1,      0,    4,     4,         24    \ Vertex 2
 VERTEX  -38,  -25,  -99,     2,      1,    5,     5,         24    \ Vertex 3
 VERTEX  -38,   40,  -59,     3,      2,    9,     6,         31    \ Vertex 4
 VERTEX   38,   40,  -59,     3,      0,   11,     6,         31    \ Vertex 5
 VERTEX   62,    0,  -67,     4,      0,   11,     8,         31    \ Vertex 6
 VERTEX   24,  -65,  -79,     4,      1,   10,     8,         31    \ Vertex 7
 VERTEX  -24,  -65,  -79,     5,      1,   10,     7,         31    \ Vertex 8
 VERTEX  -62,    0,  -67,     5,      2,    9,     7,         31    \ Vertex 9
 VERTEX    0,    7, -107,     2,      0,   10,    10,         22    \ Vertex 10
 VERTEX   13,   -9, -107,     1,      0,   10,    10,         22    \ Vertex 11
 VERTEX  -13,   -9, -107,     2,      1,   12,    12,         22    \ Vertex 12

.SHIP_BOA_EDGES

    \ vertex1, vertex2, face1, face2, visibility
 EDGE       0,       5,    11,     6,         31    \ Edge 0
 EDGE       0,       7,    10,     8,         31    \ Edge 1
 EDGE       0,       9,     9,     7,         31    \ Edge 2
 EDGE       0,       4,     9,     6,         29    \ Edge 3
 EDGE       0,       6,    11,     8,         29    \ Edge 4
 EDGE       0,       8,    10,     7,         29    \ Edge 5
 EDGE       4,       5,     6,     3,         31    \ Edge 6
 EDGE       5,       6,    11,     0,         31    \ Edge 7
 EDGE       6,       7,     8,     4,         31    \ Edge 8
 EDGE       7,       8,    10,     1,         31    \ Edge 9
 EDGE       8,       9,     7,     5,         31    \ Edge 10
 EDGE       4,       9,     9,     2,         31    \ Edge 11
 EDGE       1,       4,     3,     2,         24    \ Edge 12
 EDGE       1,       5,     3,     0,         24    \ Edge 13
 EDGE       3,       9,     5,     2,         24    \ Edge 14
 EDGE       3,       8,     5,     1,         24    \ Edge 15
 EDGE       2,       6,     4,     0,         24    \ Edge 16
 EDGE       2,       7,     4,     1,         24    \ Edge 17
 EDGE       1,      10,     2,     0,         22    \ Edge 18
 EDGE       2,      11,     1,     0,         22    \ Edge 19
 EDGE       3,      12,     2,     1,         22    \ Edge 20
 EDGE      10,      11,    12,     0,         14    \ Edge 21
 EDGE      11,      12,    12,     1,         14    \ Edge 22
 EDGE      12,      10,    12,     2,         14    \ Edge 23

.SHIP_BOA_FACES

    \ normal_x, normal_y, normal_z, visibility
 FACE       43,       37,      -60,         31      \ Face 0
 FACE        0,      -45,      -89,         31      \ Face 1
 FACE      -43,       37,      -60,         31      \ Face 2
 FACE        0,       40,        0,         31      \ Face 3
 FACE       62,      -32,      -20,         31      \ Face 4
 FACE      -62,      -32,      -20,         31      \ Face 5
 FACE        0,       23,        6,         31      \ Face 6
 FACE      -23,      -15,        9,         31      \ Face 7
 FACE       23,      -15,        9,         31      \ Face 8
 FACE      -26,       13,       10,         31      \ Face 9
 FACE        0,      -31,       12,         31      \ Face 10
 FACE       26,       13,       10,         31      \ Face 11
 FACE        0,        0,     -107,         14      \ Face 12

.SHIP_COBRA_MK_1_VERTICES

      \    x,    y,    z, face1, face2, face3, face4, visibility
 VERTEX  -18,   -1,   50,     1,      0,    3,     2,         31    \ Vertex 0
 VERTEX   18,   -1,   50,     1,      0,    5,     4,         31    \ Vertex 1
 VERTEX  -66,    0,    7,     3,      2,    8,     8,         31    \ Vertex 2
 VERTEX   66,    0,    7,     5,      4,    9,     9,         31    \ Vertex 3
 VERTEX  -32,   12,  -38,     6,      2,    8,     7,         31    \ Vertex 4
 VERTEX   32,   12,  -38,     6,      4,    9,     7,         31    \ Vertex 5
 VERTEX  -54,  -12,  -38,     3,      1,    8,     7,         31    \ Vertex 6
 VERTEX   54,  -12,  -38,     5,      1,    9,     7,         31    \ Vertex 7
 VERTEX    0,   12,   -6,     2,      0,    6,     4,         20    \ Vertex 8
 VERTEX    0,   -1,   50,     1,      0,    1,     1,          2    \ Vertex 9
 VERTEX    0,   -1,   60,     1,      0,    1,     1,         31    \ Vertex 10

.SHIP_COBRA_MK_1_EDGES

    \ vertex1, vertex2, face1, face2, visibility
 EDGE       1,       0,     1,     0,         31    \ Edge 0
 EDGE       0,       2,     3,     2,         31    \ Edge 1
 EDGE       2,       6,     8,     3,         31    \ Edge 2
 EDGE       6,       7,     7,     1,         31    \ Edge 3
 EDGE       7,       3,     9,     5,         31    \ Edge 4
 EDGE       3,       1,     5,     4,         31    \ Edge 5
 EDGE       2,       4,     8,     2,         31    \ Edge 6
 EDGE       4,       5,     7,     6,         31    \ Edge 7
 EDGE       5,       3,     9,     4,         31    \ Edge 8
 EDGE       0,       8,     2,     0,         20    \ Edge 9
 EDGE       8,       1,     4,     0,         20    \ Edge 10
 EDGE       4,       8,     6,     2,         16    \ Edge 11
 EDGE       8,       5,     6,     4,         16    \ Edge 12
 EDGE       4,       6,     8,     7,         31    \ Edge 13
 EDGE       5,       7,     9,     7,         31    \ Edge 14
 EDGE       0,       6,     3,     1,         20    \ Edge 15
 EDGE       1,       7,     5,     1,         20    \ Edge 16
 EDGE      10,       9,     1,     0,          2    \ Edge 17

.SHIP_COBRA_MK_1_FACES

    \ normal_x, normal_y, normal_z, visibility
 FACE        0,       41,       10,         31      \ Face 0
 FACE        0,      -27,        3,         31      \ Face 1
 FACE       -8,       46,        8,         31      \ Face 2
 FACE      -12,      -57,       12,         31      \ Face 3
 FACE        8,       46,        8,         31      \ Face 4
 FACE       12,      -57,       12,         31      \ Face 5
 FACE        0,       49,        0,         31      \ Face 6
 FACE        0,        0,     -154,         31      \ Face 7
 FACE     -121,      111,      -62,         31      \ Face 8
 FACE      121,      111,      -62,         31      \ Face 9

.SHIP_MORAY_VERTICES

      \    x,    y,    z, face1, face2, face3, face4, visibility
 VERTEX   15,    0,   65,     2,      0,    8,     7,         31    \ Vertex 0
 VERTEX  -15,    0,   65,     1,      0,    7,     6,         31    \ Vertex 1
 VERTEX    0,   18,  -40,    15,     15,   15,    15,         17    \ Vertex 2
 VERTEX  -60,    0,    0,     3,      1,    6,     6,         31    \ Vertex 3
 VERTEX   60,    0,    0,     5,      2,    8,     8,         31    \ Vertex 4
 VERTEX   30,  -27,  -10,     5,      4,    8,     7,         24    \ Vertex 5
 VERTEX  -30,  -27,  -10,     4,      3,    7,     6,         24    \ Vertex 6
 VERTEX   -9,   -4,  -25,     4,      4,    4,     4,          7    \ Vertex 7
 VERTEX    9,   -4,  -25,     4,      4,    4,     4,          7    \ Vertex 8
 VERTEX    0,  -18,  -16,     4,      4,    4,     4,          7    \ Vertex 9
 VERTEX   13,    3,   49,     0,      0,    0,     0,          5    \ Vertex 10
 VERTEX    6,    0,   65,     0,      0,    0,     0,          5    \ Vertex 11
 VERTEX  -13,    3,   49,     0,      0,    0,     0,          5    \ Vertex 12
 VERTEX   -6,    0,   65,     0,      0,    0,     0,          5    \ Vertex 13

.SHIP_MORAY_EDGES

    \ vertex1, vertex2, face1, face2, visibility
 EDGE       0,       1,     7,     0,         31    \ Edge 0
 EDGE       1,       3,     6,     1,         31    \ Edge 1
 EDGE       3,       6,     6,     3,         24    \ Edge 2
 EDGE       5,       6,     7,     4,         24    \ Edge 3
 EDGE       4,       5,     8,     5,         24    \ Edge 4
 EDGE       0,       4,     8,     2,         31    \ Edge 5
 EDGE       1,       6,     7,     6,         15    \ Edge 6
 EDGE       0,       5,     8,     7,         15    \ Edge 7
 EDGE       0,       2,     2,     0,         15    \ Edge 8
 EDGE       1,       2,     1,     0,         15    \ Edge 9
 EDGE       2,       3,     3,     1,         17    \ Edge 10
 EDGE       2,       4,     5,     2,         17    \ Edge 11
 EDGE       2,       5,     5,     4,         13    \ Edge 12
 EDGE       2,       6,     4,     3,         13    \ Edge 13
 EDGE       7,       8,     4,     4,          5    \ Edge 14
 EDGE       7,       9,     4,     4,          7    \ Edge 15
 EDGE       8,       9,     4,     4,          7    \ Edge 16
 EDGE      10,      11,     0,     0,          5    \ Edge 17
 EDGE      12,      13,     0,     0,          5    \ Edge 18

.SHIP_MORAY_FACES

    \ normal_x, normal_y, normal_z, visibility
 FACE        0,       43,        7,         31      \ Face 0
 FACE      -10,       49,        7,         31      \ Face 1
 FACE       10,       49,        7,         31      \ Face 2
 FACE      -59,      -28,     -101,         24      \ Face 3
 FACE        0,      -52,      -78,         24      \ Face 4
 FACE       59,      -28,     -101,         24      \ Face 5
 FACE      -72,      -99,       50,         31      \ Face 6
 FACE        0,      -83,       30,         31      \ Face 7
 FACE       72,      -99,       50,         31      \ Face 8

.SHIP_SHUTTLE_VERTICES

                        \ --- Mod: Code removed for Elite-A: ------------------>

\     \    x,    y,    z, face1, face2, face3, face4, visibility
\VERTEX    0,  -17,   23,    15,     15,   15,    15,         31    \ Vertex 0
\VERTEX  -17,    0,   23,    15,     15,   15,    15,         31    \ Vertex 1
\VERTEX    0,   18,   23,    15,     15,   15,    15,         31    \ Vertex 2
\VERTEX   18,    0,   23,    15,     15,   15,    15,         31    \ Vertex 3
\VERTEX  -20,  -20,  -27,     2,      1,    9,     3,         31    \ Vertex 4
\VERTEX  -20,   20,  -27,     4,      3,    9,     5,         31    \ Vertex 5
\VERTEX   20,   20,  -27,     6,      5,    9,     7,         31    \ Vertex 6
\VERTEX   20,  -20,  -27,     7,      1,    9,     8,         31    \ Vertex 7
\VERTEX    5,    0,  -27,     9,      9,    9,     9,         16    \ Vertex 8
\VERTEX    0,   -2,  -27,     9,      9,    9,     9,         16    \ Vertex 9
\VERTEX   -5,    0,  -27,     9,      9,    9,     9,          9    \ Vertex 10
\VERTEX    0,    3,  -27,     9,      9,    9,     9,          9    \ Vertex 11
\VERTEX    0,   -9,   35,    10,      0,   12,    11,         16    \ Vertex 12
\VERTEX    3,   -1,   31,    15,     15,    2,     0,          7    \ Vertex 13
\VERTEX    4,   11,   25,     1,      0,    4,    15,          8    \ Vertex 14
\VERTEX   11,    4,   25,     1,     10,   15,     3,          8    \ Vertex 15
\VERTEX   -3,   -1,   31,    11,      6,    3,     2,          7    \ Vertex 16
\VERTEX   -3,   11,   25,     8,     15,    0,    12,          8    \ Vertex 17
\VERTEX  -10,    4,   25,    15,      4,    8,     1,          8    \ Vertex 18

                        \ --- And replaced by: -------------------------------->

      \    x,    y,    z, face1, face2, face3, face4, visibility
 VERTEX    0,  -35,   47,    15,    15,    15,    15,         31     \ Vertex 0
 VERTEX  -35,    0,   47,    15,    15,    15,    15,         31     \ Vertex 1
 VERTEX    0,   35,   47,    15,    15,    15,    15,         31     \ Vertex 2
 VERTEX   35,    0,   47,    15,    15,    15,    15,         31     \ Vertex 3
 VERTEX  -40,  -40,  -53,     2,     1,     9,     3,         31     \ Vertex 4
 VERTEX  -40,   40,  -53,     4,     3,     9,     5,         31     \ Vertex 5
 VERTEX   40,   40,  -53,     6,     5,     9,     7,         31     \ Vertex 6
 VERTEX   40,  -40,  -53,     7,     1,     9,     8,         31     \ Vertex 7
 VERTEX   10,    0,  -53,     9,     9,     9,     9,         16     \ Vertex 8
 VERTEX    0,   -5,  -53,     9,     9,     9,     9,         16     \ Vertex 9
 VERTEX  -10,    0,  -53,     9,     9,     9,     9,          8     \ Vertex 10
 VERTEX    0,    5,  -53,     9,     9,     9,     9,          8     \ Vertex 11
 VERTEX    0,  -17,   71,    10,     0,    12,    11,         16     \ Vertex 12
 VERTEX    5,   -2,   61,    15,    15,     2,     0,          6     \ Vertex 13
 VERTEX    7,   23,   49,     1,     0,     4,    15,          7     \ Vertex 14
 VERTEX   21,    9,   49,     1,    10,    15,     3,          7     \ Vertex 15
 VERTEX   -5,   -2,   61,    11,     6,     3,     2,          6     \ Vertex 16
 VERTEX   -7,   23,   49,     8,    15,     0,    12,          7     \ Vertex 17
 VERTEX  -21,    9,   49,    15,     4,     8,     1,          7     \ Vertex 18

                        \ --- End of replacement ------------------------------>

.SHIP_SHUTTLE_EDGES

    \ vertex1, vertex2, face1, face2, visibility
 EDGE       0,       1,     2,     0,         31    \ Edge 0
 EDGE       1,       2,    10,     4,         31    \ Edge 1
 EDGE       2,       3,    11,     6,         31    \ Edge 2
 EDGE       0,       3,    12,     8,         31    \ Edge 3
 EDGE       0,       7,     8,     1,         31    \ Edge 4
 EDGE       0,       4,     2,     1,         24    \ Edge 5
 EDGE       1,       4,     3,     2,         31    \ Edge 6
 EDGE       1,       5,     4,     3,         24    \ Edge 7
 EDGE       2,       5,     5,     4,         31    \ Edge 8
 EDGE       2,       6,     6,     5,         12    \ Edge 9
 EDGE       3,       6,     7,     6,         31    \ Edge 10
 EDGE       3,       7,     8,     7,         24    \ Edge 11
 EDGE       4,       5,     9,     3,         31    \ Edge 12
 EDGE       5,       6,     9,     5,         31    \ Edge 13
 EDGE       6,       7,     9,     7,         31    \ Edge 14
 EDGE       4,       7,     9,     1,         31    \ Edge 15
 EDGE       0,      12,    12,     0,         16    \ Edge 16
 EDGE       1,      12,    10,     0,         16    \ Edge 17
 EDGE       2,      12,    11,    10,         16    \ Edge 18
 EDGE       3,      12,    12,    11,         16    \ Edge 19
 EDGE       8,       9,     9,     9,         16    \ Edge 20

                        \ --- Mod: Code removed for Elite-A: ------------------>

\EDGE       9,      10,     9,     9,          7    \ Edge 21
\EDGE      10,      11,     9,     9,          9    \ Edge 22
\EDGE       8,      11,     9,     9,          7    \ Edge 23
\EDGE      13,      14,    11,    11,          5    \ Edge 24
\EDGE      14,      15,    11,    11,          8    \ Edge 25
\EDGE      13,      15,    11,    11,          7    \ Edge 26
\EDGE      16,      17,    10,    10,          5    \ Edge 27
\EDGE      17,      18,    10,    10,          8    \ Edge 28
\EDGE      16,      18,    10,    10,          7    \ Edge 29

                        \ --- And replaced by: -------------------------------->

 EDGE       9,      10,     9,     9,          6    \ Edge 21
 EDGE      10,      11,     9,     9,          8    \ Edge 22
 EDGE       8,      11,     9,     9,          6    \ Edge 23
 EDGE      13,      14,    11,    11,          4    \ Edge 24
 EDGE      14,      15,    11,    11,          7    \ Edge 25
 EDGE      13,      15,    11,    11,          6    \ Edge 26
 EDGE      16,      17,    10,    10,          4    \ Edge 27
 EDGE      17,      18,    10,    10,          7    \ Edge 28
 EDGE      16,      18,    10,    10,          6    \ Edge 29

                        \ --- End of replacement ------------------------------>

.SHIP_SHUTTLE_FACES

                        \ --- Mod: Code removed for Elite-A: ------------------>

\   \ normal_x, normal_y, normal_z, visibility
\FACE      -55,      -55,       40,         31      \ Face 0
\FACE        0,      -74,        4,         31      \ Face 1
\FACE      -51,      -51,       23,         31      \ Face 2
\FACE      -74,        0,        4,         31      \ Face 3
\FACE      -51,       51,       23,         31      \ Face 4
\FACE        0,       74,        4,         31      \ Face 5
\FACE       51,       51,       23,         31      \ Face 6
\FACE       74,        0,        4,         31      \ Face 7
\FACE       51,      -51,       23,         31      \ Face 8
\FACE        0,        0,     -107,         31      \ Face 9
\FACE      -41,       41,       90,         31      \ Face 10
\FACE       41,       41,       90,         31      \ Face 11
\FACE       55,      -55,       40,         31      \ Face 12

                        \ --- And replaced by: -------------------------------->

    \ normal_x, normal_y, normal_z, visibility
 FACE     -110,     -110,       80,         31      \ Face 0
 FACE        0,     -149,        7,         31      \ Face 1
 FACE     -102,     -102,       46,         31      \ Face 2
 FACE     -149,        0,        7,         31      \ Face 3
 FACE     -102,      102,       46,         31      \ Face 4
 FACE        0,      149,        7,         31      \ Face 5
 FACE      102,      102,       46,         31      \ Face 6
 FACE      149,        0,        7,         31      \ Face 7
 FACE      102,     -102,       46,         31      \ Face 8
 FACE        0,        0,     -213,         31      \ Face 9
 FACE      -81,       81,      177,         31      \ Face 10
 FACE       81,       81,      177,         31      \ Face 11
 FACE      110,     -110,       80,         31      \ Face 12

.SHIP_WORM_VERTICES

      \    x,    y,    z, face1, face2, face3, face4, visibility
 VERTEX   10,  -10,   35,     2,      0,    7,     7,         31    \ Vertex 0
 VERTEX  -10,  -10,   35,     3,      0,    7,     7,         31    \ Vertex 1
 VERTEX    5,    6,   15,     1,      0,    4,     2,         31    \ Vertex 2
 VERTEX   -5,    6,   15,     1,      0,    5,     3,         31    \ Vertex 3
 VERTEX   15,  -10,   25,     4,      2,    7,     7,         31    \ Vertex 4
 VERTEX  -15,  -10,   25,     5,      3,    7,     7,         31    \ Vertex 5
 VERTEX   26,  -10,  -25,     6,      4,    7,     7,         31    \ Vertex 6
 VERTEX  -26,  -10,  -25,     6,      5,    7,     7,         31    \ Vertex 7
 VERTEX    8,   14,  -25,     4,      1,    6,     6,         31    \ Vertex 8
 VERTEX   -8,   14,  -25,     5,      1,    6,     6,         31    \ Vertex 9

.SHIP_WORM_EDGES

    \ vertex1, vertex2, face1, face2, visibility
 EDGE       0,       1,     7,     0,         31    \ Edge 0
 EDGE       1,       5,     7,     3,         31    \ Edge 1
 EDGE       5,       7,     7,     5,         31    \ Edge 2
 EDGE       7,       6,     7,     6,         31    \ Edge 3
 EDGE       6,       4,     7,     4,         31    \ Edge 4
 EDGE       4,       0,     7,     2,         31    \ Edge 5
 EDGE       0,       2,     2,     0,         31    \ Edge 6
 EDGE       1,       3,     3,     0,         31    \ Edge 7
 EDGE       4,       2,     4,     2,         31    \ Edge 8
 EDGE       5,       3,     5,     3,         31    \ Edge 9
 EDGE       2,       8,     4,     1,         31    \ Edge 10
 EDGE       8,       6,     6,     4,         31    \ Edge 11
 EDGE       3,       9,     5,     1,         31    \ Edge 12
 EDGE       9,       7,     6,     5,         31    \ Edge 13
 EDGE       2,       3,     1,     0,         31    \ Edge 14
 EDGE       8,       9,     6,     1,         31    \ Edge 15

.SHIP_WORM_FACES

    \ normal_x, normal_y, normal_z, visibility
 FACE        0,       88,       70,         31      \ Face 0
 FACE        0,       69,       14,         31      \ Face 1
 FACE       70,       66,       35,         31      \ Face 2
 FACE      -70,       66,       35,         31      \ Face 3
 FACE       64,       49,       14,         31      \ Face 4
 FACE      -64,       49,       14,         31      \ Face 5
 FACE        0,        0,     -200,         31      \ Face 6
 FACE        0,      -80,        0,         31      \ Face 7

.SHIP_CHAMELEON_VERTICES

      \    x,    y,    z, face1, face2, face3, face4, visibility
 VERTEX  -18,    0,  110,     5,     2,     1,     0,         31     \ Vertex 0
 VERTEX   18,    0,  110,     4,     3,     1,     0,         31     \ Vertex 1
 VERTEX  -40,    0,    0,    11,     8,     5,     2,         31     \ Vertex 2
 VERTEX   -8,   24,    0,     8,     6,     2,     2,         31     \ Vertex 3
 VERTEX    8,   24,    0,     9,     6,     3,     3,         31     \ Vertex 4
 VERTEX   40,    0,    0,    10,     9,     4,     3,         31     \ Vertex 5
 VERTEX    8,  -24,    0,    10,     7,     4,     4,         31     \ Vertex 6
 VERTEX   -8,  -24,    0,    11,     7,     5,     5,         31     \ Vertex 7
 VERTEX    0,   24,   40,     6,     3,     2,     0,         31     \ Vertex 8
 VERTEX    0,  -24,   40,     7,     5,     4,     1,         31     \ Vertex 9
 VERTEX  -32,    0,  -40,    12,    11,     8,     8,         31     \ Vertex 10
 VERTEX    0,   24,  -40,    12,     9,     8,     6,         31     \ Vertex 11
 VERTEX   32,    0,  -40,    12,    10,     9,     9,         31     \ Vertex 12
 VERTEX    0,  -24,  -40,    12,    11,    10,     7,         31     \ Vertex 13
 VERTEX   -8,    0,  -40,    12,    12,    12,    12,         10     \ Vertex 14
 VERTEX    0,    8,  -40,    12,    12,    12,    12,         10     \ Vertex 15
 VERTEX    8,    0,  -40,    12,    12,    12,    12,         10     \ Vertex 16
 VERTEX    0,   -8,  -40,    12,    12,    12,    12,         10     \ Vertex 17

.SHIP_CHAMELEON_EDGES

    \ vertex1, vertex2, face1, face2, visibility
 EDGE       0,       1,     1,     0,         31    \ Edge 0
 EDGE       0,       8,     2,     0,         31    \ Edge 1
 EDGE       0,       9,     5,     1,         31    \ Edge 2
 EDGE       1,       8,     3,     0,         31    \ Edge 3
 EDGE       1,       9,     4,     1,         31    \ Edge 4
 EDGE       1,       5,     4,     3,         31    \ Edge 5
 EDGE       0,       2,     5,     2,         31    \ Edge 6
 EDGE       3,       8,     6,     2,         31    \ Edge 7
 EDGE       4,       8,     6,     3,         31    \ Edge 8
 EDGE       7,       9,     5,     7,         31    \ Edge 9
 EDGE       6,       9,     4,     7,         31    \ Edge 10
 EDGE       4,       5,     9,     3,         31    \ Edge 11
 EDGE       5,       6,    10,     4,         31    \ Edge 12
 EDGE       2,       3,     8,     2,         31    \ Edge 13
 EDGE       2,       7,    11,     5,         31    \ Edge 14
 EDGE       2,      10,    11,     8,         31    \ Edge 15
 EDGE       5,      12,    10,     9,         31    \ Edge 16
 EDGE       3,      11,     8,     6,         31    \ Edge 17
 EDGE       7,      13,    11,     7,         31    \ Edge 18
 EDGE       4,      11,     9,     6,         31    \ Edge 19
 EDGE       6,      13,    10,     7,         31    \ Edge 20
 EDGE      10,      11,    12,     8,         31    \ Edge 21
 EDGE      10,      13,    12,    11,         31    \ Edge 22
 EDGE      11,      12,    12,     9,         31    \ Edge 23
 EDGE      12,      13,    12,    10,         31    \ Edge 24
 EDGE      14,      15,    12,    12,         10    \ Edge 25
 EDGE      15,      16,    12,    12,         10    \ Edge 26
 EDGE      16,      17,    12,    12,         10    \ Edge 27
 EDGE      17,      14,    12,    12,         10    \ Edge 28

.SHIP_CHAMELEON_FACES

    \ normal_x, normal_y, normal_z, visibility
 FACE        0,       90,       31,         31      \ Face 0
 FACE        0,      -90,       31,         31      \ Face 1
 FACE      -57,       76,       11,         31      \ Face 2
 FACE       57,       76,       11,         31      \ Face 3
 FACE       57,      -76,       11,         31      \ Face 4
 FACE      -57,      -76,       11,         31      \ Face 5
 FACE        0,       96,        0,         31      \ Face 6
 FACE        0,      -96,        0,         31      \ Face 7
 FACE      -57,       76,      -11,         31      \ Face 8
 FACE       57,       76,      -11,         31      \ Face 9
 FACE       57,      -76,      -11,         31      \ Face 10
 FACE      -57,      -76,      -11,         31      \ Face 11
 FACE        0,        0,      -96,         31      \ Face 12

.SHIP_IGUANA_VERTICES

      \    x,    y,    z, face1, face2, face3, face4, visibility
 VERTEX    0,    0,   90,     3,     2,     1,     0,         31     \ Vertex 0
 VERTEX    0,   20,   30,     6,     4,     2,     0,         31     \ Vertex 1
 VERTEX  -40,    0,   10,     5,     4,     1,     0,         31     \ Vertex 2
 VERTEX    0,  -20,   30,     7,     5,     3,     1,         31     \ Vertex 3
 VERTEX   40,    0,   10,     7,     6,     3,     2,         31     \ Vertex 4
 VERTEX    0,   20,  -40,     9,     8,     6,     4,         31     \ Vertex 5
 VERTEX  -40,    0,  -30,     8,     8,     5,     4,         31     \ Vertex 6
 VERTEX    0,  -20,  -40,     9,     8,     7,     5,         31     \ Vertex 7
 VERTEX   40,    0,  -30,     9,     9,     7,     6,         31     \ Vertex 8
 VERTEX  -40,    0,   40,     1,     1,     0,     0,         30     \ Vertex 9
 VERTEX   40,    0,   40,     3,     3,     2,     2,         30     \ Vertex 10
 VERTEX    0,    8,  -40,     9,     9,     8,     8,         10     \ Vertex 11
 VERTEX  -16,    0,  -36,     8,     8,     8,     8,         10     \ Vertex 12
 VERTEX    0,   -8,  -40,     9,     9,     8,     8,         10     \ Vertex 13
 VERTEX   16,    0,  -36,     9,     9,     9,     9,         10     \ Vertex 14

.SHIP_IGUANA_EDGES

    \ vertex1, vertex2, face1, face2, visibility
 EDGE       0,       1,     2,     0,         31    \ Edge 0
 EDGE       0,       2,     1,     0,         31    \ Edge 1
 EDGE       0,       3,     3,     1,         31    \ Edge 2
 EDGE       0,       4,     3,     2,         31    \ Edge 3
 EDGE       1,       5,     6,     4,         31    \ Edge 4
 EDGE       2,       6,     5,     4,         31    \ Edge 5
 EDGE       3,       7,     7,     5,         31    \ Edge 6
 EDGE       4,       8,     7,     6,         31    \ Edge 7
 EDGE       5,       6,     8,     4,         31    \ Edge 8
 EDGE       6,       7,     8,     5,         31    \ Edge 9
 EDGE       5,       8,     9,     6,         31    \ Edge 10
 EDGE       7,       8,     9,     7,         31    \ Edge 11
 EDGE       1,       2,     4,     0,         31    \ Edge 12
 EDGE       2,       3,     5,     1,         31    \ Edge 13
 EDGE       1,       4,     6,     2,         31    \ Edge 14
 EDGE       3,       4,     7,     3,         31    \ Edge 15
 EDGE       5,       7,     9,     8,         31    \ Edge 16
 EDGE       2,       9,     1,     0,         30    \ Edge 17
 EDGE       4,      10,     3,     2,         30    \ Edge 18
 EDGE      11,      12,     8,     8,         10    \ Edge 19
 EDGE      13,      12,     8,     8,         10    \ Edge 20
 EDGE      11,      14,     9,     9,         10    \ Edge 21
 EDGE      13,      14,     9,     9,         10    \ Edge 22

.SHIP_IGUANA_FACES

    \ normal_x, normal_y, normal_z, visibility
 FACE      -51,       77,       25,         31      \ Face 0
 FACE      -51,      -77,       25,         31      \ Face 1
 FACE       51,       77,       25,         31      \ Face 2
 FACE       51,      -77,       25,         31      \ Face 3
 FACE      -42,       85,        0,         31      \ Face 4
 FACE      -42,      -85,        0,         31      \ Face 5
 FACE       42,       85,        0,         31      \ Face 6
 FACE       42,      -85,        0,         31      \ Face 7
 FACE      -23,        0,      -93,         31      \ Face 8
 FACE       23,        0,      -93,         31      \ Face 9

.SHIP_COUGAR_VERTICES

      \    x,    y,    z, face1, face2, face3, face4, visibility
 VERTEX    0,    5,   67,     2,      0,    4,     4,         31    \ Vertex 0
 VERTEX  -20,    0,   40,     1,      0,    2,     2,         31    \ Vertex 1
 VERTEX  -40,    0,  -40,     1,      0,    5,     5,         31    \ Vertex 2
 VERTEX    0,   14,  -40,     4,      0,    5,     5,         30    \ Vertex 3
 VERTEX    0,  -14,  -40,     2,      1,    5,     3,         30    \ Vertex 4
 VERTEX   20,    0,   40,     3,      2,    4,     4,         31    \ Vertex 5
 VERTEX   40,    0,  -40,     4,      3,    5,     5,         31    \ Vertex 6
 VERTEX  -36,    0,   56,     1,      0,    1,     1,         31    \ Vertex 7
 VERTEX  -60,    0,  -20,     1,      0,    1,     1,         31    \ Vertex 8
 VERTEX   36,    0,   56,     4,      3,    4,     4,         31    \ Vertex 9
 VERTEX   60,    0,  -20,     4,      3,    4,     4,         31    \ Vertex 10
 VERTEX    0,    7,   35,     0,      0,    4,     4,         18    \ Vertex 11
 VERTEX    0,    8,   25,     0,      0,    4,     4,         20    \ Vertex 12
 VERTEX  -12,    2,   45,     0,      0,    0,     0,         20    \ Vertex 13
 VERTEX   12,    2,   45,     4,      4,    4,     4,         20    \ Vertex 14
 VERTEX  -10,    6,  -40,     5,      5,    5,     5,         20    \ Vertex 15
 VERTEX  -10,   -6,  -40,     5,      5,    5,     5,         20    \ Vertex 16
 VERTEX   10,   -6,  -40,     5,      5,    5,     5,         20    \ Vertex 17
 VERTEX   10,    6,  -40,     5,      5,    5,     5,         20    \ Vertex 18

.SHIP_COUGAR_EDGES

    \ vertex1, vertex2, face1, face2, visibility
 EDGE       0,       1,     2,     0,         31    \ Edge 0
 EDGE       1,       7,     1,     0,         31    \ Edge 1
 EDGE       7,       8,     1,     0,         31    \ Edge 2
 EDGE       8,       2,     1,     0,         31    \ Edge 3
 EDGE       2,       3,     5,     0,         30    \ Edge 4
 EDGE       3,       6,     5,     4,         30    \ Edge 5
 EDGE       2,       4,     5,     1,         30    \ Edge 6
 EDGE       4,       6,     5,     3,         30    \ Edge 7
 EDGE       6,      10,     4,     3,         31    \ Edge 8
 EDGE      10,       9,     4,     3,         31    \ Edge 9
 EDGE       9,       5,     4,     3,         31    \ Edge 10
 EDGE       5,       0,     4,     2,         31    \ Edge 11
 EDGE       0,       3,     4,     0,         27    \ Edge 12
 EDGE       1,       4,     2,     1,         27    \ Edge 13
 EDGE       5,       4,     3,     2,         27    \ Edge 14
 EDGE       1,       2,     1,     0,         26    \ Edge 15
 EDGE       5,       6,     4,     3,         26    \ Edge 16
 EDGE      12,      13,     0,     0,         20    \ Edge 17
 EDGE      13,      11,     0,     0,         18    \ Edge 18
 EDGE      11,      14,     4,     4,         18    \ Edge 19
 EDGE      14,      12,     4,     4,         20    \ Edge 20
 EDGE      15,      16,     5,     5,         18    \ Edge 21
 EDGE      16,      18,     5,     5,         20    \ Edge 22
 EDGE      18,      17,     5,     5,         18    \ Edge 23
 EDGE      17,      15,     5,     5,         20    \ Edge 24

.SHIP_COUGAR_FACES

    \ normal_x, normal_y, normal_z, visibility
 FACE      -16,       46,        4,         31      \ Face 0
 FACE      -16,      -46,        4,         31      \ Face 1
 FACE        0,      -27,        5,         31      \ Face 2
 FACE       16,      -46,        4,         31      \ Face 3
 FACE       16,       46,        4,         31      \ Face 4
 FACE        0,        0,     -160,         30      \ Face 5
