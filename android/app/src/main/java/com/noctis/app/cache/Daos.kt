package com.noctis.app.cache

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface OcrCacheDao {
    @Query("SELECT * FROM ocr_cache WHERE cacheKey = :key LIMIT 1")
    suspend fun get(key: String): OcrCacheEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun put(entity: OcrCacheEntity)

    @Query("SELECT COUNT(*) FROM ocr_cache")
    suspend fun count(): Int

    @Query("DELETE FROM ocr_cache")
    suspend fun clear()
}

@Dao
interface TranslationCacheDao {
    @Query("SELECT * FROM translation_cache WHERE cacheKey = :key LIMIT 1")
    suspend fun get(key: String): TranslationCacheEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun put(entity: TranslationCacheEntity)

    @Query("DELETE FROM translation_cache")
    suspend fun clear()
}
