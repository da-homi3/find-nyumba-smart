package ke.co.nyumbasearch.app.ui.webview

import android.webkit.JavascriptInterface
import ke.co.nyumbasearch.app.ui.main.MainActivity
import java.lang.ref.WeakReference

/** Bridge for native ↔ web communication. */
class JsBridge(activity: MainActivity) {
    private val activityRef = WeakReference(activity)

    @JavascriptInterface
    fun getPlatform(): String = "android"

    /** Disable pull-to-refresh while a listing upload (or similar) must not remount. */
    @JavascriptInterface
    fun setPullToRefreshEnabled(enabled: Boolean) {
        val activity = activityRef.get() ?: return
        activity.runOnUiThread {
            activity.setPullToRefreshEnabled(enabled)
        }
    }

    /**
     * Download [url] and save into the device gallery (Movies / Pictures).
     * Called from the web admin “Save walkthrough” action.
     */
    @JavascriptInterface
    fun saveMediaToGallery(url: String, mimeType: String, filename: String) {
        val activity = activityRef.get() ?: return
        activity.saveMediaToGallery(url, mimeType, filename)
    }
}
