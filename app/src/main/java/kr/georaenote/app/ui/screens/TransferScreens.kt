package kr.georaenote.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.CheckBox
import androidx.compose.material.icons.filled.CheckBoxOutlineBlank
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.outlined.Bolt
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.SelectableDates
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
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
import kotlinx.coroutines.delay
import kr.georaenote.app.AppViewModel
import kr.georaenote.app.TransferDraft
import kr.georaenote.app.data.CardCharge
import kr.georaenote.app.data.CardCompanies
import kr.georaenote.app.data.Fees
import kr.georaenote.app.data.Format
import kr.georaenote.app.data.Transfer
import kr.georaenote.app.data.TransferMethod
import kr.georaenote.app.data.TransferStatus
import kr.georaenote.app.nav.Routes
import kr.georaenote.app.ui.components.BottomBar
import kr.georaenote.app.ui.components.Card
import kr.georaenote.app.ui.components.Divider
import kr.georaenote.app.ui.components.PrimaryButton
import kr.georaenote.app.ui.components.GrayButton
import kr.georaenote.app.ui.components.KeyValue
import kr.georaenote.app.ui.components.LineField
import kr.georaenote.app.ui.components.Pill
import kr.georaenote.app.ui.components.Screen
import kr.georaenote.app.ui.components.SelectBox
import kr.georaenote.app.ui.theme.Brand
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

const val MIN_AMOUNT = 10_000L
const val MAX_AMOUNT = 20_000_000L

