package com.noctis.app.ocr

import android.graphics.Bitmap
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.Text
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.TextRecognizer
import com.google.mlkit.vision.text.chinese.ChineseTextRecognizerOptions
import com.google.mlkit.vision.text.devanagari.DevanagariTextRecognizerOptions
import com.google.mlkit.vision.text.japanese.JapaneseTextRecognizerOptions
import com.google.mlkit.vision.text.korean.KoreanTextRecognizerOptions
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import com.noctis.app.model.BBox
import com.noctis.app.model.OcrLine
import com.noctis.app.model.OcrResult
import kotlinx.coroutines.tasks.await

/**
 * OCR backend built on Google ML Kit Text Recognition v2, running entirely
 * on-device — no network call, no API key, images never leave the phone
 * for this stage. This is the "prioritize local OCR" requirement from the
 * spec, satisfied natively on Android (the web app has to run Tesseract.js
 * on the server instead, since browsers/servers don't ship ML Kit).
 *
 * Known limitation: ML Kit's public API does not expose a per-word/per-line
 * confidence score (unlike Tesseract on the web). We approximate "how good
 * was this recognizer for this image" using total recognized character
 * count instead — cruder, but honest about what the library actually
 * offers. See docs/LIMITATIONS.md.
 */
class MlKitOcrProvider : OcrProvider {
    override val id = "mlkit"

    private val latin: TextRecognizer by lazy { TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS) }
    private val chinese: TextRecognizer by lazy { TextRecognition.getClient(ChineseTextRecognizerOptions.Builder().build()) }
    private val japanese: TextRecognizer by lazy { TextRecognition.getClient(JapaneseTextRecognizerOptions.Builder().build()) }
    private val korean: TextRecognizer by lazy { TextRecognition.getClient(KoreanTextRecognizerOptions.Builder().build()) }
    private val devanagari: TextRecognizer by lazy { TextRecognition.getClient(DevanagariTextRecognizerOptions.Builder().build()) }

    private fun recognizerFor(languageHint: String): TextRecognizer = when (languageHint) {
        "ja" -> japanese
        "ko" -> korean
        "zh-CN", "zh-TW" -> chinese
        "hi" -> devanagari
        else -> latin
    }

    override suspend fun recognize(bitmap: Bitmap, languageHint: String): OcrResult {
        val image = InputImage.fromBitmap(bitmap, 0)

        val candidates: List<Pair<String, TextRecognizer>> = if (languageHint != "auto") {
            listOf(languageHint to recognizerFor(languageHint), "eng-fallback" to latin)
        } else {
            listOf("latin" to latin, "chinese" to chinese, "japanese" to japanese, "korean" to korean, "devanagari" to devanagari)
        }

        var best: Text? = null
        var bestLabel = ""
        var bestCharCount = 0

        for ((label, recognizer) in candidates) {
            val result = runCatching { recognizer.process(image).await() }.getOrNull() ?: continue
            val charCount = result.text.replace("\\s".toRegex(), "").length
            if (charCount > bestCharCount) {
                best = result
                bestLabel = label
                bestCharCount = charCount
            }
            // Already-good Latin/hint result: skip the remaining expensive
            // script-specific passes rather than always running all five.
            if (label != "latin" && label != languageHint) continue
            if (bestCharCount > 3 && languageHint != "auto") break
        }

        val text = best ?: return OcrResult(hasText = false)
        if (bestCharCount < 2) return OcrResult(hasText = false)

        val lines = text.textBlocks
            .flatMap { it.lines }
            .mapNotNull { line -> line.boundingBox?.let { rect ->
                OcrLine(text = line.text, bbox = BBox(rect.left, rect.top, rect.right, rect.bottom))
            } }
            .filter { it.text.isNotBlank() }

        if (lines.isEmpty()) return OcrResult(hasText = false)

        return OcrResult(hasText = true, lines = lines, recognizerUsed = bestLabel)
    }
}
