package com.nyumbasearch.app.data.session

import android.webkit.CookieManager
import android.webkit.WebView

object SessionPersistence {
    fun configureCookies(webView: WebView) {
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, true)
        }
    }

    fun flushCookies() {
        CookieManager.getInstance().flush()
    }
}
