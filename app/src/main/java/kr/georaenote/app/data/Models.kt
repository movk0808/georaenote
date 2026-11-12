package kr.georaenote.app.data

import java.text.NumberFormat
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.roundToLong

/** 송금 방식과 이용료. 이용료율은 bps(1/100 %) 단위입니다. */
enum class TransferMethod(val label: String, val bps: Int, val description: String) {
    INSTANT("바로송금", 400, "결제 후 '송금하기'를 누르면 바로 입금돼요"),
    SCHEDULED("예약송금", 350, "원하는 날짜에 자동으로 입금돼요");

    val rateText: String get() = "${bps / 100.0}%".replace(".0%", "%")
}

object Fees {
    /** 마일리지 적립률: 이용료의 2% */
    const val MILEAGE_PERCENT = 2

    fun fee(amount: Long, method: TransferMethod): Long = (amount * method.bps / 10_000.0).roundToLong()
    fun total(amount: Long, method: TransferMethod): Long = amount + fee(amount, method)
    fun mileage(fee: Long): Long = fee * MILEAGE_PERCENT / 100
}

/** 계약(거래) 유형. 소상공인의 반복 매입대금을 중심으로 구성했습니다. */
enum class ContractType(val label: String, val proof: String, val needsAddress: Boolean) {
    GOODS("물품대금", "거래명세서 또는 세금계산서", false),
    FOOD("식자재", "거래명세서 또는 세금계산서", false),
    BEVERAGE("음료", "거래명세서 또는 세금계산서", false),
    RENT("월세·임대료", "임대차계약서", true),
    DEPOSIT("보증금", "임대차계약서", true),
    INTERIOR("수리·인테리어", "견적서 또는 공사계약서", true),
    MAINTENANCE("관리비", "관리비 고지서", true),
    ETC("기타", "거래 사실을 확인할 수 있는 서류", false),
}

enum class ContractStatus(val label: String) {
    REVIEW("검토중"), APPROVED("승인"), REJECTED("반려")
}

data class Contract(
    val id: String,
    val type: ContractType,
    val title: String,
    val payeeName: String,
    val bank: String,
    val account: String,
    val holder: String,
    val senderName: String,
    val address: String,
    val proofs: List<String>,
    val createdAt: Long,
    val status: ContractStatus,
) {
    val maskedAccount: String
        get() = if (account.length <= 4) account else "*".repeat((account.length - 4).coerceAtMost(6)) + account.takeLast(4)
}

enum class TransferStatus(val label: String) {
    WAITING_SEND("송금 대기"), SCHEDULED("예약됨"), COMPLETED("송금 완료"), CANCELED("취소")
}

data class CardCharge(val company: String, val installment: Int, val amount: Long) {
    val installmentText: String get() = if (installment <= 1) "일시불" else "${installment}개월"
}

data class Transfer(
    val id: String,
    val contractId: String,
    val contractTitle: String,
    val payeeName: String,
    val bank: String,
    val maskedAccount: String,
    val holder: String,
    val senderName: String,
    val memo: String,
    val amount: Long,
    val fee: Long,
    val method: TransferMethod,
    val scheduledDate: String?,
    val cards: List<CardCharge>,
    val mileage: Long,
    val createdAt: Long,
    val completedAt: Long?,
    val status: TransferStatus,
) {
    val total: Long get() = amount + fee
}

data class User(
    val name: String,
    val phone: String,
    val carrier: String,
    val birth: String,
)

data class MileageLog(val title: String, val amount: Long, val at: Long)

object Format {
    private val number = NumberFormat.getNumberInstance(Locale.KOREA)
    private val zone = ZoneId.of("Asia/Seoul")
    private val dateTime = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")
    private val dateOnly = DateTimeFormatter.ofPattern("yyyy-MM-dd")

    fun won(v: Long) = "${number.format(v)}원"
    fun num(v: Long) = number.format(v)
    fun mileage(v: Long) = "${number.format(v)}M"
    fun dateTime(ms: Long): String = dateTime.format(Instant.ofEpochMilli(ms).atZone(zone))
    fun date(ms: Long): String = dateOnly.format(Instant.ofEpochMilli(ms).atZone(zone))
    fun today(): LocalDate = LocalDate.now(zone)
    fun phone(p: String): String {
        val d = p.filter(Char::isDigit)
        return when (d.length) {
            11 -> "${d.substring(0, 3)}-${d.substring(3, 7)}-${d.substring(7)}"
            10 -> "${d.substring(0, 3)}-${d.substring(3, 6)}-${d.substring(6)}"
            else -> p
        }
    }
}

val Banks = listOf(
    "KB국민은행", "신한은행", "우리은행", "하나은행", "NH농협은행", "IBK기업은행",
    "카카오뱅크", "토스뱅크", "케이뱅크", "SC제일은행", "부산은행", "대구은행(iM뱅크)",
    "경남은행", "광주은행", "전북은행", "제주은행", "새마을금고", "신협", "우체국", "수협은행",
)

val CardCompanies = listOf(
    "신한카드", "삼성카드", "현대카드", "KB국민카드", "롯데카드",
    "하나카드", "우리카드", "NH농협카드", "BC카드", "IBK기업카드",
)
