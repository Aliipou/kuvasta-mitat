"""
Image annotator — draws bounding boxes and measurement labels on a copy of
the original image and writes the result to disk.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Sequence

import cv2
import numpy as np

from .detector import Detection
from .measurer import Measurement

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Colour palette (BGR)
# ---------------------------------------------------------------------------

_PALETTE = [
    (0, 200, 255),   # amber
    (0, 255, 100),   # green
    (255, 100, 0),   # blue
    (200, 0, 255),   # magenta
    (0, 100, 255),   # orange
]


def _colour(index: int) -> tuple[int, int, int]:
    return _PALETTE[index % len(_PALETTE)]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


class AnnotatorConfig:
    def __init__(
        self,
        *,
        box_thickness: int = 2,
        font_scale: float = 0.55,
        font_thickness: int = 1,
        label_bg_alpha: float = 0.55,
        draw_contour: bool = False,
    ) -> None:
        self.box_thickness = box_thickness
        self.font_scale = font_scale
        self.font_thickness = font_thickness
        self.label_bg_alpha = label_bg_alpha
        self.draw_contour = draw_contour


class Annotator:
    """
    Overlays detection results onto an image.

    Parameters
    ----------
    config:
        Visual style options.
    """

    _FONT = cv2.FONT_HERSHEY_SIMPLEX

    def __init__(self, config: AnnotatorConfig | None = None) -> None:
        self.config = config or AnnotatorConfig()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def annotate(
        self,
        image: np.ndarray,
        detections: Sequence[Detection],
        measurements: Sequence[Measurement],
    ) -> np.ndarray:
        """Return an annotated copy of *image* (original is not modified)."""
        canvas = image.copy()
        det_map = {d.index: d for d in detections}
        for m in measurements:
            det = det_map.get(m.index)
            if det is None:
                continue
            colour = _colour(m.index)
            self._draw_box(canvas, det, colour)
            if self.config.draw_contour:
                cv2.drawContours(canvas, [det.contour], -1, colour, 1)
            self._draw_label(canvas, det, m, colour)
        return canvas

    def save(self, canvas: np.ndarray, output_path: Path) -> None:
        """Write *canvas* to *output_path*, creating parent directories."""
        output_path.parent.mkdir(parents=True, exist_ok=True)
        ok = cv2.imwrite(str(output_path), canvas)
        if not ok:
            raise RuntimeError(f"cv2.imwrite failed for path: {output_path}")
        logger.info("Annotated image saved: %s", output_path)

    @staticmethod
    def default_output_path(source: Path) -> Path:
        """Return ``<stem>_annotated<suffix>`` next to *source*."""
        return source.with_stem(source.stem + "_annotated")

    # ------------------------------------------------------------------
    # Drawing helpers
    # ------------------------------------------------------------------

    def _draw_box(
        self,
        canvas: np.ndarray,
        det: Detection,
        colour: tuple[int, int, int],
    ) -> None:
        b = det.bbox
        cv2.rectangle(
            canvas,
            (b.x, b.y),
            (b.x + b.w, b.y + b.h),
            colour,
            self.config.box_thickness,
        )

    def _draw_label(
        self,
        canvas: np.ndarray,
        det: Detection,
        m: Measurement,
        colour: tuple[int, int, int],
    ) -> None:
        cfg = self.config
        line1 = f"#{m.index + 1}  {m.width_px}x{m.height_px}px"
        line2 = (
            f"{m.width_mm:.1f}x{m.height_mm:.1f}mm" if m.has_physical else ""
        )
        lines = [l for l in [line1, line2] if l]

        (tw, th), baseline = cv2.getTextSize(
            line1, self._FONT, cfg.font_scale, cfg.font_thickness
        )
        lh = th + baseline + 4
        total_h = lh * len(lines) + 4
        b = det.bbox
        tx = max(b.x, 0)
        ty = max(b.y - total_h - 4, 0)

        # Semi-transparent background
        overlay = canvas.copy()
        cv2.rectangle(overlay, (tx, ty), (tx + tw + 6, ty + total_h), (0, 0, 0), -1)
        cv2.addWeighted(overlay, cfg.label_bg_alpha, canvas, 1 - cfg.label_bg_alpha, 0, canvas)

        for i, line in enumerate(lines):
            cv2.putText(
                canvas,
                line,
                (tx + 3, ty + (i + 1) * lh - baseline),
                self._FONT,
                cfg.font_scale,
                colour,
                cfg.font_thickness,
                cv2.LINE_AA,
            )
