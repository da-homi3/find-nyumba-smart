package ke.co.nyumbasearch.app.core.util

object Constants {
    const val BASE_URL = "https://nyumbasearch.com/"
    const val TENANT_URL = "https://nyumbasearch.com/tenant"
    const val APP_SHELL_PATH = "file:///android_asset/app_shell/shell.html"
    const val SHELL_LOAD_DELAY_MS = 80L

    /** If the main frame never finishes, force a retry before the UI feels hung. */
    const val PAGE_LOAD_WATCHDOG_MS = 18_000L

    /** Hosted checkout that must stay inside the WebView (Pesapal card pay). */
    val IN_APP_EXTERNAL_HOSTS = setOf(
        "pay.pesapal.com",
        "cybqa.pesapal.com",
    )

    /** Open in the system browser / WhatsApp (not checkout). */
    val ALLOWED_EXTERNAL_HOSTS = setOf(
        "api.safaricom.co.ke",
        "wa.me",
        "api.whatsapp.com",
    )

    val NYUMBA_HOSTS = setOf("nyumbasearch.com", "www.nyumbasearch.com")

    fun isInAppExternalHost(host: String): Boolean {
        if (IN_APP_EXTERNAL_HOSTS.any { host == it || host.endsWith(".$it") }) return true
        return host == "pesapal.com" || host.endsWith(".pesapal.com")
    }
}
