package com.nyumbasearch.app.ui.webview

import android.graphics.Bitmap
import android.net.Uri
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import com.nyumbasearch.app.core.util.Constants
import com.nyumbasearch.app.ui.main.MainActivity

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
        if (url?.startsWith("file:///android_asset") != true) {
            onPageFinished()
        }
    }

    override fun onReceivedError(
        view: WebView,
        request: WebResourceRequest,
        error: WebResourceError,
    ) {
        super.onReceivedError(view, request, error)
        if (request.isForMainFrame) {
            onMainFrameError()
        }
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
