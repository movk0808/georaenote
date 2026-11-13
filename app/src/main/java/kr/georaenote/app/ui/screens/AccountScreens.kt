package kr.georaenote.app.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.outlined.Call
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Stars
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kr.georaenote.app.AppViewModel
import kr.georaenote.app.data.Content
import kr.georaenote.app.data.Format
import kr.georaenote.app.nav.Routes
import kr.georaenote.app.ui.components.Card
import kr.georaenote.app.ui.components.Divider
import kr.georaenote.app.ui.components.PrimaryButton
import kr.georaenote.app.ui.components.Screen
import kr.georaenote.app.ui.theme.Brand

private data class ChatMsg(val mine: Boolean, val text: String)

/**
 * 고객센터. 체험판은 FAQ 키워드로 자동 답변합니다.
 * 실제 상담은 채팅 상담 SDK(예: 채널톡) 연동으로 바꿀 자리입니다.
 */
@Composable
fun SupportScreen(back: () -> Unit, go: (String) -> Unit, onInquiry: (String) -> Unit = {}) {
    val context = LocalContext.current
    val msgs = remember {
        mutableStateListOf(ChatMsg(false, "안녕하세요, ${Content.SERVICE_NAME} 고객센터예요.\n궁금한 점을 남겨 주시면 빠르게 답변드릴게요.\n\n운영 시간: ${Content.CS_HOURS}"))
    }
    var input by remember { mutableStateOf("") }
    var pending by remember { mutableStateOf<String?>(null) }
    val listState = rememberLazyListState()

    pending?.let { q ->
        LaunchedEffect(q) {
            delay(700)
            val hit = Content.faqs.firstOrNull { f -> q.split(" ").any { w -> w.length >= 2 && (f.question.contains(w) || f.answer.contains(w)) } }
            msgs.add(ChatMsg(false, hit?.let { "관련 안내를 찾았어요.\n\nQ. ${it.question}\n${it.answer}\n\n더 궁금한 점은 상담원이 이어서 답변드릴게요." }
                ?: "문의가 접수됐어요. 상담원이 확인 후 답변드릴게요. 급한 문의는 ${Content.CS_PHONE}로 전화 주세요."))
            pending = null
        }
    }
    LaunchedEffect(msgs.size) { listState.animateScrollToItem(msgs.size) }

    Screen("고객센터", back, background = Brand.Background, actions = {
        IconButton(onClick = { context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:${Content.CS_PHONE}"))) }) {
            Icon(Icons.Outlined.Call, "전화 상담", tint = Brand.Ink)
        }
    }, bottom = {
        Row(
            Modifier.fillMaxWidth().background(Color.White).navigationBarsPadding().imePadding().padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(Modifier.weight(1f).clip(RoundedCornerShape(22.dp)).background(Brand.Background).padding(horizontal = 16.dp, vertical = 12.dp)) {
                if (input.isEmpty()) Text("메시지를 입력해 주세요", color = Brand.Faint, fontSize = 15.sp)
                BasicTextField(input, { input = it.take(300) }, textStyle = TextStyle(fontSize = 15.sp, color = Brand.Ink), modifier = Modifier.fillMaxWidth())
            }
            IconButton(onClick = {
                val q = input.trim()
                if (q.isNotEmpty() && pending == null) { msgs.add(ChatMsg(true, q)); input = ""; pending = q; onInquiry(q) }
            }) { Icon(Icons.AutoMirrored.Filled.Send, "보내기", tint = if (input.isBlank()) Brand.Faint else Brand.Primary) }
        }
    }) {
        LazyColumn(state = listState, modifier = Modifier.fillMaxSize().padding(horizontal = 14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            item {
                Row(Modifier.fillMaxWidth().padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("자주묻는 질문" to Routes.board(0), "공지사항" to Routes.board(1)).forEach { (t, r) ->
                        Text(t, Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).background(Color.White).clickable { go(r) }.padding(12.dp),
                            fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = Brand.Ink)
                    }
                }
            }
            items(msgs) { m ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = if (m.mine) Arrangement.End else Arrangement.Start) {
                    Text(
                        m.text,
                        Modifier.widthIn(max = 290.dp).clip(RoundedCornerShape(16.dp)).background(if (m.mine) Brand.Primary else Color.White).padding(14.dp),
                        color = if (m.mine) Color.White else Brand.Ink, fontSize = 14.sp, lineHeight = 21.sp,
                    )
                }
            }
            if (pending != null) item { Text("답변 작성 중…", fontSize = 12.sp, color = Brand.Faint) }
        }
    }
}

