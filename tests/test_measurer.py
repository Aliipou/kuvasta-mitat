"""Tests for kuvasta_mitat.measurer — 100% branch coverage."""

from __future__ import annotations

import numpy as np
import pytest

from kuvasta_mitat.detector import BoundingRect, Detection
from kuvasta_mitat.measurer import Measurer, Measurement


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _det(index: int, w: int, h: int) -> Detection:
    cnt = np.array([[[0, 0]], [[w, 0]], [[w, h]], [[0, h]]], dtype=np.int32)
    return Detection(index=index, bbox=BoundingRect(0, 0, w, h), contour=cnt)


# ---------------------------------------------------------------------------
# Measurer — pixel only
# ---------------------------------------------------------------------------


class TestMeasurerPixelOnly:
    def test_no_ref_no_physical(self) -> None:
        dets = [_det(0, 100, 50)]
        ms = Measurer().measure(dets)
        assert len(ms) == 1
        assert ms[0].width_px == 100
        assert ms[0].height_px == 50
        assert ms[0].width_mm is None
        assert ms[0].height_mm is None
        assert not ms[0].has_physical

    def test_multiple_objects(self) -> None:
        dets = [_det(0, 200, 100), _det(1, 50, 30)]
        ms = Measurer().measure(dets)
        assert ms[0].width_px == 200
        assert ms[1].width_px == 50

    def test_empty_detections(self) -> None:
        ms = Measurer().measure([])
        assert ms == []

    def test_measurement_str_no_physical(self) -> None:
        m = Measurement(index=0, width_px=120, height_px=80)
        s = str(m)
        assert "120 × 80 px" in s
        assert "mm" not in s

    def test_measurement_str_with_physical(self) -> None:
        m = Measurement(index=0, width_px=120, height_px=80,
                        width_mm=12.0, height_mm=8.0, px_per_mm=10.0)
        s = str(m)
        assert "12.0 × 8.0 mm" in s


# ---------------------------------------------------------------------------
# Measurer — with reference object
# ---------------------------------------------------------------------------


class TestMeasurerWithRef:
    def test_single_ref_object(self) -> None:
        # Reference is 200 px wide and 100 mm in reality → 2.0 px/mm
        dets = [_det(0, 200, 100)]
        ms = Measurer(ref_width_mm=100.0).measure(dets)
        assert ms[0].px_per_mm == pytest.approx(2.0)
        assert ms[0].width_mm == pytest.approx(100.0)
        assert ms[0].height_mm == pytest.approx(50.0)

    def test_ref_applied_to_all(self) -> None:
        dets = [_det(0, 200, 100), _det(1, 100, 50)]
        ms = Measurer(ref_width_mm=100.0).measure(dets)
        for m in ms:
            assert m.has_physical
            assert m.px_per_mm == pytest.approx(2.0)

    def test_ref_index_non_zero(self) -> None:
        dets = [_det(0, 400, 200), _det(1, 200, 100)]
        # Second object (index 1) is reference: 200 px = 50 mm → 4.0 px/mm
        ms = Measurer(ref_width_mm=50.0, ref_index=1).measure(dets)
        assert ms[0].px_per_mm == pytest.approx(4.0)

    def test_ref_index_out_of_range(self) -> None:
        dets = [_det(0, 100, 50)]
        with pytest.raises(IndexError, match="ref_index=5"):
            Measurer(ref_width_mm=10.0, ref_index=5).measure(dets)

    def test_negative_ref_width_raises(self) -> None:
        with pytest.raises(ValueError, match="positive"):
            Measurer(ref_width_mm=-1.0)

    def test_zero_ref_width_raises(self) -> None:
        with pytest.raises(ValueError, match="positive"):
            Measurer(ref_width_mm=0.0)

    def test_no_detections_with_ref_returns_empty(self) -> None:
        ms = Measurer(ref_width_mm=100.0).measure([])
        assert ms == []

    def test_px_per_mm_stored_in_measurement(self) -> None:
        dets = [_det(0, 200, 100)]
        ms = Measurer(ref_width_mm=100.0).measure(dets)
        assert ms[0].px_per_mm is not None
