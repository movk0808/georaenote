package kr.georaenote.app.ui.screens

import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.outlined.AttachFile
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.Verified
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kr.georaenote.app.AppViewModel
import kr.georaenote.app.data.Banks
import kr.georaenote.app.data.ContractStatus
import kr.georaenote.app.data.ContractType
import kr.georaenote.app.data.Format
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
import kr.georaenote.app.ui.components.StepBar
import kr.georaenote.app.ui.components.TypeBadge
import kr.georaenote.app.ui.theme.Brand

private const val CONTRACT_STEPS = 4

@Composable
private fun StepTitle(step: Int, title: String, sub: String? = null) {
    Spacer(Modifier.height(4.dp))
    StepBar(step, CONTRACT_STEPS)
    Column(Modifier.padding(horizontal = 20.dp, vertical = 24.dp)) {
        Text(title, style = MaterialTheme.typography.headlineMedium, color = Brand.Ink)
        if (sub != null) {
            Spacer(Modifier.height(8.dp))
            Text(sub, fontSize = 14.sp, color = Brand.Faint)
        }
    }
}

/** 1단계: 계약 유형 선택 */
@Composable
fun ContractTypeScreen(vm: AppViewModel, back: () -> Unit, go: (String) -> Unit) {
    val selected = vm.contractDraft.type
    Screen("계약등록", back, bottom = {
        BottomBar { PrimaryButton("다음", enabled = selected != null) { go(Routes.CONTRACT_PAYEE) } }
    }) {
        StepTitle(0, "계약 유형을\n선택해 주세요.")
        Column(Modifier.verticalScroll(rememberScrollState()).padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            ContractType.entries.chunked(3).forEach { row ->
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    row.forEach { t ->
                        SelectBox(selected == t, Modifier.weight(1f), onClick = { vm.contractDraft = vm.contractDraft.copy(type = t) }) {
                            TypeBadge(t, 44.dp)
                            Spacer(Modifier.height(8.dp))
                            Text(t.label, fontSize = 13.sp, color = Brand.Ink, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center)
                        }
                    }
                    repeat(3 - row.size) { Spacer(Modifier.weight(1f)) }
                }
            }
            Text("주류 매입대금은 결제 요건 확인 후 열릴 예정이에요.", fontSize = 12.sp, color = Brand.Faint, modifier = Modifier.padding(top = 6.dp))
        }
    }
}

