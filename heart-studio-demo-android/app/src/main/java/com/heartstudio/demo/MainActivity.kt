package com.heartstudio.demo

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val Rose = Color(0xFFE88EAF)
private val Deep = Color(0xFF8D526C)
private val Ink = Color(0xFF59434F)
private val Canvas = Color(0xFFFFF7FA)
private val Pale = Color(0xFFFFE8F0)

class MainActivity : ComponentActivity() {
 override fun onCreate(savedInstanceState: Bundle?) {
  super.onCreate(savedInstanceState)
  setContent { MaterialTheme(colorScheme = lightColorScheme(primary=Rose, background=Canvas, surface=Color.White)) { HeartDemo() } }
 }
}

@Composable
private fun HeartDemo() {
 var page by remember { mutableStateOf("home") }
 var title by remember { mutableStateOf("把今天的心意，留给你") }
 var level by remember { mutableIntStateOf(0) }
 var completed by remember { mutableStateOf(setOf<Int>()) }
 var answer by remember { mutableStateOf("") }
 var dialog by remember { mutableStateOf(false) }
 val levels = listOf("第一份心意", "关于我们的小问题", "给未来的一句话")
 Scaffold(containerColor=Canvas, bottomBar={
  NavigationBar(containerColor=Color.White) {
   NavigationBarItem(page=="home",{page="home"},{Icon(Icons.Rounded.Favorite,null)},label={Text("首页")})
   NavigationBarItem(page=="creator",{page="creator"},{Icon(Icons.Rounded.EditNote,null)},label={Text("创建")})
   NavigationBarItem(page=="journey",{page="journey"},{Icon(Icons.Rounded.AutoAwesome,null)},label={Text("去体验")})
   NavigationBarItem(page=="inbox",{page="inbox"},{Icon(Icons.Rounded.Mail,null)},label={Text("回应")})
  }
 }) { pad ->
  AnimatedContent(page, modifier=Modifier.padding(pad), transitionSpec={fadeIn() togetherWith fadeOut()}, label="page") { p ->
   when(p) {
    "home" -> Home({page="creator"},{page="journey"})
    "creator" -> Creator(title,{title=it},levels,{page="journey"},{dialog=true})
    "journey" -> Journey(levels,level,completed,answer,{answer=it},{idx ->
      if(idx==0 || completed.contains(idx-1)) level=idx else dialog=true
    },{completed=completed+level; if(level<2) level++ else page="inbox"},{dialog=true})
    else -> Inbox(answer,completed.size)
   }
  }
 }
 if(dialog) AlertDialog(onDismissRequest={dialog=false},containerColor=Color.White,title={Text("演示体验",color=Deep,fontWeight=FontWeight.Bold)},text={Text("这是本地离线演示版。分享、真实支付、账号和跨设备同步尚未连接线上服务。演示不会产生真实交易。",color=Ink)},confirmButton={TextButton(onClick={dialog=false}){Text("知道了")}})
}