/** 송금하기: 분할결제 여부, 송금액, 송금 방식(바로/예약) 선택 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TransferScreen(vm: AppViewModel, contractId: String, back: () -> Unit, go: (String) -> Unit) {
    val c = vm.contract(contractId)
    if (c == null) {
        Screen("송금하기", back) { Text("계약을 찾을 수 없어요.", Modifier.padding(20.dp)) }
        return
    }
    var amountText by rememberSaveable { mutableStateOf("") }
    var memo by rememberSaveable { mutableStateOf("") }
    var split by rememberSaveable { mutableStateOf(false) }
    var method by rememberSaveable { mutableStateOf(TransferMethod.SCHEDULED) }
    var date by rememberSaveable { mutableStateOf<String?>(null) }
    var dateDialog by remember { mutableStateOf(false) }

    val amount = amountText.toLongOrNull() ?: 0L
    val amountOk = amount in MIN_AMOUNT..MAX_AMOUNT
    val ok = amountOk && (method == TransferMethod.INSTANT || date != null)
    val baseForPreview = if (amountOk) amount else 1_000_000L

    Screen("송금하기", back, background = Brand.Background, bottom = {
        BottomBar {
            PrimaryButton(if (ok) "${Format.won(Fees.total(amount, method))} 결제하기" else "결제하기", enabled = ok) {
                vm.transferDraft = TransferDraft(c.id, amount, method, if (method == TransferMethod.SCHEDULED) date else null, memo.trim(), split)
                go(Routes.PAY)
            }
        }
    }) {
        Column(Modifier.verticalScroll(rememberScrollState()).padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            // 계약 요약
            Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(Brand.navyFill).padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Text(c.title, color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(4.dp))
                Text("송금 시 [${c.senderName}] 이름으로 ${c.bank} ${c.maskedAccount}에 입금돼요.", color = Color.White.copy(alpha = 0.85f), fontSize = 12.sp, textAlign = TextAlign.Center)
            }
            Card {
                Text("카드 분할결제 사용 여부", fontWeight = FontWeight.Bold, color = Brand.Ink)
                Spacer(Modifier.height(10.dp))
                Row(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).border(1.dp, Brand.Line, RoundedCornerShape(12.dp))
                        .clickable { split = !split }.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(if (split) Icons.Filled.CheckBox else Icons.Filled.CheckBoxOutlineBlank, null, tint = if (split) Brand.Primary else Brand.Faint)
                    Spacer(Modifier.width(8.dp))
                    Text("하나의 송금 건을 여러 카드로 나눠서 결제", fontSize = 14.sp, color = Brand.Ink)
                }
                Spacer(Modifier.height(6.dp))
                Text("송금은 한 번에, 카드는 최대 3장까지 나눠 결제할 수 있어요.", fontSize = 12.sp, color = Brand.Faint)
            }
            Card {
                Text("송금 내용", fontWeight = FontWeight.Bold, color = Brand.Ink)
                Spacer(Modifier.height(4.dp))
                LineField(
                    if (amountText.isEmpty()) "" else Format.num(amount),
                    { amountText = it.filter(Char::isDigit).take(9).trimStart('0') },
                    "송금할 금액", keyboardType = KeyboardType.Number, suffix = "원",
                )
                Spacer(Modifier.height(6.dp))
                val hint = when {
                    amountText.isEmpty() -> "1만 원부터 2,000만 원까지 보낼 수 있어요."
                    amount < MIN_AMOUNT -> "1만 원 이상 입력해 주세요."
                    amount > MAX_AMOUNT -> "1회 최대 2,000만 원까지 보낼 수 있어요."
                    else -> "거래처에는 ${Format.won(amount)}이 입금돼요."
                }
                Text(hint, fontSize = 12.sp, color = if (amountText.isNotEmpty() && !amountOk) Brand.Danger else Brand.Faint)
                Spacer(Modifier.height(10.dp))
                LineField(memo, { memo = it.take(20) }, "메모 (선택) 예) 11월 식자재")
            }
            Card {
                Text("결제 방식", fontWeight = FontWeight.Bold, color = Brand.Ink)
                Spacer(Modifier.height(4.dp))
                Text("${Format.won(baseForPreview)} 이용 시", fontSize = 13.sp, color = Brand.SubInk, modifier = Modifier.align(Alignment.CenterHorizontally))
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    MethodBox(TransferMethod.INSTANT, baseForPreview, method == TransferMethod.INSTANT, Modifier.weight(1f)) { method = TransferMethod.INSTANT }
                    MethodBox(TransferMethod.SCHEDULED, baseForPreview, method == TransferMethod.SCHEDULED, Modifier.weight(1f), recommended = true) { method = TransferMethod.SCHEDULED }
                }
                Spacer(Modifier.height(10.dp))
                Text(method.description, fontSize = 12.sp, color = Brand.SubInk)
                if (method == TransferMethod.SCHEDULED) {
                    Spacer(Modifier.height(12.dp))
                    Row(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).border(1.dp, if (date == null) Brand.Line else Brand.Primary, RoundedCornerShape(12.dp))
                            .clickable { dateDialog = true }.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(Icons.Outlined.CalendarMonth, null, tint = Brand.Primary)
                        Spacer(Modifier.width(8.dp))
                        Text(date?.let { "$it 입금" } ?: "입금 날짜 선택", Modifier.weight(1f), fontSize = 15.sp, color = if (date == null) Brand.Faint else Brand.Ink, fontWeight = FontWeight.SemiBold)
                        Icon(Icons.Filled.ArrowDropDown, null, tint = Brand.Faint)
                    }
                }
            }
            if (amountOk) {
                Card {
                    val fee = Fees.fee(amount, method)
                    KeyValue("거래처 입금액", Format.won(amount))
                    KeyValue("이용료 ${method.rateText}", Format.won(fee))
                    KeyValue("적립 예정 마일리지", Format.mileage(Fees.mileage(fee)), valueColor = Brand.Primary)
                    Divider(Modifier.padding(vertical = 6.dp))
                    KeyValue("카드 청구액", Format.won(amount + fee), strong = true)
                }
            }
            Spacer(Modifier.height(8.dp))
        }
    }

    if (dateDialog) {
        val tomorrow = Format.today().plusDays(1)
        val state = rememberDatePickerState(
            initialSelectedDateMillis = tomorrow.atStartOfDay().toInstant(ZoneOffset.UTC).toEpochMilli(),
            selectableDates = object : SelectableDates {
                override fun isSelectableDate(utcTimeMillis: Long): Boolean {
                    val d = Instant.ofEpochMilli(utcTimeMillis).atZone(ZoneOffset.UTC).toLocalDate()
                    return !d.isBefore(tomorrow) && !d.isAfter(tomorrow.plusDays(90))
                }
            },
        )
        DatePickerDialog(
            onDismissRequest = { dateDialog = false },
            confirmButton = {
                TextButton({
                    state.selectedDateMillis?.let {
                        date = Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate().toString()
                    }
                    dateDialog = false
                }) { Text("선택") }
            },
            dismissButton = { TextButton({ dateDialog = false }) { Text("취소") } },
        ) { DatePicker(state, title = null, headline = null, showModeToggle = false) }
    }
}

@Composable
private fun MethodBox(m: TransferMethod, amount: Long, selected: Boolean, modifier: Modifier, recommended: Boolean = false, onClick: () -> Unit) {
    Box(modifier) {
        SelectBox(selected, Modifier.fillMaxWidth(), onClick) {
            Spacer(Modifier.height(6.dp))
            Icon(if (m == TransferMethod.INSTANT) Icons.Outlined.Bolt else Icons.Outlined.Schedule, null, tint = if (selected) Brand.Primary else Brand.Faint, modifier = Modifier.size(34.dp))
            Spacer(Modifier.height(8.dp))
            Text(m.label, fontWeight = FontWeight.Bold, color = Brand.Ink)
            Text(if (m == TransferMethod.INSTANT) "결제 후 즉시 송금" else "원하는 날짜에 입금", fontSize = 11.sp, color = Brand.Faint)
            Spacer(Modifier.height(8.dp))
            Divider()
            Spacer(Modifier.height(8.dp))
            Text(Format.won(Fees.total(amount, m)), fontWeight = FontWeight.Bold, color = if (selected) Brand.Primary else Brand.Ink)
            Text("이용료 ${m.rateText}", fontSize = 11.sp, color = if (selected) Brand.Primary else Brand.Faint)
        }
        if (recommended) {
            Pill("추천", Brand.Primary, Color.White, Modifier.align(Alignment.TopEnd).offset(x = (-6).dp, y = 6.dp))
        }
    }
}

private class CardRow(company: String = "", installment: Int = 1, amount: Long = 0) {
    var company by mutableStateOf(company)
    var installment by mutableStateOf(installment)
    var amountText by mutableStateOf(if (amount > 0) amount.toString() else "")
    val amount: Long get() = amountText.toLongOrNull() ?: 0
}

/** 결제: 카드사·할부 선택(모의 승인). 실제 서비스에서는 PG 결제창으로 대체됩니다. */
@Composable
fun PayScreen(vm: AppViewModel, back: () -> Unit, onPaid: (String) -> Unit) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val d = vm.transferDraft
    if (d == null) {
        Screen("결제", back) { Text("결제 정보가 없어요. 다시 시도해 주세요.", Modifier.padding(20.dp)) }
        return
    }
    val total = Fees.total(d.amount, d.method)
    val rows = remember { mutableStateListOf(CardRow(amount = total)) }
    var companyDialogFor by remember { mutableStateOf<CardRow?>(null) }
    var installDialogFor by remember { mutableStateOf<CardRow?>(null) }
    var processing by remember { mutableStateOf(false) }

    val sum = rows.sumOf { it.amount }
    val ok = rows.all { it.company.isNotEmpty() && it.amount >= 1_000 } && sum == total

    if (processing) {
        LaunchedEffect(Unit) {
            delay(1_400)
            vm.pay(rows.map { CardCharge(it.company, it.installment, it.amount) }) { r ->
                r.onSuccess { onPaid(it) }.onFailure { processing = false; android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_LONG).show() }
            }
        }
    }

    Screen("결제", if (processing) null else back, background = Brand.Background, bottom = {
        BottomBar { PrimaryButton("${Format.won(total)} 결제하기", enabled = ok && !processing) { processing = true } }
    }) {
        Column(Modifier.verticalScroll(rememberScrollState()).padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Card {
                Text("결제할 금액", fontSize = 13.sp, color = Brand.SubInk)
                Text(Format.won(total), fontSize = 26.sp, fontWeight = FontWeight.ExtraBold, color = Brand.Ink)
                Spacer(Modifier.height(6.dp))
                Text("입금액 ${Format.won(d.amount)} + 이용료 ${Format.won(total - d.amount)} · ${d.method.label}${d.scheduledDate?.let { " ($it)" } ?: ""}", fontSize = 12.sp, color = Brand.Faint)
            }
            rows.forEachIndexed { i, row ->
                Card {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(if (d.split) "카드 ${i + 1}" else "결제 카드", Modifier.weight(1f), fontWeight = FontWeight.Bold, color = Brand.Ink)
                        if (d.split && rows.size > 1) Icon(Icons.Filled.Close, "카드 빼기", tint = Brand.Faint, modifier = Modifier.clickable { rows.remove(row) })
                    }
                    Spacer(Modifier.height(10.dp))
                    PickBox(row.company.ifEmpty { "카드사 선택" }, row.company.isEmpty()) { companyDialogFor = row }
                    Spacer(Modifier.height(8.dp))
                    PickBox(if (row.installment <= 1) "일시불" else "${row.installment}개월 할부", false) { installDialogFor = row }
                    if (d.split) {
                        Spacer(Modifier.height(6.dp))
                        LineField(
                            if (row.amountText.isEmpty()) "" else Format.num(row.amount),
                            { row.amountText = it.filter(Char::isDigit).take(9).trimStart('0') },
                            "이 카드로 결제할 금액", keyboardType = KeyboardType.Number, suffix = "원",
                        )
                    }
                }
            }
            if (d.split) {
                if (rows.size < 3) {
                    Text(
                        "+ 카드 추가",
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).border(1.dp, Brand.Line, RoundedCornerShape(14.dp)).background(Color.White)
                            .clickable { rows.add(CardRow(amount = (total - sum).coerceAtLeast(0))) }.padding(16.dp),
                        textAlign = TextAlign.Center, color = Brand.Primary, fontWeight = FontWeight.Bold,
                    )
                }
                val diff = total - sum
                Text(
                    if (diff == 0L) "카드별 금액 합계가 결제 금액과 같아요." else if (diff > 0) "${Format.won(diff)}이 더 필요해요." else "${Format.won(-diff)}이 초과됐어요.",
                    fontSize = 13.sp, color = if (diff == 0L) Brand.Success else Brand.Danger, modifier = Modifier.padding(horizontal = 6.dp),
                )
            }
            Text(
                "체험판에서는 카드번호 입력 없이 모의 승인돼요. 실제 서비스에서는 제휴 PG사 결제창이 열리고, 본인 명의 카드만 쓸 수 있어요.",
                fontSize = 12.sp, color = Brand.Faint, modifier = Modifier.padding(horizontal = 6.dp),
            )
        }
    }

    if (processing) {
        Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.35f)).clickable(enabled = false) {}, contentAlignment = Alignment.Center) {
            Column(Modifier.clip(RoundedCornerShape(18.dp)).background(Color.White).padding(28.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                CircularProgressIndicator(color = Brand.Primary)
                Spacer(Modifier.height(14.dp))
                Text("카드 결제 승인 중이에요", color = Brand.Ink, fontWeight = FontWeight.SemiBold)
            }
        }
    }

    companyDialogFor?.let { row ->
        ListDialog("카드사 선택", CardCompanies, { companyDialogFor = null }) { row.company = it; companyDialogFor = null }
    }
    installDialogFor?.let { row ->
        val options = listOf("일시불") + (2..12).map { "${it}개월" }
        ListDialog("할부 개월", options, { installDialogFor = null }) { v ->
            row.installment = if (v == "일시불") 1 else v.removeSuffix("개월").toInt(); installDialogFor = null
        }
    }
}

