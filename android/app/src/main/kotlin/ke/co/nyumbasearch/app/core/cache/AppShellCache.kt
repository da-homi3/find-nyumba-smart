package ke.co.nyumbasearch.app.core.cache

import android.webkit.WebView
import ke.co.nyumbasearch.app.core.util.Constants

/**
 * Loads the live site. The old file:// asset shell raced with HTTPS on Android 11+
 * (API 30+) and could leave users stuck on skeleton placeholders forever.
 */
class AppShellLoader(private val webView: WebView) {
    fun showShellThenLoad(targetUrl: String, headers: Map<String, String>) {
        // Prefer tenant browse — listings are the primary Android experience.
        val url = when {
            targetUrl == Constants.BASE_URL ||
                targetUrl == "https://www.nyumbasearch.com/" ||
                targetUrl == "https://nyumbasearch.com" -> Constants.TENANT_URL
            else -> targetUrl
        }
        webView.loadUrl(url, headers)
    }
}
