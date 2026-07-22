package ke.co.nyumbasearch.app.core.network

import android.webkit.WebView

class LoadRetryHandler(
    private val webView: WebView,
    private val maxAttempts: Int = 4,
    private val onExhausted: () -> Unit,
) {
    private var attempt = 0

    fun onLoadFailed(url: String, headers: Map<String, String>) {
        if (attempt >= maxAttempts) {
            onExhausted()
            return
        }
        val delayMs = (1000L * (1 shl attempt)).coerceAtMost(16_000L)
        attempt++
        webView.postDelayed({ webView.loadUrl(url, headers) }, delayMs)
    }

    fun reset() {
        attempt = 0
    }
}
