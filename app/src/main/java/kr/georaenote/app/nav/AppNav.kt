package kr.georaenote.app.nav

import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import kr.georaenote.app.AppViewModel
import kr.georaenote.app.data.Content
import kr.georaenote.app.ui.screens.ArticleScreen
import kr.georaenote.app.ui.screens.BoardScreen
import kr.georaenote.app.ui.screens.CarrierScreen
import kr.georaenote.app.ui.screens.ContractDetailScreen
import kr.georaenote.app.ui.screens.ContractDoneScreen
import kr.georaenote.app.ui.screens.ContractPayeeScreen
import kr.georaenote.app.ui.screens.ContractProofScreen
import kr.georaenote.app.ui.screens.ContractSenderScreen
import kr.georaenote.app.ui.screens.ContractTypeScreen
import kr.georaenote.app.ui.screens.DocScreen
import kr.georaenote.app.ui.screens.EventDetailScreen
import kr.georaenote.app.ui.screens.GuideScreen
import kr.georaenote.app.ui.screens.HistoryScreen
import kr.georaenote.app.ui.screens.HomeScreen
import kr.georaenote.app.ui.screens.InstallmentScreen
import kr.georaenote.app.ui.screens.MagazineScreen
import kr.georaenote.app.ui.screens.MileageScreen
import kr.georaenote.app.ui.screens.NoticeDetailScreen
import kr.georaenote.app.ui.screens.OnboardingScreen
import kr.georaenote.app.ui.screens.PayScreen
import kr.georaenote.app.ui.screens.SettingsScreen
import kr.georaenote.app.ui.screens.SupportScreen
import kr.georaenote.app.ui.screens.TermsScreen
import kr.georaenote.app.ui.screens.TransferResultScreen
import kr.georaenote.app.ui.screens.TransferScreen
import kr.georaenote.app.ui.screens.VerifyScreen

private fun NavHostController.goHome() {
    if (!popBackStack(Routes.HOME, inclusive = false)) {
        navigate(Routes.HOME) { popUpTo(0) }
    }
}

@Composable
fun AppNav(vm: AppViewModel) {
    val nav = rememberNavController()
    val context = LocalContext.current
    val go: (String) -> Unit = { route -> nav.navigate(route) { launchSingleTop = true } }
    val back: () -> Unit = { if (!nav.popBackStack()) nav.goHome() }
    val openWeb: () -> Unit = {
        if (Content.WEB_URL.isBlank()) {
            Toast.makeText(context, "웹사이트는 준비 중이에요.", Toast.LENGTH_SHORT).show()
        } else {
            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(Content.WEB_URL)))
        }
    }

    NavHost(
        navController = nav,
        startDestination = if (vm.onboarded) Routes.HOME else Routes.ONBOARDING,
        enterTransition = { slideInHorizontally(tween(260)) { it / 4 } + fadeIn(tween(260)) },
        exitTransition = { fadeOut(tween(200)) },
        popEnterTransition = { fadeIn(tween(200)) },
        popExitTransition = { slideOutHorizontally(tween(240)) { it / 4 } + fadeOut(tween(240)) },
    ) {
        composable(Routes.ONBOARDING, enterTransition = { EnterTransition.None }, exitTransition = { ExitTransition.None }) {
            OnboardingScreen {
                vm.finishOnboarding()
                nav.navigate(Routes.HOME) { popUpTo(Routes.ONBOARDING) { inclusive = true } }
            }
        }
        composable(Routes.HOME) { HomeScreen(vm, go, openWeb) }
        composable(Routes.GUIDE) { GuideScreen(vm, back, go) }

        // 가입·본인인증
        composable(Routes.TERMS) { TermsScreen(back, go) }
        composable(Routes.DOC) { e -> DocScreen(e.arguments?.getString("kind") ?: "service", back) }
        composable(Routes.CARRIER) { CarrierScreen(back, go) }
        composable(Routes.VERIFY) { e ->
            VerifyScreen(vm, e.arguments?.getString("carrier") ?: "", back) { nav.goHome() }
        }

        // 계약 등록
        composable(Routes.CONTRACT_TYPE) { ContractTypeScreen(vm, back, go) }
        composable(Routes.CONTRACT_PAYEE) { ContractPayeeScreen(vm, back, go) }
        composable(Routes.CONTRACT_SENDER) { ContractSenderScreen(vm, back, go) }
        composable(Routes.CONTRACT_PROOF) { ContractProofScreen(vm, back) { nav.navigate(it) { popUpTo(Routes.HOME) } } }
        composable(Routes.CONTRACT_DONE) { ContractDoneScreen { nav.goHome() } }
        composable(Routes.CONTRACT) { e -> ContractDetailScreen(vm, e.arguments?.getString("id") ?: "", back, go) }

        // 송금
        composable(Routes.TRANSFER) { e -> TransferScreen(vm, e.arguments?.getString("contractId") ?: "", back, go) }
        composable(Routes.PAY) {
            PayScreen(vm, back) { id -> nav.navigate(Routes.transferDone(id)) { popUpTo(Routes.HOME) } }
        }
        composable(Routes.TRANSFER_DONE) { e ->
            TransferResultScreen(vm, e.arguments?.getString("id") ?: "", afterPay = true, back = back, goHome = { nav.goHome() })
        }
        composable(Routes.HISTORY) { HistoryScreen(vm, back, go) }
        composable(Routes.RECEIPT) { e ->
            TransferResultScreen(vm, e.arguments?.getString("id") ?: "", afterPay = false, back = back, goHome = { nav.goHome() })
        }

        // 안내·게시판
        composable(Routes.BOARD) { e -> BoardScreen(vm, e.arguments?.getString("tab")?.toIntOrNull() ?: 0, back, go) }
        composable(Routes.NOTICE) { e -> NoticeDetailScreen(e.arguments?.getString("id")?.toIntOrNull() ?: 0, back) }
        composable(Routes.EVENT) { e -> EventDetailScreen(vm, e.arguments?.getString("id")?.toIntOrNull() ?: 0, back, go) }
        composable(Routes.MAGAZINE) { MagazineScreen(back, go) }
        composable(Routes.ARTICLE) { e -> ArticleScreen(e.arguments?.getString("id")?.toIntOrNull() ?: 0, back) }
        composable(Routes.INSTALLMENT) { InstallmentScreen(back) }
        composable(Routes.SUPPORT) { SupportScreen(back, go) }
        composable(Routes.SETTINGS) { SettingsScreen(vm, back, go) { nav.goHome() } }
        composable(Routes.MILEAGE) { MileageScreen(vm, back, go) }
    }
}
