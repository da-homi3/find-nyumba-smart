package com.nyumbasearch.app.ui.webview

import android.net.Uri
import android.webkit.GeolocationPermissions
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import com.nyumbasearch.app.ui.main.MainActivity

class NyumbaChromeClient(private val activity: MainActivity) : WebChromeClient() {

    override fun onShowFileChooser(
        webView: WebView,
        filePathCallback: ValueCallback<Array<Uri>>,
        fileChooserParams: FileChooserParams,
    ): Boolean {
        activity.launchFileChooser(filePathCallback, fileChooserParams.acceptTypes)
        return true
    }

    override fun onPermissionRequest(request: PermissionRequest) {
        activity.handleWebPermissionRequest(request)
    }

    override fun onGeolocationPermissionsShowPrompt(
        origin: String,
        callback: GeolocationPermissions.Callback,
    ) {
        activity.handleGeolocationRequest(origin, callback)
    }
}