/** 2단계: 거래처·계좌(·주소) 입력 */
@Composable
fun ContractPayeeScreen(vm: AppViewModel, back: () -> Unit, go: (String) -> Unit) {
    val d = vm.contractDraft
    val type = d.type ?: ContractType.ETC
    var bankDialog by remember { mutableStateOf(false) }
    val focusManager = androidx.compose.ui.platform.LocalFocusManager.current
    var verified by remember { mutableStateOf(false) }
    val ok = d.payeeName.isNotBlank() && d.bank.isNotBlank() && d.account.length >= 8 && d.holder.isNotBlank() &&
        (!type.needsAddress || d.address.isNotBlank()) && verified

    Screen("계약등록", back, bottom = {
        BottomBar {
            GrayButton("이전", Modifier.weight(1f)) { back() }
            PrimaryButton("다음", Modifier.weight(2f), enabled = ok) { go(Routes.CONTRACT_SENDER) }
        }
    }) {
        // 키보드가 올라와도 입력칸이 가려지지 않도록 제목까지 함께 스크롤합니다
        Column(Modifier.verticalScroll(rememberScrollState())) {
        StepTitle(1, if (type.needsAddress) "거래처와 주소를\n입력해 주세요." else "거래처 정보를\n입력해 주세요.", "대금이 입금될 거래처 계좌예요.")
        Column(Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            LineField(d.payeeName, { vm.contractDraft = d.copy(payeeName = it.take(30)) }, "예) 샘플식자재", label = "거래처명(상호)")
            Box {
                LineField(d.bank, {}, "은행 선택", label = "은행", readOnly = true, trailing = { Icon(Icons.Filled.ArrowDropDown, null) })
                Box(Modifier.matchParentSize().clickable { focusManager.clearFocus(); bankDialog = true })
            }
            LineField(d.account, { vm.contractDraft = d.copy(account = it.filter(Char::isDigit).take(16)); verified = false }, "'-' 없이 숫자만", label = "계좌번호", keyboardType = KeyboardType.Number)
            LineField(d.holder, { vm.contractDraft = d.copy(holder = it.take(20)); verified = false }, "예금주명", label = "예금주",
                trailing = {
                    Text(
                        if (verified) "확인됨" else "계좌 확인",
                        Modifier.clip(RoundedCornerShape(999.dp)).border(1.dp, Brand.Primary, RoundedCornerShape(999.dp))
                            .clickable(enabled = d.bank.isNotBlank() && d.account.length >= 8 && d.holder.isNotBlank()) { verified = true }
                            .padding(horizontal = 12.dp, vertical = 5.dp),
                        color = Brand.Primary, fontSize = 13.sp, fontWeight = FontWeight.Bold,
                    )
                })
            if (verified) Text("체험판: 예금주 조회를 통과한 것으로 처리했어요.", fontSize = 12.sp, color = Brand.Success)
            if (type.needsAddress) {
                LineField(d.address, { vm.contractDraft = d.copy(address = it.take(60)) }, "예) 서울시 중구 세종대로 1", label = "사업장 주소")
                LineField(d.addressDetail, { vm.contractDraft = d.copy(addressDetail = it.take(40)) }, "상세주소", label = null)
            }
            Spacer(Modifier.height(20.dp))
        }
        }
    }

    if (bankDialog) {
        AlertDialog(
            onDismissRequest = { bankDialog = false },
            confirmButton = { TextButton({ bankDialog = false }) { Text("닫기") } },
            title = { Text("은행 선택") },
            text = {
                LazyColumn(Modifier.heightIn(max = 420.dp)) {
                    items(Banks) { b ->
                        Text(b, Modifier.fillMaxWidth().clickable {
                            vm.contractDraft = vm.contractDraft.copy(bank = b); verified = false; bankDialog = false
                        }.padding(vertical = 13.dp), fontSize = 16.sp, color = Brand.Ink)
                    }
                }
            },
            containerColor = Color.White,
        )
    }
}

/** 3단계: 송금자명(거래처 통장에 찍힐 이름) */
@Composable
fun ContractSenderScreen(vm: AppViewModel, back: () -> Unit, go: (String) -> Unit) {
    androidx.compose.runtime.LaunchedEffect(Unit) {
        val u = vm.user
        if (vm.contractDraft.senderName.isEmpty() && u != null) {
            vm.contractDraft = vm.contractDraft.copy(senderName = u.name)
        }
    }
    Screen("계약등록", back, bottom = {
        BottomBar {
            GrayButton("이전", Modifier.weight(1f)) { back() }
            PrimaryButton("다음", Modifier.weight(2f), enabled = vm.contractDraft.senderName.isNotBlank()) { go(Routes.CONTRACT_PROOF) }
        }
    }) {
        StepTitle(2, "송금자명을\n입력해 주세요.", "거래 상대 계좌에 찍힐 이름을 입력해 주세요.")
        Column(Modifier.padding(horizontal = 20.dp)) {
            LineField(vm.contractDraft.senderName, { vm.contractDraft = vm.contractDraft.copy(senderName = it.take(10)) }, "예) 홍길동식당", label = "송금자명")
            Spacer(Modifier.height(10.dp))
            Text("상호명이나 대표자명처럼 거래처가 알아볼 수 있는 이름이 좋아요. 최대 10자.", fontSize = 12.sp, color = Brand.Faint)
        }
    }
}

