package com.noctis.app.util

import android.content.Context
import android.content.SharedPreferences

/** Small wrapper around SharedPreferences for the handful of user-facing settings. */
class NoctisPreferences(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("noctis_prefs", Context.MODE_PRIVATE)

    var targetLanguage: String
        get() = prefs.getString(KEY_TARGET_LANG, "pt") ?: "pt"
        set(value) = prefs.edit().putString(KEY_TARGET_LANG, value).apply()

    var fontScale: Float
        get() = prefs.getFloat(KEY_FONT_SCALE, 1f)
        set(value) = prefs.edit().putFloat(KEY_FONT_SCALE, value).apply()

    var translateImages: Boolean
        get() = prefs.getBoolean(KEY_TRANSLATE_IMAGES, true)
        set(value) = prefs.edit().putBoolean(KEY_TRANSLATE_IMAGES, value).apply()

    var wifiOnlyModelDownloads: Boolean
        get() = prefs.getBoolean(KEY_WIFI_ONLY_MODELS, false)
        set(value) = prefs.edit().putBoolean(KEY_WIFI_ONLY_MODELS, value).apply()

    companion object {
        private const val KEY_TARGET_LANG = "target_lang"
        private const val KEY_FONT_SCALE = "font_scale"
        private const val KEY_TRANSLATE_IMAGES = "translate_images"
        private const val KEY_WIFI_ONLY_MODELS = "wifi_only_models"
    }
}
