package kr.georaenote.app.ui.screens

import androidx.compose.animation.animateContentSize
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kr.georaenote.app.AppViewModel
import kr.georaenote.app.data.Content
import kr.georaenote.app.data.EventItem
import kr.georaenote.app.data.Faq
import kr.georaenote.app.nav.Routes
import kr.georaenote.app.ui.components.BottomBar
import kr.georaenote.app.ui.components.Card
import kr.georaenote.app.ui.components.Divider
import kr.georaenote.app.ui.components.PrimaryButton
import kr.georaenote.app.ui.components.Pager
import kr.georaenote.app.ui.components.Pill
import kr.georaenote.app.ui.components.Screen
import kr.georaenote.app.ui.theme.Brand

private const val PAGE_SIZE = 10

@Composable
fun SearchBox(value: String, onChange: (String) -> Unit, placeholder: String = "검색어를 입력해 주세요", modifier: Modifier = Modifier) {
    Row(
        modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).border(1.dp, Brand.Line, RoundedCornerShape(10.dp)).background(Color.White)
            .padding(horizontal = 14.dp, vertical = 13.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.weight(1f)) {
            if (value.isEmpty()) Text(placeholder, color = Brand.Faint, fontSize = 14.sp)
            BasicTextField(value, onChange, singleLine = true, textStyle = TextStyle(fontSize = 14.sp, color = Brand.Ink), modifier = Modifier.fillMaxWidth())
        }
        Icon(Icons.Outlined.Search, null, tint = Brand.Ink)
    }
}

/** 자주하는 질문 / 공지사항 / 이벤트 탭 */
@Composable
fun BoardScreen(vm: AppViewModel, initialTab: Int, back: () -> Unit, go: (String) -> Unit) {
    var tab by rememberSaveable { mutableIntStateOf(initialTab) }
    val tabs = listOf("자주하는 질문", "공지사항", "이벤트")
    Screen(onBack = back) {
        TabRow(
            selectedTabIndex = tab, containerColor = Color.White, contentColor = Brand.Ink,
            indicator = { pos -> TabRowDefaults.SecondaryIndicator(Modifier.tabIndicatorOffset(pos[tab]), color = Brand.Primary) },
            divider = { Divider() },
        ) {
            tabs.forEachIndexed { i, t ->
                Tab(selected = tab == i, onClick = { tab = i }, text = {
                    Text(t, fontWeight = if (tab == i) FontWeight.Bold else FontWeight.Normal, fontSize = 15.sp, color = if (tab == i) Brand.Ink else Brand.SubInk)
                })
            }
        }
        when (tab) {
            0 -> FaqTab()
            1 -> NoticeTab(go)
            else -> EventTab(go)
        }
    }
}

@Composable
private fun FaqTab() {
    var category by rememberSaveable { mutableStateOf(Content.faqCategories.first()) }
    var query by rememberSaveable { mutableStateOf("") }
    var page by rememberSaveable { mutableIntStateOf(0) }
    var open by remember { mutableStateOf<Faq?>(null) }
    val list = Content.faqs.filter {
        (category == "전체보기" || it.category == category) &&
            (query.isBlank() || it.question.contains(query.trim()) || it.answer.contains(query.trim()))
    }
    val pages = (list.size + PAGE_SIZE - 1) / PAGE_SIZE
    val listState = rememberLazyListState()
    LaunchedEffect(category, query) { page = 0 }
    LaunchedEffect(page) { listState.scrollToItem(0) }

    LazyColumn(state = listState, modifier = Modifier.fillMaxSize()) {
        item {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Content.faqCategories.chunked(3).forEach { row ->
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        row.forEach { c ->
                            val sel = c == category
                            Text(
                                c,
                                Modifier.weight(1f).clip(RoundedCornerShape(999.dp))
                                    .background(if (sel) Color.White else Brand.Background)
                                    .border(if (sel) 1.5.dp else 0.dp, if (sel) Brand.Primary else Color.Transparent, RoundedCornerShape(999.dp))
                                    .clickable { category = c }.padding(vertical = 9.dp),
                                textAlign = TextAlign.Center, fontSize = 13.sp,
                                color = if (sel) Brand.Primary else Brand.SubInk, fontWeight = if (sel) FontWeight.Bold else FontWeight.Normal,
                            )
                        }
                    }
                }
                Spacer(Modifier.height(4.dp))
                SearchBox(query, { query = it })
            }
        }
        if (list.isEmpty()) {
            item { Text("검색 결과가 없어요.", Modifier.fillMaxWidth().padding(40.dp), textAlign = TextAlign.Center, color = Brand.Faint) }
        }
        items(list.drop(page * PAGE_SIZE).take(PAGE_SIZE), key = { it.question }) { f ->
            val expanded = open == f
            Column(Modifier.fillMaxWidth().animateContentSize().clickable { open = if (expanded) null else f }.padding(horizontal = 16.dp)) {
                Row(Modifier.padding(vertical = 17.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(f.question, Modifier.weight(1f), fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = Brand.Ink)
                    Icon(if (expanded) Icons.Filled.KeyboardArrowUp else Icons.Filled.KeyboardArrowDown, null, tint = Brand.Ink)
                }
                if (expanded) {
                    Text(f.answer, Modifier.padding(bottom = 18.dp), fontSize = 14.sp, color = Brand.SubInk, lineHeight = 22.sp)
                }
                Divider()
            }
        }
        item { Pager(pages, page, { page = it }) }
    }
}

