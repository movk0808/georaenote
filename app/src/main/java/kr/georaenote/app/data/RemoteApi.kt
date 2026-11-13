package kr.georaenote.app.data

import android.content.Context
import android.net.Uri
import kr.georaenote.app.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.util.UUID

/**
 * Supabase 서버와 통신합니다(웹앱과 같은 서버·같은 계정).
 * 설정(app/build.gradle.kts 의 SUPABASE_URL, SUPABASE_ANON_KEY)이 비어 있으면 [create]가 null 을 돌려주고
 * 앱은 기기 안에만 저장하는 체험 모드로 동작해요.
 * 모든 함수는 네트워크를 쓰므로 백그라운드 스레드(Dispatchers.IO)에서 불러야 해요.
 */
class RemoteApi private constructor(private val context: Context, private val base: String, private val anonKey: String) {

    class ApiException(message: String) : IOException(message)

    companion object {
        fun create(context: Context): RemoteApi? {
            val url = BuildConfig.SUPABASE_URL.trimEnd('/')
            val key = BuildConfig.SUPABASE_ANON_KEY
            return if (url.isBlank() || key.isBlank()) null else RemoteApi(context.applicationContext, url, key)
        }
    }

    private val prefs = context.getSharedPreferences("georae_note_session", Context.MODE_PRIVATE)
    private var accessToken: String? = prefs.getString("access_token", null)
    private var refreshToken: String? = prefs.getString("refresh_token", null)
    private var expiresAt: Long = prefs.getLong("expires_at", 0)
    var userId: String? = prefs.getString("user_id", null)
        private set

    val signedIn: Boolean get() = refreshToken != null && userId != null

