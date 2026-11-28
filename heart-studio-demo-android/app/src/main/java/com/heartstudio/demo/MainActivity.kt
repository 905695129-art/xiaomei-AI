package com.heartstudio.demo

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties

private data class StudioPalette(val rose: Color, val deep: Color, val ink: Color, val canvas: Color, val pale: Color, val line: Color)
private val paletteState = androidx.compose.runtime.mutableStateOf(
    StudioPalette(Color(0xFFC47D91), Color(0xFF956B79), Color(0xFF59434F), Color(0xFFFFF7FA), Color(0xFFFFE8F0), Color(0xFFF2E1E6))
)
private val Rose get() = paletteState.value.rose
private val Deep get() = paletteState.value.deep
private val Ink get() = paletteState.value.ink
private val Canvas get() = paletteState.value.canvas
private val Pale get() = paletteState.value.pale
private val CardLine get() = paletteState.value.line

private val CherryPalette = StudioPalette(Color(0xFFD982A8), Color(0xFFAD6687), Color(0xFF654457), Color(0xFFFFF5F9), Color(0xFFFFE2EF), Color(0xFFF3D7E3))
private val CreamPalette = StudioPalette(Color(0xFFB99B78), Color(0xFF92785E), Color(0xFF554A3D), Color(0xFFFFFBF3), Color(0xFFF5EBDD), Color(0xFFEDE3D4))
private val MistPalette = StudioPalette(Color(0xFF9B70B5), Color(0xFF79568F), Color(0xFF51405F), Color(0xFFF8F5FC), Color(0xFFEDE4F7), Color(0xFFE2D8EF))

private data class LevelData(
    val title: String,
    val teaser: String,
    val price: String,
    val content: String
)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(colorScheme = lightColorScheme(primary=Rose, background=Canvas, surface=Color.White)) {
                HeartStudioApp()
            }
        }
    }
}

