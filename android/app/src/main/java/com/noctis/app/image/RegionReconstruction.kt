package com.noctis.app.image

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Shader
import com.noctis.app.model.BBox
import kotlin.math.max
import kotlin.math.min

private const val RING_MARGIN = 4
private const val BOX_PADDING = 2

data class EstimatedColors(val bgTop: Int, val bgBottom: Int, val text: Int)

private fun clampBox(box: BBox, width: Int, height: Int): BBox = BBox(
    x0 = box.x0.coerceIn(0, width - 1),
    y0 = box.y0.coerceIn(0, height - 1),
    x1 = box.x1.coerceIn(0, width - 1),
    y1 = box.y1.coerceIn(0, height - 1),
)

/**
 * Same heuristic used by the web pipeline (see
 * web/src/lib/image/regionReconstruction.ts): sample a ring of pixels just
 * outside the text box for the background, and pixels inside the box that
 * stand out from that background for the text color. Not true
 * segmentation/inpainting — documented in docs/LIMITATIONS.md.
 */
fun estimateColors(bitmap: Bitmap, box: BBox): EstimatedColors {
    val clamped = clampBox(box, bitmap.width, bitmap.height)
    val ringX0 = max(0, clamped.x0 - RING_MARGIN)
    val ringY0 = max(0, clamped.y0 - RING_MARGIN)
    val ringX1 = min(bitmap.width - 1, clamped.x1 + RING_MARGIN)
    val ringY1 = min(bitmap.height - 1, clamped.y1 + RING_MARGIN)
    if (ringX1 <= ringX0 || ringY1 <= ringY0) {
        return EstimatedColors(android.graphics.Color.WHITE, android.graphics.Color.WHITE, android.graphics.Color.BLACK)
    }

    val topSamples = mutableListOf<Int>()
    val bottomSamples = mutableListOf<Int>()
    val midY = (ringY0 + ringY1) / 2

    for (y in ringY0..ringY1) {
        for (x in ringX0..ringX1) {
            val insideBox = x in clamped.x0..clamped.x1 && y in clamped.y0..clamped.y1
            if (insideBox) continue
            val pixel = bitmap.getPixel(x, y)
            if (y < midY) topSamples.add(pixel) else bottomSamples.add(pixel)
        }
    }
    val bgTop = medianColor(topSamples.ifEmpty { bottomSamples })
    val bgBottom = medianColor(bottomSamples.ifEmpty { topSamples })
    val bgAvg = medianColor(listOf(bgTop, bgBottom))

    val textSamples = mutableListOf<Int>()
    for (y in clamped.y0..clamped.y1) {
        for (x in clamped.x0..clamped.x1) {
            val pixel = bitmap.getPixel(x, y)
            if (colorDistance(pixel, bgAvg) > 60) textSamples.add(pixel)
        }
    }
    val boxArea = max(1, (clamped.x1 - clamped.x0 + 1) * (clamped.y1 - clamped.y0 + 1))
    val text = if (textSamples.size > boxArea * 0.02) medianColor(textSamples) else contrastColorFor(bgAvg)

    return EstimatedColors(bgTop, bgBottom, text)
}

/** Paints over the (padded) box with a vertical gradient built from the sampled background. */
fun reconstructBackground(canvas: Canvas, box: BBox, colors: EstimatedColors, width: Int, height: Int) {
    val padded = clampBox(
        BBox(box.x0 - BOX_PADDING, box.y0 - BOX_PADDING, box.x1 + BOX_PADDING, box.y1 + BOX_PADDING),
        width,
        height,
    )
    if (padded.x1 <= padded.x0 || padded.y1 <= padded.y0) return

    val paint = Paint().apply {
        shader = LinearGradient(
            0f, padded.y0.toFloat(), 0f, padded.y1.toFloat(),
            colors.bgTop, colors.bgBottom, Shader.TileMode.CLAMP,
        )
    }
    canvas.drawRect(padded.x0.toFloat(), padded.y0.toFloat(), (padded.x1 + 1).toFloat(), (padded.y1 + 1).toFloat(), paint)
}
