from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import cv2
import numpy as np


# ============================================================
# QUALITY INFORMATION
# ============================================================


@dataclass
class ImageQuality:
    width: int
    height: int
    channels: int

    megapixels: float

    brightness: float
    contrast: float

    blur_score: float

    estimated_skew: float

    is_low_resolution: bool
    is_very_low_resolution: bool
    is_blurry: bool
    is_low_contrast: bool

    quality_score: float

    def model_dump(self) -> dict[str, Any]:

        return {
            "width": self.width,
            "height": self.height,
            "channels": self.channels,
            "megapixels": self.megapixels,
            "brightness": self.brightness,
            "contrast": self.contrast,
            "blur_score": self.blur_score,
            "estimated_skew": self.estimated_skew,
            "is_low_resolution": self.is_low_resolution,
            "is_very_low_resolution": self.is_very_low_resolution,
            "is_blurry": self.is_blurry,
            "is_low_contrast": self.is_low_contrast,
            "quality_score": self.quality_score,
        }


@dataclass
class PreprocessingVariant:
    name: str
    image: np.ndarray

    scale: float
    deskewed: bool
    contrast_adjusted: bool
    denoised: bool
    sharpened: bool

    quality: ImageQuality

    def model_dump(self) -> dict[str, Any]:

        return {
            "name": self.name,
            "scale": self.scale,
            "deskewed": self.deskewed,
            "contrast_adjusted": self.contrast_adjusted,
            "denoised": self.denoised,
            "sharpened": self.sharpened,
            "quality": self.quality.model_dump(),
        }


# ============================================================
# BASIC IMAGE LOADING
# ============================================================


def load_image(
    image_path: str | Path,
) -> np.ndarray:

    path = Path(image_path)

    if not path.exists():

        raise FileNotFoundError(
            f"Image not found: {path}"
        )

    image = cv2.imread(
        str(path),
        cv2.IMREAD_COLOR,
    )

    if image is None:

        raise ValueError(
            f"Unable to decode image: {path}"
        )

    return image


# ============================================================
# QUALITY ANALYSIS
# ============================================================


def _blur_score(
    gray: np.ndarray,
) -> float:

    value = cv2.Laplacian(
        gray,
        cv2.CV_64F,
    ).var()

    return float(value)


def _estimate_skew(
    gray: np.ndarray,
) -> float:

    # --------------------------------------------------------
    # Use edges rather than aggressive thresholding.
    #
    # This is deliberately conservative because handwriting
    # and tables can produce misleading threshold masks.
    # --------------------------------------------------------

    edges = cv2.Canny(
        gray,
        50,
        150,
    )

    lines = cv2.HoughLinesP(
        edges,
        1,
        np.pi / 180,
        threshold=max(
            40,
            min(gray.shape) // 4,
        ),
        minLineLength=max(
            40,
            min(gray.shape) // 5,
        ),
        maxLineGap=20,
    )

    if lines is None:

        return 0.0

    angles: list[float] = []

    for line in lines[:, 0]:

        x1, y1, x2, y2 = map(
            int,
            line,
        )

        dx = x2 - x1
        dy = y2 - y1

        if dx == 0:

            continue

        angle = np.degrees(
            np.arctan2(
                dy,
                dx,
            )
        )

        # Ignore near-vertical lines.
        if abs(angle) <= 20:

            angles.append(
                float(angle)
            )

    if not angles:

        return 0.0

    return float(
        np.median(angles)
    )


