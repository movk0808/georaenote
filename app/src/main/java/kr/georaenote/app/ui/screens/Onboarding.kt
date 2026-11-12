package kr.georaenote.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import kr.georaenote.app.data.Content
import kr.georaenote.app.data.ContractType
import kr.georaenote.app.ui.components.Dots
import kr.georaenote.app.ui.components.PrimaryButton
import kr.georaenote.app.ui.components.HeroGraphic
import kr.georaenote.app.ui.components.TypeBadge
import kr.georaenote.app.ui.theme.Brand

/** 첫 실행 안내 4장. 마지막 장의 버튼을 누르면 홈으로 갑니다. */
@Composable
fun OnboardingScreen(onDone: () -> Unit) {
    val pages = Content.onboarding
    val pager = rememberPagerState { pages.size }
    val scope = rememberCoroutineScope()
    Column(Modifier.fillMaxSize().background(Color.White).statusBarsPadding().navigationBarsPadding()) {
        HorizontalPager(pager, Modifier.weight(1f)) { index ->
            Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
                Spacer(Modifier.height(40.dp))
                PhoneMock(index)
                Spacer(Modifier.height(36.dp))
                Text(pages[index].title, fontSize = 23.sp, fontWeight = FontWeight.Bold, color = Brand.Ink)
                Spacer(Modifier.height(12.dp))
                Text(pages[index].body, fontSize = 15.sp, color = Brand.SubInk, textAlign = TextAlign.Center, lineHeight = 23.sp)
            }
        }
        Dots(pages.size, pager.currentPage, Modifier.align(Alignment.CenterHorizontally).padding(bottom = 28.dp))
        val last = pager.currentPage == pages.lastIndex
        PrimaryButton(
            if (last) "지금 시작하기" else "다음",
            Modifier.padding(horizontal = 20.dp, vertical = 12.dp),
        ) {
            if (last) onDone() else scope.launch { pager.animateScrollToPage(pager.currentPage + 1) }
        }
    }
}

/** 안내 카드 위의 휴대폰 화면 미리보기(직접 그린 화면) */
@Composable
private fun PhoneMock(page: Int) {
    Box(
        Modifier
            .width(210.dp)
            .height(300.dp)
            .shadow(18.dp, RoundedCornerShape(34.dp))
            .clip(RoundedCornerShape(34.dp))
            .background(Color(0xFF1E2230))
            .padding(7.dp),
    ) {
        Column(
            Modifier.fillMaxSize().clip(RoundedCornerShape(28.dp)).background(Brand.Background).padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Box(Modifier.align(Alignment.CenterHorizontally).width(60.dp).height(14.dp).clip(RoundedCornerShape(7.dp)).background(Color(0xFF1E2230)))
            when (page) {
                0 -> {
                    HeroGraphic(Modifier.fillMaxWidth().height(90.dp))
                    MockRow(ContractType.RENT, "매장 월세")
                    MockRow(ContractType.FOOD, "식자재 대금")
                    MockRow(ContractType.GOODS, "포장재 대금")
                }
                1 -> {
                    Text("계약 유형을\n선택해 주세요.", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Brand.Ink, lineHeight = 18.sp)
                    listOf(
                        listOf(ContractType.GOODS, ContractType.FOOD, ContractType.BEVERAGE),
                        listOf(ContractType.RENT, ContractType.DEPOSIT, ContractType.INTERIOR),
                    ).forEach { row ->
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            row.forEach { t ->
                                Column(
                                    Modifier.weight(1f).clip(RoundedCornerShape(10.dp)).background(Color.White).padding(vertical = 8.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                ) {
                                    TypeBadge(t, 24.dp)
                                    Text(t.label, fontSize = 8.sp, color = Brand.SubInk)
                                }
                            }
                        }
                    }
                    Spacer(Modifier.weight(1f))
                    MockButton("다음")
                }
                2 -> {
                    Text("송금하기", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Brand.Ink)
                    MockLine("송금액", "1,000,000원")
                    MockLine("송금 방식", "바로송금")
                    MockLine("이용료 4%", "40,000원")
                    MockLine("카드 청구액", "1,040,000원")
                    Spacer(Modifier.weight(1f))
                    MockButton("결제하기")
                }
                else -> {
                    Spacer(Modifier.height(18.dp))
                    Icon(Icons.Filled.CheckCircle, null, tint = Brand.Primary, modifier = Modifier.size(54.dp).align(Alignment.CenterHorizontally))
                    Text("송금 완료!", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Brand.Ink, modifier = Modifier.align(Alignment.CenterHorizontally))
                    MockLine("입금액", "1,000,000원")
                    MockLine("받는 분", "샘플상사")
                    MockLine("적립", "800M")
                }
            }
        }
    }
}

@Composable
private fun MockRow(type: ContractType, title: String) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(Color.White).padding(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        TypeBadge(type, 22.dp)
        Spacer(Modifier.width(6.dp))
        Text(title, Modifier.weight(1f), fontSize = 10.sp, fontWeight = FontWeight.SemiBold, color = Brand.Ink)
        Text("송금", fontSize = 8.sp, color = Brand.SubInk, modifier = Modifier.clip(RoundedCornerShape(6.dp)).background(Brand.Background).padding(horizontal = 6.dp, vertical = 2.dp))
    }
}

@Composable
private fun MockLine(k: String, v: String) {
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).background(Color.White).padding(horizontal = 8.dp, vertical = 6.dp)) {
        Text(k, Modifier.weight(1f), fontSize = 9.sp, color = Brand.SubInk)
        Text(v, fontSize = 9.sp, fontWeight = FontWeight.Bold, color = Brand.Ink)
    }
}

@Composable
private fun MockButton(text: String) {
    Box(
        Modifier.fillMaxWidth().height(26.dp).clip(RoundedCornerShape(8.dp)).background(Brand.fill),
        contentAlignment = Alignment.Center,
    ) { Text(text, fontSize = 10.sp, color = Color.White, fontWeight = FontWeight.Bold) }
}
