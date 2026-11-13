package kr.georaenote.app.data

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * 기기 안(SharedPreferences)에 저장하는 임시 저장소입니다.
 * 서버·PG 연동이 생기면 이 클래스를 API 호출로 바꾸면 됩니다.
 */
class Repository(context: Context) {
    private val prefs = context.getSharedPreferences("georae_note", Context.MODE_PRIVATE)

    var onboarded: Boolean
        get() = prefs.getBoolean("onboarded", false)
        set(v) = prefs.edit().putBoolean("onboarded", v).apply()

    /** 홈 팝업: "오늘 하루 보지 않기" 날짜, "다시 보지 않기" 여부 */
    var popupHiddenDate: String
        get() = prefs.getString("popup_hidden_date", "") ?: ""
        set(v) = prefs.edit().putString("popup_hidden_date", v).apply()
    var popupNeverShow: Boolean
        get() = prefs.getBoolean("popup_never", false)
        set(v) = prefs.edit().putBoolean("popup_never", v).apply()

    var quizDoneDate: String
        get() = prefs.getString("quiz_done_date", "") ?: ""
        set(v) = prefs.edit().putString("quiz_done_date", v).apply()

    var notificationsOn: Boolean
        get() = prefs.getBoolean("noti_on", true)
        set(v) = prefs.edit().putBoolean("noti_on", v).apply()

    fun loadUser(): User? {
        val raw = prefs.getString("user", null) ?: return null
        val o = JSONObject(raw)
        return User(o.optString("name"), o.optString("phone"), o.optString("carrier"), o.optString("birth"), o.optString("nickname"), o.optBoolean("verified", true))
    }

    fun saveUser(user: User?) {
        if (user == null) {
            prefs.edit().remove("user").apply(); return
        }
        val o = JSONObject().put("name", user.name).put("phone", user.phone)
            .put("carrier", user.carrier).put("birth", user.birth).put("nickname", user.nickname).put("verified", user.verified)
        prefs.edit().putString("user", o.toString()).apply()
    }

    fun loadContracts(): List<Contract> = readArray("contracts") { o ->
        Contract(
            id = o.getString("id"),
            type = ContractType.valueOf(o.getString("type")),
            title = o.getString("title"),
            payeeName = o.getString("payeeName"),
            bank = o.getString("bank"),
            account = o.getString("account"),
            holder = o.getString("holder"),
            senderName = o.getString("senderName"),
            address = o.optString("address"),
            proofs = o.getJSONArray("proofs").let { a -> List(a.length()) { a.getString(it) } },
            createdAt = o.getLong("createdAt"),
            status = ContractStatus.valueOf(o.getString("status")),
        )
    }

    fun saveContracts(list: List<Contract>) = writeArray("contracts", list) { c ->
        JSONObject().put("id", c.id).put("type", c.type.name).put("title", c.title)
            .put("payeeName", c.payeeName).put("bank", c.bank).put("account", c.account)
            .put("holder", c.holder).put("senderName", c.senderName).put("address", c.address)
            .put("proofs", JSONArray(c.proofs)).put("createdAt", c.createdAt).put("status", c.status.name)
    }

    fun loadTransfers(): List<Transfer> = readArray("transfers") { o ->
        Transfer(
            id = o.getString("id"),
            contractId = o.getString("contractId"),
            contractTitle = o.getString("contractTitle"),
            payeeName = o.getString("payeeName"),
            bank = o.getString("bank"),
            maskedAccount = o.getString("maskedAccount"),
            holder = o.getString("holder"),
            senderName = o.getString("senderName"),
            memo = o.optString("memo"),
            amount = o.getLong("amount"),
            fee = o.getLong("fee"),
            method = TransferMethod.valueOf(o.getString("method")),
            scheduledDate = o.optString("scheduledDate").ifEmpty { null },
            cards = o.getJSONArray("cards").let { a ->
                List(a.length()) {
                    val c = a.getJSONObject(it)
                    CardCharge(c.getString("company"), c.getInt("installment"), c.getLong("amount"))
                }
            },
            mileage = o.getLong("mileage"),
            createdAt = o.getLong("createdAt"),
            completedAt = if (o.has("completedAt")) o.getLong("completedAt") else null,
            status = TransferStatus.valueOf(o.getString("status")),
        )
    }

    fun saveTransfers(list: List<Transfer>) = writeArray("transfers", list) { t ->
        JSONObject().put("id", t.id).put("contractId", t.contractId).put("contractTitle", t.contractTitle)
            .put("payeeName", t.payeeName).put("bank", t.bank).put("maskedAccount", t.maskedAccount)
            .put("holder", t.holder).put("senderName", t.senderName).put("memo", t.memo)
            .put("amount", t.amount).put("fee", t.fee).put("method", t.method.name)
            .put("scheduledDate", t.scheduledDate ?: "")
            .put("cards", JSONArray(t.cards.map {
                JSONObject().put("company", it.company).put("installment", it.installment).put("amount", it.amount)
            }))
            .put("mileage", t.mileage).put("createdAt", t.createdAt)
            .apply { t.completedAt?.let { put("completedAt", it) } }
            .put("status", t.status.name)
    }

    fun loadMileageLogs(): List<MileageLog> = readArray("mileage_logs") { o ->
        MileageLog(o.getString("title"), o.getLong("amount"), o.getLong("at"))
    }

    fun saveMileageLogs(list: List<MileageLog>) = writeArray("mileage_logs", list) { m ->
        JSONObject().put("title", m.title).put("amount", m.amount).put("at", m.at)
    }

    fun clearAccount() {
        prefs.edit().remove("user").remove("contracts").remove("transfers").remove("mileage_logs")
            .remove("quiz_done_date").apply()
    }

    private fun <T> readArray(key: String, parse: (JSONObject) -> T): List<T> {
        val raw = prefs.getString(key, null) ?: return emptyList()
        return runCatching {
            val a = JSONArray(raw)
            List(a.length()) { parse(a.getJSONObject(it)) }
        }.getOrDefault(emptyList())
    }

    private fun <T> writeArray(key: String, list: List<T>, toJson: (T) -> JSONObject) {
        val a = JSONArray()
        list.forEach { a.put(toJson(it)) }
        prefs.edit().putString(key, a.toString()).apply()
    }
}