def analyze_image(
    image: np.ndarray,
) -> ImageQuality:

    if image is None:

        raise ValueError(
            "Image cannot be None."
        )

    height, width = image.shape[:2]

    channels = (
        image.shape[2]
        if image.ndim == 3
        else 1
    )

    megapixels = (
        width * height
    ) / 1_000_000

    gray = cv2.cvtColor(
        image,
        cv2.COLOR_BGR2GRAY,
    )

    brightness = float(
        np.mean(gray)
    )

    contrast = float(
        np.std(gray)
    )

    blur = _blur_score(
        gray
    )

    skew = _estimate_skew(
        gray
    )

    shortest_side = min(
        width,
        height,
    )

    is_very_low_resolution = (
        shortest_side < 300
    )

    is_low_resolution = (
        shortest_side < 700
    )

    is_blurry = (
        blur < 80
    )

    is_low_contrast = (
        contrast < 35
    )

    # --------------------------------------------------------
    # Quality score
    #
    # This is NOT OCR confidence.
    # It is only used to decide whether preprocessing
    # should be attempted.
    # --------------------------------------------------------

    resolution_score = min(
        1.0,
        shortest_side / 900.0,
    )

    contrast_score = min(
        1.0,
        contrast / 70.0,
    )

    blur_score = min(
        1.0,
        blur / 500.0,
    )

    skew_score = max(
        0.0,
        1.0
        - min(
            abs(skew) / 15.0,
            1.0,
        ),
    )

    quality_score = (
        resolution_score * 0.30
        + contrast_score * 0.20
        + blur_score * 0.30
        + skew_score * 0.20
    )

    return ImageQuality(
        width=width,
        height=height,
        channels=channels,
        megapixels=round(
            megapixels,
            4,
        ),
        brightness=round(
            brightness,
            3,
        ),
        contrast=round(
            contrast,
            3,
        ),
        blur_score=round(
            blur,
            3,
        ),
        estimated_skew=round(
            skew,
            3,
        ),
        is_low_resolution=(
            is_low_resolution
        ),
        is_very_low_resolution=(
            is_very_low_resolution
        ),
        is_blurry=is_blurry,
        is_low_contrast=(
            is_low_contrast
        ),
        quality_score=round(
            quality_score,
            4,
        ),
    )


# ============================================================
# UPSCALING
# ============================================================


def upscale(
    image: np.ndarray,
    scale: float,
) -> np.ndarray:

    if scale <= 1.0:

        return image.copy()

    height, width = image.shape[:2]

    new_width = int(
        width * scale
    )

    new_height = int(
        height * scale
    )

    return cv2.resize(
        image,
        (
            new_width,
            new_height,
        ),
        interpolation=cv2.INTER_LANCZOS4,
    )


# ============================================================
# MILD CONTRAST
# ============================================================


def mild_contrast(
    image: np.ndarray,
) -> np.ndarray:

    lab = cv2.cvtColor(
        image,
        cv2.COLOR_BGR2LAB,
    )

    l_channel, a_channel, b_channel = (
        cv2.split(lab)
    )

    # Conservative CLAHE.
    #
    # Important:
    # clipLimit is intentionally low.
    # We don't want to destroy handwriting.
    clahe = cv2.createCLAHE(
        clipLimit=1.4,
        tileGridSize=(8, 8),
    )

    enhanced_l = clahe.apply(
        l_channel
    )

    enhanced = cv2.merge(
        (
            enhanced_l,
            a_channel,
            b_channel,
        )
    )

    return cv2.cvtColor(
        enhanced,
        cv2.COLOR_LAB2BGR,
    )


# ============================================================
# MILD SHARPENING
# ============================================================


def mild_sharpen(
    image: np.ndarray,
) -> np.ndarray:

    blurred = cv2.GaussianBlur(
        image,
        (0, 0),
        1.0,
    )

    # Very conservative unsharp mask.
    sharpened = cv2.addWeighted(
        image,
        1.20,
        blurred,
        -0.20,
        0,
    )

    return sharpened


# ============================================================
# DESKEW
# ============================================================


def deskew(
    image: np.ndarray,
    angle: float,
) -> np.ndarray:

    if abs(angle) < 0.5:

        return image.copy()

    height, width = image.shape[:2]

    center = (
        width / 2,
        height / 2,
    )

    matrix = cv2.getRotationMatrix2D(
        center,
        angle,
        1.0,
    )

    return cv2.warpAffine(
        image,
        matrix,
        (
            width,
            height,
        ),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE,
    )


# ============================================================
# VARIANT GENERATION
# ============================================================


