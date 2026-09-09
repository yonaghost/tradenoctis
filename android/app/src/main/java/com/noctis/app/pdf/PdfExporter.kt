package com.noctis.app.pdf

import android.os.CancellationSignal
import android.os.ParcelFileDescriptor
import android.print.PageRange
import android.print.PrintAttributes
import android.print.PrintDocumentAdapter
import android.print.PrintDocumentInfo
import android.webkit.WebView
import kotlinx.coroutines.suspendCancellableCoroutine
import java.io.File
import kotlin.coroutines.resume

/**
 * Exports the currently-translated page to a PDF file using Android's own
 * Print framework (`WebView.createPrintDocumentAdapter`) driven
 * programmatically instead of through the system print dialog — this is
 * the same mechanism "Print" uses under the hood, so page height beyond the
 * viewport, pagination and CSS print styles are all handled by the
 * platform's own renderer rather than something Noctis has to reimplement.
 *
 * Requires the WebView content to already reflect the translated state
 * (mode = translated, images already swapped) at call time — the caller is
 * responsible for waiting for `__noctisIsIdle()` first, on a best-effort
 * basis, exactly like the web app's PDF route.
 */
object PdfExporter {

    suspend fun export(webView: WebView, outputFile: File): Boolean = suspendCancellableCoroutine { continuation ->
        val adapter = webView.createPrintDocumentAdapter("noctis-pagina-traduzida")
        val attributes = PrintAttributes.Builder()
            .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
            .setResolution(PrintAttributes.Resolution("noctis", "noctis", 300, 300))
            .setMinMargins(PrintAttributes.Margins(0, 0, 0, 0))
            .build()

        adapter.onLayout(
            null,
            attributes,
            CancellationSignal(),
            object : PrintDocumentAdapter.LayoutResultCallback() {
                override fun onLayoutFinished(info: PrintDocumentInfo?, changed: Boolean) {
                    try {
                        val pfd = ParcelFileDescriptor.open(outputFile, ParcelFileDescriptor.MODE_CREATE or ParcelFileDescriptor.MODE_TRUNCATE or ParcelFileDescriptor.MODE_READ_WRITE)
                        adapter.onWrite(
                            arrayOf(PageRange.ALL_PAGES),
                            pfd,
                            CancellationSignal(),
                            object : PrintDocumentAdapter.WriteResultCallback() {
                                override fun onWriteFinished(pages: Array<out PageRange>?) {
                                    pfd.close()
                                    if (continuation.isActive) continuation.resume(true)
                                }

                                override fun onWriteFailed(error: CharSequence?) {
                                    pfd.close()
                                    if (continuation.isActive) continuation.resume(false)
                                }

                                override fun onWriteCancelled() {
                                    pfd.close()
                                    if (continuation.isActive) continuation.resume(false)
                                }
                            },
                        )
                    } catch (e: Exception) {
                        if (continuation.isActive) continuation.resume(false)
                    }
                }

                override fun onLayoutFailed(error: CharSequence?) {
                    if (continuation.isActive) continuation.resume(false)
                }

                override fun onLayoutCancelled() {
                    if (continuation.isActive) continuation.resume(false)
                }
            },
        )
    }
}
