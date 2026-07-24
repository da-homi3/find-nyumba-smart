package ke.co.nyumbasearch.app.ui.webview

import android.graphics.Bitmap
import android.net.Uri
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import ke.co.nyumbasearch.app.core.util.Constants
import ke.co.nyumbasearch.app.ui.main.MainActivity

class NyumbaWebViewClient(
    private val activity: MainActivity,
    private val onPageFinished: () -> Unit,
    private val onMainFrameError: () -> Unit,
) : WebViewClient() {

    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
        val url = request.url.toString()
        val host = request.url.host ?: return false

        if (Constants.NYUMBA_HOSTS.any { host == it || host.endsWith(".$it") }) {
            return false
        }

        // Pesapal hosted checkout stays in the WebView so the callback can return to the app.
        if (Constants.isInAppExternalHost(host)) {
            return false
        }

        if (Constants.ALLOWED_EXTERNAL_HOSTS.any { host == it || host.endsWith(".$it") }) {
            activity.openExternalUrl(url)
            return true
        }

        activity.openExternalUrl(url)
        return true
    }

    override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
        super.onPageStarted(view, url, favicon)
        if (url?.startsWith("file:///android_asset") != true) {
            activity.hideOfflineShell()
        }
    }

    override fun onPageFinished(view: WebView, url: String?) {
        super.onPageFinished(view, url)
        if (url?.startsWith("file:///android_asset") == true) return
        if (url.isNullOrBlank() || url == "about:blank") return

        // Native shell: mark standalone + remove PWA SW (can hang listings fetch in WebView).
        view.evaluateJavascript(
            """
            (function(){
              document.documentElement.classList.add('nyumba-android-app');
              document.documentElement.dataset.displayMode='standalone';
              try {
                if (navigator.serviceWorker) {
                  navigator.serviceWorker.getRegistrations().then(function(regs){
                    regs.forEach(function(r){ r.unregister(); });
                  });
                  if (navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage({type:'nyumba-android-skip'});
                  }
                }
                if (window.caches && caches.keys) {
                  caches.keys().then(function(keys){
                    keys.forEach(function(k){ caches.delete(k); });
                  });
                }
              } catch (e) {}
            })();
            """.trimIndent(),
            null,
        )
        onPageFinished()
    }

    override fun onReceivedError(
        view: WebView,
        request: WebResourceRequest,
        error: WebResourceError,
    ) {
        super.onReceivedError(view, request, error)
        if (!request.isForMainFrame) return
        val failing = request.url?.toString().orEmpty()
        if (failing.startsWith("file://") || failing == "about:blank") return
        onMainFrameError()
    }

    override fun onRenderProcessGone(
        view: WebView,
        detail: android.webkit.RenderProcessGoneDetail,
    ): Boolean {
        if (!detail.didCrash()) return false
        activity.recreateWebView()
        return true
    }
}
