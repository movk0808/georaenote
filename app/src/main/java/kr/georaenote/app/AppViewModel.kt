package kr.georaenote.app

import android.app.Application
import android.net.Uri
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kr.georaenote.app.data.CardCharge
import kr.georaenote.app.data.Content
import kr.georaenote.app.data.Contract
import kr.georaenote.app.data.ContractStatus
import kr.georaenote.app.data.ContractType
import kr.georaenote.app.data.Fees
import kr.georaenote.app.data.Format
import kr.georaenote.app.data.MileageLog
import kr.georaenote.app.data.RemoteApi
import kr.georaenote.app.data.Repository
import kr.georaenote.app.data.Transfer
import kr.georaenote.app.data.TransferMethod
import kr.georaenote.app.data.TransferStatus
import kr.georaenote.app.data.User
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import java.util.UUID
import kotlin.random.Random

/** 계약 등록 중 단계별로 채워지는 임시 값 */
data class ContractDraft(
    val type: ContractType? = null,
    val payeeName: String = "",
    val bank: String = "",
    val account: String = "",
    val holder: String = "",
    val address: String = "",
    val addressDetail: String = "",
    val senderName: String = "",
    val proofs: List<String> = emptyList(),
    /** 실제로 고른 파일(서버 모드에서 업로드). 샘플 서류는 이름만 있어요 */
    val files: Map<String, Uri> = emptyMap(),
)

/** 송금 화면에서 결제 화면으로 넘기는 값 */
data class TransferDraft(
    val contractId: String,
    val amount: Long,
    val method: TransferMethod,
    val scheduledDate: String?,
    val memo: String,
    val split: Boolean,
)

data class QuizResult(val correct: Boolean, val answer: Int, val explain: String)

/**
 * 앱 상태. 서버(Supabase) 설정이 있으면 서버에 저장하고 웹앱과 같은 데이터를 보며,
 * 없으면 기기 안에만 저장하는 체험 모드로 동작해요. 화면은 어느 모드든 같은 함수를 부릅니다.
 * 서버를 쓰는 함수는 결과를 onDone 으로 돌려줘요(실패하면 Result.failure 에 사용자에게 보일 문장).
 */
class AppViewModel(app: Application) : AndroidViewModel(app) {
    private val repo = Repository(app)
    private val remote: RemoteApi? = RemoteApi.create(app)
    val isRemote: Boolean get() = remote != null

    /** 체험 모드: 계약 등록 후 이 시간이 지나면 자동 승인됩니다(서버 모드는 서버 설정을 따름) */
    private val demoReviewMillis = 10_000L

    var onboarded by mutableStateOf(repo.onboarded); private set
    var user by mutableStateOf(if (remote == null) repo.loadUser() else null); private set
    var contracts by mutableStateOf(if (remote == null) repo.loadContracts() else emptyList()); private set
    var transfers by mutableStateOf(if (remote == null) repo.loadTransfers() else emptyList()); private set
    var mileageLogs by mutableStateOf(if (remote == null) repo.loadMileageLogs() else emptyList()); private set
    var notificationsOn by mutableStateOf(repo.notificationsOn); private set
    private var remoteQuizDone by mutableStateOf(false)

    var contractDraft by mutableStateOf(ContractDraft())
    var transferDraft by mutableStateOf<TransferDraft?>(null)

    val loggedIn: Boolean get() = user != null
    val mileageBalance: Long get() = mileageLogs.sumOf { it.amount }

    init { refresh() }

    /** 서버 작업을 백그라운드에서 실행하고 결과를 화면 스레드로 돌려줘요 */
    private fun <T> io(onDone: (Result<T>) -> Unit, block: suspend () -> T) {
        viewModelScope.launch {
            val r = withContext(Dispatchers.IO) { runCatching { block() } }
            onDone(r.recoverCatching { e -> throw IllegalStateException(e.message ?: "요청을 처리하지 못했어요") })
        }
    }

    private suspend fun reloadRemote() {
        val api = remote ?: return
        if (!api.signedIn) { user = null; return }
        val snap = withContext(Dispatchers.IO) { runCatching { api.load() } }.getOrNull() ?: return
        user = snap.user
        contracts = snap.contracts
        transfers = snap.transfers
        mileageLogs = snap.mileage
        notificationsOn = snap.notificationsOn
        remoteQuizDone = snap.quizDoneToday
    }

