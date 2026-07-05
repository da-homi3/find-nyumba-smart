package com.nyumbasearch.app.ui.webview

import android.webkit.JavascriptInterface

/** Bridge for future native ↔ web communication. */
class JsBridge {
    @JavascriptInterface
    fun getPlatform(): String = "android"
}
