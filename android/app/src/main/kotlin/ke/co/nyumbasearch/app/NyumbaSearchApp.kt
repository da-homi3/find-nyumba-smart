package ke.co.nyumbasearch.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import android.util.Log
import androidx.webkit.WebViewCompat
import ke.co.nyumbasearch.app.core.util.CrashRecoveryManager

class NyumbaSearchApp : Application() {
    override fun onCreate() {
        super.onCreate()

        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            CrashRecoveryManager.handleUncaughtException(this, thread, throwable)
        }

        WebViewCompat.startSafeBrowsing(this) { success ->
            Log.d("NyumbaSearch", "Safe Browsing initialised: $success")
        }

        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java) ?: return
        val channels = listOf(
            Triple("messages", "Messages", NotificationManager.IMPORTANCE_HIGH),
            Triple("listings", "New listings", NotificationManager.IMPORTANCE_DEFAULT),
            Triple("alerts", "Saved search alerts", NotificationManager.IMPORTANCE_DEFAULT),
            Triple("account", "Account", NotificationManager.IMPORTANCE_DEFAULT),
            Triple("promotions", "Promotions", NotificationManager.IMPORTANCE_LOW),
            Triple("general", "General", NotificationManager.IMPORTANCE_DEFAULT),
        )
        channels.forEach { (id, name, importance) ->
            manager.createNotificationChannel(NotificationChannel(id, name, importance))
        }
    }
}
