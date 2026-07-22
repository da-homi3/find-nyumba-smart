package ke.co.nyumbasearch.app.push

import android.content.Context

/**
 * Routes FCM notifications to channels by category.
 * Uncomment RemoteMessage import when Firebase is enabled.
 */
object NotificationRouter {
    fun route(context: Context, category: String?, data: Map<String, String>) {
        val channel = when (category) {
            "new_listing" -> "listings"
            "saved_search" -> "alerts"
            "message" -> "messages"
            "account" -> "account"
            "promo" -> "promotions"
            else -> "general"
        }
        // Build notification with deep-link intent to MainActivity + nyumbasearch.com path
        android.util.Log.d("NyumbaFCM", "route channel=$channel data=$data")
    }
}
