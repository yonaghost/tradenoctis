package com.noctis.app.image

import android.graphics.Color

fun relativeLuminance(color: Int): Double =
    0.2126 * Color.red(color) + 0.7152 * Color.green(color) + 0.0722 * Color.blue(color)

fun contrastColorFor(bgColor: Int): Int = if (relativeLuminance(bgColor) > 140) Color.BLACK else Color.WHITE

fun medianColor(samples: List<Int>): Int {
    if (samples.isEmpty()) return Color.GRAY
    fun channelMedian(selector: (Int) -> Int): Int {
        val sorted = samples.map(selector).sorted()
        return sorted[sorted.size / 2]
    }
    return Color.rgb(
        channelMedian { Color.red(it) },
        channelMedian { Color.green(it) },
        channelMedian { Color.blue(it) },
    )
}

fun colorDistance(a: Int, b: Int): Double {
    val dr = (Color.red(a) - Color.red(b)).toDouble()
    val dg = (Color.green(a) - Color.green(b)).toDouble()
    val db = (Color.blue(a) - Color.blue(b)).toDouble()
    return Math.sqrt(dr * dr + dg * dg + db * db)
}
