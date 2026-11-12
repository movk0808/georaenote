package kr.georaenote.app.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.outlined.Handyman
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.Key
import androidx.compose.material.icons.outlined.LocalDrink
import androidx.compose.material.icons.outlined.MoreHoriz
import androidx.compose.material.icons.outlined.Receipt
import androidx.compose.material.icons.outlined.Restaurant
import androidx.compose.material.icons.outlined.Storefront
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kr.georaenote.app.data.ContractType
import kr.georaenote.app.ui.theme.Brand

/** 화면 하단의 기본 버튼(단색) */
@Composable
fun PrimaryButton(
    text: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    height: Dp = 56.dp,
    onClick: () -> Unit,
) {
    Box(
        modifier
            .fillMaxWidth()
            .height(height)
            .clip(RoundedCornerShape(14.dp))
            .background(if (enabled) Brand.fill else Brand.fillDisabled)
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(text, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
    }
}

@Composable
fun GrayButton(text: String, modifier: Modifier = Modifier, enabled: Boolean = true, onClick: () -> Unit) {
    Box(
        modifier
            .height(56.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(Brand.Background)
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(text, color = if (enabled) Brand.SubInk else Brand.Faint, fontWeight = FontWeight.Bold, fontSize = 16.sp)
    }
}

/** 하단 고정 버튼 영역 */
@Composable
fun BottomBar(content: @Composable RowScope.() -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .background(Color.White)
            .navigationBarsPadding()
            .imePadding()
            .padding(horizontal = 20.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        content = content,
    )
}

/** 뒤로가기와 가운데 제목이 있는 상단바 */
@Composable
fun TopBar(title: String = "", onBack: (() -> Unit)? = null, actions: @Composable RowScope.() -> Unit = {}) {
    Box(
        Modifier
            .fillMaxWidth()
            .background(Color.White)
            .statusBarsPadding()
            .height(56.dp),
    ) {
        if (onBack != null) {
            IconButton(onClick = onBack, modifier = Modifier.align(Alignment.CenterStart)) {
                Icon(Icons.Filled.ChevronLeft, contentDescription = "뒤로", tint = Brand.Ink, modifier = Modifier.size(30.dp))
            }
        }
        if (title.isNotEmpty()) {
            Text(title, Modifier.align(Alignment.Center), fontWeight = FontWeight.Bold, fontSize = 17.sp, color = Brand.Ink)
        }
        Row(Modifier.align(Alignment.CenterEnd), verticalAlignment = Alignment.CenterVertically, content = actions)
    }
}

/** 상단바 + 스크롤 영역 + 하단 버튼으로 이루어진 기본 화면 틀 */
@Composable
fun Screen(
    title: String = "",
    onBack: (() -> Unit)? = null,
    background: Color = Color.White,
    actions: @Composable RowScope.() -> Unit = {},
    bottom: (@Composable () -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(Modifier.fillMaxSize().background(background)) {
        TopBar(title, onBack, actions)
        Column(Modifier.weight(1f).fillMaxWidth(), content = content)
        if (bottom != null) bottom() else Spacer(Modifier.navigationBarsPadding())
    }
}

/** 단계 진행 막대(계약 등록 상단) */
@Composable
fun StepBar(current: Int, total: Int, modifier: Modifier = Modifier) {
    Row(modifier.fillMaxWidth().padding(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        repeat(total) { i ->
            Box(
                Modifier
                    .weight(1f)
                    .height(4.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(if (i <= current) Brand.Primary else Brand.Line),
            )
        }
    }
}

/** 흰 배경 둥근 카드 */
@Composable
fun Card(modifier: Modifier = Modifier, padding: PaddingValues = PaddingValues(18.dp), onClick: (() -> Unit)? = null, content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(Color.White)
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(padding),
        content = content,
    )
}

/** 홈 메뉴 목록 한 줄(카드 할부 정보, 자주묻는 질문 등) */
@Composable
fun MenuRow(
    icon: ImageVector,
    iconBg: Color,
    iconTint: Color,
    title: String,
    subtitle: String? = null,
    trailing: ImageVector? = null,
    onClick: () -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(Color.White)
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).background(iconBg), contentAlignment = Alignment.Center) {
            Icon(icon, null, tint = iconTint, modifier = Modifier.size(22.dp))
        }
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(title, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = Brand.Ink)
            if (subtitle != null) Text(subtitle, fontSize = 12.sp, color = Brand.Faint)
        }
        if (trailing != null) Icon(trailing, null, tint = Brand.Faint, modifier = Modifier.size(20.dp))
    }
}

