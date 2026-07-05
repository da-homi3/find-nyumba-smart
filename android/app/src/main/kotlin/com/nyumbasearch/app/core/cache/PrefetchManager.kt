package com.nyumbasearch.app.core.cache

import android.annotation.SuppressLint
import android.content.Context
import android.webkit.WebView
import com.nyumbasearch.app.core.network.NetworkTier
import com.nyumbasearch.app.core.network.NetworkTierDetector
import com.nyumbasearch.app.core.util.Constants

/**
 * Silently warms the WebView disk cache on WiFi only — never on cellular.
 * Uses a detached WebView instance so the visible page is unaffected.
 */
class PrefetchManager(
    context: Context,
    private val tierDetector: NetworkTierDetector,
) {
    private val appContext = context.applicationContext

    @SuppressLint("SetJavaScriptEnabled")
    fun prefetchIfOnWifi(urls: List<String>, headers: Map<String, String>) {
        if (tierDetector.currentTier() != NetworkTier.WIFI) return
        if (urls.isEmpty()) return

        val prefetchWebView = WebView(appContext)
        prefetchWebView.settings.javaScriptEnabled = true
        prefetchWebView.settings.domStorageEnabled = true
        prefetchWebView.settings.cacheMode = android.webkit.WebSettings.LOAD_DEFAULT

        urls.take(3).forEachIndexed { index, url ->
            prefetchWebView.postDelayed({
                prefetchWebView.loadUrl(url, headers)
            }, (index * 500L))
        }

        prefetchWebView.postDelayed({ prefetchWebView.destroy() }, 5_000L)
    }

    fun defaultPrefetchUrls(): List<String> = listOf(
        Constants.BASE_URL,
        "${Constants.BASE_URL}tenant",
        "${Constants.BASE_URL}tenant/map",
    )
}