def generate_variants(
    image: np.ndarray,
    quality: ImageQuality | None = None,
) -> list[PreprocessingVariant]:

    if quality is None:

        quality = analyze_image(
            image
        )

    variants: list[
        PreprocessingVariant
    ] = []

    # ========================================================
    # VARIANT 0 — ORIGINAL
    #
    # Always keep the original.
    # ========================================================

    variants.append(
        PreprocessingVariant(
            name="original",
            image=image.copy(),
            scale=1.0,
            deskewed=False,
            contrast_adjusted=False,
            denoised=False,
            sharpened=False,
            quality=quality,
        )
    )

    # ========================================================
    # VERY LOW RESOLUTION
    # ========================================================

    if quality.is_very_low_resolution:

        scaled = upscale(
            image,
            3.0,
        )

        variants.append(
            PreprocessingVariant(
                name="upscale_3x",
                image=scaled,
                scale=3.0,
                deskewed=False,
                contrast_adjusted=False,
                denoised=False,
                sharpened=False,
                quality=analyze_image(
                    scaled
                ),
            )
        )

        enhanced = mild_sharpen(
            mild_contrast(
                scaled
            )
        )

        variants.append(
            PreprocessingVariant(
                name="upscale_3x_contrast_sharp",
                image=enhanced,
                scale=3.0,
                deskewed=False,
                contrast_adjusted=True,
                denoised=False,
                sharpened=True,
                quality=analyze_image(
                    enhanced
                ),
            )
        )

        return variants

    # ========================================================
    # LOW RESOLUTION
    # ========================================================

    if quality.is_low_resolution:

        scaled = upscale(
            image,
            2.0,
        )

        variants.append(
            PreprocessingVariant(
                name="upscale_2x",
                image=scaled,
                scale=2.0,
                deskewed=False,
                contrast_adjusted=False,
                denoised=False,
                sharpened=False,
                quality=analyze_image(
                    scaled
                ),
            )
        )

        enhanced = mild_sharpen(
            mild_contrast(
                scaled
            )
        )

        variants.append(
            PreprocessingVariant(
                name="upscale_2x_contrast_sharp",
                image=enhanced,
                scale=2.0,
                deskewed=False,
                contrast_adjusted=True,
                denoised=False,
                sharpened=True,
                quality=analyze_image(
                    enhanced
                ),
            )
        )

        return variants

    # ========================================================
    # NORMAL / HIGH RESOLUTION
    # ========================================================

    # Only deskew when there is meaningful skew.
    if abs(
        quality.estimated_skew
    ) >= 0.8:

        corrected = deskew(
            image,
            -quality.estimated_skew,
        )

        variants.append(
            PreprocessingVariant(
                name="deskew",
                image=corrected,
                scale=1.0,
                deskewed=True,
                contrast_adjusted=False,
                denoised=False,
                sharpened=False,
                quality=analyze_image(
                    corrected
                ),
            )
        )

    # Mild contrast variant only when the image is actually
    # low contrast.
    if quality.is_low_contrast:

        enhanced = mild_contrast(
            image
        )

        variants.append(
            PreprocessingVariant(
                name="mild_contrast",
                image=enhanced,
                scale=1.0,
                deskewed=False,
                contrast_adjusted=True,
                denoised=False,
                sharpened=False,
                quality=analyze_image(
                    enhanced
                ),
            )
        )

    # Conservative 2× candidate for difficult photos.
    if (
        quality.is_blurry
        or quality.is_low_contrast
        or abs(
            quality.estimated_skew
        ) >= 1.5
    ):

        scaled = upscale(
            image,
            2.0,
        )

        enhanced = mild_sharpen(
            mild_contrast(
                scaled
            )
        )

        variants.append(
            PreprocessingVariant(
                name="upscale_2x_enhanced",
                image=enhanced,
                scale=2.0,
                deskewed=False,
                contrast_adjusted=True,
                denoised=False,
                sharpened=True,
                quality=analyze_image(
                    enhanced
                ),
            )
        )

    return variants


# ============================================================
# SAVE VARIANT
# ============================================================


def save_variant(
    variant: PreprocessingVariant,
    output_path: str | Path,
) -> Path:

    output = Path(
        output_path
    )

    output.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    success = cv2.imwrite(
        str(output),
        variant.image,
    )

    if not success:

        raise IOError(
            f"Failed to save "
            f"preprocessed image: {output}"
        )

    return output