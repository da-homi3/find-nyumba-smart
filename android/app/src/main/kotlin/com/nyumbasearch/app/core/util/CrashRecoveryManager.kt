package com.nyumbasearch.app.core.util

import android.content.Context
import android.util.Log
import kotlin.system.exitProcess

object CrashRecoveryManager {
    private const val TAG = "NyumbaCrash"

    fun handleUncaughtException(context: Context, thread: Thread, throwable: Throwable) {
        Log.e(TAG, "Uncaught on ${thread.name}", throwable)
        LocalEventLoggerPlaceholder.log("crash", mapOf("message" to (throwable.message ?: "unknown")))
        android.os.Process.killProcess(android.os.Process.myPid())
        exitProcess(1)
    }
}

/** Avoid circular dependency with analytics module during crash handler init. */
private object LocalEventLoggerPlaceholder {
    private const val TAG = "NyumbaCrash"

    fun log(event: String, params: Map<String, String>) {
        Log.d(TAG, "$event $params")
    }
}