@Composable
private fun PickBox(text: String, placeholder: Boolean, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).border(1.dp, Brand.Line, RoundedCornerShape(12.dp)).clickable(onClick = onClick).padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(text, Modifier.weight(1f), color = if (placeholder) Brand.Faint else Brand.Ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
        Icon(Icons.Filled.ArrowDropDown, null, tint = Brand.Faint)
    }
}

@Composable
fun ListDialog(title: String, options: List<String>, onDismiss: () -> Unit, onPick: (String) -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = { TextButton(onDismiss) { Text("닫기") } },
        title = { Text(title) },
        text = {
            LazyColumn(Modifier.heightIn(max = 420.dp)) {
                items(options) { o ->
                    Text(o, Modifier.fillMaxWidth().clickable { onPick(o) }.padding(vertical = 13.dp), fontSize = 16.sp, color = Brand.Ink)
                }
            }
        },
        containerColor = Color.White,
    )
}

/** 결제 직후 화면이자 송금 영수증. 바로송금은 '송금하기'를 눌러야 입금됩니다. */
@Composable
fun TransferResultScreen(vm: AppViewModel, id: String, afterPay: Boolean, back: () -> Unit, goHome: () -> Unit) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val t = vm.transfer(id)
    if (t == null) {
        Screen("송금 내역", back) { Text("송금 내역을 찾을 수 없어요.", Modifier.padding(20.dp)) }
        return
    }
    var sending by remember { mutableStateOf(false) }
    var confirmCancel by remember { mutableStateOf(false) }
    if (sending) {
        LaunchedEffect(Unit) { delay(800); vm.complete(t.id) { r -> sending = false; r.onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_LONG).show() } } }
    }
    val title = if (afterPay) "송금하기" else "송금 내역"
    Screen(title, if (afterPay) null else back, bottom = {
        BottomBar {
            when (t.status) {
                TransferStatus.WAITING_SEND -> {
                    GrayButton("결제 취소", Modifier.weight(1f), enabled = !sending) { confirmCancel = true }
                    PrimaryButton(if (sending) "송금 중…" else "송금하기", Modifier.weight(2f), enabled = !sending) { sending = true }
                }
                TransferStatus.SCHEDULED -> {
                    GrayButton("예약 취소", Modifier.weight(1f)) { confirmCancel = true }
                    PrimaryButton("확인", Modifier.weight(2f)) { if (afterPay) goHome() else back() }
                }
                else -> PrimaryButton("확인") { if (afterPay) goHome() else back() }
            }
        }
    }) {
        Column(Modifier.verticalScroll(rememberScrollState()).padding(horizontal = 20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Spacer(Modifier.height(30.dp))
            StatusHeader(t)
            Spacer(Modifier.height(26.dp))
            Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(Brand.Background).padding(18.dp)) {
                KeyValue("송금 금액", Format.won(t.amount), strong = true)
                KeyValue("송금 일시", t.completedAt?.let { Format.dateTime(it) } ?: t.scheduledDate?.let { "$it 예정" } ?: "송금 대기")
                KeyValue("받는 분", t.payeeName)
                KeyValue("입금 계좌", "${t.bank} ${t.maskedAccount}")
                KeyValue("예금주", t.holder)
                KeyValue("송금자명", t.senderName)
                if (t.memo.isNotBlank()) KeyValue("메모", t.memo)
                Divider(Modifier.padding(vertical = 8.dp))
                KeyValue("이용료", "${Format.won(t.fee)} (${t.method.label} ${t.method.rateText})")
                KeyValue("카드 청구액", Format.won(t.total))
                t.cards.forEach { KeyValue("결제 카드", "${it.company} ${it.installmentText} ${Format.won(it.amount)}") }
                KeyValue("결제 일시", Format.dateTime(t.createdAt))
                KeyValue(if (t.status == TransferStatus.COMPLETED) "적립 마일리지" else "적립 예정", Format.mileage(t.mileage), valueColor = Brand.Primary)
            }
            Spacer(Modifier.height(16.dp))
            if (t.status == TransferStatus.WAITING_SEND) {
                Text("바로송금은 결제 후 반드시 '송금하기' 버튼을 눌러야 송금이 완료돼요.", fontSize = 13.sp, color = Brand.SubInk, textAlign = TextAlign.Center)
            }
            Spacer(Modifier.height(20.dp))
        }
    }
    if (confirmCancel) {
        AlertDialog(
            onDismissRequest = { confirmCancel = false },
            title = { Text(if (t.status == TransferStatus.SCHEDULED) "예약을 취소할까요?" else "결제를 취소할까요?") },
            text = { Text("카드 결제 ${Format.won(t.total)}이 취소되고 송금되지 않아요.") },
            confirmButton = { TextButton({ confirmCancel = false; vm.cancel(t.id) { r -> r.onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_LONG).show() } } }) { Text("취소하기", color = Brand.Danger) } },
            dismissButton = { TextButton({ confirmCancel = false }) { Text("닫기") } },
            containerColor = Color.White,
        )
    }
}

