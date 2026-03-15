"""
Dimension measurement — converts pixel bounding boxes to physical units
using an optional reference object with a known real-world width.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Sequence

from .detector import Detection

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Public types
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Measurement:
    """Pixel and optional physical dimensions for one detected object."""

    index: int
    width_px: int
    height_px: int
    width_mm: float | None = None
    height_mm: float | None = None
    px_per_mm: float | None = None

    @property
    def has_physical(self) -> bool:
        return self.width_mm is not None

    def __str__(self) -> str:
        px_part = f"{self.width_px} × {self.height_px} px"
        if self.has_physical:
            mm_part = f"  ({self.width_mm:.1f} × {self.height_mm:.1f} mm)"
        else:
            mm_part = ""
        return f"Object {self.index + 1:>2}: {px_part}{mm_part}"


# ---------------------------------------------------------------------------
# Measurer
# ---------------------------------------------------------------------------


class Measurer:
    """
    Convert :class:`~detector.Detection` objects into :class:`Measurement` s.

    Parameters
    ----------
    ref_width_mm:
        Real-world width (millimetres) of the reference object.  When given,
        the pixels-per-mm ratio is derived from the reference detection and
        applied to all others.
    ref_index:
        Which detection (0-based, sorted largest-first) is the reference.
        Defaults to 0 (the largest detected object).
    """

    def __init__(
        self,
        ref_width_mm: float | None = None,
        ref_index: int = 0,
    ) -> None:
        if ref_width_mm is not None and ref_width_mm <= 0:
            raise ValueError(f"ref_width_mm must be positive, got {ref_width_mm}")
        self._ref_width_mm = ref_width_mm
        self._ref_index = ref_index

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def measure(self, detections: Sequence[Detection]) -> list[Measurement]:
        """Return a :class:`Measurement` for every detection."""
        px_per_mm = self._compute_scale(detections)
        measurements: list[Measurement] = []
        for det in detections:
            w_px, h_px = det.bbox.w, det.bbox.h
            if px_per_mm is not None:
                w_mm = round(w_px / px_per_mm, 2)
                h_mm = round(h_px / px_per_mm, 2)
            else:
                w_mm = h_mm = None
            measurements.append(
                Measurement(
                    index=det.index,
                    width_px=w_px,
                    height_px=h_px,
                    width_mm=w_mm,
                    height_mm=h_mm,
                    px_per_mm=round(px_per_mm, 4) if px_per_mm else None,
                )
            )
        return measurements

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _compute_scale(self, detections: Sequence[Detection]) -> float | None:
        if self._ref_width_mm is None:
            return None
        if not detections:
            logger.warning("No detections — cannot compute pixel-per-mm scale")
            return None
        if self._ref_index >= len(detections):
            raise IndexError(
                f"ref_index={self._ref_index} out of range "
                f"for {len(detections)} detection(s)"
            )
        ref_det = detections[self._ref_index]
        px_per_mm = ref_det.bbox.w / self._ref_width_mm
        logger.info(
            "Reference object #%d  width=%d px  → %.4f px/mm",
            self._ref_index,
            ref_det.bbox.w,
            px_per_mm,
        )
        return px_per_mm