@Composable
fun ArrowRow(text: String, onClick: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(Color.White)
            .clickable(onClick = onClick)
            .padding(horizontal = 18.dp, vertical = 18.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(text, Modifier.weight(1f), fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = Brand.Ink)
        Icon(Icons.Filled.ChevronRight, null, tint = Brand.Faint)
    }
}

/** 밑줄형 입력칸 */
@Composable
fun LineField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    label: String? = null,
    keyboardType: KeyboardType = KeyboardType.Text,
    suffix: String? = null,
    enabled: Boolean = true,
    readOnly: Boolean = false,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    imeAction: ImeAction = ImeAction.Next,
    trailing: (@Composable () -> Unit)? = null,
) {
    Column(modifier.fillMaxWidth()) {
        if (label != null) {
            Text(label, fontSize = 13.sp, color = Brand.SubInk, fontWeight = FontWeight.SemiBold)
        }
        TextField(
            value = value,
            onValueChange = onValueChange,
            placeholder = { Text(placeholder, color = Brand.Faint, fontSize = 16.sp) },
            singleLine = true,
            enabled = enabled,
            readOnly = readOnly,
            visualTransformation = visualTransformation,
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType, imeAction = imeAction),
            textStyle = androidx.compose.ui.text.TextStyle(fontSize = 17.sp, color = Brand.Ink, fontWeight = FontWeight.SemiBold),
            suffix = suffix?.let { { Text(it, color = Brand.Ink, fontSize = 16.sp) } },
            trailingIcon = trailing,
            colors = TextFieldDefaults.colors(
                focusedContainerColor = Color.Transparent,
                unfocusedContainerColor = Color.Transparent,
                disabledContainerColor = Color.Transparent,
                focusedIndicatorColor = Brand.Primary,
                unfocusedIndicatorColor = Brand.Line,
                disabledIndicatorColor = Brand.Line,
                cursorColor = Brand.Primary,
            ),
            // 읽기 전용 칸(은행 선택, 통신사)은 키보드 '다음' 이동에서 건너뜁니다.
            modifier = Modifier.fillMaxWidth().focusProperties { canFocus = !readOnly },
        )
    }
}

@Composable
fun Pill(text: String, bg: Color, fg: Color, modifier: Modifier = Modifier) {
    Text(
        text,
        modifier.clip(RoundedCornerShape(999.dp)).background(bg).padding(horizontal = 10.dp, vertical = 4.dp),
        color = fg,
        fontSize = 12.sp,
        fontWeight = FontWeight.Bold,
    )
}

@Composable
fun SelectBox(selected: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier
            .clip(RoundedCornerShape(16.dp))
            .background(if (selected) Brand.PrimarySoft else Color.White)
            .border(if (selected) 1.5.dp else 1.dp, if (selected) Brand.Primary else Brand.Line, RoundedCornerShape(16.dp))
            .clickable(onClick = onClick)
            .padding(14.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        content = content,
    )
}

