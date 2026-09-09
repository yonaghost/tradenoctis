package com.noctis.app

import com.noctis.app.util.normalizeToUrl
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class UrlUtilsTest {
    @Test
    fun `keeps well-formed http and https URLs untouched`() {
        assertEquals("https://example.com/page", normalizeToUrl("https://example.com/page"))
        assertEquals("http://example.com", normalizeToUrl("http://example.com"))
    }

    @Test
    fun `adds https to a bare domain`() {
        assertEquals("https://example.com", normalizeToUrl("example.com"))
        assertEquals("https://example.com/path", normalizeToUrl("example.com/path"))
    }

    @Test
    fun `treats a plain phrase as a search query`() {
        val result = normalizeToUrl("melhores restaurantes")
        assertTrue(result.startsWith("https://www.google.com/search?q="))
    }

    @Test
    fun `returns empty string for blank input`() {
        assertEquals("", normalizeToUrl("   "))
    }
}
