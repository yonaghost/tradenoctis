package com.noctis.app.util

private val DOMAIN_LIKE = Regex("^[\\w-]+(\\.[\\w-]+)+([/?#].*)?$")

/** Turns whatever the user typed (a URL, a bare domain, or a search phrase) into a navigable https URL. */
fun normalizeToUrl(input: String): String {
    val trimmed = input.trim()
    if (trimmed.isEmpty()) return ""
    if (trimmed.startsWith("http://", ignoreCase = true) || trimmed.startsWith("https://", ignoreCase = true)) {
        return trimmed
    }
    if (DOMAIN_LIKE.matches(trimmed)) return "https://$trimmed"
    val encoded = java.net.URLEncoder.encode(trimmed, "UTF-8")
    return "https://www.google.com/search?q=$encoded"
}
