"""Facets for browsing, measured from the glyphs themselves (no hand tagging).

size     letter height in pixels: tiny (5-6), small (7-8), medium (9-11), large (12+)
weight   typical stroke width: thin (1 px), bold (2 px), heavy (3 px and more)
slant    italic when the tops of straight letters sit clearly right of their feet
license  public domain, free with credit, share-alike, unknown
family   near-identical fonts (under 12 % of letter pixels differ) are grouped together
"""
from collections import defaultdict

import numpy as np

CAPS = list(range(ord("A"), ord("Z") + 1))
CODES = CAPS + list(range(ord("0"), ord("9") + 1))
STRAIGHT = [ord(c) for c in "HIKLNTUY"]


def letter_height(glyphs):
    caps = [glyphs[c] for c in CAPS if c in glyphs and glyphs[c].any()]
    rows = np.nonzero(np.any(caps, axis=0).any(axis=1))[0]
    return int(rows.max() - rows.min() + 1)


def size_class(height):
    return "tiny" if height <= 6 else "small" if height <= 8 else "medium" if height <= 11 else "large"


def stroke_weight(glyphs):
    """Mean length of horizontal ink runs in A-Z: about 1.4 for 1 px strokes, 2.4 for 2 px."""
    runs = []
    for c in CAPS:
        if c not in glyphs:
            continue
        for row in glyphs[c]:
            edges = np.diff(np.concatenate([[0], row.astype(np.int8), [0]]))
            starts, ends = np.nonzero(edges == 1)[0], np.nonzero(edges == -1)[0]
            runs.extend(ends - starts)
    return float(np.mean(runs))


def weight_class(w):
    return "thin" if w < 1.9 else "bold" if w < 3.2 else "heavy"


def slant(glyphs):
    """How far (px) the top third of straight letters sits right of the bottom third."""
    shifts = []
    for c in STRAIGHT:
        g = glyphs.get(c)
        if g is None or not g.any():
            continue
        rows = np.nonzero(g.any(axis=1))[0]
        k = max(1, len(rows) // 3)
        top, bottom = g[rows.min():rows.min() + k], g[rows.max() - k + 1:rows.max() + 1]
        if top.any() and bottom.any():
            shifts.append(np.nonzero(top)[1].mean() - np.nonzero(bottom)[1].mean())
    return float(np.mean(shifts)) if shifts else 0.0


def license_group(license):
    l = (license or "").lower()
    if l.startswith(("cc0", "public domain")) or "wtfpl" in l:
        return "public-domain"
    if "by-sa" in l or "gpl" in l:
        return "share-alike"
    if l in ("", "unknown"):
        return "unknown"
    return "credit"


def _difference(a, b):
    codes = [c for c in CODES if c in a and c in b]
    if len(codes) < 30 or any(a[c].shape != b[c].shape for c in codes):
        return 1.0
    diff = sum(int((a[c] != b[c]).sum()) for c in codes)
    ink = sum(int((a[c] | b[c]).sum()) for c in codes)
    return diff / max(ink, 1)


def families(glyph_sets, threshold=0.12):
    """Group near-identical fonts. Returns a list of index lists (union-find over pairs)."""
    n = len(glyph_sets)
    parent = list(range(n))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for i in range(n):
        for j in range(i + 1, n):
            if _difference(glyph_sets[i], glyph_sets[j]) < threshold:
                parent[find(i)] = find(j)
    groups = defaultdict(list)
    for i in range(n):
        groups[find(i)].append(i)
    return list(groups.values())


def describe(fonts):
    """fonts: list of (entry, glyphs, score). Returns one trait dict per font, in order."""
    glyph_sets = [g for _, g, _ in fonts]
    slants = [slant(g) for g in glyph_sets]
    typical = float(np.median(slants))
    out = []
    for (e, g, score), s in zip(fonts, slants):
        h = letter_height(g)
        w = stroke_weight(g)
        out.append({
            "height": h,
            "sizeClass": size_class(h),
            "weight": weight_class(w),
            "italic": bool(s - typical > 0.9),
            "licenseGroup": license_group(e["license"]),
        })
    for members in families(glyph_sets):
        # the family is named after its best-known member: shortlist first, then IBM, then best match
        def rank(i):
            e, _, score = fonts[i]
            return (not e.get("featured", False), not e["id"].startswith("ibm-"), -score, e["id"])

        members.sort(key=rank)
        lead = fonts[members[0]][0]["id"]
        for k, i in enumerate(members):
            out[i]["family"] = lead
            out[i]["familySize"] = len(members)
            out[i]["familyLead"] = k == 0
    return out
