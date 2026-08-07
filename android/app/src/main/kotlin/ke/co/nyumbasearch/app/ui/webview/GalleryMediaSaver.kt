package ke.co.nyumbasearch.app.ui.webview

import android.content.ContentValues
import android.content.Context
import android.media.MediaScannerConnection
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.webkit.CookieManager
import android.webkit.URLUtil
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/** Download a remote media URL and insert it into the system gallery / Movies. */
object GalleryMediaSaver {
    private val executor = Executors.newSingleThreadExecutor()

    fun saveAsync(
        context: Context,
        url: String,
        mimeType: String,
        filename: String,
        onSuccess: () -> Unit,
        onError: (String) -> Unit,
    ) {
        executor.execute {
            try {
                saveBlocking(context.applicationContext, url, mimeType, filename)
                onSuccess()
            } catch (err: Exception) {
                onError(err.message ?: "Save failed")
            }
        }
    }

    private fun saveBlocking(context: Context, url: String, mimeType: String, filename: String) {
        val safeName =
            URLUtil.guessFileName(url, null, mimeType).takeIf { it.isNotBlank() }
                ?: filename.ifBlank { "nyumba-walkthrough.mp4" }
        val mime = mimeType.ifBlank { guessMime(safeName) }
        val connection = (URL(url).openConnection() as HttpURLConnection).apply {
            connectTimeout = 30_000
            readTimeout = 120_000
            instanceFollowRedirects = true
            val cookie = CookieManager.getInstance().getCookie(url)
            if (!cookie.isNullOrBlank()) setRequestProperty("Cookie", cookie)
            connect()
        }
        if (connection.responseCode !in 200..299) {
            throw IllegalStateException("Download failed (${connection.responseCode})")
        }

        connection.inputStream.use { input ->
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                insertViaMediaStore(context, input, mime, safeName)
            } else {
                insertLegacy(context, input, mime, safeName)
            }
        }
        connection.disconnect()
    }

    private fun insertViaMediaStore(
        context: Context,
        input: java.io.InputStream,
        mime: String,
        filename: String,
    ) {
        val isVideo = mime.startsWith("video/")
        val collection =
            if (isVideo) {
                MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
            } else {
                MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
            }
        val relative =
            if (isVideo) {
                Environment.DIRECTORY_MOVIES + "/NyumbaSearch"
            } else {
                Environment.DIRECTORY_PICTURES + "/NyumbaSearch"
            }
        val values =
            ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME, filename)
                put(MediaStore.MediaColumns.MIME_TYPE, mime)
                put(MediaStore.MediaColumns.RELATIVE_PATH, relative)
                put(MediaStore.MediaColumns.IS_PENDING, 1)
            }
        val resolver = context.contentResolver
        val uri = resolver.insert(collection, values)
            ?: throw IllegalStateException("Could not create gallery item")
        try {
            resolver.openOutputStream(uri)?.use { output -> input.copyTo(output) }
                ?: throw IllegalStateException("Could not write gallery item")
            values.clear()
            values.put(MediaStore.MediaColumns.IS_PENDING, 0)
            resolver.update(uri, values, null, null)
        } catch (err: Exception) {
            resolver.delete(uri, null, null)
            throw err
        }
    }

    @Suppress("DEPRECATION")
    private fun insertLegacy(
        context: Context,
        input: java.io.InputStream,
        mime: String,
        filename: String,
    ) {
        val isVideo = mime.startsWith("video/")
        val root =
            Environment.getExternalStoragePublicDirectory(
                if (isVideo) Environment.DIRECTORY_MOVIES else Environment.DIRECTORY_PICTURES,
            )
        val dir = File(root, "NyumbaSearch").apply { mkdirs() }
        val outFile = File(dir, filename)
        FileOutputStream(outFile).use { output -> input.copyTo(output) }
        MediaScannerConnection.scanFile(
            context,
            arrayOf(outFile.absolutePath),
            arrayOf(mime),
            null,
        )
    }

    private fun guessMime(filename: String): String {
        val lower = filename.lowercase()
        return when {
            lower.endsWith(".webm") -> "video/webm"
            lower.endsWith(".mov") -> "video/quicktime"
            lower.endsWith(".m4v") || lower.endsWith(".mp4") -> "video/mp4"
            lower.endsWith(".png") -> "image/png"
            lower.endsWith(".webp") -> "image/webp"
            lower.endsWith(".jpg") || lower.endsWith(".jpeg") -> "image/jpeg"
            else -> "application/octet-stream"
        }
    }
}
