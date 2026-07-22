package ke.co.nyumbasearch.app.push

/**
 * Firebase Cloud Messaging service — inactive until Firebase is configured.
 *
 * Enable steps:
 * 1. Add google-services.json to app/
 * 2. Uncomment google-services plugin in app/build.gradle.kts
 * 3. Uncomment FCM dependency and AndroidManifest service entry
 * 4. Feature-flag server-side sending when ready
 */
/*
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class FcmService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        // NyumbaApiClient.registerFcmToken(token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val category = message.data["category"]
        NotificationRouter.route(this, category, message)
    }
}
*/
