"""Tests for kuvasta_mitat.annotator — 100% branch coverage."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

import numpy as np
import pytest

from kuvasta_mitat.annotator import Annotator, AnnotatorConfig
from kuvasta_mitat.detector import BoundingRect, Detection
from kuvasta_mitat.measurer import Measurement


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _blank(h: int = 200, w: int = 300) -> np.ndarray:
    return np.zeros((h, w, 3), dtype=np.uint8)


def _det(idx: int, x: int = 10, y: int = 10, w: int = 80, h: int = 50) -> Detection:
    cnt = np.array([[[x, y]], [[x+w, y]], [[x+w, y+h]], [[x, y+h]]], dtype=np.int32)
    return Detection(index=idx, bbox=BoundingRect(x, y, w, h), contour=cnt)


def _meas(idx: int, *, physical: bool = False) -> Measurement:
    if physical:
        return Measurement(index=idx, width_px=80, height_px=50,
                           width_mm=40.0, height_mm=25.0, px_per_mm=2.0)
    return Measurement(index=idx, width_px=80, height_px=50)


# ---------------------------------------------------------------------------
# AnnotatorConfig
# ---------------------------------------------------------------------------


class TestAnnotatorConfig:
    def test_defaults(self) -> None:
        cfg = AnnotatorConfig()
        assert cfg.box_thickness == 2
        assert not cfg.draw_contour


# ---------------------------------------------------------------------------
# Annotator.annotate
# ---------------------------------------------------------------------------


class TestAnnotatorAnnotate:
    def test_returns_copy(self) -> None:
        img = _blank()
        original = img.copy()
        canvas = Annotator().annotate(img, [_det(0)], [_meas(0)])
        np.testing.assert_array_equal(img, original)  # original unchanged
        assert canvas is not img

    def test_annotation_modifies_canvas(self) -> None:
        img = _blank()
        canvas = Annotator().annotate(img, [_det(0)], [_meas(0)])
        assert not np.array_equal(canvas, img)

    def test_with_physical_dimensions(self) -> None:
        img = _blank()
        canvas = Annotator().annotate(img, [_det(0)], [_meas(0, physical=True)])
        assert canvas.shape == img.shape

    def test_draw_contour_flag(self) -> None:
        img = _blank()
        cfg = AnnotatorConfig(draw_contour=True)
        canvas = Annotator(cfg).annotate(img, [_det(0)], [_meas(0)])
        assert canvas.shape == img.shape

    def test_missing_detection_skipped(self) -> None:
        """Measurement whose index has no matching Detection is silently skipped."""
        img = _blank()
        canvas = Annotator().annotate(img, [], [_meas(99)])
        np.testing.assert_array_equal(canvas, img)

    def test_multiple_objects(self) -> None:
        img = _blank()
        dets = [_det(0, 10, 10, 80, 40), _det(1, 110, 10, 60, 30)]
        meas = [_meas(0), _meas(1)]
        canvas = Annotator().annotate(img, dets, meas)
        assert canvas.shape == img.shape

    def test_label_near_top_edge(self) -> None:
        """Object at y=0 — label clamped to top edge, no crash."""
        img = _blank()
        det = _det(0, x=0, y=0, w=80, h=50)
        canvas = Annotator().annotate(img, [det], [_meas(0)])
        assert canvas.shape == img.shape

    def test_colour_palette_cycles(self) -> None:
        """More than 5 objects cycles through the palette without crashing."""
        img = _blank(600, 600)
        dets = [_det(i, x=i * 10, y=i * 10, w=8, h=8) for i in range(8)]
        meas = [_meas(i) for i in range(8)]
        canvas = Annotator().annotate(img, dets, meas)
        assert canvas.shape == img.shape


# ---------------------------------------------------------------------------
# Annotator.save
# ---------------------------------------------------------------------------


class TestAnnotatorSave:
    def test_save_creates_file(self, tmp_path: Path) -> None:
        import cv2

        img = _blank()
        out = tmp_path / "output.png"
        Annotator().save(img, out)
        assert out.exists()
        loaded = cv2.imread(str(out))
        assert loaded is not None

    def test_save_creates_parent_dirs(self, tmp_path: Path) -> None:
        img = _blank()
        out = tmp_path / "deep" / "nested" / "output.png"
        Annotator().save(img, out)
        assert out.exists()

    def test_save_fails_on_bad_extension(self, tmp_path: Path) -> None:
        img = _blank()
        out = tmp_path / "bad_file.xyz_unknown"
        with patch("cv2.imwrite", return_value=False):
            with pytest.raises(RuntimeError, match="cv2.imwrite failed"):
                Annotator().save(img, out)


# ---------------------------------------------------------------------------
# Annotator.default_output_path
# ---------------------------------------------------------------------------


class TestDefaultOutputPath:
    def test_suffix_appended(self) -> None:
        src = Path("/some/dir/photo.jpg")
        out = Annotator.default_output_path(src)
        assert out.name == "photo_annotated.jpg"
        assert out.parent == src.parent

    def test_png_preserved(self) -> None:
        src = Path("image.png")
        out = Annotator.default_output_path(src)
        assert out.suffix == ".png"