@Composable
private fun HeartStudioApp() {
    var page by remember { mutableStateOf("home") }
    var title by remember { mutableStateOf("把今天的心意，留给你") }
    var description by remember { mutableStateOf("把普通的一天，变成只属于你们的互动小旅程。") }
    var coverTheme by remember { mutableStateOf("甜粉花雾") }\n    var ambience by remember { mutableStateOf("樱花粉") }
    var coverChoice by remember { mutableStateOf("主题封面") }
    var qrReady by remember { mutableStateOf(false) }
    var levels by remember { mutableStateOf(listOf(
        LevelData("第一份心意","先从一个小问题开始","免费","如果今天可以为我们留下一件小事，你最想记住什么？"),
        LevelData("关于我们的小问题","回答一个只有我们懂的问题","6.00","说说你第一次意识到自己喜欢我的瞬间。"),
        LevelData("给未来的一句话","把想对未来说的话藏在这里","12.00","如果一年后的我们读到这句话，你希望它写着什么？")
    )) }
    var completed by remember { mutableStateOf(setOf<Int>()) }
    var answer by remember { mutableStateOf("") }
    var responses by remember { mutableStateOf(listOf<String>()) }
    var modal by remember { mutableStateOf("") }
    var selectedIndex by remember { mutableIntStateOf(0) }
    var draftLevel by remember { mutableStateOf(levels.first()) }
    var draftTitle by remember { mutableStateOf(title) }
    var draftDescription by remember { mutableStateOf(description) }
    var showPublish by remember { mutableStateOf(false) }
    val context = LocalContext.current

    BackHandler(enabled = modal.isNotBlank()) { modal = "" }

    Scaffold(
        containerColor=Canvas,
        bottomBar={
            NavigationBar(containerColor=Color.White, tonalElevation=8.dp) {
                NavigationBarItem(page=="home",{page="home"},{Icon(Icons.Rounded.Favorite,null)},label={Text("首页")})
                NavigationBarItem(page=="creator",{page="creator"},{Icon(Icons.Rounded.EditNote,null)},label={Text("创建")})
                NavigationBarItem(page=="journey",{page="journey"},{Icon(Icons.Rounded.AutoAwesome,null)},label={Text("去体验")})
                NavigationBarItem(page=="inbox",{page="inbox"},{Icon(Icons.Rounded.Mail,null)},label={Text("回应")})
            }
        }
    ) { pad ->
        AnimatedContent(page, modifier=Modifier.padding(pad), transitionSpec={fadeIn() togetherWith fadeOut()}, label="main-pages") { p ->
            when(p) {
                "home" -> Home(
                    title=title,
                    create={page="creator"},
                    tryIt={page="journey"},
                    openFeature={modal=it}
                )
                "creator" -> Creator(
                    title=title, description=description, levels=levels,
                    coverChoice=coverChoice, coverTheme=coverTheme, qrReady=qrReady,
                    onEditInfo={draftTitle=title;draftDescription=description;modal="basic_info"},
                    onCover={modal="cover"}, onQr={modal="qr"},
                    onLevel={i->selectedIndex=i;draftLevel=levels[i];modal="edit_level"},
                    onAdd={selectedIndex=levels.size;draftLevel=LevelData("新的一关","","6.00","");modal="edit_level"},
                    onPreview={page="journey"}, onShare={modal="share"},
                    onPublish={showPublish=true}
                )
                "journey" -> Journey(
                    title=title, levels=levels, done=completed, answer=answer,
                    onAnswer={answer=it},
                    onSelect={i->selectedIndex=i;modal=if(i==0||completed.contains(i-1))"level_detail" else "locked"},
                    onSubmit={
                        completed=completed+selectedIndex.coerceIn(0,levels.lastIndex)
                        if(answer.isNotBlank()) responses=listOf(answer)+responses
                        answer=""
                        modal="submitted"
                    },
                    onExplain={modal="payment_info"},
                    onSelectCurrent={selectedIndex=it;modal="level_detail"}
                )
                else -> Inbox(responses,completed.size,onOpen={modal="response_detail"})
            }
        }
    }

    if(modal.isNotBlank()) {
        StudioDialog(onDismiss={modal=""}) {
            when(modal) {
                "basic_info" -> {
                    DialogHeader("编辑体验信息","修改标题和介绍，保存后同步到你的体验预览。")
                    FieldLabel("体验标题")
                    OutlinedTextField(draftTitle,{draftTitle=it},modifier=Modifier.fillMaxWidth(),singleLine=true,shape=RoundedCornerShape(14.dp))
                    Spacer(Modifier.height(12.dp));FieldLabel("体验介绍")
                    OutlinedTextField(draftDescription,{draftDescription=it},modifier=Modifier.fillMaxWidth(),minLines=3,shape=RoundedCornerShape(14.dp))
                    DialogButtons("保存修改",{title=draftTitle.ifBlank{"一份专属心意"};description=draftDescription;modal=""})
                }
                "cover" -> {
                    DialogHeader("选择专属封面","让打开链接的第一眼，就有你们的感觉。")
                    listOf("甜粉花雾","奶油暖光","梦幻紫雾","星夜心愿","上传自己的照片").forEachIndexed { i,s ->
                        ChoiceRow(s,if(s==coverTheme||s==coverChoice) "当前使用" else listOf("柔和粉色渐变","温暖奶油色调","轻盈紫色氛围","深色星夜氛围","从手机相册选择图片")[i],s==coverTheme||s==coverChoice) {
                            if(i==4) modal="upload_cover" else {coverTheme=s;coverChoice="主题封面"}
                        }
                    }
                    DialogButtons("完成",{modal=""},secondary="关闭",onSecondary={modal=""})
                }
                "upload_cover" -> {
                    DialogHeader("上传封面照片","正式版会从手机相册选择并安全上传。当前安装包为本地交互演示。")
                    InfoCard("照片授权","只使用你主动选择并拥有使用权的照片，不会抓取其他人的社交平台图片。")
                    DialogButtons("我知道了",{modal="cover"})
                }
                "qr" -> {
                    DialogHeader("收款码设置","可展示你主动上传的收款码，由双方自行完成转账。")
                    InfoCard(if(qrReady)"已设置演示收款码" else "尚未添加收款码","本地演示仅展示设置流程，不会收款，也不会核验到账。")
                    DialogButtons(if(qrReady)"更换收款码（演示）" else "选择收款码（演示）",{qrReady=true;modal="qr_saved"},secondary="稍后设置",onSecondary={modal=""})
                }
                "qr_saved" -> {
                    DialogHeader("收款码设置已记录","当前仅为本机演示状态，尚未上传服务器。")
                    DialogButtons("完成",{modal=""})
                }
                "edit_level" -> {
                    DialogHeader(if(selectedIndex<levels.size)"编辑第 ${selectedIndex+1} 关" else "添加新关卡","每一关都可以单独编辑内容和价格。")
                    FieldLabel("关卡名称")
                    OutlinedTextField(draftLevel.title,{draftLevel=draftLevel.copy(title=it)},modifier=Modifier.fillMaxWidth(),singleLine=true,shape=RoundedCornerShape(14.dp))
                    Spacer(Modifier.height(10.dp));FieldLabel("解锁前提示")
                    OutlinedTextField(draftLevel.teaser,{draftLevel=draftLevel.copy(teaser=it)},modifier=Modifier.fillMaxWidth(),minLines=2,shape=RoundedCornerShape(14.dp))
                    Spacer(Modifier.height(10.dp));FieldLabel("这一关的内容")
                    OutlinedTextField(draftLevel.content,{draftLevel=draftLevel.copy(content=it)},modifier=Modifier.fillMaxWidth(),minLines=3,shape=RoundedCornerShape(14.dp))
                    Spacer(Modifier.height(10.dp));FieldLabel("单关价格（输入 0 即免费）")
                    OutlinedTextField(draftLevel.price,{draftLevel=draftLevel.copy(price=it.filter{c->c.isDigit()||c=='.'})},modifier=Modifier.fillMaxWidth(),singleLine=true,shape=RoundedCornerShape(14.dp),leadingIcon={Text("¥",color=Rose)})
                    DialogButtons("保存这一关",{
                        val safe=draftLevel.copy(title=draftLevel.title.ifBlank{"未命名关卡"},price=if(draftLevel.price.isBlank())"0" else draftLevel.price)
                        levels=if(selectedIndex<levels.size) levels.toMutableList().also{it[selectedIndex]=safe} else levels+safe
                        modal=""
                    },secondary="取消",onSecondary={modal=""})
                }
                "share" -> {
                    DialogHeader("分享给心里那个人","把专属链接分享给对方，邀请 TA 一关一关体验。")
                    InfoCard("分享内容预览","$title\n每打开一扇小门，都有一份认真准备的惊喜。\n\n当前为离线演示：尚未生成真实线上分享链接。")
                    DialogButtons("调用系统分享",{ 
                        val send=Intent(Intent.ACTION_SEND).apply{type="text/plain";putExtra(Intent.EXTRA_TEXT,"$title — Heart Studio（本地演示，暂无线上链接）")}
                        context.startActivity(Intent.createChooser(send,"分享这份心意"));modal=""
                    },secondary="知道了",onSecondary={modal=""})
                }
                "level_detail" -> {
                    val item=levels.getOrNull(selectedIndex)
                    DialogHeader(item?.title ?: "这一份心意","第 ${selectedIndex+1} 关 · ${item?.let{if(it.price=="0"||it.price=="免费")"免费" else "¥${it.price}"}?:""}")
                    InfoCard("这一关的内容",item?.content?.ifBlank{"创建者还没有填写内容。"}?:"")
                    FieldLabel("留下你的回答")
                    OutlinedTextField(answer,{answer=it},modifier=Modifier.fillMaxWidth(),minLines=3,shape=RoundedCornerShape(14.dp),placeholder={Text("把你的想法写在这里…")})
                    DialogButtons("提交回答并继续",{
                        completed=completed+selectedIndex
                        if(answer.isNotBlank())responses=listOf(answer)+responses
                        answer=""
                        modal="submitted"
                    },secondary="稍后再说",onSecondary={modal=""})
                }
                "locked" -> {
                    DialogHeader("再走一步，就能打开啦","每一关按顺序解锁，先完成前面的心意。")
                    InfoCard("解锁规则","需要先完成第 ${selectedIndex} 关。逐关解锁，不会默认一次性解锁全部内容。")
                    DialogButtons("我知道了",{modal=""})
                }
                "payment_info" -> {
                    DialogHeader("关于逐关解锁","每一关独立设置价格，也可以免费开放。")
                    InfoCard("支付状态说明","当前演示没有接入微信支付或支付宝商户支付。静态收款码无法自动核验到账；真实支付开通前，不会创建真实订单或声称付款成功。")
                    DialogButtons("明白了",{modal=""})
                }
                "submitted" -> {
                    DialogHeader("这份心意，已经收到了 ♡","回答已加入本地回应示例。")
                    InfoCard("接下来","可以继续下一关，也可以去「回应」版块查看刚才留下的内容。")
                    DialogButtons("去看回应",{page="inbox";modal=""},secondary="继续体验",onSecondary={page="journey";modal=""})
                }
                "response_detail" -> {
                    DialogHeader("回应收件箱","这里集中展示体验者提交的回答。")
                    if(responses.isEmpty()) InfoCard("还没有新回应","完成体验并提交回答后，这里就会出现内容。")
                    else responses.forEachIndexed{i,s->InfoCard("第 ${i+1} 份回应",s)}
                    DialogButtons("完成",{modal=""})
                }
            }
        }
    }

    if(showPublish) {
        StudioDialog(onDismiss={showPublish=false}) {
            DialogHeader("发布前检查","先确认体验内容，再把它分享给对方。")
            InfoCard("体验标题",title)
            InfoCard("关卡数量","共 ${levels.size} 关 · 免费和付费关卡可混合设置")
            InfoCard("上线状态","当前安装包是本地交互演示。正式发布、云端保存、真实链接与支付服务仍需线上环境配置。")
            DialogButtons("完成检查",{showPublish=false;modal="share"},secondary="返回编辑",onSecondary={showPublish=false})
        }
    }
}

