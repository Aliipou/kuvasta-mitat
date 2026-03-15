"""
Contour-based object detector using OpenCV.

Applies Gaussian blur + Canny edge detection, then extracts external contours
that pass a minimum-area filter.  Returns :class:`Detection` dataclasses so
that the rest of the pipeline stays decoupled from OpenCV internals.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Sequence

import cv2
import numpy as np

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Public data model
# ---------------------------------------------------------------------------


@dataclass(frozen=True, order=True)
class BoundingRect:
    """Axis-aligned bounding rectangle in pixel coordinates."""

    x: int
    y: int
    w: int
    h: int

    @property
    def area(self) -> int:
        return self.w * self.h

    @property
    def center(self) -> tuple[int, int]:
        return self.x + self.w // 2, self.y + self.h // 2


@dataclass
class Detection:
    """Single detected object with its contour and bounding box."""

    index: int
    bbox: BoundingRect
    contour: np.ndarray = field(repr=False, compare=False)

    @property
    def area(self) -> int:
        return self.bbox.area


# ---------------------------------------------------------------------------
# Detector
# ---------------------------------------------------------------------------


class DetectorConfig:
    """Tunable parameters for the detection pipeline."""

    def __init__(
        self,
        *,
        blur_kernel: int = 5,
        canny_low: int = 50,
        canny_high: int = 150,
        dilate_iterations: int = 1,
        min_area: int = 500,
        max_area: int | None = None,
        approx_epsilon_factor: float = 0.02,
    ) -> None:
        if blur_kernel % 2 == 0:
            raise ValueError("blur_kernel must be odd")
        self.blur_kernel = blur_kernel
        self.canny_low = canny_low
        self.canny_high = canny_high
        self.dilate_iterations = dilate_iterations
        self.min_area = min_area
        self.max_area = max_area
        self.approx_epsilon_factor = approx_epsilon_factor


class ImageDetector:
    """
    Detect objects in an image by finding external contours.

    Parameters
    ----------
    config:
        Tuning parameters.  Defaults work well for objects placed on a
        contrasting background.
    """

    def __init__(self, config: DetectorConfig | None = None) -> None:
        self.config = config or DetectorConfig()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def detect_from_path(self, image_path: Path) -> tuple[np.ndarray, list[Detection]]:
        """Load *image_path* and run detection.

        Returns
        -------
        image:
            Original BGR image (for annotation).
        detections:
            Detections sorted by area descending.
        """
        image = self._load(image_path)
        detections = self.detect(image)
        return image, detections

    def detect(self, image: np.ndarray) -> list[Detection]:
        """Run detection on a pre-loaded BGR numpy array."""
        if image is None or image.size == 0:
            raise ValueError("Empty or invalid image array")

        edges = self._preprocess(image)
        contours = self._find_contours(edges)
        detections = self._build_detections(contours)
        logger.info(
            "Detected %d objects (min_area=%d)", len(detections), self.config.min_area
        )
        return detections

    # ------------------------------------------------------------------
    # Internal pipeline steps
    # ------------------------------------------------------------------

    def _load(self, path: Path) -> np.ndarray:
        img = cv2.imread(str(path))
        if img is None:
            raise FileNotFoundError(f"OpenCV could not read image: {path}")
        logger.debug("Loaded image %s  shape=%s", path, img.shape)
        return img

    def _preprocess(self, image: np.ndarray) -> np.ndarray:
        cfg = self.config
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (cfg.blur_kernel, cfg.blur_kernel), 0)
        edges = cv2.Canny(blurred, cfg.canny_low, cfg.canny_high)
        if cfg.dilate_iterations > 0:
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
            edges = cv2.dilate(edges, kernel, iterations=cfg.dilate_iterations)
        return edges

    def _find_contours(self, edges: np.ndarray) -> Sequence[np.ndarray]:
        contours, _ = cv2.findContours(
            edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        return contours

    def _build_detections(
        self, contours: Sequence[np.ndarray]
    ) -> list[Detection]:
        cfg = self.config
        detections: list[Detection] = []
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < cfg.min_area:
                continue
            if cfg.max_area is not None and area > cfg.max_area:
                continue
            x, y, w, h = cv2.boundingRect(cnt)
            detections.append(
                Detection(
                    index=len(detections),
                    bbox=BoundingRect(x, y, w, h),
                    contour=cnt,
                )
            )
        # Stable sort: largest area first
        detections.sort(key=lambda d: d.area, reverse=True)
        # Re-index after sort
        for i, det in enumerate(detections):
            object.__setattr__(det, "index", i) if False else None
            det.index = i  # dataclass is not frozen for index
        return detections