    fun finishOnboarding() {
        repo.onboarded = true
        onboarded = true
    }

    fun shouldShowPopup(): Boolean =
        !repo.popupNeverShow && repo.popupHiddenDate != Format.today().toString()

    fun hidePopupToday() { repo.popupHiddenDate = Format.today().toString() }
    fun hidePopupForever() { repo.popupNeverShow = true }

    // ---------------- 로그인 ----------------

    /** 인증번호 요청. 체험 서버/체험 모드에서는 번호를 돌려줘요(실서비스에서는 빈 문자열, 문자로 발송) */
    fun requestCode(phone: String, onDone: (Result<String>) -> Unit) {
        val api = remote
        if (api == null) { onDone(Result.success(String.format("%06d", Random.nextInt(0, 1_000_000)))); return }
        io(onDone) { api.requestCode(phone) }
    }

    /**
     * 휴대폰 본인인증.
     * link = false: 이 번호로 인증한 계정으로 로그인(없으면 새로 가입)
     * link = true : 지금 로그인한 계정(바로 시작)에 본인인증을 붙임 — 계약 등록·결제 전에 1회
     */
    fun verify(name: String, phone: String, carrier: String, birth: String, code: String, expected: String, link: Boolean = false, onDone: (Result<Unit>) -> Unit) {
        val api = remote
        if (api == null) {
            if (code != expected) { onDone(Result.failure(IllegalStateException("인증번호가 일치하지 않아요"))); return }
            val nick = user?.nickname?.ifBlank { null } ?: "사장님${phone.takeLast(4)}"
            val u = User(name.trim(), phone.filter(Char::isDigit), carrier, birth, nick, verified = true)
            repo.saveUser(u); user = u
            onDone(Result.success(Unit)); return
        }
        io(onDone) {
            if (link) api.verifyLink(phone.filter(Char::isDigit), code, name.trim(), birth, carrier)
            else api.verify(phone.filter(Char::isDigit), code, name.trim(), birth, carrier)
            reloadRemote()
        }
    }

    /** 바로 시작: 이름·번호 없이 자동 닉네임으로 가입 */
    fun quickStart(onDone: (Result<Unit>) -> Unit) {
        val api = remote
        if (api == null) {
            val n = listOf("멋진사장님", "든든한사장님", "부지런한사장님", "똑똑한사장님").random() + Random.nextInt(100, 1000)
            val u = User("", "", "", "", n, verified = false)
            repo.saveUser(u); user = u
            onDone(Result.success(Unit)); return
        }
        io(onDone) { api.quickStart(); reloadRemote() }
    }

    fun updateNickname(nickname: String, onDone: (Result<Unit>) -> Unit) {
        val api = remote
        if (api == null) {
            if (!Regex("^[가-힣A-Za-z0-9]{2,12}$").matches(nickname.trim())) {
                onDone(Result.failure(IllegalStateException("닉네임은 한글·영문·숫자 2~12자로 정해 주세요"))); return
            }
            user?.let { val u = it.copy(nickname = nickname.trim()); repo.saveUser(u); user = u }
            onDone(Result.success(Unit)); return
        }
        io(onDone) { api.updateNickname(nickname.trim()); reloadRemote() }
    }

    /** 계약 등록·결제 전에 본인인증이 필요한지 */
    val needsVerify: Boolean get() = user?.verified == false

    /** 본인인증을 마치면 돌아갈 화면 */
    var afterVerify: String? = null

    // ---------------- 카카오·네이버·구글 로그인 ----------------

    /** 로그인 브라우저를 열 주소. 서버 모드가 아니면 null */
    fun socialStartUrl(provider: String): String? = remote?.socialStartUrl(provider)

    /** 소셜 로그인 처리 중(브라우저에서 돌아와 세션을 저장하는 동안) */
    var socialBusy by mutableStateOf(false); private set
    var socialError by mutableStateOf<String?>(null)
    /** 소셜 로그인이 끝날 때마다 1씩 늘어요. 화면은 이 값이 바뀌면 홈으로 이동해요 */
    var socialDone by mutableStateOf(0); private set

    /** MainActivity 가 georaenote://auth 로 열리면 불러요 */
    fun handleAuthRedirect(uri: android.net.Uri?) {
        val api = remote ?: return
        if (uri == null || uri.scheme != "georaenote" || uri.host != "auth") return
        socialBusy = true; socialError = null
        io<Unit>({ r ->
            socialBusy = false
            r.onSuccess { socialDone++ }.onFailure { socialError = it.message }
        }) { api.completeSocial(uri); reloadRemote() }
    }

