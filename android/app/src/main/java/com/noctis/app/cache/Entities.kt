package com.noctis.app.cache

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * One row per (image content hash + source-language hint): the reconstructed
 * "cleaned" background (text removed) plus the OCR'd regions, so the
 * expensive OCR + background-reconstruction work never has to repeat for an
 * image already seen — the same content-hash cache design used on the web
 * (see web/src/lib/cache/hash.ts).
 */
@Entity(tableName = "ocr_cache")
data class OcrCacheEntity(
    @PrimaryKey val cacheKey: String,
    val width: Int,
    val height: Int,
    val cleanedImagePath: String,
    /** JSON-encoded List<CachedRegion> (bbox + original text + sampled color). */
    val regionsJson: String,
    val createdAt: Long = System.currentTimeMillis(),
)

/** One row per (text + source language + target language). */
@Entity(tableName = "translation_cache")
data class TranslationCacheEntity(
    @PrimaryKey val cacheKey: String,
    val translatedText: String,
    val createdAt: Long = System.currentTimeMillis(),
)