@Composable
private fun Home(title:String,create:()->Unit,tryIt:()->Unit,openFeature:(String)->Unit) {
    LazyColumn(Modifier.fillMaxSize().padding(horizontal=22.dp)) {
        item {
            Spacer(Modifier.height(28.dp))
            Text("HEART STUDIO",color=Rose,fontSize=11.sp,fontWeight=FontWeight.Bold,letterSpacing=3.sp)
            Spacer(Modifier.height(18.dp))
            Text("让喜欢的人，\n一关一关走进你的心意。",color=Ink,fontSize=29.sp,lineHeight=39.sp,fontWeight=FontWeight.Bold)
            Spacer(Modifier.height(10.dp));Text("把普通的一天，变成只属于你们的互动小旅程。",color=Deep,fontSize=13.sp)
            Spacer(Modifier.height(22.dp))
            Box(Modifier.fillMaxWidth().height(195.dp).shadow(10.dp,RoundedCornerShape(28.dp)).background(Pale,RoundedCornerShape(28.dp)).clickable{tryIt()},contentAlignment=Alignment.Center) {
                Column(horizontalAlignment=Alignment.CenterHorizontally) {
                    Text("♡",color=Rose,fontSize=62.sp)
                    Text("A LITTLE JOURNEY FOR US",color=Deep,fontSize=9.sp,letterSpacing=2.sp)
                    Text("心意闯关 · 从这一刻开始",color=Ink,fontWeight=FontWeight.SemiBold,fontSize=16.sp)
                    Text("点击进入体验  →",color=Rose,fontSize=11.sp)
                }
            }
            Spacer(Modifier.height(25.dp));Text("把想法变成真实互动",color=Ink,fontSize=18.sp,fontWeight=FontWeight.Bold)
        }
        item { FeatureCard("01","创建专属关卡","编辑标题、封面、问题、私密内容和每关价格",Icons.Rounded.EditNote){create()} }
        item { FeatureCard("02","页面氛围与主题","樱花粉、奶油白、雾霭紫，一键切换整套界面",Icons.Rounded.Palette){openFeature("theme")} }\n        item { FeatureCard("03","自定义封面与收款码","选择主题、使用自己的照片、设置收款码",Icons.Rounded.Image){openFeature("cover")} }
        item { FeatureCard("04","逐关解锁体验","每关单独定价，免费关卡也可以参与",Icons.Rounded.LockOpen){tryIt()} }
        item { FeatureCard("05","分享给对方","生成专属分享内容，邀请对方参与",Icons.Rounded.Share){openFeature("share")} }
        item { FeatureCard("06","回应收件箱","集中查看对方提交的回答和互动回应",Icons.Rounded.Favorite){openFeature("response_detail")} }
        item { Spacer(Modifier.height(18.dp));Button(onClick=create,modifier=Modifier.fillMaxWidth().height(54.dp),shape=RoundedCornerShape(18.dp)){Text("开始制作专属心意 ♡",fontWeight=FontWeight.Bold)} }
        item { Spacer(Modifier.height(10.dp));OutlinedButton(onClick=tryIt,modifier=Modifier.fillMaxWidth().height(50.dp),shape=RoundedCornerShape(18.dp)){Text("先体验一段闯关旅程")};Spacer(Modifier.height(25.dp)) }
    }
}