@Composable
private fun StatusHeader(t: Transfer) {
    val (title, sub, color) = when (t.status) {
        TransferStatus.WAITING_SEND -> Triple("카드 결제가 완료됐어요", "아래 '송금하기'를 누르면 바로 입금돼요.", Brand.Primary)
        TransferStatus.SCHEDULED -> Triple("예약 완료!", "${t.scheduledDate}에 거래처 계좌로 입금돼요.", Brand.Primary)
        TransferStatus.COMPLETED -> Triple("송금 완료!", "${t.payeeName}에 ${Format.won(t.amount)}을 보냈어요.", Brand.Primary)
        TransferStatus.CANCELED -> Triple("취소된 송금이에요", "카드 결제가 취소되었어요.", Brand.Faint)
        TransferStatus.FAILED -> Triple("송금에 실패했어요", "고객센터에서 확인 후 다시 처리해 드릴게요.", Brand.Danger)
    }
    Box(Modifier.size(78.dp).clip(RoundedCornerShape(39.dp)).background(if (t.status == TransferStatus.CANCELED) Brand.Background else Brand.PrimarySoft), contentAlignment = Alignment.Center) {
        Icon(
            if (t.status == TransferStatus.SCHEDULED) Icons.Outlined.Schedule else if (t.status == TransferStatus.CANCELED) Icons.Filled.Close else Icons.Filled.CheckCircle,
            null, tint = color, modifier = Modifier.size(46.dp),
        )
    }
    Spacer(Modifier.height(16.dp))
    Text(title, fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Brand.Ink)
    Spacer(Modifier.height(6.dp))
    Text(sub, fontSize = 14.sp, color = Brand.SubInk, textAlign = TextAlign.Center)
}

