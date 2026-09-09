package com.noctis.app.image

import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import com.noctis.app.model.BBox
import kotlin.math.min

private const val MIN_TEXT_SIZE_PX = 10f
private const val MAX_NATURAL_TEXT_SIZE_PX = 64f
private const val TEXT_SIZE_STEP = 1f

/**
 * Draws [text] inside [box], shrinking it (Android's [StaticLayout] already
 * wraps by word or by character as appropriate for the script) until it
 * fits vertically — the translated text must never spill outside the area
 * originally occupied by the source text.
 *
 * Like the web pipeline, translated text is always laid out horizontally
 * even if the original text was vertical (CJK): the target languages this
 * app supports are not conventionally read top-to-bottom.
 */
fun drawFittedText(canvas: Canvas, box: BBox, text: String, textColor: Int, fontScale: Float) {
    if (text.isBlank()) return
    val maxWidth = box.width.coerceAtLeast(1)
    val maxHeight = box.height.coerceAtLeast(1)

    val naturalSize = min(maxHeight.toFloat(), MAX_NATURAL_TEXT_SIZE_PX).coerceAtLeast(MIN_TEXT_SIZE_PX)
    var textSize = naturalSize * fontScale

    val paint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { color = textColor }
    var layout = buildLayout(text, paint, textSize, maxWidth)

    while (layout.height > maxHeight && textSize > MIN_TEXT_SIZE_PX) {
        textSize = (textSize - TEXT_SIZE_STEP).coerceAtLeast(MIN_TEXT_SIZE_PX)
        layout = buildLayout(text, paint, textSize, maxWidth)
    }

    val strokeColor = if (Color.red(textColor) + Color.green(textColor) + Color.blue(textColor) > 380) Color.BLACK else Color.WHITE
    val strokePaint = TextPaint(paint).apply {
        style = Paint.Style.STROKE
        strokeWidth = (textSize / 10f).coerceAtLeast(1f)
        color = strokeColor
        alpha = 140
    }
    val strokeLayout = buildLayout(text, strokePaint, textSize, maxWidth)

    canvas.save()
    canvas.translate(box.x0.toFloat(), box.y0 + (maxHeight - layout.height) / 2f)
    strokeLayout.draw(canvas)
    layout.draw(canvas)
    canvas.restore()
}

private fun buildLayout(text: String, paint: TextPaint, textSize: Float, maxWidth: Int): StaticLayout {
    paint.textSize = textSize
    return StaticLayout.Builder.obtain(text, 0, text.length, paint, maxWidth)
        .setAlignment(Layout.Alignment.ALIGN_CENTER)
        .setLineSpacing(0f, 1.15f)
        .setIncludePad(false)
        .build()
}
