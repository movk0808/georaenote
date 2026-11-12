package kr.georaenote.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

/**
 * 브랜드 색상은 모두 여기서 바꿉니다. 웹은 web/src/styles.css 의 :root 변수와 같은 값을 씁니다.
 * 팔레트: 네이비 + 입금 그린 (ui-ux-pro-max-skill 'Invoice & Billing' 기반)
 *  - Navy: 헤더·요약 카드처럼 무게가 필요한 면
 *  - Primary(파랑): 버튼, 선택, 핵심 금액 등 행동을 부르는 곳에만
 *  - Paid(초록): 입금 완료, 승인, 마일리지 적립
 */
object Brand {
    val Navy = Color(0xFF1E3A5F)
    val NavyDeep = Color(0xFF162C48)
    val Primary = Color(0xFF2563EB)
    val PrimaryPressed = Color(0xFF1D4ED8)
    val PrimarySoft = Color(0xFFEAF1FF)
    /** 이벤트 이미지(동전) 바탕과 같은 색: 이벤트 배너·팝업 바탕 */
    val EventBg = Color(0xFFE0EBFD)
    val Paid = Color(0xFF059669)
    val PaidSoft = Color(0xFFE6F6F0)
    val Ink = Color(0xFF0F172A)
    val SubInk = Color(0xFF475569)
    val Faint = Color(0xFF64748B)
    val Line = Color(0xFFE4E7EB)
    val Background = Color(0xFFF8FAFC)
    val Raised = Color(0xFFF1F3F5)
    val Surface = Color.White
    val Disabled = Color(0xFFCBD5E1)
    val Success = Paid
    val Warning = Color(0xFFB45309)
    val Danger = Color(0xFFDC2626)
    val Dark = Color(0xFF0F172A)

    /** 기본 버튼 채움(단색) */
    val fill: Brush get() = SolidColor(Primary)
    /** 네이비 면(헤더 카드, 요약 띠) */
    val navyFill: Brush get() = SolidColor(Navy)
    val fillDisabled: Brush get() = SolidColor(Disabled)
}

private val colors = lightColorScheme(
    primary = Brand.Primary,
    onPrimary = Color.White,
    secondary = Brand.Navy,
    background = Brand.Surface,
    surface = Brand.Surface,
    onBackground = Brand.Ink,
    onSurface = Brand.Ink,
    surfaceVariant = Brand.Background,
    outline = Brand.Line,
    error = Brand.Danger,
)

private val typography = Typography(
    headlineLarge = TextStyle(fontSize = 26.sp, fontWeight = FontWeight.Bold, lineHeight = 36.sp, letterSpacing = (-0.5).sp),
    headlineMedium = TextStyle(fontSize = 22.sp, fontWeight = FontWeight.Bold, lineHeight = 31.sp, letterSpacing = (-0.4).sp),
    titleLarge = TextStyle(fontSize = 19.sp, fontWeight = FontWeight.Bold, lineHeight = 27.sp),
    titleMedium = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.SemiBold, lineHeight = 23.sp),
    bodyLarge = TextStyle(fontSize = 15.sp, lineHeight = 23.sp),
    bodyMedium = TextStyle(fontSize = 14.sp, lineHeight = 21.sp),
    bodySmall = TextStyle(fontSize = 12.sp, lineHeight = 18.sp),
    labelLarge = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.Bold),
)

@Composable
fun GeoraeNoteTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = colors, typography = typography, content = content)
}