/** 설정·내 정보 */
@Composable
fun SettingsScreen(vm: AppViewModel, back: () -> Unit, go: (String) -> Unit, onLoggedOut: () -> Unit) {
    val context = LocalContext.current
    var confirmLogout by remember { mutableStateOf(false) }
    var confirmWithdraw by remember { mutableStateOf(false) }
    Screen("설정", back, background = Brand.Background) {
        Column(Modifier.verticalScroll(rememberScrollState()).padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Card {
                val u = vm.user
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(52.dp).clip(RoundedCornerShape(26.dp)).background(Brand.PrimarySoft), contentAlignment = Alignment.Center) {
                        Icon(Icons.Outlined.Person, null, tint = Brand.Primary, modifier = Modifier.size(28.dp))
                    }
                    Spacer(Modifier.width(14.dp))
                    Column(Modifier.weight(1f)) {
                        if (u != null) {
                            Text("${u.name} 사장님", fontWeight = FontWeight.Bold, fontSize = 17.sp, color = Brand.Ink)
                            Text("${Format.phone(u.phone)} · ${u.carrier}", fontSize = 13.sp, color = Brand.Faint)
                        } else {
                            Text("로그인이 필요해요", fontWeight = FontWeight.Bold, fontSize = 17.sp, color = Brand.Ink)
                            Text("본인인증 한 번으로 시작할 수 있어요", fontSize = 13.sp, color = Brand.Faint)
                        }
                    }
                }
                if (u == null) {
                    Spacer(Modifier.height(14.dp))
                    PrimaryButton("본인인증하고 시작하기", height = 48.dp) { go(Routes.TERMS) }
                }
            }
            if (vm.loggedIn) {
                Card(padding = androidx.compose.foundation.layout.PaddingValues(vertical = 4.dp)) {
                    SettingRow("송금 내역") { go(Routes.HISTORY) }
                    SettingRow("마일리지", Format.mileage(vm.mileageBalance)) { go(Routes.MILEAGE) }
                }
            }
            Card(padding = androidx.compose.foundation.layout.PaddingValues(vertical = 4.dp)) {
                Row(Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.Notifications, null, tint = Brand.Ink)
                    Spacer(Modifier.width(10.dp))
                    Text("알림 받기", Modifier.weight(1f), fontSize = 15.sp, color = Brand.Ink)
                    Switch(vm.notificationsOn, { vm.setNotifications(it) }, colors = SwitchDefaults.colors(checkedTrackColor = Brand.Primary))
                }
            }
            Card(padding = androidx.compose.foundation.layout.PaddingValues(vertical = 4.dp)) {
                SettingRow("공지사항") { go(Routes.board(1)) }
                SettingRow("자주묻는 질문") { go(Routes.board(0)) }
                SettingRow("고객센터") { go(Routes.SUPPORT) }
                SettingRow("서비스 이용약관") { go(Routes.doc("service")) }
                SettingRow("개인정보 처리 안내") { go(Routes.doc("privacy")) }
                SettingRow("앱 버전", "0.1.0 (체험판)", arrow = false) {}
            }
            if (vm.loggedIn) {
                Card(padding = androidx.compose.foundation.layout.PaddingValues(vertical = 4.dp)) {
                    SettingRow("로그아웃", arrow = false) { confirmLogout = true }
                    SettingRow("회원 탈퇴", arrow = false, danger = true) { confirmWithdraw = true }
                }
            }
        }
    }
    if (confirmLogout) {
        AlertDialog(
            onDismissRequest = { confirmLogout = false },
            title = { Text("로그아웃할까요?") },
            text = { Text("계약과 송금 기록은 이 기기에 그대로 남아요.") },
            confirmButton = { TextButton({ confirmLogout = false; vm.logout(); onLoggedOut() }) { Text("로그아웃") } },
            dismissButton = { TextButton({ confirmLogout = false }) { Text("취소") } },
            containerColor = Color.White,
        )
    }
    if (confirmWithdraw) {
        AlertDialog(
            onDismissRequest = { confirmWithdraw = false },
            title = { Text("회원 탈퇴할까요?") },
            text = { Text("이 기기에 저장된 계정, 계약, 송금 기록, 마일리지가 모두 지워지고 되돌릴 수 없어요.") },
            confirmButton = { TextButton({ confirmWithdraw = false; vm.withdraw { r -> r.onSuccess { onLoggedOut() }.onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_LONG).show() } } }) { Text("탈퇴하기", color = Brand.Danger) } },
            dismissButton = { TextButton({ confirmWithdraw = false }) { Text("취소") } },
            containerColor = Color.White,
        )
    }
}

