package ke.co.nyumbasearch.app.ui.main

import android.Manifest
import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
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
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.isVisible
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import ke.co.nyumbasearch.app.BuildConfig
import ke.co.nyumbasearch.app.R
import ke.co.nyumbasearch.app.core.cache.AppShellLoader
import ke.co.nyumbasearch.app.core.cache.PrefetchManager
import ke.co.nyumbasearch.app.core.network.LoadRetryHandler
import ke.co.nyumbasearch.app.core.network.NetworkTier
import ke.co.nyumbasearch.app.core.network.NetworkTierDetector
import ke.co.nyumbasearch.app.core.util.Constants
import ke.co.nyumbasearch.app.data.session.SessionPersistence
import ke.co.nyumbasearch.app.databinding.ActivityMainBinding
import ke.co.nyumbasearch.app.ui.webview.GalleryMediaSaver
import ke.co.nyumbasearch.app.ui.webview.JsBridge
import ke.co.nyumbasearch.app.ui.webview.NyumbaChromeClient
import ke.co.nyumbasearch.app.ui.webview.NyumbaWebViewClient

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var tierDetector: NetworkTierDetector
    private lateinit var appShellLoader: AppShellLoader
    private lateinit var retryHandler: LoadRetryHandler
    private lateinit var prefetchManager: PrefetchManager
    private var networkCallback: android.net.ConnectivityManager.NetworkCallback? = null

    private var pendingUrl: String = Constants.TENANT_URL
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var pendingGeoCallback: android.webkit.GeolocationPermissions.Callback? = null
    private var pendingGeoOrigin: String? = null
    private var pendingWebPermission: PermissionRequest? = null
    private var pageLoadWatchdog: Runnable? = null
    private var androidSafeTopPx: Int = 0
    private var pullRefreshLockedByPage: Boolean = false
    private var pendingGallerySave: Triple<String, String, String>? = null

    private val storagePermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            val pending = pendingGallerySave
            pendingGallerySave = null
            if (!granted || pending == null) {
                Toast.makeText(this, R.string.save_gallery_permission_denied, Toast.LENGTH_LONG).show()
                return@registerForActivityResult
            }
            enqueueGallerySave(pending.first, pending.second, pending.third)
        }

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
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        supportActionBar?.hide()
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = false
        }

        ViewCompat.setOnApplyWindowInsetsListener(binding.root) { _, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            androidSafeTopPx = bars.top
            injectSafeAreaCss()
            insets
        }

        tierDetector = NetworkTierDetector(this)
        appShellLoader = AppShellLoader(binding.webView)
        prefetchManager = PrefetchManager(this, tierDetector)
        retryHandler = LoadRetryHandler(binding.webView, onExhausted = { showOfflineShell() })

        setupSwipeRefresh()
        setupBackNavigation()
        setupOfflineRetry()
        setupNetworkObserver()
        maybeClearStaleWebViewState()

        pendingUrl = intent.dataString ?: Constants.TENANT_URL
        initWebView(binding.webView)
        loadWithAppHeaders(pendingUrl, useShell = savedInstanceState == null)
        prefetchManager.prefetchIfOnWifi(
            prefetchManager.defaultPrefetchUrls(),
            buildRequestHeaders(),
        )
    }

    /** Bust broken WebView HTTP cache left by older builds (keep cookies/session). */
    private fun maybeClearStaleWebViewState() {
        val prefs = getSharedPreferences("nyumba_webview", MODE_PRIVATE)
        val last = prefs.getInt("cleared_for_version", 0)
        if (last >= BuildConfig.VERSION_CODE) return
        runCatching { binding.webView.clearCache(true) }
        prefs.edit().putInt("cleared_for_version", BuildConfig.VERSION_CODE).apply()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun initWebView(webView: WebView) {
        SessionPersistence.configureCookies(webView)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            // Assets not needed for cold start anymore; keep false for security on API 30+.
            allowFileAccess = false
            allowContentAccess = true
            javaScriptCanOpenWindowsAutomatically = false
            setSupportMultipleWindows(false)
            setGeolocationEnabled(true)
            mediaPlaybackRequiresUserGesture = true
            loadsImagesAutomatically = true
            blockNetworkImage = false
            textZoom = 100
            useWideViewPort = true
            loadWithOverviewMode = true
            builtInZoomControls = false
            displayZoomControls = false
            // Identify the Play Store shell so the site never shows browser/install chrome.
            userAgentString =
                "$userAgentString NyumbaSearchApp/${BuildConfig.VERSION_NAME} (standalone)"
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                safeBrowsingEnabled = true
            }
        }

        webView.setLayerType(android.view.View.LAYER_TYPE_HARDWARE, null)
        webView.addJavascriptInterface(JsBridge(this), "NyumbaAndroid")
        webView.webChromeClient = NyumbaChromeClient(this)
        webView.webViewClient = NyumbaWebViewClient(
            activity = this,
            onPageFinished = {
                clearPageLoadWatchdog()
                binding.swipeRefresh.isRefreshing = false
                retryHandler.reset()
                updatePullRefreshForUrl(binding.webView.url)
                injectSafeAreaCss()
            },
            onMainFrameError = {
                clearPageLoadWatchdog()
                binding.swipeRefresh.isRefreshing = false
                retryHandler.onLoadFailed(pendingUrl, buildRequestHeaders())
            },
        )

        webView.setDownloadListener { url, _, contentDisposition, mimeType, _ ->
            val name = URLUtil.guessFileName(url, contentDisposition, mimeType)
            val mime = mimeType ?: "application/octet-stream"
            // Videos/images → gallery; other files → Downloads.
            if (mime.startsWith("video/") || mime.startsWith("image/")) {
                saveMediaToGallery(url, mime, name)
                return@setDownloadListener
            }
            val request = DownloadManager.Request(Uri.parse(url)).apply {
                setMimeType(mime)
                addRequestHeader("cookie", CookieManager.getInstance().getCookie(url) ?: "")
                setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name)
            }
            (getSystemService(DOWNLOAD_SERVICE) as DownloadManager).enqueue(request)
            Toast.makeText(this, R.string.downloading, Toast.LENGTH_SHORT).show()
        }

        webView.setOnScrollChangeListener { _, _, scrollY, _, _ ->
            binding.swipeRefresh.isEnabled = !pullRefreshLockedByPage && scrollY == 0
        }
    }

    /** Push system-bar inset into CSS so web chrome clears the status bar under edge-to-edge. */
    fun injectSafeAreaCss() {
        if (!::binding.isInitialized) return
        val top = androidSafeTopPx.coerceAtLeast(0)
        binding.webView.evaluateJavascript(
            "document.documentElement.style.setProperty('--android-safe-top','${top}px');",
            null,
        )
    }

    fun setPullToRefreshEnabled(enabled: Boolean) {
        pullRefreshLockedByPage = !enabled
        if (!::binding.isInitialized) return
        if (!enabled) {
            binding.swipeRefresh.isRefreshing = false
            binding.swipeRefresh.isEnabled = false
        } else {
            binding.swipeRefresh.isEnabled = binding.webView.scrollY == 0
        }
    }

    /** Save a remote video/image into the system gallery (Movies / Pictures → NyumbaSearch). */
    fun saveMediaToGallery(url: String, mimeType: String, filename: String) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            val granted =
                ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) ==
                    PackageManager.PERMISSION_GRANTED
            if (!granted) {
                pendingGallerySave = Triple(url, mimeType, filename)
                storagePermissionLauncher.launch(Manifest.permission.WRITE_EXTERNAL_STORAGE)
                return
            }
        }
        enqueueGallerySave(url, mimeType, filename)
    }

    private fun enqueueGallerySave(url: String, mimeType: String, filename: String) {
        Toast.makeText(this, R.string.saving_to_gallery, Toast.LENGTH_SHORT).show()
        GalleryMediaSaver.saveAsync(
            context = this,
            url = url,
            mimeType = mimeType,
            filename = filename,
            onSuccess = {
                runOnUiThread {
                    Toast.makeText(this, R.string.saved_to_gallery, Toast.LENGTH_LONG).show()
                }
            },
            onError = { message ->
                runOnUiThread {
                    Toast.makeText(
                        this,
                        getString(R.string.save_gallery_failed, message),
                        Toast.LENGTH_LONG,
                    ).show()
                }
            },
        )
    }

    private fun updatePullRefreshForUrl(url: String?) {
        // Listing upload wizards: pull-to-refresh remounts React and aborts mid-upload UX.
        val locked =
            url?.contains("/listings/new") == true ||
                url?.contains("/properties/new") == true ||
                url?.contains("/properties/create") == true
        setPullToRefreshEnabled(!locked)
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
                        else -> loadWithAppHeaders(Constants.TENANT_URL, useShell = false)
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
            // Always hint Save-Data so Worker serves lite assets in the WebView.
            "Save-Data" to "on",
        )
    }

    private fun clearPageLoadWatchdog() {
        pageLoadWatchdog?.let { binding.webView.removeCallbacks(it) }
        pageLoadWatchdog = null
    }

    private fun armPageLoadWatchdog() {
        clearPageLoadWatchdog()
        val watchdog = Runnable {
            if (isFinishing || isDestroyed) return@Runnable
            // Main frame hung — stop and retry with exponential backoff.
            binding.webView.stopLoading()
            binding.swipeRefresh.isRefreshing = false
            retryHandler.onLoadFailed(pendingUrl, buildRequestHeaders())
        }
        pageLoadWatchdog = watchdog
        binding.webView.postDelayed(watchdog, Constants.PAGE_LOAD_WATCHDOG_MS)
    }

    private fun loadWithAppHeaders(url: String, useShell: Boolean) {
        pendingUrl = url
        val headers = buildRequestHeaders()
        armPageLoadWatchdog()
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
        return url == Constants.BASE_URL ||
            url == Constants.TENANT_URL ||
            url == "https://www.nyumbasearch.com/" ||
            url == "https://www.nyumbasearch.com/tenant"
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
        // Do not pauseTimers() — it freezes in-flight listing fetches on Android 11+.
        SessionPersistence.flushCookies()
    }

    override fun onResume() {
        super.onResume()
        binding.webView.onResume()
    }

    override fun onDestroy() {
        clearPageLoadWatchdog()
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
