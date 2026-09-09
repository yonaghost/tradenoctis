package com.noctis.app.image

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import com.noctis.app.cache.NoctisDatabase
import com.noctis.app.cache.OcrCacheEntity
import com.noctis.app.cache.TranslationCacheEntity
import com.noctis.app.ocr.OcrProvider
import com.noctis.app.translate.TranslationProvider
import com.noctis.app.util.imageCacheKey
import com.noctis.app.util.textCacheKey
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.util.concurrent.TimeUnit

private const val MAX_IMAGE_BYTES = 8L * 1024 * 1024
private const val MIN_DIMENSION_TO_PROCESS = 24
private const val MIN_TOTAL_TEXT_CHARS = 2

/**
 * Full OCR -> translate -> reconstruct -> composite pipeline for a single
 * image, mirroring web/src/lib/image/pipeline.ts but running entirely
 * on-device (ML Kit OCR + ML Kit Translate, Room for the content-hash
 * cache instead of an in-memory Map).
 *
 * Returns `null` on ANY failure or when no text was found — callers must
 * treat that as "keep showing the original image", never as a crash or a
 * blank space.
 */
class ImagePipeline(
    context: Context,
    private val database: NoctisDatabase,
    private val ocrProvider: OcrProvider,
    private val translationProvider: TranslationProvider,
) {
    private val appContext = context.applicationContext
    private val json = Json { ignoreUnknownKeys = true }
    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()
    private val cacheDir: File by lazy { File(appContext.cacheDir, "noctis_images").apply { mkdirs() } }

    suspend fun translateImage(imageUrl: String, sourceLangHint: String, targetLang: String, fontScale: Float): Bitmap? =
        withContext(Dispatchers.IO) {
            runCatching {
                val bytes = downloadImage(imageUrl) ?: return@withContext null
                val original = BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: return@withContext null
                if (original.width < MIN_DIMENSION_TO_PROCESS || original.height < MIN_DIMENSION_TO_PROCESS) {
                    return@withContext null
                }

                val cacheKey = imageCacheKey(bytes, sourceLangHint)
                val stage = database.ocrCacheDao().get(cacheKey) ?: runOcrStage(cacheKey, original, sourceLangHint)

                if (stage.cleanedImagePath.isBlank()) return@withContext null // cached "no text" result

                val regions = json.decodeFromString<List<CachedRegion>>(stage.regionsJson)
                if (regions.isEmpty()) return@withContext null

                val cleaned = BitmapFactory.decodeFile(stage.cleanedImagePath) ?: return@withContext null
                val translations = translateRegions(regions, sourceLangHint, targetLang)

                composite(cleaned, regions, translations, fontScale)
            }.getOrNull()
        }

    private fun downloadImage(url: String): ByteArray? {
        val request = Request.Builder().url(url).header("User-Agent", "Noctis-Android/0.1").build()
        httpClient.newCall(request).execute().use { response ->
            if (!response.isSuccessful) return null
            val body = response.body ?: return null
            val bytes = body.bytes()
            if (bytes.size > MAX_IMAGE_BYTES) return null
            return bytes
        }
    }

    private suspend fun runOcrStage(cacheKey: String, original: Bitmap, sourceLangHint: String): OcrCacheEntity {
        val result = ocrProvider.recognize(original, sourceLangHint)
        val totalChars = result.lines.sumOf { it.text.replace("\\s".toRegex(), "").length }

        if (!result.hasText || totalChars < MIN_TOTAL_TEXT_CHARS) {
            val negative = OcrCacheEntity(cacheKey = cacheKey, width = original.width, height = original.height, cleanedImagePath = "", regionsJson = "[]")
            database.ocrCacheDao().put(negative)
            return negative
        }

        val working = original.copy(Bitmap.Config.ARGB_8888, true)
        val canvas = Canvas(working)

        val regions = result.lines.filter { it.text.isNotBlank() }.map { line ->
            val colors = estimateColors(working, line.bbox)
            CachedRegion.from(line.bbox, line.text, colors.text) to colors
        }

        // Reconstruct backgrounds only after every region's colors were
        // sampled from the still-intact bitmap.
        regions.forEach { (region, colors) -> reconstructBackground(canvas, region.bbox, colors, working.width, working.height) }

        val file = File(cacheDir, "$cacheKey".replace(":", "_") + ".png")
        file.outputStream().use { working.compress(Bitmap.CompressFormat.PNG, 100, it) }

        val entity = OcrCacheEntity(
            cacheKey = cacheKey,
            width = working.width,
            height = working.height,
            cleanedImagePath = file.absolutePath,
            regionsJson = json.encodeToString(regions.map { it.first }),
        )
        database.ocrCacheDao().put(entity)
        return entity
    }

    private suspend fun translateRegions(regions: List<CachedRegion>, sourceLang: String, targetLang: String): List<String> {
        val dao = database.translationCacheDao()
        val keys = regions.map { textCacheKey(it.text, sourceLang, targetLang) }
        val cached = keys.map { dao.get(it)?.translatedText }

        val missingIndexes = cached.indices.filter { cached[it] == null }
        if (missingIndexes.isNotEmpty()) {
            val missingTexts = missingIndexes.map { regions[it].text }
            val translated = translationProvider.translate(missingTexts, sourceLang, targetLang)
            missingIndexes.forEachIndexed { i, originalIndex ->
                val text = translated.getOrElse(i) { regions[originalIndex].text }
                dao.put(TranslationCacheEntity(cacheKey = keys[originalIndex], translatedText = text))
            }
        }

        return regions.indices.map { i -> cached[i] ?: dao.get(keys[i])?.translatedText ?: regions[i].text }
    }

    private fun composite(cleaned: Bitmap, regions: List<CachedRegion>, translations: List<String>, fontScale: Float): Bitmap {
        val result = cleaned.copy(Bitmap.Config.ARGB_8888, true)
        val canvas = Canvas(result)
        regions.forEachIndexed { i, region ->
            val translated = translations.getOrElse(i) { region.text }
            drawFittedText(canvas, region.bbox, translated, region.textColor, fontScale)
        }
        return result
    }

    fun clearCache() {
        cacheDir.listFiles()?.forEach { it.delete() }
    }
}