@Composable
private fun NoticeTab(go: (String) -> Unit) {
    var query by rememberSaveable { mutableStateOf("") }
    var page by rememberSaveable { mutableIntStateOf(0) }
    val list = Content.notices.filter { query.isBlank() || it.title.contains(query.trim()) }
    val pages = (list.size + PAGE_SIZE - 1) / PAGE_SIZE
    LaunchedEffect(query) { page = 0 }
    LazyColumn(Modifier.fillMaxSize()) {
        items(list.drop(page * PAGE_SIZE).take(PAGE_SIZE), key = { it.id }) { n ->
            Row(Modifier.fillMaxWidth().clickable { go(Routes.notice(n.id)) }.padding(horizontal = 16.dp, vertical = 16.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(n.title, Modifier.weight(1f), fontSize = 14.sp, color = Brand.Ink)
                Spacer(Modifier.width(10.dp))
                Text(n.date, fontSize = 13.sp, color = Brand.SubInk)
            }
            Divider(Modifier.padding(horizontal = 16.dp))
        }
        item {
            Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("제목", Modifier.clip(RoundedCornerShape(10.dp)).border(1.dp, Brand.Line, RoundedCornerShape(10.dp)).padding(horizontal = 14.dp, vertical = 13.dp), fontSize = 13.sp, color = Brand.SubInk)
                Spacer(Modifier.width(8.dp))
                SearchBox(query, { query = it }, "", Modifier.weight(1f))
            }
            Pager(pages, page, { page = it })
        }
    }
}

@Composable
private fun EventTab(go: (String) -> Unit) {
    LazyColumn(Modifier.fillMaxSize().background(Brand.Background), contentPadding = androidx.compose.foundation.layout.PaddingValues(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        items(Content.events, key = { it.id }) { e -> EventCard(e) { go(Routes.event(e.id)) } }
    }
}

@Composable
private fun EventCard(e: EventItem, onClick: () -> Unit) {
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(Color.White).clickable(onClick = onClick)) {
        Box(Modifier.fillMaxWidth().height(110.dp).background(androidx.compose.ui.graphics.SolidColor(Brand.EventBg)).padding(18.dp)) {
            Column(Modifier.align(Alignment.CenterStart)) {
                Pill(e.tag, Brand.Dark, Color.White)
                Spacer(Modifier.height(8.dp))
                Text(e.subtitle, fontSize = 13.sp, color = Brand.SubInk)
            }
            if (e.id == 1) {
                Icon(Icons.Outlined.AutoAwesome, null, tint = Brand.Primary, modifier = Modifier.align(Alignment.CenterEnd).size(52.dp))
            } else {
                androidx.compose.foundation.Image(
                    androidx.compose.ui.res.painterResource(if (e.id == 2) kr.georaenote.app.R.drawable.event_coins_cut else kr.georaenote.app.R.drawable.banner_shop),
                    null,
                    Modifier.align(Alignment.CenterEnd).size(96.dp).clip(RoundedCornerShape(14.dp)),
                    contentScale = androidx.compose.ui.layout.ContentScale.Crop,
                )
            }
        }
        Column(Modifier.padding(16.dp)) {
            Text(e.title, fontWeight = FontWeight.Bold, color = Brand.Ink, fontSize = 15.sp)
            Text(e.period, fontSize = 12.sp, color = Brand.Faint)
        }
    }
}

