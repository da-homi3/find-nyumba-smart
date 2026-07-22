package ke.co.nyumbasearch.app.core.cache

import android.webkit.WebView
import ke.co.nyumbasearch.app.core.util.Constants

class AppShellLoader(private val webView: WebView) {
    fun showShellThenLoad(targetUrl: String, headers: Map<String, String>) {
        webView.loadUrl(Constants.APP_SHELL_PATH)
        webView.postDelayed(
            { webView.loadUrl(targetUrl, headers) },
            Constants.SHELL_LOAD_DELAY_MS,
        )
    }
}