    // ---------------- HTTP ----------------
    private fun http(method: String, path: String, body: Any? = null, auth: Boolean = true, contentType: String = "application/json", raw: ByteArray? = null, extraHeaders: Map<String, String> = emptyMap()): String {
        val conn = (URL(base + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 15_000
            readTimeout = 30_000
            setRequestProperty("apikey", anonKey)
            setRequestProperty("Authorization", "Bearer " + (if (auth) token() else anonKey))
            setRequestProperty("Content-Type", contentType)
            setRequestProperty("Accept", "application/json")
            extraHeaders.forEach { (k, v) -> setRequestProperty(k, v) }
        }
        val payload = raw ?: body?.toString()?.toByteArray()
        if (payload != null) {
            conn.doOutput = true
            conn.outputStream.use { it.write(payload) }
        }
        val code = conn.responseCode
        val text = (if (code in 200..299) conn.inputStream else conn.errorStream)?.bufferedReader()?.use { it.readText() } ?: ""
        if (code !in 200..299) {
            val msg = runCatching { JSONObject(text).let { it.optString("message").ifBlank { it.optString("error").ifBlank { it.optString("msg") } } } }.getOrNull()
            throw ApiException(if (!msg.isNullOrBlank()) msg else "서버 요청에 실패했어요 ($code)")
        }
        return text
    }

    private fun token(): String {
        val now = System.currentTimeMillis() / 1000
        if (accessToken == null || expiresAt - now < 60) refreshSession()
        return accessToken ?: throw ApiException("로그인이 필요해요")
    }

    private fun refreshSession() {
        val rt = refreshToken ?: throw ApiException("로그인이 필요해요")
        val res = try {
            JSONObject(http("POST", "/auth/v1/token?grant_type=refresh_token", JSONObject().put("refresh_token", rt), auth = false))
        } catch (e: ApiException) {
            clearSession(); throw ApiException("다시 로그인해 주세요")
        }
        saveSession(res.getString("access_token"), res.getString("refresh_token"), res.optLong("expires_at", now() + res.optLong("expires_in", 3600)), res.getJSONObject("user").getString("id"))
    }

    private fun now() = System.currentTimeMillis() / 1000

    private fun saveSession(access: String, refresh: String, exp: Long, uid: String) {
        accessToken = access; refreshToken = refresh; expiresAt = exp; userId = uid
        prefs.edit().putString("access_token", access).putString("refresh_token", refresh).putLong("expires_at", exp).putString("user_id", uid).apply()
    }

    fun clearSession() {
        accessToken = null; refreshToken = null; expiresAt = 0; userId = null
        prefs.edit().clear().apply()
    }

    private fun rpc(fn: String, args: JSONObject = JSONObject()): String = http("POST", "/rest/v1/rpc/$fn", args)
    private fun get(path: String): JSONArray = JSONArray(http("GET", "/rest/v1/$path"))
    private fun enc(s: String) = URLEncoder.encode(s, "UTF-8")

    // ---------------- 로그인 ----------------

    /** 인증번호 요청. 데모 서버는 문자 대신 번호를 돌려줘요(실서비스에서는 빈 문자열) */
    fun requestCode(phone: String): String {
        val res = JSONObject(http("POST", "/functions/v1/auth-phone", JSONObject().put("action", "request").put("phone", phone), auth = false))
        return res.optString("demo_code", "")
    }

    fun verify(phone: String, code: String, name: String, birth: String, carrier: String) {
        val res = JSONObject(http("POST", "/functions/v1/auth-phone", JSONObject().put("action", "verify").put("phone", phone).put("code", code)
            .put("name", name).put("birth", birth).put("carrier", carrier), auth = false))
        saveSession(res.getString("access_token"), res.getString("refresh_token"), res.optLong("expires_at", now() + 3600), res.getString("user_id"))
    }

    /** 바로 시작: 이름·번호 없이 가입(익명 계정 + 자동 닉네임). 계약·결제 전에 본인인증을 붙여요 */
    fun quickStart() {
        val res = JSONObject(http("POST", "/auth/v1/signup", JSONObject().put("data", JSONObject()), auth = false))
        saveSession(res.getString("access_token"), res.getString("refresh_token"), res.optLong("expires_at", now() + res.optLong("expires_in", 3600)), res.getJSONObject("user").getString("id"))
        rpc("ensure_profile")
    }

    /** 지금 로그인한 계정에 휴대폰 본인인증을 붙여요 */
    fun verifyLink(phone: String, code: String, name: String, birth: String, carrier: String) {
        http("POST", "/functions/v1/auth-phone", JSONObject().put("action", "verify").put("link", true).put("phone", phone).put("code", code)
            .put("name", name).put("birth", birth).put("carrier", carrier))
        refreshSession()
    }

    fun updateNickname(nickname: String) { rpc("update_nickname", JSONObject().put("p_nickname", nickname)) }

    fun logout() {
        runCatching { http("POST", "/auth/v1/logout") }
        clearSession()
    }

    // ---------------- 읽기 ----------------
    data class Snapshot(
        val user: User?,
        val notificationsOn: Boolean,
        val contracts: List<Contract>,
        val transfers: List<Transfer>,
        val mileage: List<MileageLog>,
        val quizDoneToday: Boolean,
    )

    fun load(): Snapshot {
        val uid = userId ?: throw ApiException("로그인이 필요해요")
        runCatching { rpc("tick") }
        var p = get("profiles?select=*&id=eq.$uid").optJSONObject(0)
        if (p == null) { rpc("ensure_profile"); p = get("profiles?select=*&id=eq.$uid").optJSONObject(0) }
        val contracts = get("contracts?select=*,contract_documents(file_name)&user_id=eq.$uid&status=neq.SUSPENDED&order=created_at.desc").objects().map(::toContract)
        val transfers = get("transfers?select=*,card_charges(company,installment,amount)&user_id=eq.$uid&order=created_at.desc&limit=200").objects().map(::toTransfer)
        val mileage = get("mileage_ledger?select=amount,reason,created_at&user_id=eq.$uid&order=created_at.desc&limit=200").objects()
            .map { MileageLog(it.getString("reason"), it.getLong("amount"), ms(it.getString("created_at"))) }
        val quiz = get("quiz_answers?select=day&user_id=eq.$uid&day=eq.${Format.today()}").length() > 0
        return Snapshot(
            user = p?.let { User(it.str("name") ?: "", it.str("phone") ?: "", it.str("carrier") ?: "", it.str("birth") ?: "", it.optString("nickname"), !it.isNull("verified_at")) },
            notificationsOn = p?.optBoolean("notifications_on", true) ?: true,
            contracts = contracts, transfers = transfers, mileage = mileage, quizDoneToday = quiz,
        )
    }

    // ---------------- 쓰기 ----------------
    fun submitContract(type: ContractType, payee: String, bank: String, account: String, holder: String, sender: String, address: String,
                       proofs: List<String>, files: Map<String, Uri>): String {
        val uid = userId ?: throw ApiException("로그인이 필요해요")
        val docs = JSONArray()
        for (name in proofs) {
            val uri = files[name]
            if (uri == null) { docs.put(JSONObject().put("file_name", name).put("storage_path", JSONObject.NULL)); continue }
            val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: throw ApiException("$name 파일을 읽지 못했어요")
            if (bytes.size > 10 * 1024 * 1024) throw ApiException("$name 파일이 10MB를 넘어요")
            val mime = context.contentResolver.getType(uri) ?: "application/octet-stream"
            val ext = name.substringAfterLast('.', "bin").lowercase().filter { it.isLetterOrDigit() }.ifBlank { "bin" }
            val path = "$uid/${UUID.randomUUID()}.$ext"
            http("POST", "/storage/v1/object/proofs/$path", raw = bytes, contentType = mime)
            docs.put(JSONObject().put("file_name", name).put("storage_path", path))
        }
        val res = rpc("submit_contract", JSONObject().put("p_type", type.name).put("p_payee_name", payee).put("p_bank", bank).put("p_account", account)
            .put("p_holder", holder).put("p_sender_name", sender).put("p_address", address).put("p_documents", docs))
        return res.trim('"')
    }

    fun deleteContract(id: String) { rpc("delete_contract", JSONObject().put("p_id", id)) }

    fun pay(contractId: String, amount: Long, method: TransferMethod, scheduledDate: String?, memo: String, cards: List<CardCharge>): String {
        val arr = JSONArray()
        cards.forEach { arr.put(JSONObject().put("company", it.company).put("installment", it.installment).put("amount", it.amount)) }
        val res = JSONObject(rpc("pay_transfer", JSONObject().put("p_contract_id", contractId).put("p_amount", amount).put("p_method", method.name)
            .put("p_scheduled_date", scheduledDate ?: JSONObject.NULL).put("p_memo", memo).put("p_cards", arr)))
        return res.getString("id")
    }

    fun send(id: String) { rpc("send_transfer", JSONObject().put("p_id", id)) }
    fun cancel(id: String) { rpc("cancel_transfer", JSONObject().put("p_id", id)) }
    fun setNotifications(on: Boolean) { rpc("update_my_profile", JSONObject().put("p_notifications", on)) }
    fun withdraw() {
        // 올린 증빙 파일 먼저 지우기(계정 삭제 후에는 본인이 지울 수 없어요)
        val uid = userId
        if (uid != null) runCatching {
            val list = JSONArray(http("POST", "/storage/v1/object/list/proofs", JSONObject().put("prefix", "$uid/").put("limit", 1000)))
            for (i in 0 until list.length()) {
                runCatching { http("DELETE", "/storage/v1/object/proofs/$uid/" + list.getJSONObject(i).getString("name")) }
            }
        }
        rpc("withdraw_me")
        clearSession()
    }
    fun inquiry(message: String) { rpc("create_inquiry", JSONObject().put("p_message", message)) }

    /** 정답은 서버가 판정해요. (정답 여부, 정답 번호, 해설) */
    fun answerQuiz(choice: Int): Triple<Boolean, Int, String> {
        val r = JSONObject(rpc("answer_quiz", JSONObject().put("p_choice", choice)))
        return Triple(r.getBoolean("correct"), r.getInt("answer"), r.getString("explain"))
    }

    // ---------------- 변환 ----------------
    private fun JSONArray.objects(): List<JSONObject> = List(length()) { getJSONObject(it) }
    private fun ms(iso: String?): Long = if (iso.isNullOrBlank()) 0 else runCatching { OffsetDateTime.parse(iso).toInstant().toEpochMilli() }.getOrElse { Instant.parse(iso).toEpochMilli() }
    private fun JSONObject.str(k: String): String? = if (isNull(k)) null else optString(k)

    private fun toContract(o: JSONObject) = Contract(
        id = o.getString("id"),
        type = runCatching { ContractType.valueOf(o.getString("type")) }.getOrDefault(ContractType.ETC),
        title = o.getString("title"),
        payeeName = o.getString("payee_name"),
        bank = o.getString("bank"),
        account = o.getString("account"),
        holder = o.getString("holder"),
        senderName = o.getString("sender_name"),
        address = o.optString("address"),
        proofs = o.optJSONArray("contract_documents")?.objects()?.map { it.getString("file_name") } ?: emptyList(),
        createdAt = ms(o.getString("created_at")),
        status = when (o.getString("status")) { "APPROVED" -> ContractStatus.APPROVED; "REJECTED" -> ContractStatus.REJECTED; else -> ContractStatus.REVIEW },
        rejectReason = o.str("reject_reason"),
    )

    private fun toTransfer(o: JSONObject) = Transfer(
        id = o.getString("id"),
        contractId = o.getString("contract_id"),
        contractTitle = o.getString("payee_name"),
        payeeName = o.getString("payee_name"),
        bank = o.getString("bank"),
        maskedAccount = o.getString("masked_account"),
        holder = o.getString("holder"),
        senderName = o.getString("sender_name"),
        memo = o.optString("memo"),
        amount = o.getLong("amount"),
        fee = o.getLong("fee"),
        method = TransferMethod.valueOf(o.getString("method")),
        scheduledDate = o.str("scheduled_date")?.let { LocalDate.parse(it).toString() },
        cards = o.optJSONArray("card_charges")?.objects()?.map { CardCharge(it.getString("company"), it.getInt("installment"), it.getLong("amount")) } ?: emptyList(),
        mileage = o.getLong("mileage"),
        createdAt = ms(o.getString("paid_at")),
        completedAt = o.str("completed_at")?.let { ms(it) },
        status = when (o.getString("status")) {
            "COMPLETED" -> TransferStatus.COMPLETED; "CANCELED" -> TransferStatus.CANCELED; "SCHEDULED" -> TransferStatus.SCHEDULED
            "FAILED" -> TransferStatus.FAILED; else -> TransferStatus.WAITING_SEND
        },
    )

    @Suppress("unused")
    private fun encodeForLog(s: String) = enc(s)
}