@Composable
private fun FeatureCard(n:String,t:String,d:String,icon:androidx.compose.ui.graphics.vector.ImageVector,onClick:()->Unit) {
    Row(Modifier.fillMaxWidth().padding(top=11.dp).shadow(2.dp,RoundedCornerShape(18.dp)).background(Color.White,RoundedCornerShape(18.dp)).clickable{onClick()}.padding(15.dp),verticalAlignment=Alignment.CenterVertically) {
        Box(Modifier.size(42.dp).background(Pale,CircleShape),contentAlignment=Alignment.Center){Icon(icon,null,tint=Rose)}
        Spacer(Modifier.width(13.dp))
        Column(Modifier.weight(1f)){Text(n,color=Rose,fontSize=10.sp,fontWeight=FontWeight.Bold);Text(t,color=Ink,fontWeight=FontWeight.Bold,fontSize=14.sp);Text(d,color=Deep,fontSize=11.sp,lineHeight=16.sp)}
        Icon(Icons.Rounded.ChevronRight,null,tint=Rose)
    }
}

@Composable
private fun Creator(
    title:String,description:String,levels:List<LevelData>,coverChoice:String,coverTheme:String,qrReady:Boolean,
    onEditInfo:()->Unit,onCover:()->Unit,onQr:()->Unit,onLevel:(Int)->Unit,onAdd:()->Unit,
    onPreview:()->Unit,onShare:()->Unit,onPublish:()->Unit
) {
    LazyColumn(Modifier.fillMaxSize().padding(20.dp)) {
        item {
            Text("创作者工作台",color=Ink,fontSize=25.sp,fontWeight=FontWeight.Bold)
            Text("把想说的话，设计成一场小小的闯关。",color=Deep,fontSize=13.sp)
            Spacer(Modifier.height(18.dp))
            SectionCard("体验基础信息", "标题、介绍和封面决定对方打开时看到的第一印象",onEditInfo) {
                Text(title,color=Ink,fontWeight=FontWeight.Bold,fontSize=16.sp)
                Text(description,color=Deep,fontSize=12.sp,maxLines=2)
            }
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement=Arrangement.spacedBy(10.dp)) {
                SmallAction("封面与主题",Icons.Rounded.Image,onCover,Modifier.weight(1f))
                SmallAction("收款码设置",Icons.Rounded.QrCode,onQr,Modifier.weight(1f))
            }
            Spacer(Modifier.height(20.dp));Text("关卡编辑",color=Ink,fontSize=18.sp,fontWeight=FontWeight.Bold)
            Text("点击任意关卡，编辑提示、私密内容与独立价格。",color=Deep,fontSize=11.sp)
        }
        itemsIndexed(levels) { i,l ->
            Row(Modifier.fillMaxWidth().padding(top=10.dp).shadow(1.dp,RoundedCornerShape(17.dp)).background(Color.White,RoundedCornerShape(17.dp)).clickable{onLevel(i)}.padding(14.dp),verticalAlignment=Alignment.CenterVertically) {
                Box(Modifier.size(38.dp).background(Pale,CircleShape),contentAlignment=Alignment.Center){Text("%02d".format(i+1),color=Rose,fontWeight=FontWeight.Bold)}
                Spacer(Modifier.width(12.dp));Column(Modifier.weight(1f)){Text(l.title,color=Ink,fontWeight=FontWeight.SemiBold);Text(l.teaser.ifBlank{"点击编辑这一关的提示和内容"},color=Deep,fontSize=11.sp)}
                Text(if(l.price=="0"||l.price=="免费")"免费" else "¥${l.price}",color=Rose,fontSize=12.sp,fontWeight=FontWeight.Bold)
                Icon(Icons.Rounded.ChevronRight,null,tint=Rose)
            }
        }
        item {
            Spacer(Modifier.height(12.dp));OutlinedButton(onClick=onAdd,modifier=Modifier.fillMaxWidth(),shape=RoundedCornerShape(15.dp)){Icon(Icons.Rounded.Add,null);Text("添加一关")}
            Spacer(Modifier.height(18.dp))
            InfoCard("当前封面", "${coverChoice} · ${coverTheme}")
            InfoCard("收款码",if(qrReady)"已设置（本地演示）" else "尚未设置")
            Button(onClick=onPreview,modifier=Modifier.fillMaxWidth().height(50.dp),shape=RoundedCornerShape(16.dp)){Text("预览伴侣体验流程")}
            Spacer(Modifier.height(9.dp));OutlinedButton(onClick=onShare,modifier=Modifier.fillMaxWidth().height(48.dp),shape=RoundedCornerShape(16.dp)){Icon(Icons.Rounded.Share,null);Spacer(Modifier.width(7.dp));Text("分享给对方")}
            Spacer(Modifier.height(9.dp));TextButton(onClick=onPublish,modifier=Modifier.fillMaxWidth()){Text("发布前检查与设置",color=Rose)}
            Spacer(Modifier.height(25.dp))
        }
    }
}

