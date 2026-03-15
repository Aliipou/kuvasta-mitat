"""Tests for kuvasta_mitat.main — 100% branch coverage."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

import cv2
import numpy as np
import pytest

from kuvasta_mitat.main import main


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _write_image(path: Path, h: int = 100, w: int = 100) -> None:
    img = np.zeros((h, w, 3), dtype=np.uint8)
    img[20:80, 20:80] = 255
    cv2.imwrite(str(path), img)


# ---------------------------------------------------------------------------
# CLI — exit code paths
# ---------------------------------------------------------------------------


class TestMainExitCodes:
    def test_image_not_found_returns_2(self, tmp_path: Path) -> None:
        code = main([str(tmp_path / "ghost.jpg")])
        assert code == 2

    def test_valid_image_returns_0(self, tmp_path: Path) -> None:
        p = tmp_path / "img.png"
        _write_image(p)
        code = main([str(p), "--min-area", "100", "--canny-low", "30", "--canny-high", "100"])
        assert code == 0

    def test_no_detections_returns_0(self, tmp_path: Path) -> None:
        # Solid black image — no edges
        p = tmp_path / "black.png"
        cv2.imwrite(str(p), np.zeros((50, 50, 3), dtype=np.uint8))
        code = main([str(p), "--min-area", "999999"])
        assert code == 0

    def test_no_save_flag(self, tmp_path: Path) -> None:
        p = tmp_path / "img.png"
        _write_image(p)
        code = main([str(p), "--min-area", "100", "--canny-low", "30",
                     "--canny-high", "100", "--no-save"])
        assert code == 0
        annotated = p.with_stem(p.stem + "_annotated")
        assert not annotated.exists()

    def test_custom_output_path(self, tmp_path: Path) -> None:
        p = tmp_path / "img.png"
        out = tmp_path / "custom_out.png"
        _write_image(p)
        code = main([str(p), "--min-area", "100", "--canny-low", "30",
                     "--canny-high", "100", "--output", str(out)])
        assert code == 0
        assert out.exists()

    def test_ref_width_mm_applied(self, tmp_path: Path) -> None:
        p = tmp_path / "img.png"
        _write_image(p)
        code = main([str(p), "--min-area", "100", "--canny-low", "30",
                     "--canny-high", "100", "--ref-width-mm", "50",
                     "--no-save"])
        assert code == 0

    def test_ref_index_out_of_range_returns_1(self, tmp_path: Path) -> None:
        p = tmp_path / "img.png"
        _write_image(p)
        code = main([str(p), "--min-area", "100", "--canny-low", "30",
                     "--canny-high", "100", "--ref-width-mm", "50",
                     "--ref-index", "999"])
        assert code == 1

    def test_draw_contour_flag(self, tmp_path: Path) -> None:
        p = tmp_path / "img.png"
        _write_image(p)
        code = main([str(p), "--min-area", "100", "--canny-low", "30",
                     "--canny-high", "100", "--draw-contour", "--no-save"])
        assert code == 0

    def test_no_dilate_flag(self, tmp_path: Path) -> None:
        p = tmp_path / "img.png"
        _write_image(p)
        code = main([str(p), "--min-area", "100", "--canny-low", "30",
                     "--canny-high", "100", "--no-dilate", "--no-save"])
        assert code == 0

    def test_max_area_flag(self, tmp_path: Path) -> None:
        p = tmp_path / "img.png"
        _write_image(p)
        # max_area=1 filters everything out → no detections
        code = main([str(p), "--min-area", "1", "--max-area", "1",
                     "--canny-low", "30", "--canny-high", "100", "--no-save"])
        assert code == 0

    def test_save_failure_returns_1(self, tmp_path: Path) -> None:
        p = tmp_path / "img.png"
        _write_image(p)
        with patch("cv2.imwrite", return_value=False):
            code = main([str(p), "--min-area", "100", "--canny-low", "30",
                         "--canny-high", "100"])
        assert code == 1

    def test_opencv_imread_none_returns_2(self, tmp_path: Path) -> None:
        p = tmp_path / "bad.jpg"
        p.write_bytes(b"not image")
        with patch("cv2.imread", return_value=None):
            code = main([str(p)])
        assert code == 2

    def test_debug_log_level(self, tmp_path: Path) -> None:
        p = tmp_path / "img.png"
        _write_image(p)
        code = main([str(p), "--min-area", "100", "--canny-low", "30",
                     "--canny-high", "100", "--log-level", "DEBUG", "--no-save"])
        assert code == 0
