package com.noctis.app.cache

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(entities = [OcrCacheEntity::class, TranslationCacheEntity::class], version = 1, exportSchema = false)
abstract class NoctisDatabase : RoomDatabase() {
    abstract fun ocrCacheDao(): OcrCacheDao
    abstract fun translationCacheDao(): TranslationCacheDao

    companion object {
        fun build(context: Context): NoctisDatabase =
            Room.databaseBuilder(context.applicationContext, NoctisDatabase::class.java, "noctis.db").build()
    }
}
