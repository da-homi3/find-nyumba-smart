package ke.co.nyumbasearch.app.core.analytics

import android.util.Log

/** Local event logger — wire to Firebase Analytics when enabled server-side. */
object LocalEventLogger {
    private const val TAG = "NyumbaAnalytics"

    fun log(event: String, params: Map<String, String> = emptyMap()) {
        Log.d(TAG, "$event $params")
    }
}
