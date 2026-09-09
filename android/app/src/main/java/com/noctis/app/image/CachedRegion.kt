package com.noctis.app.image

import com.noctis.app.model.BBox
import kotlinx.serialization.Serializable

@Serializable
data class CachedRegion(
    val x0: Int,
    val y0: Int,
    val x1: Int,
    val y1: Int,
    val text: String,
    val textColor: Int,
) {
    val bbox: BBox get() = BBox(x0, y0, x1, y1)

    companion object {
        fun from(bbox: BBox, text: String, textColor: Int) =
            CachedRegion(bbox.x0, bbox.y0, bbox.x1, bbox.y1, text, textColor)
    }
}
