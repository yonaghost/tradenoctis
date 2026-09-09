package com.noctis.app.model

/** Mirrors the bounding-box shape used by the web pipeline for consistency. */
data class BBox(val x0: Int, val y0: Int, val x1: Int, val y1: Int) {
    val width: Int get() = x1 - x0
    val height: Int get() = y1 - y0
}

data class OcrLine(
    val text: String,
    val bbox: BBox,
)

/**
 * Result of the local (on-device) OCR pass. `hasText = false` means the
 * image had no recognizable text (or too little to be worth translating) —
 * callers must treat that as "leave the image untouched", never as an error.
 */
data class OcrResult(
    val hasText: Boolean,
    val lines: List<OcrLine> = emptyList(),
    val recognizerUsed: String? = null,
)
