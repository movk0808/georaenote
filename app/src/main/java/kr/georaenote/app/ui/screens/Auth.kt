package kr.georaenote.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kr.georaenote.app.AppViewModel
import kr.georaenote.app.data.Content
import kr.georaenote.app.data.Format
import kr.georaenote.app.nav.Routes
import kr.georaenote.app.ui.components.BottomBar
import kr.georaenote.app.ui.components.Divider
import kr.georaenote.app.ui.components.PrimaryButton
import kr.georaenote.app.ui.components.LineField
import kr.georaenote.app.ui.components.Screen
import kr.georaenote.app.ui.theme.Brand
import kotlin.random.Random

/** 약관 동의 화면. 필수 항목을 모두 체크해야 본인인증 버튼이 켜집니다. */
@Composable
fun TermsScreen(back: () -> Unit, go: (String) -> Unit) {
    var service by rememberSaveable { mutableStateOf(false) }
    var privacy by rememberSaveable { mutableStateOf(false) }
    var marketing by rememberSaveable { mutableStateOf(false) }
    val all = service && privacy && marketing

    Screen(onBack = back, bottom = {
        BottomBar { PrimaryButton("휴대폰 본인인증", enabled = service && privacy) { go(Routes.CARRIER) } }
    }) {
        Column(Modifier.padding(horizontal = 20.dp)) {
            Spacer(Modifier.height(24.dp))
            Text("휴대폰 번호로\n본인인증을 해주세요.", style = androidx.compose.material3.MaterialTheme.typography.headlineMedium, color = Brand.Ink)
            Spacer(Modifier.height(10.dp))
            Text("${Content.SERVICE_NAME}는 휴대폰 본인인증 한 번으로\n회원가입이 끝나요!", fontSize = 14.sp, color = Brand.Faint)
            Spacer(Modifier.height(40.dp))
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Brand.Background)
                    .clickable { val v = !all; service = v; privacy = v; marketing = v }
                    .padding(horizontal = 18.dp, vertical = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                CheckMark(all)
                Spacer(Modifier.width(12.dp))
                Text("전체동의", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Brand.Ink)
            }
            Spacer(Modifier.height(8.dp))
            TermRow(true, "서비스 이용약관", service, { service = !service }) { go(Routes.doc("service")) }
            Divider()
            TermRow(true, "개인정보 수집·이용 동의", privacy, { privacy = !privacy }) { go(Routes.doc("privacy")) }
            Divider()
            TermRow(false, "마케팅 정보 수신 동의", marketing, { marketing = !marketing }) { go(Routes.doc("marketing")) }
            Divider()
        }
    }
}

@Composable
private fun CheckMark(on: Boolean) {
    Icon(Icons.Filled.Check, null, tint = if (on) Brand.Primary else Brand.Disabled, modifier = Modifier.size(22.dp))
}

@Composable
private fun TermRow(required: Boolean, title: String, checked: Boolean, toggle: () -> Unit, open: () -> Unit) {
    Row(Modifier.fillMaxWidth().clickable(onClick = toggle).padding(horizontal = 18.dp, vertical = 16.dp), verticalAlignment = Alignment.CenterVertically) {
        CheckMark(checked)
        Spacer(Modifier.width(12.dp))
        Text(if (required) "필수" else "선택", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = if (required) Brand.Primary else Brand.Faint)
        Spacer(Modifier.width(6.dp))
        Text(title, Modifier.weight(1f), fontSize = 14.sp, color = Brand.Ink)
        Icon(Icons.Filled.ChevronRight, "약관 보기", tint = Brand.Faint, modifier = Modifier.clickable(onClick = open))
    }
}

/** 약관 본문(초안). 법무 검토 후 실제 문서로 교체해야 합니다. */
@Composable
fun DocScreen(kind: String, back: () -> Unit) {
    val (title, body) = when (kind) {
        "service" -> "서비스 이용약관" to "제1조 (목적)\n이 약관은 ${Content.SERVICE_NAME}(이하 '회사')가 제공하는 사업대금 카드결제 대행 서비스의 이용 조건과 절차를 정합니다.\n\n제2조 (서비스 내용)\n회사는 회원이 등록한 실제 거래의 대금을 회원의 신용카드로 결제받고, 제휴 전자지급결제대행사를 통해 회원이 지정한 거래처 계좌로 지급합니다.\n\n제3조 (이용료)\n이용료는 송금 방식에 따라 송금액의 일정 비율로 부과되며, 결제 금액에 포함됩니다.\n\n※ 이 문서는 체험판용 초안입니다. 출시 전 법무 검토를 거친 정식 약관으로 바꿔야 합니다."
        "privacy" -> "개인정보 수집·이용 동의" to "1. 수집 항목: 이름, 생년월일, 휴대폰 번호, 통신사, 거래처 계좌 정보, 증빙서류\n2. 이용 목적: 본인 확인, 계약 심사, 결제 및 송금 처리, 고객 상담\n3. 보유 기간: 회원 탈퇴 시까지(관계 법령에 따라 보존이 필요한 정보는 해당 기간까지)\n\n※ 체험판에서는 입력한 정보가 이 기기에만 저장되고 외부로 전송되지 않습니다."
        else -> "마케팅 정보 수신 동의" to "이벤트, 혜택, 무이자 할부 소식을 앱 알림과 문자로 받아볼 수 있어요. 동의하지 않아도 서비스는 그대로 이용할 수 있어요."
    }
    Screen(title, back) {
        Text(body, Modifier.verticalScroll(rememberScrollState()).padding(20.dp), fontSize = 14.sp, color = Brand.SubInk, lineHeight = 22.sp)
    }
}

