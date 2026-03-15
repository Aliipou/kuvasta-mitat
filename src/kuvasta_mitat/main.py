"""
CLI entry point for kuvasta_mitat.

Usage
-----
    python -m kuvasta_mitat <image> [options]
    kuvasta-mitat <image> [options]          # after pip install

Run --help for full option reference.
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

from .annotator import Annotator, AnnotatorConfig
from .detector import DetectorConfig, ImageDetector
from .measurer import Measurer

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

_LOG_LEVELS = {"DEBUG": logging.DEBUG, "INFO": logging.INFO, "WARNING": logging.WARNING}


def _setup_logging(level: str) -> None:
    logging.basicConfig(
        format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
        datefmt="%H:%M:%S",
        level=_LOG_LEVELS.get(level.upper(), logging.INFO),
    )


# ---------------------------------------------------------------------------
# Argument parser
# ---------------------------------------------------------------------------


def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="kuvasta-mitat",
        description="Detect objects in an image and report their dimensions.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  kuvasta-mitat photo.jpg
  kuvasta-mitat photo.jpg --min-area 300 --ref-width-mm 100
  kuvasta-mitat photo.jpg --output out.jpg --canny-low 30 --canny-high 100
""",
    )
    p.add_argument("image", type=Path, help="Input image file (JPG, PNG, …)")
    p.add_argument(
        "--output", "-o", type=Path, default=None,
        help="Path for the annotated output image (default: <stem>_annotated<ext>)",
    )
    # Detection tuning
    det = p.add_argument_group("detection")
    det.add_argument("--min-area", type=int, default=500, metavar="PX²",
                     help="Minimum contour area in pixels² (default: 500)")
    det.add_argument("--max-area", type=int, default=None, metavar="PX²",
                     help="Maximum contour area in pixels² (default: unlimited)")
    det.add_argument("--canny-low", type=int, default=50,
                     help="Canny lower threshold (default: 50)")
    det.add_argument("--canny-high", type=int, default=150,
                     help="Canny upper threshold (default: 150)")
    det.add_argument("--blur-kernel", type=int, default=5,
                     help="Gaussian blur kernel size, must be odd (default: 5)")
    det.add_argument("--no-dilate", action="store_true",
                     help="Skip edge dilation step")
    # Physical scale
    scale = p.add_argument_group("physical scale")
    scale.add_argument("--ref-width-mm", type=float, default=None, metavar="MM",
                       help="Real-world width of the reference object in mm")
    scale.add_argument("--ref-index", type=int, default=0, metavar="N",
                       help="Index of the reference detection (0 = largest, default: 0)")
    # Annotation style
    vis = p.add_argument_group("visualisation")
    vis.add_argument("--draw-contour", action="store_true",
                     help="Also draw raw contour outline")
    vis.add_argument("--no-save", action="store_true",
                     help="Print measurements only, do not save annotated image")
    # Verbosity
    p.add_argument("--log-level", default="INFO",
                   choices=["DEBUG", "INFO", "WARNING"],
                   help="Logging verbosity (default: INFO)")
    return p


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    """Entry point; returns an exit code."""
    parser = _build_parser()
    args = parser.parse_args(argv)
    _setup_logging(args.log_level)
    log = logging.getLogger(__name__)

    image_path: Path = args.image
    if not image_path.is_file():
        log.error("Image not found: %s", image_path)
        return 2

    # --- Detect ---------------------------------------------------------------
    det_cfg = DetectorConfig(
        blur_kernel=args.blur_kernel,
        canny_low=args.canny_low,
        canny_high=args.canny_high,
        dilate_iterations=0 if args.no_dilate else 1,
        min_area=args.min_area,
        max_area=args.max_area,
    )
    detector = ImageDetector(det_cfg)
    try:
        image, detections = detector.detect_from_path(image_path)
    except FileNotFoundError as exc:
        log.error("%s", exc)
        return 2

    if not detections:
        log.warning("No objects detected.  Try lowering --min-area or adjusting Canny thresholds.")
        return 0

    # --- Measure --------------------------------------------------------------
    measurer = Measurer(
        ref_width_mm=args.ref_width_mm,
        ref_index=args.ref_index,
    )
    try:
        measurements = measurer.measure(detections)
    except IndexError as exc:
        log.error("%s", exc)
        return 1

    # --- Print ----------------------------------------------------------------
    print(f"\nFound {len(measurements)} object(s) in {image_path.name}\n")
    for m in measurements:
        print(f"  {m}")
    if measurements and measurements[0].px_per_mm:
        print(f"\n  Scale: {measurements[0].px_per_mm:.4f} px/mm")

    # --- Annotate & save ------------------------------------------------------
    if not args.no_save:
        ann_cfg = AnnotatorConfig(draw_contour=args.draw_contour)
        annotator = Annotator(ann_cfg)
        canvas = annotator.annotate(image, detections, measurements)
        out_path = args.output or Annotator.default_output_path(image_path)
        try:
            annotator.save(canvas, out_path)
        except RuntimeError as exc:
            log.error("%s", exc)
            return 1
        print(f"\n  Annotated image → {out_path}\n")

    return 0


def _cli() -> None:
    sys.exit(main())


if __name__ == "__main__":
    _cli()
