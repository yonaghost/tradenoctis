# ML Kit models are loaded via reflection/JNI — keep their entry points.
-keep class com.google.mlkit.** { *; }
-keep class com.google.android.gms.internal.mlkit_** { *; }

# Room entities/DAOs are referenced by generated code.
-keep class com.noctis.app.cache.** { *; }

# Kotlinx serialization uses reflection for @Serializable classes.
-keepattributes *Annotation*, InnerClasses
-keep class com.noctis.app.browser.** { *; }