    fun logout() {
        val api = remote
        if (api == null) { repo.saveUser(null); user = null; return }
        viewModelScope.launch(Dispatchers.IO) { api.logout() }
        user = null; contracts = emptyList(); transfers = emptyList(); mileageLogs = emptyList()
    }

    /** 회원 탈퇴: 서버 모드는 앱·웹 모두에서 계정이 지워져요 */
    fun withdraw(onDone: (Result<Unit>) -> Unit) {
        val api = remote
        if (api == null) {
            repo.clearAccount()
            user = null; contracts = emptyList(); transfers = emptyList(); mileageLogs = emptyList()
            onDone(Result.success(Unit)); return
        }
        io<Unit>({ r -> if (r.isSuccess) { user = null; contracts = emptyList(); transfers = emptyList(); mileageLogs = emptyList() }; onDone(r) }) { api.withdraw() }
    }

    fun setNotifications(on: Boolean) {
        repo.notificationsOn = on
        notificationsOn = on
        remote?.let { api -> viewModelScope.launch(Dispatchers.IO) { runCatching { api.setNotifications(on) } } }
    }

    /** 서버 모드: 서버 최신 상태 읽기 / 체험 모드: 데모 심사 승인, 예약송금 입금일 처리 */
    fun refresh() {
        if (remote != null) { viewModelScope.launch { reloadRemote() }; return }
        val now = System.currentTimeMillis()
        if (contracts.any { it.status == ContractStatus.REVIEW && now - it.createdAt >= demoReviewMillis }) {
            contracts = contracts.map {
                if (it.status == ContractStatus.REVIEW && now - it.createdAt >= demoReviewMillis) it.copy(status = ContractStatus.APPROVED) else it
            }
            repo.saveContracts(contracts)
        }
        val today = Format.today()
        transfers.filter {
            it.status == TransferStatus.SCHEDULED && it.scheduledDate != null && !LocalDate.parse(it.scheduledDate).isAfter(today)
        }.forEach { completeLocal(it.id) }
    }

    fun contract(id: String) = contracts.firstOrNull { it.id == id }
    fun transfer(id: String) = transfers.firstOrNull { it.id == id }

    // ---------------- 계약 ----------------
    fun submitContract(onDone: (Result<String>) -> Unit) {
        val d = contractDraft
        val type = d.type ?: ContractType.ETC
        val address = listOf(d.address, d.addressDetail).filter { it.isNotBlank() }.joinToString(" ")
        val api = remote
        if (api != null) {
            io<String>({ r -> if (r.isSuccess) contractDraft = ContractDraft(); onDone(r) }) {
                val id = api.submitContract(type, d.payeeName.trim(), d.bank, d.account.filter(Char::isDigit), d.holder.trim(), d.senderName.trim(), address, d.proofs, d.files)
                reloadRemote(); id
            }
            return
        }
        val c = Contract(
            id = UUID.randomUUID().toString(), type = type, title = "${d.payeeName.trim()} ${type.label}", payeeName = d.payeeName.trim(),
            bank = d.bank, account = d.account.filter(Char::isDigit), holder = d.holder.trim(), senderName = d.senderName.trim(),
            address = address, proofs = d.proofs, createdAt = System.currentTimeMillis(), status = ContractStatus.REVIEW,
        )
        contracts = listOf(c) + contracts
        repo.saveContracts(contracts)
        contractDraft = ContractDraft()
        onDone(Result.success(c.id))
    }

    fun deleteContract(id: String, onDone: (Result<Unit>) -> Unit) {
        val api = remote
        if (api != null) { io(onDone) { api.deleteContract(id); reloadRemote() }; return }
        contracts = contracts.filterNot { it.id == id }
        repo.saveContracts(contracts)
        onDone(Result.success(Unit))
    }

    // ---------------- 송금 ----------------