@Composable
private fun Home(create:()->Unit, tryIt:()->Unit) {
 LazyColumn(Modifier.fillMaxSize().padding(horizontal=22.dp)) {
  item { Spacer(Modifier.height(30.dp)); Text("HEART STUDIO",color=Rose,fontSize=12.sp,fontWeight=FontWeight.Bold,letterSpacing=3.sp); Spacer(Modifier.height(22.dp)); Text("让喜欢的人，\n一关一关走进你的心意。",color=Ink,fontSize=30.sp,lineHeight=40.sp,fontWeight=FontWeight.Bold); Spacer(Modifier.height(12.dp)); Text("把普通的一天，变成只属于你们的互动小旅程。",color=Deep,fontSize=14.sp) }
  item { Spacer(Modifier.height(26.dp)); Box(Modifier.fillMaxWidth().height(210.dp).shadow(8.dp,RoundedCornerShape(30.dp)).background(Pale,RoundedCornerShape(30.dp)).clickable{tryIt()},contentAlignment=Alignment.Center) { Column(horizontalAlignment=Alignment.CenterHorizontally){Text("♡",color=Rose,fontSize=66.sp);Text("A LITTLE JOURNEY FOR US",color=Deep,fontSize=10.sp,letterSpacing=2.sp);Text("心意闯关 · 从这一刻开始",color=Ink,fontWeight=FontWeight.SemiBold,fontSize=17.sp)} } }
  item { Spacer(Modifier.height(25.dp)); Text("你可以这样使用",color=Ink,fontSize=18.sp,fontWeight=FontWeight.Bold) }
  item { Feature("01","创建专属关卡","写下问题、心意和小任务，设计你们的互动。") }
  item { Feature("02","逐关解锁体验","每一关独立设置价格，也可以设置为免费。") }
  item { Feature("03","收下对方回应","查看对方的回答，让互动有来有回。") }
  item { Spacer(Modifier.height(18.dp)); Button(onClick=create,modifier=Modifier.fillMaxWidth().height(54.dp),shape=RoundedCornerShape(18.dp)){Text("创建我们的心意旅程",fontWeight=FontWeight.Bold)} }
  item { Spacer(Modifier.height(10.dp)); OutlinedButton(onClick=tryIt,modifier=Modifier.fillMaxWidth().height(52.dp),shape=RoundedCornerShape(18.dp)){Text("先体验一段闯关旅程")}; Spacer(Modifier.height(25.dp)) }
 }
}
@Composable
private fun Feature(n:String,t:String,d:String) {
 Row(Modifier.fillMaxWidth().padding(top=12.dp).background(Color.White,RoundedCornerShape(18.dp)).padding(16.dp),verticalAlignment=Alignment.CenterVertically) {
  Box(Modifier.size(42.dp).background(Pale,CircleShape),contentAlignment=Alignment.Center){Text(n,color=Rose,fontWeight=FontWeight.Bold)}
  Spacer(Modifier.width(13.dp)); Column {Text(t,color=Ink,fontWeight=FontWeight.Bold);Text(d,color=Deep,fontSize=12.sp)}
 }
}
@Composable
private fun Creator(title:String,onTitle:(String)->Unit,levels:List<String>,preview:()->Unit,share:()->Unit) {
 LazyColumn(Modifier.fillMaxSize().padding(20.dp)) {
  item { Text("创建专属体验",color=Ink,fontSize=25.sp,fontWeight=FontWeight.Bold);Text("把想说的话，设计成一场小小的闯关。",color=Deep,fontSize=13.sp);Spacer(Modifier.height(20.dp));Text("体验标题",color=Ink,fontWeight=FontWeight.SemiBold);OutlinedTextField(title,onTitle,modifier=Modifier.fillMaxWidth(),shape=RoundedCornerShape(16.dp),singleLine=true) }
  item { Spacer(Modifier.height(20.dp));Text("关卡设置",color=Ink,fontWeight=FontWeight.Bold,fontSize=18.sp);Text("每关可以独立设置价格；此处为演示内容。",color=Deep,fontSize=12.sp) }
  items(levels.size) { i -> Row(Modifier.fillMaxWidth().padding(top=10.dp).background(Color.White,RoundedCornerShape(18.dp)).padding(15.dp),verticalAlignment=Alignment.CenterVertically) {
   Box(Modifier.size(38.dp).background(Pale,CircleShape),contentAlignment=Alignment.Center){Text((i+1).toString(),color=Rose,fontWeight=FontWeight.Bold)}
   Spacer(Modifier.width(12.dp));Column(Modifier.weight(1f)){Text(levels[i],color=Ink,fontWeight=FontWeight.SemiBold);Text(if(i==0)"免费体验" else "¥ 6.00 · 单关解锁",color=Deep,fontSize=12.sp)}
   Icon(Icons.Rounded.ChevronRight,null,tint=Rose)
  } }
  item { Spacer(Modifier.height(22.dp));Button(onClick=preview,modifier=Modifier.fillMaxWidth().height(52.dp),shape=RoundedCornerShape(17.dp)){Text("预览伴侣体验流程")};Spacer(Modifier.height(10.dp));OutlinedButton(onClick=share,modifier=Modifier.fillMaxWidth().height(50.dp),shape=RoundedCornerShape(17.dp)){Icon(Icons.Rounded.Share,null);Spacer(Modifier.width(8.dp));Text("生成分享链接（演示）")};Spacer(Modifier.height(25.dp)) }
 }
}
@Composable
private fun Journey(levels:List<String>,current:Int,done:Set<Int>,answer:String,onAnswer:(String)->Unit,onSelect:(Int)->Unit,onComplete:()->Unit,onInfo:()->Unit) {
 LazyColumn(Modifier.fillMaxSize().padding(20.dp)) {
  item { Text("A LITTLE JOURNEY",color=Rose,fontSize=11.sp,letterSpacing=2.sp,fontWeight=FontWeight.Bold);Spacer(Modifier.height(10.dp));Text("慢慢来，\n每一关都是一份心意。",color=Ink,fontSize=27.sp,fontWeight=FontWeight.Bold);Spacer(Modifier.height(18.dp)) }
  items(levels.size) { i ->
   val open=i==0 || done.contains(i-1)
   Row(Modifier.fillMaxWidth().padding(bottom=10.dp).background(if(i==current)Pale else Color.White,RoundedCornerShape(18.dp)).clickable{if(open)onSelect(i)else onInfo()}.padding(15.dp),verticalAlignment=Alignment.CenterVertically) {
    Box(Modifier.size(40.dp).background(if(done.contains(i))Color(0xFFE3F5E9) else Pale,CircleShape),contentAlignment=Alignment.Center){Icon(if(done.contains(i))Icons.Rounded.Check else if(open)Icons.Rounded.FavoriteBorder else Icons.Rounded.Lock,null,tint=Rose)}
    Spacer(Modifier.width(12.dp));Column(Modifier.weight(1f)){Text("第 "+(i+1)+" 关 · "+levels[i],color=Ink,fontWeight=FontWeight.SemiBold);Text(if(i==0)"免费" else "¥ 6.00 · 演示解锁",color=Deep,fontSize=12.sp)}
    if(i==current) Text("正在体验",color=Rose,fontSize=11.sp)
   }
  }
  item { Spacer(Modifier.height(12.dp));Text("这一关想对你说",color=Ink,fontWeight=FontWeight.Bold);Text("如果今天可以为我们留下一件小事，你最想记住什么？",color=Deep,fontSize=14.sp);Spacer(Modifier.height(10.dp));OutlinedTextField(answer,onAnswer,modifier=Modifier.fillMaxWidth().heightIn(min=110.dp),shape=RoundedCornerShape(17.dp),placeholder={Text("写下你的回答…")}) }
  item { Spacer(Modifier.height(14.dp));Button(onClick=onComplete,modifier=Modifier.fillMaxWidth().height(52.dp),shape=RoundedCornerShape(17.dp)){Text(if(current==levels.lastIndex)"完成这段旅程" else "提交回答 · 解锁下一关")};Spacer(Modifier.height(10.dp));TextButton(onClick=onInfo,modifier=Modifier.fillMaxWidth()){Text("关于解锁与付款说明",color=Deep)};Spacer(Modifier.height(25.dp)) }
 }
}
@Composable
private fun Inbox(answer:String,count:Int) {
 Column(Modifier.fillMaxSize().padding(22.dp)) {
  Text("心意回应",color=Ink,fontSize=26.sp,fontWeight=FontWeight.Bold);Text("每一份认真回答，都值得被好好收下。",color=Deep,fontSize=13.sp);Spacer(Modifier.height(22.dp))
  Row(Modifier.fillMaxWidth().background(Color.White,RoundedCornerShape(20.dp)).padding(18.dp),verticalAlignment=Alignment.CenterVertically){Icon(Icons.Rounded.Favorite,null,tint=Rose,modifier=Modifier.size(34.dp));Spacer(Modifier.width(12.dp));Column{Text("已完成关卡",color=Deep,fontSize=12.sp);Text(count.toString()+" / 3",color=Ink,fontSize=23.sp,fontWeight=FontWeight.Bold)}}
  Spacer(Modifier.height(14.dp));Column(Modifier.fillMaxWidth().background(Color.White,RoundedCornerShape(20.dp)).padding(18.dp)){Text("对方的回答",color=Ink,fontWeight=FontWeight.Bold);Spacer(Modifier.height(8.dp));Text(if(answer.isBlank())"完成体验并提交回答后，这里会显示回应。" else answer,color=Deep,fontSize=14.sp)}
  Spacer(Modifier.height(14.dp));Text("本地演示数据仅保存在当前运行状态，退出后不保证保留。",color=Deep,fontSize=11.sp)
 }
}