/** 송금 내역 목록 */
@Composable
fun HistoryScreen(vm: AppViewModel, back: () -> Unit, go: (String) -> Unit) {
    var filter by rememberSaveable { mutableStateOf(0) }
    val filters = listOf("전체", "진행 중", "완료", "취소")
    val list = vm.transfers.filter {
        when (filter) {
            1 -> it.status == TransferStatus.WAITING_SEND || it.status == TransferStatus.SCHEDULED
            2 -> it.status == TransferStatus.COMPLETED
            3 -> it.status == TransferStatus.CANCELED
            else -> true
        }
    }
    Screen("송금 내역", back, background = Brand.Background) {
        Row(Modifier.padding(horizontal = 14.dp, vertical = 10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            filters.forEachIndexed { i, f ->
                FilterChip(
                    selected = filter == i, onClick = { filter = i }, label = { Text(f) },
                    colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Brand.PrimarySoft, selectedLabelColor = Brand.Primary, containerColor = Color.White),
                )
            }
        }
        if (list.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text("송금 내역이 없어요.", color = Brand.Faint) }
        } else {
            LazyColumn(Modifier.padding(horizontal = 14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(list, key = { it.id }) { t ->
                    Row(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Color.White).clickable { go(Routes.receipt(t.id)) }.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text(t.payeeName, fontWeight = FontWeight.Bold, color = Brand.Ink)
                            Text("${Format.date(t.createdAt)} · ${t.method.label}", fontSize = 12.sp, color = Brand.Faint)
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text(Format.won(t.amount), fontWeight = FontWeight.Bold, color = if (t.status == TransferStatus.CANCELED) Brand.Faint else Brand.Ink)
                            Text(t.status.label, fontSize = 12.sp, color = when (t.status) {
                                TransferStatus.COMPLETED -> Brand.Success
                                TransferStatus.CANCELED -> Brand.Faint
                                else -> Brand.Primary
                            })
                        }
                    }
                }
            }
        }
    }
}
