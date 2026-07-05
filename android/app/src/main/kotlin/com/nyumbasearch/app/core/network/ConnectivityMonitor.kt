package com.nyumbasearch.app.core.network

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest

/** Live connectivity observer — wraps [NetworkTierDetector] for components that only need online/offline. */
class ConnectivityMonitor(context: Context) {
    private val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    private val tierDetector = NetworkTierDetector(context)

    fun isOnline(): Boolean = tierDetector.currentTier() != NetworkTier.OFFLINE

    fun observe(onChange: (Boolean) -> Unit): ConnectivityManager.NetworkCallback {
        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) = onChange(true)
            override fun onLost(network: Network) = onChange(isOnline())
            override fun onCapabilitiesChanged(network: Network, caps: NetworkCapabilities) {
                onChange(tierDetector.currentTier() != NetworkTier.OFFLINE)
            }
        }
        cm.registerNetworkCallback(request, callback)
        return callback
    }
}
