package com.noctis.app.pdf

import android.content.Context
import android.print.PrintAttributes
import android.print.PrintManager
import android.webkit.WebView

/**
 * Exports the currently-translated page to PDF using Android's own Print
 * framework (`WebView.createPrintDocumentAdapter` + `PrintManager`).
 *
 * Note on the API shape: `PrintDocumentAdapter.LayoutResultCallback` and
 * `WriteResultCallback` cannot be instantiated by app code — their
 * constructors are package-private to `android.print`, by design, because
 * only the system print spooler is meant to drive a `PrintDocumentAdapter`.
 * That means there is no public, fully headless way to render a WebView
 * straight to a PDF file without going through `PrintManager.print(...)`,
 * which shows the system print UI (where "Salvar como PDF" is one of the
 * built-in destinations). This is a real Android platform constraint, not
 * a shortcut — see docs/LIMITATIONS.md.
 */
object PdfExporter {

    fun printToPdf(context: Context, webView: WebView, jobName: String = "noctis-pagina-traduzida") {
        val printManager = context.getSystemService(Context.PRINT_SERVICE) as PrintManager
        val adapter = webView.createPrintDocumentAdapter(jobName)
        val attributes = PrintAttributes.Builder()
            .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
            .setResolution(PrintAttributes.Resolution("noctis", "noctis", 300, 300))
            .setMinMargins(PrintAttributes.Margins(0, 0, 0, 0))
            .build()
        printManager.print(jobName, adapter, attributes)
    }
}
