package kr.georaenote.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import android.graphics.Color
import kr.georaenote.app.nav.AppNav
import kr.georaenote.app.ui.theme.GeoraeNoteTheme

class MainActivity : ComponentActivity() {
    private val vm: AppViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.light(Color.WHITE, Color.WHITE),
        )
        setContent {
            GeoraeNoteTheme { AppNav(vm) }
        }
        // 카카오·네이버·구글 로그인 후 브라우저가 georaenote://auth 로 앱을 열어요
        if (savedInstanceState == null) vm.handleAuthRedirect(intent?.data)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        vm.handleAuthRedirect(intent.data)
    }

    override fun onResume() {
        super.onResume()
        vm.refresh()
    }
}