@Composable
fun NoticeDetailScreen(id: Int, back: () -> Unit) {
    val n = Content.notices.firstOrNull { it.id == id }
    Screen("공지사항", back) {
        if (n == null) {
            Text("공지를 찾을 수 없어요.", Modifier.padding(20.dp)); return@Screen
        }
        Column(Modifier.verticalScroll(rememberScrollState()).padding(20.dp)) {
            Text(n.title, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Brand.Ink)
            Text(n.date, fontSize = 13.sp, color = Brand.Faint, modifier = Modifier.padding(top = 6.dp, bottom = 18.dp))
            Divider()
            Text(n.body, Modifier.padding(top = 18.dp), fontSize = 15.sp, color = Brand.SubInk, lineHeight = 24.sp)
            if (n.title.contains("무이자")) {
                Spacer(Modifier.height(16.dp))
                Text("카드 할부 정보 화면에서 카드사별 혜택을 볼 수 있어요.", fontSize = 13.sp, color = Brand.Primary)
            }
            val idx = Content.notices.indexOf(n)
            Spacer(Modifier.height(30.dp))
            Divider()
            Content.notices.getOrNull(idx + 1)?.let { Text("▲ 이전글   ${it.title}", Modifier.padding(vertical = 14.dp), fontSize = 13.sp, color = Brand.SubInk) }
            Content.notices.getOrNull(idx - 1)?.let { Text("▼ 다음글   ${it.title}", Modifier.padding(vertical = 4.dp), fontSize = 13.sp, color = Brand.SubInk) }
        }
    }
}

/** 이벤트 상세. 퀴즈 이벤트는 로그인 후 하루 한 번 참여할 수 있습니다. */
@Composable
fun EventDetailScreen(vm: AppViewModel, id: Int, back: () -> Unit, go: (String) -> Unit) {
    val e = Content.events.firstOrNull { it.id == id }
    if (e == null) {
        Screen("이벤트", back) { Text("이벤트를 찾을 수 없어요.", Modifier.padding(20.dp)) }; return
    }
    var quizOpen by remember { mutableStateOf(false) }
    var picked by remember { mutableStateOf<Int?>(null) }
    var done by remember { mutableStateOf(vm.quizDoneToday()) }
    var result by remember { mutableStateOf<kr.georaenote.app.QuizResult?>(null) }
    var submitting by remember { mutableStateOf(false) }
    val context = androidx.compose.ui.platform.LocalContext.current
    val quiz = Content.quizzes[vm.todayQuizIndex()]

    Screen(onBack = back, background = Brand.Dark, bottom = {
        BottomBar {
            when {
                !vm.loggedIn -> PrimaryButton("로그인 후 이용 가능합니다", enabled = false) {}
                e.isQuiz && done -> PrimaryButton("오늘은 이미 참여했어요", enabled = false) {}
                e.isQuiz && !quizOpen -> PrimaryButton("퀴즈 풀기") { quizOpen = true }
                e.isQuiz -> PrimaryButton("정답 제출", enabled = picked != null && !submitting) {
                    submitting = true
                    vm.answerQuiz(picked ?: 0) { r ->
                        submitting = false
                        r.onSuccess { result = it; done = true }.onFailure { android.widget.Toast.makeText(context, it.message, android.widget.Toast.LENGTH_LONG).show() }
                    }
                }
                e.id == 2 -> PrimaryButton("송금하러 가기") { go(Routes.HOME) }
                else -> PrimaryButton("후기 남기기") { go(Routes.SUPPORT) }
            }
        }
    }) {
        Column(Modifier.verticalScroll(rememberScrollState()).padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Pill(e.tag, Color(0xFF2B2F3B), Color.White)
            Spacer(Modifier.height(14.dp))
            Text(e.title, fontSize = 24.sp, fontWeight = FontWeight.ExtraBold, color = Color(0xFF8FA2FF), textAlign = TextAlign.Center, lineHeight = 32.sp)
            Spacer(Modifier.height(10.dp))
            Text(e.period, fontSize = 13.sp, color = Color(0xFF9CA3AF))
            Spacer(Modifier.height(24.dp))
            Text(e.body, fontSize = 15.sp, color = Color(0xFFD1D5DB), textAlign = TextAlign.Center, lineHeight = 24.sp)
            if (e.isQuiz && vm.loggedIn) {
                Spacer(Modifier.height(18.dp))
                Text("내 마일리지 ${kr.georaenote.app.data.Format.mileage(vm.mileageBalance)}", color = Color.White, fontWeight = FontWeight.Bold)
            }
            if (e.isQuiz && (quizOpen || done) && vm.loggedIn) {
                Spacer(Modifier.height(24.dp))
                Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(Color(0xFF22252F)).padding(18.dp)) {
                    Text("Q. ${quiz.question}", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    Spacer(Modifier.height(12.dp))
                    quiz.options.forEachIndexed { i, o ->
                        val sel = picked == i
                        val showAnswer = result != null
                        val bg = when {
                            showAnswer && i == result?.answer -> Color(0xFF1F6F43)
                            showAnswer && sel -> Color(0xFF7A2E33)
                            sel -> Brand.Primary
                            else -> Color(0xFF2E3240)
                        }
                        Text(
                            "${i + 1}. $o",
                            Modifier.fillMaxWidth().padding(vertical = 4.dp).clip(RoundedCornerShape(12.dp)).background(bg)
                                .clickable(enabled = !done) { picked = i }.padding(14.dp),
                            color = Color.White, fontSize = 15.sp,
                        )
                    }
                    result?.let { res ->
                        Spacer(Modifier.height(10.dp))
                        Text(if (res.correct) "정답이에요! 10M이 적립됐어요." else "아쉬워요. 내일 다시 도전해 주세요.", color = Color.White, fontWeight = FontWeight.Bold)
                        Text(res.explain, color = Color(0xFFB0B6C3), fontSize = 13.sp, modifier = Modifier.padding(top = 4.dp))
                    }
                }
            }
        }
    }
}

