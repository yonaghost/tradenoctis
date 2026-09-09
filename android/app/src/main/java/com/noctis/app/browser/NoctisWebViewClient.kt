package com.noctis.app.browser

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient

/**
 * Standard browsing behavior (the app is explicitly NOT a full browser —
 * see spec — so this stays intentionally minimal): let the WebView load
 * http/https navigations itself (back/forward/links all keep working for
 * free), hand off anything else (tel:, mailto:, intent:, market:) to the
 * system so it doesn't dead-end inside the WebView, and re-inject the
 * translation runtime script on every page load.
 *
 * minSdk is 26, so only the [WebResourceRequest] overload of
 * shouldOverrideUrlLoading is ever invoked by the platform — the deprecated
 * String-based overload is intentionally not overridden here.
 */
class NoctisWebViewClient(
    private val injectedJs: String,
    private val onPageStarted: (String) -> Unit,
    private val onPageFinished: (String) -> Unit,
) : WebViewClient() {

    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
        val url = request.url.toString()
        if (url.startsWith("http://") || url.startsWith("https://")) return false
        return try {
            view.context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
            true
        } catch (e: ActivityNotFoundException) {
            true // swallow unsupported scheme rather than crashing the WebView
        }
    }

    override fun onPageStarted(view: WebView, url: String?, favicon: android.graphics.Bitmap?) {
        onPageStarted(url ?: "")
    }

    override fun onPageFinished(view: WebView, url: String?) {
        view.evaluateJavascript(injectedJs, null)
        onPageFinished(url ?: "")
    }
}
