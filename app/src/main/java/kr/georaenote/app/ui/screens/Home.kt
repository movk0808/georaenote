package kr.georaenote.app.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import kr.georaenote.app.R
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.outlined.AutoStories
import androidx.compose.material.icons.outlined.CreditCard
import androidx.compose.material.icons.outlined.HelpOutline
import androidx.compose.material.icons.outlined.Language
import androidx.compose.material.icons.outlined.NorthEast
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.ReceiptLong
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.SupportAgent
import androidx.compose.material.icons.outlined.Stars
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kr.georaenote.app.AppViewModel
import kr.georaenote.app.data.Content
import kr.georaenote.app.data.Contract
import kr.georaenote.app.data.ContractStatus
import kr.georaenote.app.data.Format
import kr.georaenote.app.data.TransferStatus
import kr.georaenote.app.nav.Routes
import kr.georaenote.app.ui.components.ArrowRow
import kr.georaenote.app.ui.components.Card
import kr.georaenote.app.ui.components.Divider
import kr.georaenote.app.ui.components.PrimaryButton
import kr.georaenote.app.ui.components.HeroGraphic
import kr.georaenote.app.ui.components.MenuRow
import kr.georaenote.app.ui.components.Pill
import kr.georaenote.app.ui.components.TypeBadge
import kr.georaenote.app.ui.theme.Brand

@Composable
fun HomeScreen(vm: AppViewModel, go: (String) -> Unit, openWeb: () -> Unit) {
    var showPopup by remember { mutableStateOf(vm.shouldShowPopup()) }

    // 데모 심사 승인·예약송금 처리를 주기적으로 반영
    LaunchedEffect(Unit) {
        while (true) {
            vm.refresh(); delay(3_000)
        }
    }

    Box(Modifier.fillMaxSize().background(Brand.Background)) {
        Column(
            Modifier.fillMaxSize().statusBarsPadding().verticalScroll(rememberScrollState()).padding(horizontal = 14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            HomeHeader(vm, go)
            if (vm.loggedIn) {
                ContractsCard(vm, go)
                SummaryRow(vm, go)
            } else {
                Card(padding = androidx.compose.foundation.layout.PaddingValues(0.dp)) {
                    HeroGraphic(Modifier.fillMaxWidth().height(200.dp))
                    PrimaryButton("${Content.SERVICE_NAME} 시작하기", Modifier.padding(start = 16.dp, end = 16.dp, bottom = 16.dp)) {
                        go(Routes.TERMS)
                    }
                }
            }
            ArrowRow("${Content.SERVICE_NAME}, 어떻게 사용하나요?") { go(Routes.GUIDE) }
            QuizRow { go(Routes.event(1)) }
            Banner(
                brush = Brand.navyFill,
                small = "물품대금 · 식자재 · 월세 등 다양한 거래",
                big = "언제 어디서나\n${Content.SERVICE_NAME}와 함께",
                light = true,
                photo = R.drawable.banner_shop,
            ) { go(Routes.GUIDE) }
            Banner(
                brush = androidx.compose.ui.graphics.SolidColor(Brand.EventBg),
                small = "가입 후 첫 송금 고객 대상",
                big = "첫 송금 완료하면\n3,000M 적립!",
                light = false,
                cta = "자세히 보기",
                sideImage = R.drawable.event_coins_cut,
            ) { go(Routes.event(2)) }
            MenuRow(Icons.Outlined.CreditCard, Color(0xFFFFE9EE), Color(0xFFE5484D), "카드 할부 정보") { go(Routes.INSTALLMENT) }
            MenuRow(Icons.Outlined.HelpOutline, Color(0xFFEDE9FF), Color(0xFF7C5CF6), "자주묻는 질문") { go(Routes.board(0)) }
            MenuRow(Icons.Outlined.AutoStories, Color(0xFFFFF4D6), Color(0xFFE0A000), "${Content.SERVICE_NAME} 매거진") { go(Routes.MAGAZINE) }
            MenuRow(
                Icons.Outlined.SupportAgent, Color(0xFFE3F4FF), Color(0xFF1E90D6), "고객센터 연결",
                "궁금한 점은 채팅으로 편하게 물어보세요", Icons.Filled.ChevronRight,
            ) { go(Routes.SUPPORT) }
            MenuRow(
                Icons.Outlined.Language, Brand.PrimarySoft, Brand.Primary, "${Content.SERVICE_NAME} 웹으로 이용하기",
                "브라우저에서 ${Content.SERVICE_NAME}를 만나보세요", Icons.Outlined.NorthEast,
            ) { openWeb() }
            Text(
                "${Content.SERVICE_NAME}는 체험판입니다. 실제 카드결제·본인인증·송금은 PG 연동 후 제공됩니다.",
                fontSize = 11.sp, color = Brand.Faint, modifier = Modifier.padding(horizontal = 6.dp, vertical = 8.dp),
            )
            Spacer(Modifier.navigationBarsPadding().height(8.dp))
        }

        if (showPopup) {
            HomePopup(
                onClose = { showPopup = false },
                onToday = { vm.hidePopupToday(); showPopup = false },
                onNever = { vm.hidePopupForever(); showPopup = false },
                onDetail = { showPopup = false; go(Routes.event(2)) },
            )
        }
    }
}

@Composable
private fun HomeHeader(vm: AppViewModel, go: (String) -> Unit) {
    Row(Modifier.fillMaxWidth().padding(top = 6.dp, start = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        val user = vm.user
        if (user != null) {
            Column(Modifier.weight(1f)) {
                Text("${user.name} 사장님", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Brand.Ink)
                Text("오늘도 든든한 하루 되세요", fontSize = 12.sp, color = Brand.Faint)
            }
        } else {
            Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(26.dp).clip(RoundedCornerShape(8.dp)).background(Brand.navyFill), contentAlignment = Alignment.Center) {
                    Icon(Icons.Outlined.ReceiptLong, null, tint = Color.White, modifier = Modifier.size(16.dp))
                }
                Spacer(Modifier.width(8.dp))
                Text(Content.SERVICE_NAME, fontSize = 19.sp, fontWeight = FontWeight.ExtraBold, color = Brand.Ink)
            }
        }
        IconButton(onClick = { go(Routes.board(1)) }) { Icon(Icons.Outlined.Notifications, "공지사항", tint = Brand.Ink) }
        IconButton(onClick = { go(Routes.SETTINGS) }) { Icon(Icons.Outlined.Settings, "설정", tint = Brand.Ink) }
    }
}