/** 매거진 목록 */
@Composable
fun MagazineScreen(back: () -> Unit, go: (String) -> Unit) {
    var category by rememberSaveable { mutableStateOf("전체") }
    var query by rememberSaveable { mutableStateOf("") }
    val categories = listOf("전체") + Content.articles.map { it.category }.distinct()
    val list = Content.articles.filter { (category == "전체" || it.category == category) && (query.isBlank() || it.title.contains(query.trim())) }
    Screen("${Content.SERVICE_NAME} 매거진", back) {
        LazyColumn(Modifier.fillMaxSize()) {
            item {
                Column(Modifier.padding(20.dp)) {
                    Text("사장님들의 비밀 지식인", fontSize = 24.sp, fontWeight = FontWeight.ExtraBold, color = Brand.Ink)
                    Spacer(Modifier.height(6.dp))
                    Text("사업 운영부터 카드 활용까지,\n${Content.SERVICE_NAME} 매거진에서 함께 알아보세요.", fontSize = 13.sp, color = Brand.Faint)
                    Spacer(Modifier.height(18.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        categories.forEach { c ->
                            val sel = c == category
                            Text(
                                c,
                                Modifier.clip(RoundedCornerShape(8.dp)).background(if (sel) Brand.Primary else Color.White)
                                    .border(1.dp, if (sel) Brand.Primary else Brand.Line, RoundedCornerShape(8.dp))
                                    .clickable { category = c }.padding(horizontal = 14.dp, vertical = 9.dp),
                                color = if (sel) Color.White else Brand.SubInk, fontSize = 13.sp, fontWeight = FontWeight.SemiBold,
                            )
                        }
                    }
                    Spacer(Modifier.height(18.dp))
                    Text("최신 아티클", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Brand.Ink)
                    Spacer(Modifier.height(10.dp))
                    SearchBox(query, { query = it })
                }
            }
            items(list, key = { it.id }) { a ->
                Column(Modifier.fillMaxWidth().clickable { go(Routes.article(a.id)) }.padding(horizontal = 20.dp, vertical = 10.dp)) {
                    androidx.compose.foundation.Image(
                        androidx.compose.ui.res.painterResource(magazineImage(a.id)), null,
                        Modifier.fillMaxWidth().height(180.dp).clip(RoundedCornerShape(16.dp)).background(Brand.Raised),
                        contentScale = androidx.compose.ui.layout.ContentScale.Crop,
                    )
                    Spacer(Modifier.height(10.dp))
                    Text(a.category, fontSize = 12.sp, color = Brand.Primary, fontWeight = FontWeight.SemiBold)
                    Text(a.title, fontSize = 17.sp, fontWeight = FontWeight.Bold, color = Brand.Ink, lineHeight = 24.sp)
                    Text(a.date, fontSize = 12.sp, color = Brand.Faint, modifier = Modifier.padding(top = 4.dp))
                }
            }
            item { Spacer(Modifier.height(24.dp)) }
        }
    }
}

@Composable
fun ArticleScreen(id: Int, back: () -> Unit) {
    val a = Content.articles.firstOrNull { it.id == id }
    Screen("${Content.SERVICE_NAME} 매거진", back) {
        if (a == null) {
            Text("글을 찾을 수 없어요.", Modifier.padding(20.dp)); return@Screen
        }
        Column(Modifier.verticalScroll(rememberScrollState()).padding(20.dp)) {
            androidx.compose.foundation.Image(
                androidx.compose.ui.res.painterResource(magazineImage(a.id)), null,
                Modifier.fillMaxWidth().height(200.dp).clip(RoundedCornerShape(16.dp)),
                contentScale = androidx.compose.ui.layout.ContentScale.Crop,
            )
            Spacer(Modifier.height(18.dp))
            Text(a.category, fontSize = 13.sp, color = Brand.Primary, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(6.dp))
            Text(a.title, fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Brand.Ink, lineHeight = 30.sp)
            Text(a.date, fontSize = 12.sp, color = Brand.Faint, modifier = Modifier.padding(top = 8.dp, bottom = 18.dp))
            Text(a.summary, fontSize = 15.sp, color = Brand.Ink, fontWeight = FontWeight.SemiBold, lineHeight = 24.sp)
            Spacer(Modifier.height(14.dp))
            Text(a.body, fontSize = 15.sp, color = Brand.SubInk, lineHeight = 25.sp)
        }
    }
}

/** 카드 할부 정보(월별 카드사 무이자 혜택) */
@Composable
fun InstallmentScreen(back: () -> Unit) {
    Screen("${Content.installmentMonth} 할부정보", back, background = Color(0xFFE3F2FF)) {
        Column(Modifier.verticalScroll(rememberScrollState()).padding(16.dp)) {
            Text(Content.SERVICE_NAME, fontWeight = FontWeight.Bold, color = Brand.Primary)
            Text("${Content.installmentMonth} 무이자 할부\n카드사별 안내", fontSize = 28.sp, fontWeight = FontWeight.ExtraBold, color = Brand.Ink, lineHeight = 36.sp)
            Spacer(Modifier.height(8.dp))
            Text("· ${Content.installmentPeriod}", fontSize = 13.sp, color = Brand.SubInk)
            Spacer(Modifier.height(18.dp))
            Card {
                Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(999.dp)).background(Brand.Dark).padding(vertical = 10.dp, horizontal = 8.dp)) {
                    Text("카드사", Modifier.weight(1.1f), color = Color.White, fontSize = 12.sp, textAlign = TextAlign.Center)
                    Text("무이자 할부", Modifier.weight(1f), color = Color.White, fontSize = 12.sp, textAlign = TextAlign.Center)
                    Text("부분무이자(고객부담 회차)", Modifier.weight(1.8f), color = Color.White, fontSize = 12.sp, textAlign = TextAlign.Center)
                }
                Content.installments.forEach { r ->
                    Row(Modifier.fillMaxWidth().padding(vertical = 12.dp, horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(r.card, Modifier.weight(1.1f), fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = Brand.Ink)
                        Text(r.free, Modifier.weight(1f), fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Brand.Primary, textAlign = TextAlign.Center)
                        Text(r.partial, Modifier.weight(1.8f), fontSize = 11.sp, color = Brand.SubInk, textAlign = TextAlign.Center)
                    }
                    Divider()
                }
                Spacer(Modifier.height(10.dp))
                Text("화면의 혜택은 예시이며 카드사 사정에 따라 바뀌거나 중단될 수 있어요. 결제 전 카드사에서 꼭 확인해 주세요.", fontSize = 11.sp, color = Brand.Faint, textAlign = TextAlign.Center)
            }
        }
    }
}

