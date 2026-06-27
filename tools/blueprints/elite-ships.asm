\ ============================================================================
\ Right on Commander — ship blueprints (parser input for bbcelite_to_mesh.py)
\
\ VERTEX / EDGE / FACE macro data for the first batch of hulls, extracted from
\ Mark Moxon's annotated BBC Elite source (https://www.bbcelite.com), disc
\ version. Geometry derives from Acornsoft Elite (1984, Bell & Braben) and is
\ used here as homage; see tasks.md T9.6 for the IP/licensing sanity-check.
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