@Composable
private fun ContractsCard(vm: AppViewModel, go: (String) -> Unit) {
    Card(padding = androidx.compose.foundation.layout.PaddingValues(0.dp)) {
        // 상단 안내 배너
        Box(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(topStart = 18.dp, topEnd = 18.dp)).background(Brand.navyFill)
                .clickable { go(Routes.GUIDE) }.padding(horizontal = 18.dp, vertical = 16.dp),
        ) {
            Column {
                Text("사업대금은 카드로, 거래처는 계좌로", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                Text("${Content.SERVICE_NAME} 어떻게 이용하나요?", color = Color.White.copy(alpha = 0.85f), fontSize = 12.sp)
            }
        }
        Column(Modifier.padding(vertical = 6.dp)) {
            vm.contracts.forEach { c -> ContractRow(c, go) }
            Row(
                Modifier.fillMaxWidth().clickable {
                    vm.contractDraft = kr.georaenote.app.ContractDraft()
                    go(Routes.CONTRACT_TYPE)
                }.padding(horizontal = 18.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).background(Brand.Background), contentAlignment = Alignment.Center) {
                    Icon(Icons.Filled.Add, null, tint = Brand.SubInk)
                }
                Spacer(Modifier.width(14.dp))
                Text("계약을 등록해 주세요.", color = Brand.SubInk, fontSize = 15.sp)
            }
        }
    }
}

@Composable
private fun ContractRow(c: Contract, go: (String) -> Unit) {
    Row(
        Modifier.fillMaxWidth().clickable { go(Routes.contract(c.id)) }.padding(horizontal = 18.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        TypeBadge(c.type)
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(c.type.label, fontSize = 11.sp, color = Brand.Faint)
            Text(c.title, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = Brand.Ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        when (c.status) {
            ContractStatus.APPROVED -> Text(
                "송금",
                Modifier.clip(RoundedCornerShape(10.dp)).background(Brand.Background).clickable { go(Routes.transfer(c.id)) }
                    .padding(horizontal = 14.dp, vertical = 7.dp),
                fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Brand.Ink,
            )
            ContractStatus.REVIEW -> Pill("검토중", Color(0xFFFFF4D6), Color(0xFFB7791F))
            ContractStatus.REJECTED -> Pill("반려", Color(0xFFFFE9EE), Brand.Danger)
        }
    }
}

@Composable
private fun SummaryRow(vm: AppViewModel, go: (String) -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        val waiting = vm.transfers.count { it.status == TransferStatus.WAITING_SEND || it.status == TransferStatus.SCHEDULED }
        Card(Modifier.weight(1f), onClick = { go(Routes.HISTORY) }) {
            Text("송금 내역", fontSize = 13.sp, color = Brand.SubInk)
            Spacer(Modifier.height(4.dp))
            Text("${vm.transfers.size}건", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Brand.Ink)
            if (waiting > 0) Text("진행 중 ${waiting}건", fontSize = 12.sp, color = Brand.Primary)
        }
        Card(Modifier.weight(1f), onClick = { go(Routes.MILEAGE) }) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.Stars, null, tint = Color(0xFFE0A000), modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(4.dp))
                Text("마일리지", fontSize = 13.sp, color = Brand.SubInk)
            }
            Spacer(Modifier.height(4.dp))
            Text(Format.mileage(vm.mileageBalance), fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Brand.Ink)
        }
    }
}

