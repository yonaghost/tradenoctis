package com.noctis.app

import com.noctis.app.util.imageCacheKey
import com.noctis.app.util.sha256Hex
import com.noctis.app.util.textCacheKey
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class ContentHashTest {
    @Test
    fun `sha256 is stable and content-sensitive`() {
        assertEquals(sha256Hex("hello"), sha256Hex("hello"))
        assertNotEquals(sha256Hex("hello"), sha256Hex("world"))
    }

    @Test
    fun `text cache key is scoped by language pair`() {
        val a = textCacheKey("Hello", "en", "pt")
        val b = textCacheKey("Hello", "en", "es")
        assertNotEquals(a, b)
    }

    @Test
    fun `image cache key is scoped by bytes and source-language hint`() {
        val bytesA = "image-a".toByteArray()
        val bytesB = "image-b".toByteArray()
        assertNotEquals(imageCacheKey(bytesA, "auto"), imageCacheKey(bytesB, "auto"))
        assertNotEquals(imageCacheKey(bytesA, "auto"), imageCacheKey(bytesA, "ja"))
        assertEquals(imageCacheKey(bytesA, "auto"), imageCacheKey(bytesA, "auto"))
    }
}
