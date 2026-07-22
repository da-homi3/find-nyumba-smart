package ke.co.nyumbasearch.app.ui.splash

import android.animation.ObjectAnimator
import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.core.animation.doOnEnd
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.lifecycleScope
import ke.co.nyumbasearch.app.core.network.NetworkTierDetector
import ke.co.nyumbasearch.app.ui.main.MainActivity
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class SplashActivity : AppCompatActivity() {

    private var isReady = false

    override fun onCreate(savedInstanceState: Bundle?) {
        val splashScreen = installSplashScreen()
        splashScreen.setKeepOnScreenCondition { !isReady }
        splashScreen.setOnExitAnimationListener { splashView ->
            ObjectAnimator.ofFloat(splashView.view, android.view.View.ALPHA, 1f, 0f).apply {
                duration = 220L
                doOnEnd { splashView.remove() }
                start()
            }
        }

        super.onCreate(savedInstanceState)

        lifecycleScope.launch {
            NetworkTierDetector(this@SplashActivity).currentTier()
            delay(300)
            isReady = true
            startActivity(
                Intent(this@SplashActivity, MainActivity::class.java).apply {
                    data = intent?.data
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                },
            )
            finish()
        }
    }
}
