package com.noctis.app

import android.app.Application
import com.noctis.app.cache.NoctisDatabase

class NoctisApplication : Application() {
    val database: NoctisDatabase by lazy { NoctisDatabase.build(this) }
}
