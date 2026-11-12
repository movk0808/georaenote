package kr.georaenote.app

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import kr.georaenote.app.data.CardCharge
import kr.georaenote.app.data.Content
import kr.georaenote.app.data.Contract
import kr.georaenote.app.data.ContractStatus
import kr.georaenote.app.data.ContractType
import kr.georaenote.app.data.Fees
import kr.georaenote.app.data.Format
import kr.georaenote.app.data.MileageLog
import kr.georaenote.app.data.Repository
import kr.georaenote.app.data.Transfer
import kr.georaenote.app.data.TransferMethod
import kr.georaenote.app.data.TransferStatus
import kr.georaenote.app.data.User
import java.time.LocalDate
import java.util.UUID

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

class AppViewModel(app: Application) : AndroidViewModel(app) {
    private val repo = Repository(app)

    /** 데모: 계약 등록 후 이 시간이 지나면 자동 승인됩니다. 실제 서비스에서는 심사 결과를 서버에서 받아옵니다. */
    private val demoReviewMillis = 10_000L

    var onboarded by mutableStateOf(repo.onboarded); private set
    var user by mutableStateOf(repo.loadUser()); private set
    var contracts by mutableStateOf(repo.loadContracts()); private set
    var transfers by mutableStateOf(repo.loadTransfers()); private set
    var mileageLogs by mutableStateOf(repo.loadMileageLogs()); private set
    var notificationsOn by mutableStateOf(repo.notificationsOn); private set

    var contractDraft by mutableStateOf(ContractDraft())
    var transferDraft by mutableStateOf<TransferDraft?>(null)

    val loggedIn: Boolean get() = user != null
    val mileageBalance: Long get() = mileageLogs.sumOf { it.amount }

    init { refresh() }

    fun finishOnboarding() {
        repo.onboarded = true
        onboarded = true
    }

    fun shouldShowPopup(): Boolean =
        !repo.popupNeverShow && repo.popupHiddenDate != Format.today().toString()

    fun hidePopupToday() { repo.popupHiddenDate = Format.today().toString() }
    fun hidePopupForever() { repo.popupNeverShow = true }

    fun login(name: String, phone: String, carrier: String, birth: String) {
        val u = User(name.trim(), phone.filter(Char::isDigit), carrier, birth)
        repo.saveUser(u)
        user = u
    }

    fun logout() {
        repo.saveUser(null)
        user = null
    }

    /** 회원 탈퇴(데모): 기기에 저장된 계정·계약·송금 기록을 지웁니다. */
    fun withdraw() {
        repo.clearAccount()
        user = null
        contracts = emptyList()
        transfers = emptyList()
        mileageLogs = emptyList()
    }

    fun setNotifications(on: Boolean) {
        repo.notificationsOn = on
        notificationsOn = on
    }

    /** 데모 심사 승인, 예약송금 입금일 처리 */
    fun refresh() {
        val now = System.currentTimeMillis()
        if (contracts.any { it.status == ContractStatus.REVIEW && now - it.createdAt >= demoReviewMillis }) {
            contracts = contracts.map {
                if (it.status == ContractStatus.REVIEW && now - it.createdAt >= demoReviewMillis) it.copy(status = ContractStatus.APPROVED) else it
            }
            repo.saveContracts(contracts)
        }
        val today = Format.today()
        transfers.filter {
            it.status == TransferStatus.SCHEDULED && it.scheduledDate != null &&
                !LocalDate.parse(it.scheduledDate).isAfter(today)
        }.forEach { complete(it.id) }
    }

    fun contract(id: String) = contracts.firstOrNull { it.id == id }
    fun transfer(id: String) = transfers.firstOrNull { it.id == id }

    fun submitContract(): String {
        val d = contractDraft
        val type = d.type ?: ContractType.ETC
        val id = UUID.randomUUID().toString()
        val address = listOf(d.address, d.addressDetail).filter { it.isNotBlank() }.joinToString(" ")
        val c = Contract(
            id = id,
            type = type,
            title = "${d.payeeName.trim()} ${type.label}",
            payeeName = d.payeeName.trim(),
            bank = d.bank,
            account = d.account.filter(Char::isDigit),
            holder = d.holder.trim(),
            senderName = d.senderName.trim(),
            address = address,
            proofs = d.proofs,
            createdAt = System.currentTimeMillis(),
            status = ContractStatus.REVIEW,
        )
        contracts = listOf(c) + contracts
        repo.saveContracts(contracts)
        contractDraft = ContractDraft()
        return id
    }

    fun deleteContract(id: String) {
        contracts = contracts.filterNot { it.id == id }
        repo.saveContracts(contracts)
    }

    /** 카드 결제(모의 승인) 후 송금 건을 만듭니다. */
    fun pay(cards: List<CardCharge>): Transfer? {
        val d = transferDraft ?: return null
        val c = contract(d.contractId) ?: return null
        val fee = Fees.fee(d.amount, d.method)
        val t = Transfer(
            id = UUID.randomUUID().toString(),
            contractId = c.id,
            contractTitle = c.title,
            payeeName = c.payeeName,
            bank = c.bank,
            maskedAccount = c.maskedAccount,
            holder = c.holder,
            senderName = c.senderName,
            memo = d.memo,
            amount = d.amount,
            fee = fee,
            method = d.method,
            scheduledDate = d.scheduledDate,
            cards = cards,
            mileage = Fees.mileage(fee),
            createdAt = System.currentTimeMillis(),
            completedAt = null,
            status = if (d.method == TransferMethod.INSTANT) TransferStatus.WAITING_SEND else TransferStatus.SCHEDULED,
        )
        transfers = listOf(t) + transfers
        repo.saveTransfers(transfers)
        transferDraft = null
        return t
    }

    /** 바로송금의 '송금하기' 또는 예약일 도래 시 송금 완료 처리 */
    fun complete(id: String) {
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

    fun cancel(id: String) {
        transfers = transfers.map {
            if (it.id == id && it.status != TransferStatus.COMPLETED) it.copy(status = TransferStatus.CANCELED) else it
        }
        repo.saveTransfers(transfers)
    }

    fun quizDoneToday(): Boolean = repo.quizDoneDate == Format.today().toString()

    fun todayQuizIndex(): Int = (Format.today().toEpochDay() % Content.quizzes.size).toInt()

    /** 정답이면 10M 적립. 하루 한 번만 참여 가능 */
    fun answerQuiz(correct: Boolean) {
        repo.quizDoneDate = Format.today().toString()
        if (correct) {
            mileageLogs = listOf(MileageLog("매일 퀴즈 정답", 10, System.currentTimeMillis())) + mileageLogs
            repo.saveMileageLogs(mileageLogs)
        }
    }
}
