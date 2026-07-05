package com.nyumbasearch.app.core.network

enum class NetworkTier {
    OFFLINE,
    POOR_2G_3G,
    GOOD_4G,
    WIFI,
}

class NetworkTierDetector(private val context: android.content.Context) {
    private val cm =
        context.getSystemService(android.content.Context.CONNECTIVITY_SERVICE)
            as android.net.ConnectivityManager

    fun currentTier(): NetworkTier {
        val network = cm.activeNetwork ?: return NetworkTier.OFFLINE
        val caps = cm.getNetworkCapabilities(network) ?: return NetworkTier.OFFLINE

        return when {
            !caps.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_INTERNET) ->
                NetworkTier.OFFLINE
            caps.hasTransport(android.net.NetworkCapabilities.TRANSPORT_WIFI) ->
                NetworkTier.WIFI
            caps.hasTransport(android.net.NetworkCapabilities.TRANSPORT_CELLULAR) -> {
                val downKbps = caps.linkDownstreamBandwidthKbps
                if (downKbps in 1..1500) NetworkTier.POOR_2G_3G else NetworkTier.GOOD_4G
            }
            else -> NetworkTier.GOOD_4G
        }
    }

    fun observe(onChange: (NetworkTier) -> Unit): android.net.ConnectivityManager.NetworkCallback {
        val request = android.net.NetworkRequest.Builder()
            .addCapability(android.net.NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()
        val callback = object : android.net.ConnectivityManager.NetworkCallback() {
            override fun onCapabilitiesChanged(
                network: android.net.Network,
                caps: android.net.NetworkCapabilities,
            ) {
                onChange(currentTier())
            }

            override fun onLost(network: android.net.Network) {
                onChange(NetworkTier.OFFLINE)
            }
        }
        cm.registerNetworkCallback(request, callback)
        return callback
    }
}
