#!/usr/bin/env python3
"""
Turn docs/logos/2.jpg-style assets into a clean transparent PNG:

- Remove fake checkerboard (edge-connected flood fill on light pixels).
- Strip light anti-alias fringes at the transparency boundary.
- Optionally grow the silhouette outward by N pixels (solid navy).
- Snap every opaque pixel to the nearest flat brand color (no JPEG grain).

Dependencies: Python 3.10+, Pillow, NumPy (no SciPy).

Example:
  python3 docs/logos/scripts/jpg-to-clean-transparent-png.py \\
    --input docs/logos/2.jpg --output docs/logos/2.png
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image


# Flat palette (RGB) derived from asset medians; opaque pixels snap to nearest.
NAVY = np.array([19, 32, 59], dtype=np.uint8)
GREY = np.array([166, 167, 166], dtype=np.uint8)
YELLOW = np.array([232, 186, 38], dtype=np.uint8)
PALETTE = np.stack([NAVY, GREY, YELLOW], axis=0).astype(np.float32)  # (3, 3)

BG_LUMA_MIN = 192
HALO_THRESHOLDS = (88, 80)
OUTWARD_DILATE_STEPS = 2


def _binary_dilate(mask: np.ndarray, iterations: int = 1) -> np.ndarray:
    """8-connected binary dilation without SciPy."""
    out = mask.astype(bool)
    for _ in range(iterations):
        m = out
        h, w = m.shape
        padded = np.pad(m, 1, mode="constant", constant_values=False)
        stacked = np.empty((9, h, w), dtype=bool)
        idx = 0
        for di in range(3):
            for dj in range(3):
                stacked[idx] = padded[di : h + di, dj : w + dj]
                idx += 1
        out = stacked.any(axis=0)
    return out


def _remove_checkerboard(rgb: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Return (rgb_uint8 h*w*3, alpha_uint8 h*w) with checkerboard transparent."""
    rgb_u16 = rgb.astype(np.uint16)
    h, w = rgb_u16.shape[:2]
    luma = (rgb_u16[:, :, 0] + rgb_u16[:, :, 1] + rgb_u16[:, :, 2]) / 3.0
    bg_color = luma >= BG_LUMA_MIN

    visited = np.zeros((h, w), dtype=bool)
    transparent = np.zeros((h, w), dtype=bool)
    from collections import deque

    q: deque[tuple[int, int]] = deque()

    def try_add(x: int, y: int) -> None:
        if x < 0 or x >= w or y < 0 or y >= h or visited[y, x]:
            return
        visited[y, x] = True
        if bg_color[y, x]:
            transparent[y, x] = True
            q.append((x, y))

    for x in range(w):
        try_add(x, 0)
        try_add(x, h - 1)
    for y in range(h):
        try_add(0, y)
        try_add(w - 1, y)

    while q:
        x, y = q.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if nx < 0 or nx >= w or ny < 0 or ny >= h or visited[ny, nx]:
                continue
            visited[ny, nx] = True
            if bg_color[ny, nx]:
                transparent[ny, nx] = True
                q.append((nx, ny))

    rgb_u8 = rgb_u16.astype(np.uint8)
    alpha = np.where(transparent, 0, 255).astype(np.uint8)
    return rgb_u8, alpha


def _strip_light_halo(rgb: np.ndarray, alpha: np.ndarray) -> None:
    """In-place: clear alpha on opaque pixels that touch transparency and are too light."""
    a = alpha
    for thresh in HALO_THRESHOLDS:
        for _ in range(30):
            opaque = a >= 128
            tr = a < 128
            tr_dil = _binary_dilate(tr, iterations=1)
            edge = opaque & tr_dil
            luma = rgb.astype(np.float32).mean(axis=2)
            remove = edge & (luma > thresh)
            if not remove.any():
                break
            a[remove] = 0


def _expand_silhouette_outward(
    rgb: np.ndarray, alpha: np.ndarray, steps: int, fill_rgb: np.ndarray
) -> None:
    """In-place: dilate opaque mask by `steps` and fill new pixels with fill_rgb."""
    if steps <= 0:
        return
    opaque = alpha >= 128
    grown = _binary_dilate(opaque, iterations=steps)
    new_mask = grown & ~opaque
    rgb[new_mask] = fill_rgb
    alpha[new_mask] = 255


def _snap_opaque_to_palette(rgb: np.ndarray, alpha: np.ndarray) -> None:
    """In-place: replace each opaque pixel with nearest PALETTE color (squared Euclidean)."""
    opaque = alpha >= 128
    if not opaque.any():
        return
    px = rgb[opaque].astype(np.float32)  # (N, 3)
    # distances (N, 3 palette)
    d2 = ((px[:, None, :] - PALETTE[None, :, :]) ** 2).sum(axis=2)
    nearest = np.argmin(d2, axis=1).astype(np.uint8)
    rgb[opaque] = PALETTE[nearest].astype(np.uint8)


def process(
    rgb_in: np.ndarray,
    *,
    outward_px: int,
    snap_palette: bool,
) -> np.ndarray:
    """
    rgb_in: uint8 (H, W, 3) from JPEG/PNG RGB.
    Returns uint8 (H, W, 4) RGBA.
    """
    rgb = rgb_in.copy()
    rgb_u8, alpha = _remove_checkerboard(rgb)
    _strip_light_halo(rgb_u8, alpha)
    _expand_silhouette_outward(rgb_u8, alpha, outward_px, NAVY)
    if snap_palette:
        _snap_opaque_to_palette(rgb_u8, alpha)
    rgba = np.dstack([rgb_u8, alpha])
    return rgba


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--input", type=Path, required=True, help="Source JPEG/PNG (RGB).")
    p.add_argument("--output", type=Path, required=True, help="Destination PNG path.")
    p.add_argument(
        "--outward-px",
        type=int,
        default=OUTWARD_DILATE_STEPS,
        help="Grow opaque silhouette by this many 8-connected steps; fill with navy.",
    )
    p.add_argument(
        "--no-snap",
        action="store_true",
        help="Skip flat palette snap (keep blended JPEG colors).",
    )
    args = p.parse_args()

    im = Image.open(args.input).convert("RGB")
    rgba = process(np.array(im), outward_px=args.outward_px, snap_palette=not args.no_snap)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba).save(args.output, optimize=True)
    print(f"Wrote {args.output.resolve()}")


if __name__ == "__main__":
    main()
