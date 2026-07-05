-keep class com.nyumbasearch.app.push.** { *; }
-keep class com.nyumbasearch.app.ui.webview.NyumbaChromeClient { *; }
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.google.firebase.** { *; }
-dontwarn okhttp3.**