/** 4단계: 증빙서류 첨부 */
@Composable
fun ContractProofScreen(vm: AppViewModel, back: () -> Unit, go: (String) -> Unit) {
    val context = LocalContext.current
    var submitting by remember { mutableStateOf(false) }
    val d = vm.contractDraft
    val type = d.type ?: ContractType.ETC
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris: List<Uri> ->
        val names = uris.map { uri ->
            context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
                if (c.moveToFirst()) c.getString(0) else null
            } ?: uri.lastPathSegment ?: "첨부파일"
        }
        vm.contractDraft = vm.contractDraft.copy(
            proofs = (vm.contractDraft.proofs + names).distinct().take(5),
            files = vm.contractDraft.files + names.zip(uris).toMap(),
        )
    }

    Screen("계약등록", back, bottom = {
        BottomBar {
            GrayButton("이전", Modifier.weight(1f)) { back() }
            PrimaryButton("등록하기", Modifier.weight(2f), enabled = d.proofs.isNotEmpty()) {
                if (!submitting) {
                    submitting = true
                    vm.submitContract { r -> submitting = false; r.onSuccess { go(Routes.CONTRACT_DONE) }.onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_LONG).show() } }
                }
            }
        }
    }) {
        StepTitle(3, "증빙서류를\n첨부해 주세요.", "${type.label} 계약은 ${type.proof}가 필요해요.")
        Column(Modifier.verticalScroll(rememberScrollState()).padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            d.proofs.forEach { name ->
                Row(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Brand.Background).padding(horizontal = 14.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Outlined.Description, null, tint = Brand.Primary)
                    Spacer(Modifier.width(10.dp))
                    Text(name, Modifier.weight(1f), fontSize = 14.sp, color = Brand.Ink, maxLines = 1)
                    Icon(Icons.Filled.Close, "삭제", tint = Brand.Faint, modifier = Modifier.clickable {
                        vm.contractDraft = vm.contractDraft.copy(proofs = vm.contractDraft.proofs - name)
                    })
                }
            }
            if (d.proofs.size < 5) {
                Row(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).border(1.dp, Brand.Line, RoundedCornerShape(12.dp))
                        .clickable { picker.launch(arrayOf("image/*", "application/pdf")) }.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center,
                ) {
                    Icon(Icons.Outlined.AttachFile, null, tint = Brand.SubInk)
                    Spacer(Modifier.width(6.dp))
                    Text("사진 또는 PDF 첨부", fontSize = 15.sp, color = Brand.SubInk, fontWeight = FontWeight.SemiBold)
                }
                Text(
                    "체험용 샘플 서류로 진행하기",
                    Modifier.clickable {
                        vm.contractDraft = vm.contractDraft.copy(proofs = (vm.contractDraft.proofs + "샘플_${type.proof.substringBefore(" ")}.pdf").distinct())
                    }.padding(vertical = 6.dp),
                    color = Brand.Primary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold,
                )
            }
            Text("최대 5개까지 첨부할 수 있어요. 체험판에서는 파일 이름만 이 기기에 저장되고 외부로 전송되지 않아요.", fontSize = 12.sp, color = Brand.Faint)
        }
    }
}

/** 등록 완료 */
@Composable
fun ContractDoneScreen(onConfirm: () -> Unit) {
    Screen("계약등록", bottom = { BottomBar { PrimaryButton("확인", onClick = onConfirm) } }) {
        Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            Box(Modifier.size(84.dp).clip(RoundedCornerShape(22.dp)).background(Brand.navyFill), contentAlignment = Alignment.Center) {
                Icon(Icons.Outlined.Description, null, tint = Color.White, modifier = Modifier.size(46.dp))
            }
            Spacer(Modifier.height(20.dp))
            Text("계약등록 완료!", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Brand.Ink)
            Spacer(Modifier.height(8.dp))
            Text("검토 처리 이후 사용할 수 있어요.\n검토에는 영업일 기준 최대 1일이 걸려요.", fontSize = 14.sp, color = Brand.SubInk, textAlign = TextAlign.Center)
            Spacer(Modifier.height(14.dp))
            Pill("체험판: 약 10초 뒤 자동 승인돼요", Brand.PrimarySoft, Brand.Primary)
        }
    }
}