@Composable
private fun QuizRow(onClick: () -> Unit) {
    Box(Modifier.fillMaxWidth().padding(top = 8.dp)) {
        Row(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(Brand.fill).clickable(onClick = onClick)
                .padding(horizontal = 18.dp, vertical = 18.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("오늘의 사장님 퀴즈, 풀어볼까요?", Modifier.weight(1f), color = Color.White, fontWeight = FontWeight.Bold, fontSize = 15.sp)
            Icon(Icons.Filled.ChevronRight, null, tint = Color.White)
        }
        Text(
            "매일 마일리지 적립!",
            Modifier.align(Alignment.TopEnd).offset(x = (-8).dp, y = (-10).dp).clip(RoundedCornerShape(999.dp))
                .background(Brand.Dark).padding(horizontal = 10.dp, vertical = 5.dp),
            color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold,
        )
    }
}

/**
 * 홈 배너. photo 가 있으면 사진을 배경으로 깔고 왼쪽에 같은 네이비로 글자 영역을 만들고,
 * sideImage 가 있으면 오른쪽에 작은 이미지를 둡니다.
 */
@Composable
private fun Banner(
    brush: Brush, small: String, big: String, light: Boolean, cta: String? = null,
    photo: Int? = null, sideImage: Int? = null, onClick: () -> Unit,
) {
    Box(
        Modifier.fillMaxWidth().heightIn(min = 118.dp).clip(RoundedCornerShape(18.dp)).background(brush).clickable(onClick = onClick),
    ) {
        if (photo != null) {
            Image(painterResource(photo), null, Modifier.matchParentSize(), contentScale = ContentScale.Crop, alignment = Alignment.CenterEnd)
            Box(
                Modifier.matchParentSize().background(
                    Brush.horizontalGradient(0f to Brand.Navy, 0.45f to Brand.Navy.copy(alpha = 0.85f), 1f to Brand.Navy.copy(alpha = 0.05f)),
                ),
            )
        }
        if (sideImage != null) {
            Image(painterResource(sideImage), null, Modifier.align(Alignment.CenterEnd).padding(end = 8.dp).size(112.dp), contentScale = ContentScale.Fit)
        }
        Column(Modifier.align(Alignment.CenterStart).padding(horizontal = 20.dp, vertical = 16.dp)) {
            Text(small, fontSize = 12.sp, color = if (light) Color.White.copy(alpha = 0.8f) else Brand.SubInk)
            Text(big, fontSize = 18.sp, fontWeight = FontWeight.ExtraBold, color = if (light) Color.White else Brand.Ink, lineHeight = 24.sp)
            if (cta != null) {
                Spacer(Modifier.height(6.dp))
                Text(cta, Modifier.clip(RoundedCornerShape(999.dp)).background(Brand.Dark).padding(horizontal = 12.dp, vertical = 4.dp), color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

/** 홈 진입 시 뜨는 이벤트 팝업(오늘 하루 보지 않기 / 다시 보지 않기) */
@Composable
private fun HomePopup(onClose: () -> Unit, onToday: () -> Unit, onNever: () -> Unit, onDetail: () -> Unit) {
    Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.45f)).clickable(onClick = onClose)) {
        Column(Modifier.align(Alignment.BottomCenter).fillMaxWidth()) {
            Box(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp))
                    .background(androidx.compose.ui.graphics.SolidColor(Brand.EventBg))
                    .clickable(onClick = onDetail).padding(24.dp),
            ) {
                IconButton(onClick = onClose, modifier = Modifier.align(Alignment.TopEnd).offset(x = 12.dp, y = (-12).dp)) {
                    Icon(Icons.Filled.Close, "닫기", tint = Brand.Ink)
                }
                Image(
                    painterResource(R.drawable.event_coins), null,
                    Modifier.align(Alignment.BottomEnd).offset(x = 4.dp, y = 8.dp).size(128.dp),
                    contentScale = ContentScale.Crop,
                )
                Column(Modifier.padding(top = 18.dp, bottom = 6.dp)) {
                    Text("첫 송금 완료하고", fontSize = 24.sp, fontWeight = FontWeight.ExtraBold, color = Brand.Ink)
                    Row {
                        Text("3,000M", fontSize = 24.sp, fontWeight = FontWeight.ExtraBold, color = Brand.Primary)
                        Text(" 받기!", fontSize = 24.sp, fontWeight = FontWeight.ExtraBold, color = Brand.Ink)
                    }
                    Spacer(Modifier.height(8.dp))
                    Text("가입 후 첫 송금 고객에게 드려요.", fontSize = 13.sp, color = Brand.SubInk)
                    Spacer(Modifier.height(14.dp))
                    Text("자세히 보기", Modifier.clip(RoundedCornerShape(999.dp)).background(Brand.Dark).padding(horizontal = 16.dp, vertical = 7.dp), color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                }
            }
            Row(Modifier.fillMaxWidth().background(Brand.Dark).navigationBarsPadding().padding(horizontal = 20.dp, vertical = 14.dp)) {
                Text("오늘 하루 보지 않기", Modifier.weight(1f).clickable(onClick = onToday), color = Color.White, fontSize = 13.sp)
                Text("다시 보지 않기", Modifier.clickable(onClick = onNever), color = Color.White, fontSize = 13.sp)
            }
        }
    }
}