@Composable
private fun SectionCard(title:String,subtitle:String,onClick:()->Unit,content:@Composable ColumnScope.()->Unit) {
    Column(Modifier.fillMaxWidth().background(Color.White,RoundedCornerShape(18.dp)).clickable{onClick()}.padding(16.dp)) {
        Row(verticalAlignment=Alignment.CenterVertically){Text(title,color=Ink,fontWeight=FontWeight.Bold,modifier=Modifier.weight(1f));Icon(Icons.Rounded.Edit,null,tint=Rose)}
        Spacer(Modifier.height(4.dp));Text(subtitle,color=Deep,fontSize=11.sp);Spacer(Modifier.height(10.dp));content()
    }
}
@Composable
private fun SmallAction(label:String,icon:androidx.compose.ui.graphics.vector.ImageVector,onClick:()->Unit,modifier:Modifier=Modifier) {
    OutlinedButton(onClick=onClick,modifier=modifier.height(47.dp),shape=RoundedCornerShape(14.dp),contentPadding=PaddingValues(horizontal=8.dp)){Icon(icon,null,tint=Rose);Spacer(Modifier.width(5.dp));Text(label,fontSize=11.sp)}
}

@Composable
private fun Journey(title:String,levels:List<LevelData>,done:Set<Int>,answer:String,onAnswer:(String)->Unit,onSelect:(Int)->Unit,onSubmit:()->Unit,onExplain:()->Unit,onSelectCurrent:(Int)->Unit) {
    LazyColumn(Modifier.fillMaxSize().padding(20.dp)) {
        item {
            Text("A LITTLE JOURNEY",color=Rose,fontSize=10.sp,letterSpacing=2.sp,fontWeight=FontWeight.Bold)
            Spacer(Modifier.height(9.dp));Text("慢慢来，\n每一关都是一份心意。",color=Ink,fontSize=27.sp,fontWeight=FontWeight.Bold)
            Text(title,color=Deep,fontSize=12.sp);Spacer(Modifier.height(18.dp))
            Row(Modifier.fillMaxWidth().background(Color.White,RoundedCornerShape(15.dp)).padding(14.dp),verticalAlignment=Alignment.CenterVertically){
                Text("旅程进度",color=Deep,fontSize=12.sp,modifier=Modifier.weight(1f));Text("${done.size} / ${levels.size} 已完成",color=Rose,fontWeight=FontWeight.Bold,fontSize=12.sp)
            }
            Spacer(Modifier.height(15.dp))
        }
        itemsIndexed(levels) { i,l ->
            val open=i==0||done.contains(i-1)
            Row(Modifier.fillMaxWidth().padding(bottom=10.dp).background(if(done.contains(i))Color(0xFFF1F8F2) else if(open)Pale else Color.White,RoundedCornerShape(18.dp)).clickable{onSelect(i)}.padding(15.dp),verticalAlignment=Alignment.CenterVertically) {
                Box(Modifier.size(40.dp).background(Color.White,CircleShape),contentAlignment=Alignment.Center){Icon(if(done.contains(i))Icons.Rounded.CheckCircle else if(open)Icons.Rounded.FavoriteBorder else Icons.Rounded.Lock,null,tint=Rose)}
                Spacer(Modifier.width(12.dp));Column(Modifier.weight(1f)){Text("第 ${i+1} 关 · ${l.title}",color=Ink,fontWeight=FontWeight.SemiBold);Text(l.teaser,color=Deep,fontSize=11.sp)}
                Text(if(done.contains(i))"已完成" else if(!open)"未解锁" else if(l.price=="0"||l.price=="免费")"免费" else "¥${l.price}",color=Rose,fontSize=11.sp,fontWeight=FontWeight.Bold)
                Icon(Icons.Rounded.ChevronRight,null,tint=Rose)
            }
        }
        item {
            Spacer(Modifier.height(10.dp));Text("这一关想对你说",color=Ink,fontWeight=FontWeight.Bold)
            Text("选择一关打开卡片，读完内容后留下你的回答。",color=Deep,fontSize=12.sp)
            Spacer(Modifier.height(12.dp));Button(onClick={onSelectCurrent(0)},modifier=Modifier.fillMaxWidth().height(50.dp),shape=RoundedCornerShape(16.dp)){Text("打开第一关")}
            Spacer(Modifier.height(8.dp));TextButton(onClick=onExplain,modifier=Modifier.fillMaxWidth()){Text("关于逐关解锁与付款说明",color=Deep)}
            Spacer(Modifier.height(25.dp))
        }
    }
}

