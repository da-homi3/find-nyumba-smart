-keep class ke.co.nyumbasearch.app.push.** { *; }
-keep class ke.co.nyumbasearch.app.ui.webview.NyumbaChromeClient { *; }
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.google.firebase.** { *; }
-dontwarn okhttp3.**