/** 계약 상세 */
@Composable
fun ContractDetailScreen(vm: AppViewModel, id: String, back: () -> Unit, go: (String) -> Unit) {
    val context = LocalContext.current
    val c = vm.contract(id)
    if (c == null) {
        Screen("계약 정보", back) { Text("계약을 찾을 수 없어요.", Modifier.padding(20.dp)) }
        return
    }
    var confirmDelete by remember { mutableStateOf(false) }
    val used = vm.transfers.filter { it.contractId == id && it.status != TransferStatus.CANCELED }
    Screen("계약 정보", back, background = Brand.Background, bottom = {
        BottomBar {
            GrayButton("삭제", Modifier.weight(1f)) { confirmDelete = true }
            PrimaryButton("송금하기", Modifier.weight(2f), enabled = c.status == ContractStatus.APPROVED) { go(Routes.transfer(c.id)) }
        }
    }) {
        Column(Modifier.verticalScroll(rememberScrollState()).padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Card {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    TypeBadge(c.type, 48.dp)
                    Spacer(Modifier.width(14.dp))
                    Column(Modifier.weight(1f)) {
                        Text(c.type.label, fontSize = 12.sp, color = Brand.Faint)
                        Text(c.title, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Brand.Ink)
                    }
                    when (c.status) {
                        ContractStatus.APPROVED -> Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Outlined.Verified, null, tint = Brand.Success, modifier = Modifier.size(18.dp))
                            Text(" 승인", color = Brand.Success, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        }
                        ContractStatus.REVIEW -> Pill("검토중", Color(0xFFFFF4D6), Color(0xFFB7791F))
                        ContractStatus.REJECTED -> Pill("반려", Color(0xFFFFE9EE), Brand.Danger)
                    }
                }
            }
            Card {
                KeyValue("거래처", c.payeeName)
                KeyValue("입금 계좌", "${c.bank} ${c.maskedAccount}")
                KeyValue("예금주", c.holder)
                KeyValue("송금자명", c.senderName)
                if (c.address.isNotBlank()) KeyValue("주소", c.address)
                KeyValue("등록일", Format.date(c.createdAt))
            }
            Card {
                Text("증빙서류", fontWeight = FontWeight.Bold, color = Brand.Ink)
                Spacer(Modifier.height(6.dp))
                c.proofs.forEach { Text("· $it", fontSize = 14.sp, color = Brand.SubInk, modifier = Modifier.padding(vertical = 3.dp)) }
            }
            Card {
                Text("이 계약으로 보낸 송금 ${used.size}건", fontWeight = FontWeight.Bold, color = Brand.Ink)
                if (used.isNotEmpty()) {
                    Spacer(Modifier.height(6.dp))
                    used.take(5).forEach { t ->
                        Row(Modifier.fillMaxWidth().clickable { go(Routes.receipt(t.id)) }.padding(vertical = 8.dp)) {
                            Text(Format.date(t.createdAt), Modifier.weight(1f), fontSize = 13.sp, color = Brand.SubInk)
                            Text(Format.won(t.amount), fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = Brand.Ink)
                        }
                        Divider()
                    }
                }
            }
        }
    }
    if (confirmDelete) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text("계약을 삭제할까요?") },
            text = { Text("삭제한 계약은 되돌릴 수 없어요. 송금 내역은 그대로 남아요.") },
            confirmButton = { TextButton({ confirmDelete = false; vm.deleteContract(id) { r -> r.onSuccess { back() }.onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_LONG).show() } } }) { Text("삭제", color = Brand.Danger) } },
            dismissButton = { TextButton({ confirmDelete = false }) { Text("취소") } },
            containerColor = Color.White,
        )
    }
}
