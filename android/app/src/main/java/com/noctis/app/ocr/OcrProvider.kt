package com.noctis.app.ocr

import android.graphics.Bitmap
import com.noctis.app.model.OcrResult

/**
 * Contract every OCR backend must satisfy. Kept narrow and platform-neutral
 * (mirrors web/src/lib/providers/ocr/OCRProvider.ts) so a different engine
 * could be swapped in later without touching the pipeline that calls it.
 *
 * Implementations must never throw for "no text found" — return
 * `OcrResult(hasText = false)` instead, so callers can fall back to the
 * original image.
 */
interface OcrProvider {
    val id: String
    suspend fun recognize(bitmap: Bitmap, languageHint: String): OcrResult
}