@Composable
private fun Inbox(responses:List<String>,count:Int,onOpen:()->Unit) {
    LazyColumn(Modifier.fillMaxSize().padding(22.dp)) {
        item {
            Text("心意回应",color=Ink,fontSize=26.sp,fontWeight=FontWeight.Bold)
            Text("每一份认真回答，都值得被好好收下。",color=Deep,fontSize=13.sp)
            Spacer(Modifier.height(20.dp))
            Row(Modifier.fillMaxWidth().background(Color.White,RoundedCornerShape(20.dp)).clickable{onOpen()}.padding(18.dp),verticalAlignment=Alignment.CenterVertically){
                Icon(Icons.Rounded.Favorite,null,tint=Rose,modifier=Modifier.size(34.dp));Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)){Text("已完成关卡",color=Deep,fontSize=12.sp);Text("$count / 3",color=Ink,fontSize=23.sp,fontWeight=FontWeight.Bold)}
                Icon(Icons.Rounded.ChevronRight,null,tint=Rose)
            }
            Spacer(Modifier.height(14.dp));Text("最新回应",color=Ink,fontWeight=FontWeight.Bold,fontSize=17.sp)
        }
        if(responses.isEmpty()) item { InfoCard("还没有新回应","体验者完成关卡并提交回答后，这里会显示回应。点击卡片可查看收件箱。") }
        else itemsIndexed(responses) { i,s ->
            Column(Modifier.fillMaxWidth().padding(top=10.dp).background(Color.White,RoundedCornerShape(17.dp)).clickable{onOpen()}.padding(16.dp)){
                Text("收到一份新的心意 · ${i+1}",color=Rose,fontSize=11.sp,fontWeight=FontWeight.Bold)
                Spacer(Modifier.height(6.dp));Text(s,color=Ink,fontSize=13.sp)
            }
        }
        item { Spacer(Modifier.height(15.dp));Text("本地演示数据保存在当前运行状态，正式云端收件箱尚未连接。",color=Deep,fontSize=11.sp) }
    }
}

