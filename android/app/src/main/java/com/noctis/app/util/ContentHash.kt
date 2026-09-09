package com.noctis.app.util

import java.security.MessageDigest

fun sha256Hex(bytes: ByteArray): String {
    val digest = MessageDigest.getInstance("SHA-256").digest(bytes)
    return digest.joinToString("") { "%02x".format(it) }
}

fun sha256Hex(text: String): String = sha256Hex(text.toByteArray(Charsets.UTF_8))

fun textCacheKey(text: String, sourceLang: String, targetLang: String): String =
    sha256Hex("$sourceLang:$targetLang:$text")

fun imageCacheKey(bytes: ByteArray, sourceLangHint: String): String =
    "${sha256Hex(bytes)}:$sourceLangHint"