/** 이용 방법 안내 */
@Composable
fun GuideScreen(vm: AppViewModel, back: () -> Unit, go: (String) -> Unit) {
    Screen(onBack = back, bottom = {
        BottomBar {
            PrimaryButton(if (vm.loggedIn) "계약 등록하러 가기" else "${Content.SERVICE_NAME} 시작하기") {
                if (vm.loggedIn) { vm.contractDraft = kr.georaenote.app.ContractDraft(); go(Routes.CONTRACT_TYPE) } else go(Routes.TERMS)
            }
        }
    }) {
        Column(Modifier.verticalScroll(rememberScrollState()), horizontalAlignment = Alignment.CenterHorizontally) {
            Spacer(Modifier.height(16.dp))
            Text("${Content.SERVICE_NAME}, 어떻게 사용하나요?", fontSize = 15.sp, color = Brand.Faint)
            Spacer(Modifier.height(18.dp))
            Text("현금이 필요할 때,\n카드를 쓰세요!", fontSize = 30.sp, fontWeight = FontWeight.ExtraBold, color = Brand.Primary, textAlign = TextAlign.Center, lineHeight = 40.sp)
            Spacer(Modifier.height(16.dp))
            Text(
                "${Content.SERVICE_NAME}는 물품대금, 식자재, 월세 등 꼭 필요한 지출을\n신용카드로 결제하고 거래처에는 계좌로 보내는\n사업대금 결제 서비스예요.",
                fontSize = 14.sp, color = Brand.SubInk, textAlign = TextAlign.Center, lineHeight = 22.sp,
            )
            Spacer(Modifier.height(24.dp))
            kr.georaenote.app.ui.components.HeroGraphic(Modifier.fillMaxWidth().height(200.dp).background(Brand.Background))
            Column(Modifier.fillMaxWidth().background(Brand.Background).padding(vertical = 10.dp)) {
                Content.guidePoints.forEach { p ->
                    Column(Modifier.fillMaxWidth().padding(horizontal = 30.dp, vertical = 22.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(p.title, fontSize = 19.sp, fontWeight = FontWeight.Bold, color = Brand.Ink)
                        Spacer(Modifier.height(8.dp))
                        Text(p.body, fontSize = 14.sp, color = Brand.SubInk, textAlign = TextAlign.Center, lineHeight = 22.sp)
                    }
                    Divider(Modifier.padding(horizontal = 30.dp))
                }
            }
            Column(Modifier.fillMaxWidth().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Text("이렇게 이용해요", fontSize = 22.sp, fontWeight = FontWeight.ExtraBold, color = Brand.Primary)
                Spacer(Modifier.height(16.dp))
                listOf(
                    "계약 등록" to "거래 유형 선택 → 거래처·계좌 입력 → 송금자명 → 증빙서류 첨부",
                    "검토·승인" to "영업일 기준 최대 1일 안에 검토가 끝나요.",
                    "결제하기" to "바로송금(4%) 또는 예약송금(3.5%)을 고르고 카드로 결제해요. 여러 카드로 나눠 결제할 수도 있어요.",
                    "송금 완료" to "거래처 계좌로 입금되고 이용료의 2%가 마일리지로 쌓여요.",
                ).forEachIndexed { i, (t, b) ->
                    Row(Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
                        Box(Modifier.size(28.dp).clip(RoundedCornerShape(14.dp)).background(Brand.navyFill), contentAlignment = Alignment.Center) {
                            Text("${i + 1}", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        }
                        Spacer(Modifier.width(12.dp))
                        Column {
                            Text(t, fontWeight = FontWeight.Bold, color = Brand.Ink)
                            Text(b, fontSize = 13.sp, color = Brand.SubInk, lineHeight = 20.sp)
                        }
                    }
                }
            }
        }
    }
}

/** 매거진 글 번호별 썸네일(Sunra로 생성한 사진) */
fun magazineImage(id: Int): Int = when (id) {
    1 -> kr.georaenote.app.R.drawable.mag1
    2 -> kr.georaenote.app.R.drawable.mag2
    3 -> kr.georaenote.app.R.drawable.mag3
    4 -> kr.georaenote.app.R.drawable.mag4
    5 -> kr.georaenote.app.R.drawable.mag5
    else -> kr.georaenote.app.R.drawable.mag6
}
