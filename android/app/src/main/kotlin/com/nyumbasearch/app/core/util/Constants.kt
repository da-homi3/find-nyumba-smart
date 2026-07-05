package com.nyumbasearch.app.core.util

object Constants {
    const val BASE_URL = "https://nyumbasearch.com/"
    const val APP_SHELL_PATH = "file:///android_asset/app_shell/shell.html"
    const val SHELL_LOAD_DELAY_MS = 80L

    val ALLOWED_EXTERNAL_HOSTS = setOf(
        "checkout.flutterwave.com",
        "api.safaricom.co.ke",
        "wa.me",
        "api.whatsapp.com",
    )

    val NYUMBA_HOSTS = setOf("nyumbasearch.com", "www.nyumbasearch.com")
}