@Composable
private fun StudioDialog(onDismiss:()->Unit,content:@Composable ColumnScope.()->Unit) {
    Dialog(onDismissRequest=onDismiss,properties=DialogProperties(usePlatformDefaultWidth=false)) {
        Column(
            Modifier.fillMaxWidth().padding(horizontal=19.dp).shadow(18.dp,RoundedCornerShape(28.dp)).background(Color.White,RoundedCornerShape(28.dp)).padding(22.dp)
        ) {
            Box(Modifier.align(Alignment.End).size(30.dp).background(Canvas,CircleShape).clickable{onDismiss()},contentAlignment=Alignment.Center){Icon(Icons.Rounded.Close,null,tint=Deep,modifier=Modifier.size(17.dp))}
            content()
        }
    }
}
@Composable
private fun DialogHeader(title:String,subtitle:String) {
    Text("♡  HEART STUDIO",color=Rose,fontSize=9.sp,letterSpacing=2.sp,fontWeight=FontWeight.Bold)
    Spacer(Modifier.height(10.dp));Text(title,color=Ink,fontSize=22.sp,fontWeight=FontWeight.Bold,lineHeight=29.sp)
    Spacer(Modifier.height(6.dp));Text(subtitle,color=Deep,fontSize=12.sp,lineHeight=18.sp)
    Spacer(Modifier.height(17.dp))
}
@Composable
private fun FieldLabel(text:String){Text(text,color=Ink,fontWeight=FontWeight.SemiBold,fontSize=12.sp);Spacer(Modifier.height(6.dp))}
@Composable
private fun InfoCard(title:String,body:String) {
    Column(Modifier.fillMaxWidth().padding(bottom=9.dp).background(Canvas,RoundedCornerShape(15.dp)).padding(14.dp)) {
        Text(title,color=Rose,fontSize=11.sp,fontWeight=FontWeight.Bold);Spacer(Modifier.height(5.dp));Text(body,color=Ink,fontSize=12.sp,lineHeight=18.sp)
    }
}
@Composable
private fun ChoiceRow(title:String,sub:String,selected:Boolean,onClick:()->Unit) {
    Row(Modifier.fillMaxWidth().padding(bottom=8.dp).background(if(selected)Pale else Canvas,RoundedCornerShape(14.dp)).clickable{onClick()}.padding(13.dp),verticalAlignment=Alignment.CenterVertically) {
        Column(Modifier.weight(1f)){Text(title,color=Ink,fontWeight=FontWeight.SemiBold,fontSize=13.sp);Text(sub,color=Deep,fontSize=10.sp)}
        if(selected)Icon(Icons.Rounded.CheckCircle,null,tint=Rose)
    }
}
@Composable
private fun DialogButtons(primary:String,onPrimary:()->Unit,secondary:String?=null,onSecondary:(()->Unit)?=null) {
    Spacer(Modifier.height(13.dp));Button(onClick=onPrimary,modifier=Modifier.fillMaxWidth().height(48.dp),shape=RoundedCornerShape(16.dp)){Text(primary)}
    if(secondary!=null&&onSecondary!=null) TextButton(onClick=onSecondary,modifier=Modifier.fillMaxWidth()){Text(secondary,color=Deep)}
}
