package com.noctis.app.model

data class LanguageOption(val code: String, val label: String)

/** Mirrors web/src/lib/languages.ts — drives the picker only, doesn't limit what ML Kit can translate. */
val SUPPORTED_LANGUAGES = listOf(
    LanguageOption("pt", "Português"),
    LanguageOption("en", "English"),
    LanguageOption("es", "Español"),
    LanguageOption("fr", "Français"),
    LanguageOption("de", "Deutsch"),
    LanguageOption("it", "Italiano"),
    LanguageOption("ja", "日本語"),
    LanguageOption("ko", "한국어"),
    LanguageOption("zh-CN", "中文（简体）"),
    LanguageOption("zh-TW", "中文（繁體）"),
    LanguageOption("ru", "Русский"),
    LanguageOption("ar", "العربية"),
    LanguageOption("hi", "हिन्दी"),
    LanguageOption("nl", "Nederlands"),
    LanguageOption("pl", "Polski"),
    LanguageOption("tr", "Türkçe"),
    LanguageOption("vi", "Tiếng Việt"),
    LanguageOption("id", "Bahasa Indonesia"),
)