@Composable
fun KeyValue(key: String, value: String, strong: Boolean = false, valueColor: Color = Brand.Ink) {
    Row(Modifier.fillMaxWidth().padding(vertical = 7.dp), verticalAlignment = Alignment.Top) {
        Text(key, color = Brand.SubInk, fontSize = 14.sp, modifier = Modifier.width(110.dp))
        Text(
            value,
            Modifier.weight(1f),
            textAlign = TextAlign.End,
            color = valueColor,
            fontSize = if (strong) 17.sp else 14.sp,
            fontWeight = if (strong) FontWeight.Bold else FontWeight.SemiBold,
        )
    }
}

@Composable
fun Divider(modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth().height(1.dp).background(Brand.Line))
}

fun ContractType.icon(): ImageVector = when (this) {
    ContractType.GOODS -> Icons.Outlined.Inventory2
    ContractType.FOOD -> Icons.Outlined.Restaurant
    ContractType.BEVERAGE -> Icons.Outlined.LocalDrink
    ContractType.RENT -> Icons.Outlined.Storefront
    ContractType.DEPOSIT -> Icons.Outlined.Key
    ContractType.INTERIOR -> Icons.Outlined.Handyman
    ContractType.MAINTENANCE -> Icons.Outlined.Receipt
    ContractType.ETC -> Icons.Outlined.MoreHoriz
}

fun ContractType.tint(): Color = when (this) {
    ContractType.GOODS -> Color(0xFF3D50F0)
    ContractType.FOOD -> Color(0xFFF08A24)
    ContractType.BEVERAGE -> Color(0xFF14A3C7)
    ContractType.RENT -> Color(0xFF16A34A)
    ContractType.DEPOSIT -> Color(0xFFD9A10B)
    ContractType.INTERIOR -> Color(0xFF8B5CF6)
    ContractType.MAINTENANCE -> Color(0xFFE5484D)
    ContractType.ETC -> Color(0xFF6B7280)
}

@Composable
fun TypeBadge(type: ContractType, size: Dp = 40.dp) {
    Box(
        Modifier.size(size).clip(RoundedCornerShape(12.dp)).background(type.tint().copy(alpha = 0.12f)),
        contentAlignment = Alignment.Center,
    ) {
        Icon(type.icon(), null, tint = type.tint(), modifier = Modifier.size(size * 0.55f))
    }
}

/**
 * 홈 상단 메인 그래픽: Blender로 렌더링한 3D 장면(네이비 카드 + 입금완료 영수증 + 동전, 배경 투명).
 * 원본 장면 스크립트는 brand/3d/hero.py 에 있습니다.
 */
@Composable
fun HeroGraphic(modifier: Modifier = Modifier) {
    androidx.compose.foundation.Image(
        painter = androidx.compose.ui.res.painterResource(kr.georaenote.app.R.drawable.hero_3d),
        contentDescription = null,
        modifier = modifier,
        contentScale = androidx.compose.ui.layout.ContentScale.Fit,
    )
}

/** 원형 페이지 표시 점 */
@Composable
fun Dots(count: Int, selected: Int, modifier: Modifier = Modifier) {
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        repeat(count) { i ->
            Box(
                Modifier
                    .size(if (i == selected) 7.dp else 6.dp)
                    .clip(CircleShape)
                    .background(if (i == selected) Brand.Primary else Brand.Disabled),
            )
        }
    }
}

/** 숫자 페이지 이동(FAQ, 공지 목록 하단) */
@Composable
fun Pager(pageCount: Int, page: Int, onPage: (Int) -> Unit, modifier: Modifier = Modifier) {
    if (pageCount <= 1) return
    Row(modifier.fillMaxWidth().padding(vertical = 20.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
        repeat(pageCount) { i ->
            Box(
                Modifier
                    .padding(horizontal = 4.dp)
                    .size(30.dp)
                    .clip(CircleShape)
                    .background(if (i == page) Brand.Primary else Color.Transparent)
                    .clickable { onPage(i) },
                contentAlignment = Alignment.Center,
            ) {
                Text("${i + 1}", color = if (i == page) Color.White else Brand.SubInk, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}