@Composable
private fun SettingRow(title: String, value: String? = null, arrow: Boolean = true, danger: Boolean = false, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 18.dp, vertical = 15.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(title, Modifier.weight(1f), fontSize = 15.sp, color = if (danger) Brand.Danger else Brand.Ink)
        if (value != null) Text(value, fontSize = 14.sp, color = Brand.SubInk)
        if (arrow) Icon(Icons.Filled.ChevronRight, null, tint = Brand.Faint)
    }
}

/** 마일리지 잔액과 적립 내역 */
@Composable
fun MileageScreen(vm: AppViewModel, back: () -> Unit, go: (String) -> Unit) {
    Screen("마일리지", back, background = Brand.Background) {
        LazyColumn(Modifier.fillMaxSize().padding(horizontal = 14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            item {
                Column(Modifier.fillMaxWidth().padding(top = 6.dp).clip(RoundedCornerShape(18.dp)).background(Brand.navyFill).padding(22.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Outlined.Stars, null, tint = Color.White, modifier = Modifier.size(18.dp))
                        Text(" 내 마일리지", color = Color.White.copy(alpha = 0.9f), fontSize = 14.sp)
                    }
                    Spacer(Modifier.height(6.dp))
                    Text(Format.mileage(vm.mileageBalance), color = Color.White, fontSize = 30.sp, fontWeight = FontWeight.ExtraBold)
                    Spacer(Modifier.height(8.dp))
                    Text("송금이 완료되면 이용료의 2%가 적립돼요.", color = Color.White.copy(alpha = 0.85f), fontSize = 12.sp)
                }
            }
            item {
                Card(onClick = { go(Routes.event(1)) }) {
                    Text("오늘의 퀴즈로 10M 더 받기", fontWeight = FontWeight.Bold, color = Brand.Ink)
                    Text("하루 한 문제, 맞히면 바로 적립돼요.", fontSize = 13.sp, color = Brand.Faint)
                }
            }
            item {
                Card {
                    Text("마일리지 샵", fontWeight = FontWeight.Bold, color = Brand.Ink)
                    Text("쿠폰 교환은 준비 중이에요. 열리면 공지로 알려드릴게요.", fontSize = 13.sp, color = Brand.Faint)
                }
            }
            item { Text("적립 내역", fontWeight = FontWeight.Bold, color = Brand.Ink, modifier = Modifier.padding(start = 6.dp, top = 8.dp)) }
            if (vm.mileageLogs.isEmpty()) {
                item { Text("아직 적립 내역이 없어요.", color = Brand.Faint, fontSize = 14.sp, modifier = Modifier.padding(6.dp)) }
            }
            items(vm.mileageLogs) { m ->
                Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Color.White).padding(16.dp)) {
                    Column(Modifier.weight(1f)) {
                        Text(m.title, fontSize = 14.sp, color = Brand.Ink, fontWeight = FontWeight.SemiBold)
                        Text(Format.dateTime(m.at), fontSize = 12.sp, color = Brand.Faint)
                    }
                    Text("+${Format.mileage(m.amount)}", color = Brand.Primary, fontWeight = FontWeight.Bold)
                }
            }
            item { Spacer(Modifier.height(20.dp)); Divider() }
        }
    }
}
