package com.nyumbasearch.app.ui.main

import android.Manifest
import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.webkit.CookieManager
import android.webkit.PermissionRequest
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebSettings
import android.webkit.WebView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.isVisible
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.nyumbasearch.app.BuildConfig
import com.nyumbasearch.app.R
import com.nyumbasearch.app.core.cache.AppShellLoader
import com.nyumbasearch.app.core.cache.PrefetchManager
import com.nyumbasearch.app.core.network.LoadRetryHandler
import com.nyumbasearch.app.core.network.NetworkTier
import com.nyumbasearch.app.core.network.NetworkTierDetector
import com.nyumbasearch.app.core.util.Constants
import com.nyumbasearch.app.data.session.SessionPersistence
import com.nyumbasearch.app.databinding.ActivityMainBinding
import com.nyumbasearch.app.ui.webview.JsBridge
import com.nyumbasearch.app.ui.webview.NyumbaChromeClient
import com.nyumbasearch.app.ui.webview.NyumbaWebViewClient

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var tierDetector: NetworkTierDetector
    private lateinit var appShellLoader: AppShellLoader
    private lateinit var retryHandler: LoadRetryHandler
    private lateinit var prefetchManager: PrefetchManager
    private var networkCallback: android.net.ConnectivityManager.NetworkCallback? = null

    private var pendingUrl: String = Constants.BASE_URL
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var pendingGeoCallback: android.webkit.GeolocationPermissions.Callback? = null
    private var pendingGeoOrigin: String? = null
    private var pendingWebPermission: PermissionRequest? = null

    private val fileChooserLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val callback = filePathCallback ?: return@registerForActivityResult
            filePathCallback = null
            val uris = WebChromeClientResultHelper.parse(result.resultCode, result.data)
            callback.onReceiveValue(uris)
        }

    private val cameraPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            pendingWebPermission?.let { request ->
                if (granted) request.grant(request.resources) else request.deny()
                pendingWebPermission = null
            }
        }

    private val locationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { results ->
            val granted = results.values.any { it }
            pendingGeoCallback?.invoke(pendingGeoOrigin, granted, false)
            pendingGeoCallback = null
            pendingGeoOrigin = null
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        tierDetector = NetworkTierDetector(this)
        appShellLoader = AppShellLoader(binding.webView)
        prefetchManager = PrefetchManager(this, tierDetector)
        retryHandler = LoadRetryHandler(binding.webView, onExhausted = { showOfflineShell() })

        setupSwipeRefresh()
        setupBackNavigation()
        setupOfflineRetry()
        setupNetworkObserver()

        pendingUrl = intent.dataString ?: Constants.BASE_URL
        initWebView(binding.webView)
        loadWithAppHeaders(pendingUrl, useShell = savedInstanceState == null)
        prefetchManager.prefetchIfOnWifi(
            prefetchManager.defaultPrefetchUrls(),
            buildRequestHeaders(),
        )
    }

  @SuppressLint("SetJavaScriptEnabled")
    private fun initWebView(webView: WebView) {
        SessionPersistence.configureCookies(webView)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            allowFileAccess = false
            allowContentAccess = false
            javaScriptCanOpenWindowsAutomatically = false
            setGeolocationEnabled(true)
            mediaPlaybackRequiresUserGesture = true
            loadsImagesAutomatically = true
            blockNetworkImage = false
            textZoom = 100
        }

        webView.addJavascriptInterface(JsBridge(), "NyumbaAndroid")
        webView.webChromeClient = NyumbaChromeClient(this)
        webView.webViewClient = NyumbaWebViewClient(
            activity = this,
            onPageFinished = {
                binding.swipeRefresh.isRefreshing = false
                retryHandler.reset()
            },
            onMainFrameError = {
                binding.swipeRefresh.isRefreshing = false
                retryHandler.onLoadFailed(pendingUrl, buildRequestHeaders())
            },
        )

        webView.setDownloadListener { url, _, contentDisposition, mimeType, _ ->
            val request = DownloadManager.Request(Uri.parse(url)).apply {
                setMimeType(mimeType)
                addRequestHeader("cookie", CookieManager.getInstance().getCookie(url) ?: "")
                setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                setDestinationInExternalPublicDir(
                    Environment.DIRECTORY_DOWNLOADS,
                    URLUtil.guessFileName(url, contentDisposition, mimeType),
                )
            }
            (getSystemService(DOWNLOAD_SERVICE) as DownloadManager).enqueue(request)
            Toast.makeText(this, R.string.downloading, Toast.LENGTH_SHORT).show()
        }

        webView.setOnScrollChangeListener { _, _, scrollY, _, _ ->
            binding.swipeRefresh.isEnabled = scrollY == 0
        }
    }

    private fun setupSwipeRefresh() {
        binding.swipeRefresh.setColorSchemeColors(ContextCompat.getColor(this, R.color.mint))
        binding.swipeRefresh.setOnRefreshListener {
            if (tierDetector.currentTier() == NetworkTier.OFFLINE) {
                binding.swipeRefresh.isRefreshing = false
                Toast.makeText(this, R.string.no_internet, Toast.LENGTH_SHORT).show()
            } else {
                binding.webView.reload()
            }
        }
    }

    private fun setupBackNavigation() {
        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    when {
                        binding.webView.canGoBack() -> binding.webView.goBack()
                        isOnHomepage() -> showExitConfirmationDialog()
                        else -> loadWithAppHeaders(Constants.BASE_URL, useShell = false)
                    }
                }
            },
        )
    }

    private fun setupOfflineRetry() {
        binding.retryButton.setOnClickListener {
            hideOfflineShell()
            loadWithAppHeaders(pendingUrl, useShell = false)
        }
    }

    private fun setupNetworkObserver() {
        networkCallback = tierDetector.observe { tier ->
            if (tier == NetworkTier.OFFLINE && !binding.offlinePanel.isVisible) {
                // Defer until user navigates or refresh — avoid interrupting active loads
            }
        }
    }

    fun buildRequestHeaders(): Map<String, String> {
        val tier = tierDetector.currentTier()
        return mapOf(
            "X-App-Client" to "android",
            "X-App-Version" to BuildConfig.VERSION_NAME,
            "X-Network-Tier" to tier.name,
            "Save-Data" to if (tier == NetworkTier.POOR_2G_3G) "on" else "off",
        )
    }

    private fun loadWithAppHeaders(url: String, useShell: Boolean) {
        pendingUrl = url
        val headers = buildRequestHeaders()
        if (useShell) {
            appShellLoader.showShellThenLoad(url, headers)
        } else {
            binding.webView.loadUrl(url, headers)
        }
    }

    fun showOfflineShell() {
        binding.offlinePanel.isVisible = true
    }

    fun hideOfflineShell() {
        binding.offlinePanel.isVisible = false
    }

    fun recreateWebView() {
        val url = pendingUrl
        binding.webView.apply {
            stopLoading()
            clearHistory()
            loadUrl("about:blank")
        }
        initWebView(binding.webView)
        loadWithAppHeaders(url, useShell = false)
    }

    fun openExternalUrl(url: String) {
        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
    }

    fun launchFileChooser(callback: ValueCallback<Array<Uri>>, acceptTypes: Array<String>) {
        filePathCallback?.onReceiveValue(null)
        filePathCallback = callback
        val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = acceptTypes.firstOrNull()?.takeIf { it.isNotBlank() } ?: "*/*"
            putExtra(Intent.EXTRA_MIME_TYPES, acceptTypes)
        }
        fileChooserLauncher.launch(Intent.createChooser(intent, "Select file"))
    }

    fun handleWebPermissionRequest(request: PermissionRequest) {
        val needsCamera = request.resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)
        if (needsCamera &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            pendingWebPermission = request
            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
        } else {
            request.grant(request.resources)
        }
    }

    fun handleGeolocationRequest(
        origin: String,
        callback: android.webkit.GeolocationPermissions.Callback,
    ) {
        val fine = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
        val coarse =
            ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION)
        if (fine == PackageManager.PERMISSION_GRANTED || coarse == PackageManager.PERMISSION_GRANTED) {
            callback.invoke(origin, true, false)
        } else {
            pendingGeoOrigin = origin
            pendingGeoCallback = callback
            locationPermissionLauncher.launch(
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION,
                ),
            )
        }
    }

    private fun isOnHomepage(): Boolean {
        val url = binding.webView.url ?: return true
        return url == Constants.BASE_URL || url == "https://www.nyumbasearch.com/"
    }

    private fun showExitConfirmationDialog() {
        MaterialAlertDialogBuilder(this)
            .setTitle(R.string.exit_title)
            .setMessage(R.string.exit_message)
            .setPositiveButton(R.string.exit_confirm) { _, _ -> finish() }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        intent.dataString?.let { loadWithAppHeaders(it, useShell = false) }
    }

    override fun onPause() {
        super.onPause()
        binding.webView.onPause()
        binding.webView.pauseTimers()
        SessionPersistence.flushCookies()
    }

    override fun onResume() {
        super.onResume()
        binding.webView.onResume()
        binding.webView.resumeTimers()
    }

    override fun onDestroy() {
        networkCallback?.let {
            (getSystemService(CONNECTIVITY_SERVICE) as android.net.ConnectivityManager)
                .unregisterNetworkCallback(it)
        }
        binding.webView.destroy()
        super.onDestroy()
    }
}

/** Parses file chooser activity results for WebView. */
private object WebChromeClientResultHelper {
    fun parse(resultCode: Int, data: Intent?): Array<Uri>? {
        if (resultCode != android.app.Activity.RESULT_OK) return null
        val uri = data?.data ?: return null
        return arrayOf(uri)
    }
}
