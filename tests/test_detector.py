"""Tests for kuvasta_mitat.detector — 100% branch coverage."""

from __future__ import annotations

import textwrap
from pathlib import Path
from unittest.mock import MagicMock, patch

import numpy as np
import pytest

from kuvasta_mitat.detector import (
    BoundingRect,
    Detection,
    DetectorConfig,
    ImageDetector,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _white_rect_image(h: int = 100, w: int = 100) -> np.ndarray:
    """Black image with a white rectangle — easy for Canny to find."""
    img = np.zeros((h, w, 3), dtype=np.uint8)
    img[20:80, 20:80] = 255
    return img


def _make_contour(x: int, y: int, w: int, h: int) -> np.ndarray:
    """Construct a minimal rectangular contour compatible with OpenCV."""
    return np.array(
        [[[x, y]], [[x + w, y]], [[x + w, y + h]], [[x, y + h]]],
        dtype=np.int32,
    )


# ---------------------------------------------------------------------------
# BoundingRect
# ---------------------------------------------------------------------------


class TestBoundingRect:
    def test_area(self) -> None:
        assert BoundingRect(0, 0, 10, 5).area == 50

    def test_center(self) -> None:
        assert BoundingRect(0, 0, 10, 4).center == (5, 2)

    def test_frozen(self) -> None:
        b = BoundingRect(0, 0, 1, 1)
        with pytest.raises((AttributeError, TypeError)):
            b.x = 99  # type: ignore[misc]


# ---------------------------------------------------------------------------
# DetectorConfig validation
# ---------------------------------------------------------------------------


class TestDetectorConfig:
    def test_even_blur_kernel_raises(self) -> None:
        with pytest.raises(ValueError, match="odd"):
            DetectorConfig(blur_kernel=4)

    def test_odd_blur_kernel_ok(self) -> None:
        cfg = DetectorConfig(blur_kernel=3)
        assert cfg.blur_kernel == 3

    def test_defaults(self) -> None:
        cfg = DetectorConfig()
        assert cfg.min_area == 500
        assert cfg.max_area is None
        assert cfg.dilate_iterations == 1


# ---------------------------------------------------------------------------
# ImageDetector.detect
# ---------------------------------------------------------------------------


class TestImageDetector:
    def test_detect_empty_array_raises(self) -> None:
        detector = ImageDetector()
        with pytest.raises(ValueError, match="Empty"):
            detector.detect(np.array([]))

    def test_detect_finds_rect(self) -> None:
        img = _white_rect_image()
        cfg = DetectorConfig(min_area=100, canny_low=30, canny_high=100)
        detections = ImageDetector(cfg).detect(img)
        assert len(detections) >= 1

    def test_detect_min_area_filter(self) -> None:
        img = _white_rect_image()
        # Very large min_area — should filter everything out
        cfg = DetectorConfig(min_area=999_999)
        detections = ImageDetector(cfg).detect(img)
        assert detections == []

    def test_detect_max_area_filter(self) -> None:
        img = _white_rect_image()
        # Max area 1 — should filter everything out
        cfg = DetectorConfig(min_area=1, max_area=1, canny_low=30, canny_high=100)
        detections = ImageDetector(cfg).detect(img)
        assert detections == []

    def test_detect_sorted_largest_first(self) -> None:
        img = _white_rect_image(200, 400)
        # Two white rects of different sizes
        img[10:50, 10:50] = 255   # ~40×40
        img[100:180, 50:350] = 255  # ~80×300
        cfg = DetectorConfig(min_area=10, canny_low=30, canny_high=100)
        detections = ImageDetector(cfg).detect(img)
        areas = [d.area for d in detections]
        assert areas == sorted(areas, reverse=True)

    def test_detect_indexes_sequential(self) -> None:
        img = _white_rect_image(200, 400)
        img[10:50, 10:50] = 255
        img[100:180, 50:350] = 255
        cfg = DetectorConfig(min_area=10, canny_low=30, canny_high=100)
        detections = ImageDetector(cfg).detect(img)
        for i, d in enumerate(detections):
            assert d.index == i

    def test_no_dilate(self) -> None:
        img = _white_rect_image()
        cfg = DetectorConfig(min_area=100, dilate_iterations=0, canny_low=30, canny_high=100)
        detections = ImageDetector(cfg).detect(img)
        assert isinstance(detections, list)

    def test_detect_from_path_not_found(self, tmp_path: Path) -> None:
        p = tmp_path / "ghost.jpg"
        with pytest.raises(FileNotFoundError, match="ghost.jpg"):
            ImageDetector().detect_from_path(p)

    def test_detect_from_path_valid(self, tmp_path: Path) -> None:
        import cv2

        img = _white_rect_image()
        p = tmp_path / "test.png"
        cv2.imwrite(str(p), img)
        cfg = DetectorConfig(min_area=100, canny_low=30, canny_high=100)
        orig, detections = ImageDetector(cfg).detect_from_path(p)
        assert orig.shape == img.shape
        assert len(detections) >= 1

    def test_detect_from_path_opencv_returns_none(self, tmp_path: Path) -> None:
        """Simulate cv2.imread returning None for an unreadable file."""
        p = tmp_path / "fake.jpg"
        p.write_bytes(b"not an image")
        with patch("cv2.imread", return_value=None):
            with pytest.raises(FileNotFoundError):
                ImageDetector().detect_from_path(p)

    def test_detection_contour_stored(self) -> None:
        img = _white_rect_image()
        cfg = DetectorConfig(min_area=100, canny_low=30, canny_high=100)
        _, detections = ImageDetector(cfg).detect_from_path(
            _save_tmp_image(img)
        )
        for det in detections:
            assert isinstance(det.contour, np.ndarray)
            assert det.contour.ndim == 3


def _save_tmp_image(img: np.ndarray) -> Path:
    import cv2
    import tempfile

    p = Path(tempfile.mktemp(suffix=".png"))
    cv2.imwrite(str(p), img)
    return p