    /** 카드 결제(모의 승인) 후 송금 건 생성. PG 연동 후에는 PG 결제창 → 승인 웹훅으로 바뀝니다 */
    fun pay(cards: List<CardCharge>, onDone: (Result<String>) -> Unit) {
        val d = transferDraft ?: run { onDone(Result.failure(IllegalStateException("결제 정보가 없어요"))); return }
        val api = remote
        if (api != null) {
            io<String>({ r -> if (r.isSuccess) transferDraft = null; onDone(r) }) {
                val id = api.pay(d.contractId, d.amount, d.method, d.scheduledDate, d.memo, cards)
                reloadRemote(); id
            }
            return
        }
        val c = contract(d.contractId) ?: run { onDone(Result.failure(IllegalStateException("계약을 찾을 수 없어요"))); return }
        val fee = Fees.fee(d.amount, d.method)
        val t = Transfer(
            id = UUID.randomUUID().toString(), contractId = c.id, contractTitle = c.title, payeeName = c.payeeName, bank = c.bank,
            maskedAccount = c.maskedAccount, holder = c.holder, senderName = c.senderName, memo = d.memo, amount = d.amount, fee = fee,
            method = d.method, scheduledDate = d.scheduledDate, cards = cards, mileage = Fees.mileage(fee), createdAt = System.currentTimeMillis(),
            completedAt = null, status = if (d.method == TransferMethod.INSTANT) TransferStatus.WAITING_SEND else TransferStatus.SCHEDULED,
        )
        transfers = listOf(t) + transfers
        repo.saveTransfers(transfers)
        transferDraft = null
        onDone(Result.success(t.id))
    }

    /** 바로송금의 '송금하기' */
    fun complete(id: String, onDone: (Result<Unit>) -> Unit) {
        val api = remote
        if (api != null) { io(onDone) { api.send(id); reloadRemote() }; return }
        completeLocal(id)
        onDone(Result.success(Unit))
    }

    private fun completeLocal(id: String) {
        val t = transfer(id) ?: return
        if (t.status == TransferStatus.COMPLETED || t.status == TransferStatus.CANCELED) return
        val firstEver = transfers.none { it.status == TransferStatus.COMPLETED }
        val now = System.currentTimeMillis()
        transfers = transfers.map { if (it.id == id) it.copy(status = TransferStatus.COMPLETED, completedAt = now) else it }
        repo.saveTransfers(transfers)
        val logs = mutableListOf(MileageLog("송금 적립 · ${t.payeeName}", t.mileage, now))
        if (firstEver) logs += MileageLog("첫 송금 이벤트", 3_000, now)
        mileageLogs = logs + mileageLogs
        repo.saveMileageLogs(mileageLogs)
    }

    fun cancel(id: String, onDone: (Result<Unit>) -> Unit = {}) {
        val api = remote
        if (api != null) { io(onDone) { api.cancel(id); reloadRemote() }; return }
        transfers = transfers.map { if (it.id == id && it.status != TransferStatus.COMPLETED) it.copy(status = TransferStatus.CANCELED) else it }
        repo.saveTransfers(transfers)
        onDone(Result.success(Unit))
    }

    // ---------------- 퀴즈·문의 ----------------
    fun quizDoneToday(): Boolean = if (remote != null) remoteQuizDone else repo.quizDoneDate == Format.today().toString()

    /** 웹·서버와 같은 규칙: 2026-01-01부터 지난 날 수로 오늘의 문제를 골라요 */
    fun todayQuizIndex(): Int = (ChronoUnit.DAYS.between(LocalDate.of(2026, 1, 1), Format.today()) % Content.quizzes.size).toInt().let { if (it < 0) it + Content.quizzes.size else it }

    fun answerQuiz(choice: Int, onDone: (Result<QuizResult>) -> Unit) {
        val api = remote
        if (api != null) {
            io(onDone) { val (ok, ans, exp) = api.answerQuiz(choice); reloadRemote(); QuizResult(ok, ans, exp) }
            return
        }
        val q = Content.quizzes[todayQuizIndex()]
        val ok = choice == q.answer
        repo.quizDoneDate = Format.today().toString()
        if (ok) {
            mileageLogs = listOf(MileageLog("매일 퀴즈 정답", 10, System.currentTimeMillis())) + mileageLogs
            repo.saveMileageLogs(mileageLogs)
        }
        onDone(Result.success(QuizResult(ok, q.answer, q.explain)))
    }

    /** 고객센터 채팅 문의를 서버에 남겨 관리자가 답할 수 있게 해요(체험 모드에서는 남기지 않음) */
    fun sendInquiry(message: String) {
        val api = remote ?: return
        if (user == null) return
        viewModelScope.launch(Dispatchers.IO) { runCatching { api.inquiry(message) } }
    }
}
