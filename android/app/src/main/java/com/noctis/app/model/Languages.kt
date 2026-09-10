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
    LanguageOption("ja", "Japonês (日本語)"),
    LanguageOption("ko", "Coreano (한국어)"),
    LanguageOption("zh-CN", "Chinês simplificado (中文)"),
    LanguageOption("zh-TW", "Chinês tradicional (中文)"),
    LanguageOption("ru", "Russo (Русский)"),
    LanguageOption("ar", "Árabe (العربية)"),
    LanguageOption("hi", "Hindi (हिन्दी)"),
    LanguageOption("nl", "Neerlandês (Nederlands)"),
    LanguageOption("pl", "Polonês (Polski)"),
    LanguageOption("tr", "Turco (Türkçe)"),
    LanguageOption("vi", "Vietnamita (Tiếng Việt)"),
    LanguageOption("id", "Indonésio (Bahasa Indonesia)"),
)