/** 통신사 선택. 실제 서비스에서는 본인인증 기관(PASS 등) 연동 화면으로 대체됩니다. */
@Composable
fun CarrierScreen(back: () -> Unit, go: (String) -> Unit) {
    val carriers = listOf("SKT", "KT", "LG U+", "SKT\n알뜰폰", "KT\n알뜰폰", "LG U+\n알뜰폰")
    Screen(onBack = back) {
        Column(Modifier.padding(horizontal = 20.dp)) {
            Spacer(Modifier.height(20.dp))
            Text("본인인증", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Brand.Primary)
            Spacer(Modifier.height(10.dp))
            Text("이용 중인 통신사를\n선택해 주세요", fontSize = 26.sp, color = Brand.Ink, lineHeight = 36.sp, fontWeight = FontWeight.Medium)
            Spacer(Modifier.height(36.dp))
            carriers.chunked(3).forEachIndexed { rowIdx, row ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(bottom = 8.dp)) {
                    row.forEach { c ->
                        Box(
                            Modifier.weight(1f).aspectRatio(1f).clip(RoundedCornerShape(12.dp))
                                .background(if (rowIdx == 0) Color.White else Brand.Background)
                                .border(1.dp, Brand.Line, RoundedCornerShape(12.dp))
                                .clickable { go(Routes.verify(c.replace("\n", " "))) },
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(c, fontSize = 17.sp, fontWeight = FontWeight.Bold, color = Brand.Ink, textAlign = TextAlign.Center)
                        }
                    }
                }
            }
            Spacer(Modifier.height(12.dp))
            Row(Modifier.align(Alignment.End), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.Info, null, tint = Brand.Faint, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(4.dp))
                Text("알뜰폰 사업자 확인", fontSize = 13.sp, color = Brand.SubInk)
            }
        }
    }
}

/** 이름·생년월일·휴대폰 입력과 인증번호 확인(체험용 인증번호 표시) */
@Composable
fun VerifyScreen(vm: AppViewModel, carrier: String, back: () -> Unit, onDone: () -> Unit) {
    var name by rememberSaveable { mutableStateOf("") }
    var birth by rememberSaveable { mutableStateOf("") }
    var phone by rememberSaveable { mutableStateOf("") }
    var code by rememberSaveable { mutableStateOf("") }
    var sentCode by rememberSaveable { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    val infoOk = name.isNotBlank() && birth.length == 8 && phone.length in 10..11

    Screen(onBack = back, bottom = {
        BottomBar {
            if (sentCode.isEmpty()) {
                PrimaryButton("인증번호 받기", enabled = infoOk) {
                    sentCode = String.format("%06d", Random.nextInt(0, 1_000_000)); error = null
                }
            } else {
                PrimaryButton("확인", enabled = code.length == 6) {
                    if (code == sentCode) {
                        vm.login(name, phone, carrier, birth); onDone()
                    } else error = "인증번호가 일치하지 않아요."
                }
            }
        }
    }) {
        Column(Modifier.verticalScroll(rememberScrollState()).padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(22.dp)) {
            Spacer(Modifier.height(4.dp))
            Text("본인 정보를\n입력해 주세요", style = androidx.compose.material3.MaterialTheme.typography.headlineMedium, color = Brand.Ink)
            LineField(carrier, {}, "", label = "통신사", readOnly = true)
            LineField(name, { name = it.take(20) }, "홍길동", label = "이름", enabled = sentCode.isEmpty())
            LineField(birth, { birth = it.filter(Char::isDigit).take(8) }, "19900101", label = "생년월일 8자리", keyboardType = KeyboardType.Number, enabled = sentCode.isEmpty())
            LineField(phone, { phone = it.filter(Char::isDigit).take(11) }, "01012345678", label = "휴대폰 번호", keyboardType = KeyboardType.Phone, enabled = sentCode.isEmpty())
            if (sentCode.isNotEmpty()) {
                LineField(code, { code = it.filter(Char::isDigit).take(6); error = null }, "6자리 입력", label = "인증번호", keyboardType = KeyboardType.NumberPassword)
                Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Brand.PrimarySoft).padding(14.dp)) {
                    Text(
                        "체험판 인증번호: $sentCode\n(${Format.phone(phone)}로 보낸 것으로 가정합니다. 실제 서비스에서는 문자로 받습니다.)",
                        fontSize = 13.sp, color = Brand.Primary,
                    )
                }
                Text("인증번호 다시 받기", Modifier.clickable { sentCode = String.format("%06d", Random.nextInt(0, 1_000_000)); code = "" }, fontSize = 13.sp, color = Brand.SubInk)
            }
            error?.let { Text(it, color = Brand.Danger, fontSize = 13.sp) }
        }
    }
}
