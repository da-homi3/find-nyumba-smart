package ke.co.nyumbasearch.app.core.network

import android.webkit.WebView

class LoadRetryHandler(
    private val webView: WebView,
    private val maxAttempts: Int = 3,
    private val onExhausted: () -> Unit,
) {
    private var attempt = 0

    fun onLoadFailed(url: String, headers: Map<String, String>) {
        if (attempt >= maxAttempts) {
            onExhausted()
            return
        }
        // Faster recovery on flaky Kenyan mobile networks (was up to 16s).
        val delayMs = (600L * (1 shl attempt)).coerceAtMost(4_000L)
        attempt++
        webView.postDelayed({ webView.loadUrl(url, headers) }, delayMs)
    }

    fun reset() {
        attempt = 0
    }
}
