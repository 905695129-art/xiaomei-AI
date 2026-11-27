package com.xiaomei.ai

import android.app.Activity
import android.app.AlertDialog
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.widget.*

class MainActivity : Activity() {
    private val pink = Color.rgb(211,103,151)
    private val deep = Color.rgb(112,55,83)
    private val ink = Color.rgb(65,49,59)
    private val muted = Color.rgb(145,119,132)
    private val bg = Color.rgb(250,244,248)
    private val prefs by lazy { getSharedPreferences("xiaomei", MODE_PRIVATE) }
    private val handler = Handler(Looper.getMainLooper())
    private lateinit var result: TextView
    private var chatMode: Int = 0

    private val titles = listOf("吸引力课程","展示面工坊","优质男筛选","聊天辅助","关系成长记","约会与复盘")
    private val icons = listOf("🌷","📸","💎","💬","🧸","✨")
    private val desc = listOf("学习自然建立吸引力","优化照片、资料与个人介绍","识别契合点与需要核实的问题","理解对话并生成自然回复","记住对象、话题和交流进度","安全邀约与关系复盘")

    override fun onCreate(state: Bundle?) { super.onCreate(state); routeIntent(intent) }
    override fun onNewIntent(intent: Intent) { super.onNewIntent(intent); setIntent(intent); routeIntent(intent) }
    private fun routeIntent(intent: Intent?) {
        val module = intent?.getIntExtra("xiaomei_module", -1) ?: -1
        if (module in 0..5) { if (module == 3) chatMode = intent?.getIntExtra("xiaomei_chat_mode", 0) ?: 0; open(module) } else home()
    }
    private fun dp(n:Int) = (n*resources.displayMetrics.density).toInt()
    private fun bgd(c:Int,r:Int=18):GradientDrawable = GradientDrawable().apply { setColor(c); cornerRadius=dp(r).toFloat() }
    private fun label(s:String,size:Float=14f,c:Int=ink,b:Boolean=false)=TextView(this).apply {
        text=s; textSize=size; setTextColor(c); if(b)setTypeface(typeface,Typeface.BOLD); setLineSpacing(dp(2).toFloat(),1f)
    }
    private fun button(s:String,action:()->Unit)=Button(this).apply {
        text=s; textSize=14f; isAllCaps=false; setTextColor(Color.WHITE)
        typeface=Typeface.DEFAULT_BOLD; minHeight=dp(54); setPadding(dp(18),dp(12),dp(18),dp(12))
        background=GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT,intArrayOf(0xFFE58AB2.toInt(),0xFFD36A98.toInt())).apply{cornerRadius=dp(17).toFloat()}
        elevation=dp(3).toFloat(); setOnClickListener{action()}
    }
    private fun field(h:String,v:String="",lines:Int=1)=EditText(this).apply {
        hint=h; setText(v); textSize=14f; setTextColor(ink); setHintTextColor(0xFFBDAAB5.toInt())
        setPadding(dp(15),dp(13),dp(15),dp(13))
        background=GradientDrawable().apply{setColor(Color.WHITE);cornerRadius=dp(15).toFloat();setStroke(dp(1),0xFFF0E2E9.toInt())}
        minLines=lines; gravity=if(lines>1) Gravity.TOP else Gravity.CENTER_VERTICAL
    }
    private fun column()=LinearLayout(this).apply {
        orientation=1; setPadding(dp(20),dp(18),dp(20),dp(30))
        background=GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,intArrayOf(0xFFFFF9FC.toInt(),bg,0xFFF7F0F6.toInt()))
    }
    private fun gap(parent:LinearLayout,n:Int=12){ parent.addView(View(this),LinearLayout.LayoutParams(1,dp(n))) }
    private fun show(v:android.view.View){ setContentView(ScrollView(this).apply{isFillViewport=true;addView(v)}) }
    private fun card(parent:LinearLayout,v:View){
        val box=LinearLayout(this).apply{
            orientation=1;setPadding(dp(18),dp(18),dp(18),dp(18))
            background=GradientDrawable().apply{setColor(Color.WHITE);cornerRadius=dp(22).toFloat();setStroke(dp(1),0xFFF1E4EB.toInt())}
            elevation=dp(4).toFloat()
        }
        box.addView(v);parent.addView(box,LinearLayout.LayoutParams(-1,-2).apply{bottomMargin=dp(15)})
    }
    private fun page(title:String,sub:String):LinearLayout{
        val r=column(); val h=LinearLayout(this).apply{orientation=0;gravity=Gravity.CENTER_VERTICAL}
        h.addView(label("‹",34f,deep).apply{setPadding(0,0,dp(14),0);setOnClickListener{home()}})
        val t=LinearLayout(this).apply{orientation=1};t.addView(label(title,22f,deep,true));t.addView(label(sub,12f,muted));h.addView(t);r.addView(h);gap(r,18);return r
    }
    private fun addField(r:LinearLayout,title:String,e:EditText){r.addView(label(title,13f,deep,true));gap(r,5);r.addView(e,LinearLayout.LayoutParams(-1,if(e.minLines>1)dp(105) else dp(50)));gap(r,12)}
    private fun home(){
        val r=column()
        val top=LinearLayout(this).apply{orientation=0;gravity=Gravity.CENTER_VERTICAL}
        val logo=TextView(this).apply{
            text="🐻";textSize=28f;gravity=Gravity.CENTER
            background=GradientDrawable(GradientDrawable.Orientation.TL_BR,intArrayOf(0xFFFFDCEB.toInt(),0xFFEDE4FF.toInt())).apply{cornerRadius=dp(20).toFloat()}
            layoutParams=LinearLayout.LayoutParams(dp(58),dp(58)).apply{rightMargin=dp(13)}
        }
        val brand=LinearLayout(this).apply{orientation=1}
        brand.addView(label("小美 AI",26f,deep,true));gap(brand,3)
        brand.addView(label("GROW WITH GRACE  ·  自信而温柔",10f,muted))
        top.addView(logo);top.addView(brand,LinearLayout.LayoutParams(0,-2,1f))
        top.addView(label("⚙",22f,deep).apply{setPadding(dp(12),dp(12),dp(7),dp(12));setOnClickListener{settings()}})
        r.addView(top);gap(r,20)

        val hero=LinearLayout(this).apply{
            orientation=1;setPadding(dp(22),dp(23),dp(22),dp(21))
            background=GradientDrawable(GradientDrawable.Orientation.TL_BR,intArrayOf(0xFFFFD8E8.toInt(),0xFFFFF0F5.toInt(),0xFFEDE7FF.toInt())).apply{cornerRadius=dp(29).toFloat()}
            elevation=dp(3).toFloat()
        }
        val pill=TextView(this).apply{
            text="  YOUR PERSONAL GROWTH SPACE  ";textSize=9f;letterSpacing=.10f
            setTextColor(0xFF985A78.toInt());setPadding(dp(10),dp(7),dp(10),dp(7));background=bgd(0xBFFFFFFF.toInt(),30)
        }
        hero.addView(pill);gap(hero,16)
        hero.addView(label("把喜欢自己的能力，\n一点点养出来。",26f,deep,true));gap(hero,10)
        hero.addView(label("从认识自己、呈现魅力，到自然交流与关系选择。这里不教套路，只陪你建立真实而舒服的吸引力。",13f,0xFF805F71.toInt()))
        gap(hero,17)
        val chips=LinearLayout(this).apply{orientation=0;gravity=Gravity.CENTER_VERTICAL}
        listOf("自我成长","真实表达","双向关系").forEachIndexed{idx,t->
            val chip=TextView(this).apply{text=t;textSize=10f;setTextColor(deep);setPadding(dp(9),dp(7),dp(9),dp(7));background=bgd(0xBFFFFFFF.toInt(),24)}
            chips.addView(chip,LinearLayout.LayoutParams(-2,-2).apply{if(idx>0)leftMargin=dp(7)})
        }
        hero.addView(chips);r.addView(hero);gap(r,24)

        val section=LinearLayout(this).apply{orientation=0;gravity=Gravity.CENTER_VERTICAL}
        val title=LinearLayout(this).apply{orientation=1}
        title.addView(label("探索你的成长路径",19f,deep,true));gap(title,4)
        title.addView(label("六个模块，陪你走过交友的不同阶段",12f,muted))
        section.addView(title,LinearLayout.LayoutParams(0,-2,1f))
        section.addView(label("01 — 06",10f,pink,true).apply{setPadding(dp(10),dp(7),dp(10),dp(7));background=bgd(0xFFFFE8F0.toInt(),20)})
        r.addView(section);gap(r,14)

        val colors=listOf(0xFFFFF0F5.toInt(),0xFFF1EDFF.toInt(),0xFFFFF5E9.toInt(),0xFFECF7F4.toInt(),0xFFFFF0F2.toInt(),0xFFF0F1FF.toInt())
        val subtitles=listOf("认识自我 · 建立内在价值","照片资料 · 展示真实生活","观察行动 · 识别关系契合","自然开场 · 轻松回应交流","记录感受 · 看见关系变化","约会准备 · 复盘真实体验")
        for(rowIndex in 0..2){
            val row=LinearLayout(this).apply{orientation=0}
            for(col in 0..1){
                val i=rowIndex*2+col
                val tile=LinearLayout(this).apply{
                    orientation=1;setPadding(dp(16),dp(16),dp(14),dp(15))
                    background=GradientDrawable().apply{setColor(Color.WHITE);cornerRadius=dp(23).toFloat();setStroke(dp(1),0xFFF0E4EA.toInt())}
                    elevation=dp(2).toFloat();setOnClickListener{open(i)}
                }
                val icon=TextView(this).apply{
                    text=icons[i];textSize=22f;gravity=Gravity.CENTER;background=bgd(colors[i],16)
                    layoutParams=LinearLayout.LayoutParams(dp(48),dp(48))
                }
                tile.addView(icon);gap(tile,13)
                tile.addView(label(titles[i],15f,deep,true));gap(tile,6)
                tile.addView(label(subtitles[i],11f,muted))
                tile.addView(label("探索模块  →",10f,pink,true).apply{setPadding(0,dp(12),0,0)})
                row.addView(tile,LinearLayout.LayoutParams(0,dp(176),1f).apply{if(col==0)rightMargin=dp(7) else leftMargin=dp(7)})
            }
            r.addView(row);gap(r,12)
        }
        val companion=LinearLayout(this).apply{
            orientation=1;setPadding(dp(19),dp(18),dp(19),dp(18))
            background=GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT,intArrayOf(0xFFFFEAF2.toInt(),0xFFF4EDFF.toInt())).apply{cornerRadius=dp(23).toFloat()}
        }
        companion.addView(label("随身聊天搭档",17f,deep,true));gap(companion,5)
        companion.addView(label("遇到不知道怎么回应的时刻，让小美陪你整理思路。",12f,muted));gap(companion,14)
        companion.addView(button("💗  开始聊天辅助"){open(3)});gap(companion,9)
        companion.addView(button("🐻  开启悬浮小熊"){floating()})
        r.addView(companion);gap(r,16)
        label("真实展示自己  ·  尊重彼此选择  ·  自然建立连接",10f,muted).also{it.gravity=Gravity.CENTER;r.addView(it)}
        show(r)
    }
    private fun open(i:Int){when(i){0->course();1->profile();2->screening();3->chat();4->journal();5->date()}}
    private val lessonTitles = listOf("停止讨好：把注意力放回自己","真实展示：让别人看见你的魅力","温柔而坚定：建立清晰边界","轻松吸引：让交流有来有往","适度留白：保留自己的生活节奏","识别双向奔赴：选择值得的人")
    private val lessonBodies = listOf(
        """【本课目标】
把“我必须让对方喜欢我”慢慢调整为“我也在观察，这段关系是否适合我”。

【核心讲解】
讨好常常不是因为你不够好，而是因为你担心失去连接。于是你把对方的情绪、回复速度和态度放在第一位，自己的安排和感受不断往后退。短期看，这可能换来一点安心；长期却容易让关系失去平衡，也让你越来越听不见自己的需要。
真正稳定的吸引力，不是永远表现得完美，而是你有自己的生活、有判断，也愿意真诚地靠近别人。你可以喜欢一个人，同时不放弃自己。

【生活案例】
对方几个小时没有回复，你反复打开聊天框，取消了原本的运动和朋友聚会。你开始猜测是不是自己说错了话。
可以尝试的新路径：先不急着给沉默下结论，按原计划生活。等有合适的时间，再自然地继续交流。如果这种失联长期反复出现，再通过沟通判断双方节奏是否合适。

【可执行的四步】
1. 识别：我现在是在表达喜欢，还是在用讨好换取确定感？
2. 暂停：先给自己十分钟，不立刻连续追问或道歉。
3. 回到生活：完成一件原本安排好的小事。
4. 观察：看对方是否也愿意主动、稳定地投入。

【练习】
写下三件即使没有恋爱也想认真经营的事；再写下你在亲密关系中不愿牺牲的三项原则。

【温柔提醒】
你不需要靠被谁选择，来证明自己值得被爱。""",
        """【本课目标】
让别人更容易认识真实的你，而不是把自己包装成一个不真实的人。

【核心讲解】
展示面不是炫耀，也不是把生活修饰得毫无瑕疵。它更像一扇清楚、舒服的窗：别人能从你的照片、文字和兴趣里，看见你的生活质感、性格特点和相处期待。
有记忆点的展示通常来自具体细节，而不是空泛标签。“热爱生活”“有趣的灵魂”不如一张你认真做饭、散步看展或完成一项兴趣的真实照片。照片与简介最好彼此一致，让人看到的是同一个你。

【照片组合建议】
1. 清晰自然的头像：光线舒服，面部清楚，避免过度滤镜。
2. 日常生活照：呈现真实的生活状态，不必刻意摆拍。
3. 兴趣场景照：让别人知道你喜欢什么，也更容易找到共同话题。
4. 环境或全身照：帮助别人形成完整、自然的印象。
5. 近期照片优先：避免使用他人照片、旧照冒充近照或过度修图。

【个人简介结构】
一句生活态度 + 两个真实兴趣 + 一项愿意分享的体验 + 对相处方式的期待。
示例：“平时喜欢城市散步和做饭，周末会去看展或找一家新咖啡馆。比起热闹的场面，我更喜欢轻松真诚的交流。希望认识有好奇心、愿意认真沟通的人。”

【练习】
选出三张真实照片，分别写下它们呈现了你哪一面；再写一段不超过80字的简介。删掉任何你其实并不喜欢、只是觉得“这样更受欢迎”的描述。

【检查标准】
真实、清楚、具体、不过度承诺。你的展示面是邀请别人认识你，不是向所有人证明你足够好。""",
        """【本课目标】
学会表达偏好、拒绝和协商，让温柔与边界同时存在。

【核心讲解】
边界不是惩罚对方，也不是让对方猜你的底线。它是对自己负责：我知道什么让我舒服，什么让我不舒服；我愿意说明，也愿意承担选择的结果。
健康的边界包含三部分：说清事实、表达自己的感受或偏好、提出可行的替代方式。表达时不必攻击对方，也不需要把每个“不”解释成一篇论文。

【常见场景与表达】
对方临时要求深夜见面：“今晚太晚了，我更愿意白天见面。如果你方便，我们可以约周末下午。”
对方开让你不舒服的玩笑：“我知道你可能是在开玩笑，但这个话题我不太舒服，我们换一个吧。”
对方要求过快确定关系：“我愿意继续了解你，不过我希望慢一点，让彼此都更确定。”
你暂时不想聊天：“我现在需要处理一点自己的事情，晚些时候再认真回复你。”

【边界的三个层次】
1. 偏好：我更喜欢怎样相处。
2. 请求：我希望我们可以怎样调整。
3. 行动：如果边界持续被忽视，我会怎样保护自己，例如结束当次对话、拒绝见面或退出关系。

【练习】
回想一次你明明不愿意却答应的经历。把原来的回应改写成一句礼貌、明确、不攻击对方的话。再想想：如果对方不接受，你准备如何照顾自己？

【重要提醒】
拒绝不需要获得对方批准。对方也有拒绝你的权利。好的关系不是谁赢了，而是双方都能自在地说出真实想法。""",
        """【本课目标】
从“想一句完美的话”转向“建立自然、有来有往的交流”。

【核心讲解】
聊天不是面试，也不是一场必须拿高分的表演。舒服的交流通常由四个动作组成：观察对方说过的具体内容、分享一点自己的真实经验、提出轻松的问题、认真接住对方的回答。
提问不宜像查户口；分享也不宜一次倾倒太多。把对话当作两个人共同搭建的小桥，给彼此回应和选择的空间。

【四步对话法】
1. 观察：从对方明确提到的兴趣、经历或观点里找一个细节。
2. 分享：补充一点与你有关的真实内容。
3. 轻问：提出一个容易回答、没有压力的问题。
4. 延展：根据对方的回答继续，而不是机械地切换到下一个问题。

【示例】
对方说最近常去书店。你可以说：“我也喜欢在书店慢慢逛，尤其是有独立咖啡区的那种。你更喜欢去找某一本书，还是随便看看？”
对方分享一次旅行。你可以先回应：“听起来那段旅程挺特别的。”再问：“如果以后再去一次，你还会选择同样的路线吗？”

【避免的情况】
不要假装拥有相同经历；不要连续追问隐私；不要把对方的每句话都转成自己的故事；如果对方明显不想继续，就允许对话自然结束。

【练习】
找一个对方公开表达过的具体兴趣，写出三条“观察 + 一点自己的分享 + 一个轻问题”。选最像你平时说话的那一条。

【复盘】
交流结束后，不只问“对方喜不喜欢我”，也问“我有没有表达自己？这段交流让我感觉舒服吗？”""",
        """【本课目标】
理解健康的留白：给彼此空间，而不是故意制造不确定感。

【核心讲解】
留白的价值在于每个人都保有自己的生活节奏。刚认识一个人时，容易把大量注意力集中在聊天上，仿佛随时在线才能维持关系。但长期稳定的连接不应该要求你放弃工作、朋友、兴趣和休息。
真正舒服的节奏，是忙的时候可以说明，想念时可以表达，有空时愿意投入；不靠故意消失、延迟回复或冷热交替来测试对方。

【生活案例】
周末你已经和朋友约好活动，对方临时邀约。你不必取消原计划来证明在意，可以说：“我今天已经有安排啦，不过我也想见你。我们看看下周哪天都方便？”
如果对方回复慢，先看整体交流是否稳定，而不是只凭一次间隔判断关系。

【建立自己的节奏】
1. 保留固定的工作、休息和兴趣时间。
2. 忙碌时简短说明，不必为了秒回而打乱安排。
3. 有期待就诚实表达，不用冷淡来试探。
4. 观察双方是否愿意协调，而不是只有一个人迁就。

【练习】
安排一周的个人时间，至少保留两项不依赖恋爱关系的活动。写下一句你在忙碌时可以自然使用的说明。

【温柔提醒】
留白不是让别人害怕失去你，而是让你不再因为害怕失去别人而弄丢自己。""",
        """【本课目标】
从单次心动走向持续观察，判断一段关系是否值得继续了解。

【核心讲解】
关系是否合适，不应只看对方说了什么，也要看长期行动是否一致。筛选不是给人贴标签，更不是只按收入、外貌或职业排序；它是把自己的期待和现实互动放在一起，看看双方能否建立互相尊重的生活。
可以观察五个维度：主动性、稳定性、尊重、可靠性和生活契合度。每个维度都需要时间和具体行为来验证，不要凭一次热情就下结论。

【五个观察维度】
1. 主动性：是否双方都会发起交流，而不是长期单向维持。
2. 稳定性：说过的话与实际行动是否大体一致。
3. 尊重：是否尊重你的时间、隐私、拒绝和边界。
4. 可靠性：约定能否认真对待，出现变化是否愿意说明。
5. 契合度：对生活方式、金钱观、家庭期待和未来方向是否有可沟通的共识。

【决策参考】
有好感但信息不足：继续轻松了解，不急着承诺。
互动总体积极：可以提出具体、低压力的见面计划。
长期只有一方投入：表达一次真实感受，观察对方是否愿意一起调整。
出现威胁、羞辱、控制、跟踪或金钱索取：优先保护自己，必要时停止联系并寻求可信任的人帮助。

【练习】
回顾最近三次互动，分三栏记录：对方实际做了什么、我的真实感受、仍需核实的信息。只记录事实，不替对方编理由，也不把猜测当结论。

【结束语】
双向奔赴不是每一天都完全对等，而是双方都愿意看见彼此、尊重彼此，并在有分歧时一起寻找办法。你也有选择的权利。"""
    )
    private fun course(){
        val done=prefs.getStringSet("course_done",emptySet())?:emptySet()
        val r=page("🌷 吸引力成长","像一本温柔的成长手册，陪你慢慢练习")
        val hero=LinearLayout(this).apply{
            orientation=1;setPadding(dp(20),dp(20),dp(20),dp(20))
            background=GradientDrawable(GradientDrawable.Orientation.TL_BR,intArrayOf(0xFFFFDDEB.toInt(),0xFFFFF2F6.toInt(),0xFFEDE8FF.toInt())).apply{cornerRadius=dp(25).toFloat()}
        }
        hero.addView(label("今天，也给自己一点温柔。",20f,deep,true));gap(hero,7)
        hero.addView(label("吸引力不是讨好谁，而是更了解自己、自在表达，也有能力选择适合自己的关系。",13f,0xFF805F71.toInt()))
        gap(hero,15)
        hero.addView(label("我的成长进度",12f,deep,true));gap(hero,6)
        val progress=ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal).apply{
            max=6;progress=done.size.coerceAtMost(6);progressTintList=android.content.res.ColorStateList.valueOf(0xFFD8759F.toInt())
            progressBackgroundTintList=android.content.res.ColorStateList.valueOf(0xFFFFF9FC.toInt())
        }
        hero.addView(progress,LinearLayout.LayoutParams(-1,dp(7)));gap(hero,7)
        hero.addView(label("${done.size.coerceAtMost(6)} / 6 课已完成 · 不用赶进度，按自己的节奏来",11f,muted))
        r.addView(hero);gap(r,20)

        val daily=LinearLayout(this).apply{orientation=1;setPadding(dp(17),dp(16),dp(17),dp(16));background=bgd(Color.WHITE,20);elevation=dp(2).toFloat()}
        daily.addView(label("今日成长灵感  ·  01",10f,pink,true));gap(daily,7)
        daily.addView(label("你可以主动表达喜欢，也可以认真观察对方是否适合你。",16f,deep,true));gap(daily,6)
        daily.addView(label("今天的小练习：做一件原本就想为自己做的事。完成后，记下那一刻的感受。",12f,muted))
        r.addView(daily);gap(r,20)

        r.addView(label("循序渐进 · 6 个成长单元",18f,deep,true));gap(r,5)
        r.addView(label("每一课都有目标、生活案例、表达方法和练习。",12f,muted));gap(r,12)
        val subtitles=listOf("找回自我价值与生活重心","真实照片、简介与个人表达","偏好表达、拒绝与协商","观察、分享、提问与倾听","保留自己的生活节奏","观察行动与双向契合")
        val palettes=listOf(0xFFFFEFF5.toInt(),0xFFF1EDFF.toInt(),0xFFFFF4E9.toInt(),0xFFECF7F3.toInt(),0xFFFFF0F0.toInt(),0xFFF0F1FF.toInt())
        lessonTitles.forEachIndexed{index,title->
            val finished=done.contains(index.toString())
            val tile=LinearLayout(this).apply{
                orientation=0;gravity=Gravity.CENTER_VERTICAL;setPadding(dp(13),dp(14),dp(13),dp(14))
                background=GradientDrawable().apply{setColor(Color.WHITE);cornerRadius=dp(19).toFloat();setStroke(dp(1),0xFFF0E4EA.toInt())}
                elevation=dp(2).toFloat();setOnClickListener{lesson(index)}
            }
            val badge=TextView(this).apply{
                text=listOf("♡","✿","☁","✧","❀","♡")[index];textSize=21f;gravity=Gravity.CENTER;setTextColor(0xFFB96D91.toInt());background=bgd(palettes[index],15)
                layoutParams=LinearLayout.LayoutParams(dp(48),dp(48)).apply{rightMargin=dp(12)}
            }
            val col=LinearLayout(this).apply{orientation=1}
            col.addView(label("第 ${index+1} 课  ·  ${if(finished)"已完成" else "约 8 分钟"}",10f,pink,true));gap(col,4)
            col.addView(label(title,14f,deep,true));gap(col,4)
            col.addView(label(subtitles[index],11f,muted))
            tile.addView(badge);tile.addView(col,LinearLayout.LayoutParams(0,-2,1f))
            tile.addView(label(if(finished)"✓" else "›",22f,if(finished)0xFF69A88C.toInt() else pink,true))
            r.addView(tile,LinearLayout.LayoutParams(-1,-2).apply{bottomMargin=dp(10)})
        }
        gap(r,6)
        val note=label("这里不教冷暴力、忽冷忽热或制造焦虑。我们练习的是自我尊重、真实表达、安全感与双向选择。",11f,muted)
        note.setPadding(dp(13),dp(12),dp(13),dp(12));note.background=bgd(0xFFF5EFF8.toInt(),15);r.addView(note)
        show(r)
    }
    private fun lesson(index:Int){
        val r=page("第 "+(index+1)+" 课",lessonTitles[index]+" · 讲解 / 案例 / 练习")
        val body=label(lessonBodies[index],14f,ink);body.setPadding(dp(17),dp(17),dp(17),dp(17));body.background=bgd(Color.WHITE,20)
        r.addView(body);gap(r,14)
        r.addView(button("完成本课，记录学习进度"){
            val done=prefs.getStringSet("course_done",emptySet())!!.toMutableSet();done.add(index.toString());prefs.edit().putStringSet("course_done",done).apply();toast("已记录本课进度")
        });gap(r,9);r.addView(button("返回课程目录"){course()});show(r)
    }
    private fun profile(){
        val r=page("📸 展示面工坊","让真实的你清晰、有记忆点")
        val bio=field("个人介绍：你是谁、喜欢什么、期待怎样的相处",prefs.getString("bio","").orEmpty(),3)
        val interest=field("兴趣爱好与日常生活",prefs.getString("interest","").orEmpty(),2)
        val value=field("重视的生活方式与关系观",prefs.getString("value","").orEmpty(),2)
        val photo=field("照片规划：头像、生活照、兴趣场景", "",2)
        addField(r,"个人介绍",bio);addField(r,"兴趣与生活",interest);addField(r,"价值观与期待",value);addField(r,"照片规划",photo)
        val out=label("优化建议会显示在这里。");card(r,out)
        r.addView(button("✨ 生成展示面优化建议"){
            prefs.edit().putString("bio",bio.text.toString()).putString("interest",interest.text.toString()).putString("value",value.text.toString()).apply()
            ai("你是女性交友展示面顾问。根据用户真实提供的信息，提出个人介绍、兴趣标签、照片组合和表达重点建议。不要虚构学历、职业、收入或生活经历，不鼓励盗用照片。给出一版自然真诚的个人简介。个人介绍："+bio.text+"；兴趣："+interest.text+"；价值观："+value.text+"；照片规划："+photo.text){out.text=it}
        });show(r)
    }
    private fun screening(){
        val r=page("💎 优质男筛选","从公开资料出发，判断是否适合进一步认识")
        val data=field("对方公开资料：年龄段、职业介绍、兴趣、生活方式等","",4)
        val want=field("自己的择偶期待：必须项与弹性项","",3)
        addField(r,"对方公开资料",data);addField(r,"我的择偶期待",want)
        val out=label("分析结果会显示在这里。");card(r,out)
        r.addView(button("分析契合点与需要核实的问题"){
            ai("请对用户提供的公开资料做审慎适配分析，分为明确事实、可能契合点、信息缺口、值得了解的问题、需要观察的言行一致性。不要仅凭收入或外貌贴标签，不推断内心或人品，不给绝对结论。对方资料："+data.text+"。我的期待："+want.text){out.text=it}
        });show(r)
    }
    private fun chat(){
        val modes=listOf("轻松开场","兴趣破冰","自然邀约","暖心回应","幽默接话","认真沟通")
        val modeTitles=listOf("主动发起｜轻松开场","主动发起｜兴趣破冰","主动发起｜自然邀约","识别后回应｜暖心回应","识别后回应｜幽默接话","识别后回应｜认真沟通")
        val modePrompts=listOf(
            "根据用户提供的对方公开资料或共同背景，写三条自然、不冒犯的初次开场白，避免群发感和过度热情。",
            "围绕对方明确展示的兴趣，生成三种具体的破冰开场，采用分享加轻问题，不假装拥有相同经历。",
            "根据已有交流进展，生成三种轻松、清晰、可拒绝的邀约表达，不施压、不默认对方同意。",
            "识别对方表达的情绪和事实，给出三种共情但不过度承诺的回应，先理解再交流。",
            "根据上下文给出三种轻松幽默的接话，不讽刺、不贬低、不拿敏感经历开玩笑。",
            "针对对方明确提出的观点或问题，生成三种真诚、清楚、有边界的回应，允许双方意见不同。"
        )
        val mode=chatMode.coerceIn(0,5)
        val r=page("💬 "+modeTitles[mode],"六种对话模式 · 由你选择并决定是否发送")
        val context=field(if(mode<3) "对方资料、共同兴趣或你想开启的话题" else "粘贴对方发来的内容或你愿意分享的聊天片段","",5)
        val goal=field("补充目标或背景",if(mode<3) "自然开启交流，不显得刻意" else "理解对方意思，给出合适回应")
        addField(r,if(mode<3)"发起对话的素材" else "需要识别的内容",context);addField(r,"补充说明",goal)
        result=label("生成内容会显示在这里。");card(r,result)
        r.addView(button("✨ 生成三种表达方案"){
            if(context.text.toString().isBlank()){toast("先填写内容");return@button}
            ai("你是小美AI沟通助手。当前模式："+modes[mode]+"。"+modePrompts[mode]+"给出三种可直接参考的中文口语表达，并简要说明各自适用场景。不得虚构用户经历、操纵对方或绕过拒绝；尊重双方边界。用户提供内容："+context.text+"。补充目标："+goal.text){result.text=it}
        })
        gap(r,8);r.addView(button("复制建议，由我自己检查和发送"){copy(result.text.toString())})
        r.addView(label("前三种用于主动发起对话，后三种用于读取当前页面可见文字后给出回应建议。需由你主动开启系统无障碍授权；AI只生成草稿，每条可单独复制，不会自动发送。识别功能开启时，仅处理当前前台页面可访问的文字节点，请勿在敏感页面开启。",11f,muted));show(r)
    }
    private fun journal(){
        val r=page("🧸 关系成长记","记录聊过的事情，让交流更连贯")
        val name=field("对象昵称或备注");val summary=field("共同兴趣、聊过的话题、对方明确表达的期待","",4);val next=field("下次可以继续的话题","",3)
        addField(r,"对象备注",name);addField(r,"交流摘要",summary);addField(r,"下次交流备忘",next)
        val records=label(recordsText(),13f);card(r,records)
        r.addView(button("保存本次记录"){
            if(name.text.toString().isBlank()){toast("请填写备注名");return@button}
            prefs.edit().putString("record_"+name.text.toString(),"交流摘要："+summary.text+"\n下次话题："+next.text).apply()
            records.text=recordsText();toast("已保存在本机")
        });show(r)
    }
    private fun recordsText():String{
        val all=prefs.all.filterKeys{it.startsWith("record_")}
        if(all.isEmpty())return "目前还没有保存的记录。"
        return all.entries.joinToString("\n\n"){it.key.removePrefix("record_")+"\n"+it.value.toString()}
    }
    private fun date(){
        val r=page("✨ 约会与复盘","从线上交流走向安全、真实的相处")
        listOf("邀约前：确认双方都愿意，时间地点具体，不给对方压力。","首次见面：选择人流正常的公共场所，自行安排交通。","安全提醒：告诉可信任的人见面行程，不转账、不借贷、不泄露验证码。","见面后：记录相处感受、价值观差异和对方是否尊重边界。","关系推进：看持续行动与双方意愿，不用单次热情判断长期承诺。").forEach{val t=label("♡ "+it);t.setPadding(dp(13),dp(13),dp(13),dp(13));t.background=bgd(Color.WHITE,15);r.addView(t,LinearLayout.LayoutParams(-1,-2).apply{bottomMargin=dp(9)})}
        r.addView(button("设置1–10分钟自我复盘提醒"){
            val delay=(60L..600L).random()*1000L;toast("已设置提醒")
            handler.postDelayed({if(!isFinishing)AlertDialog.Builder(this).setTitle("小美提醒").setMessage("可以复盘刚才的交流，是否回复由你决定。").setPositiveButton("知道了",null).show()},delay)
        });show(r)
    }
    private fun settings(){
        val box=LinearLayout(this).apply{orientation=1;setPadding(dp(16),0,dp(16),0)}
        box.addView(label("AI 服务商：OpenRouter（一个密钥连接多种模型）",13f,deep,true))
        val endpoint=field("API 地址",prefs.getString("endpoint","https://openrouter.ai/api/v1/chat/completions").orEmpty())
        val tier=Spinner(this).apply{
            adapter=ArrayAdapter(this@MainActivity,android.R.layout.simple_spinner_dropdown_item,listOf("免费模型（有次数限制）","付费模型（按量计费）"))
            setSelection(if(prefs.getString("tier","free")=="paid")1 else 0)
        }
        val model=field("模型名称",prefs.getString("model","openrouter/free").orEmpty())
        val key=field("OpenRouter API Key",prefs.getString("key","").orEmpty()).apply{inputType=129}
        box.addView(label("模型类型",12f,muted));box.addView(tier)
        box.addView(endpoint);box.addView(model);box.addView(key)
        box.addView(label("免费默认：openrouter/free。付费可填写模型 ID，例如 anthropic/claude-sonnet-4。付费模型需要账户余额。",11f,muted))
        AlertDialog.Builder(this).setTitle("AI 服务设置").setView(box)
            .setPositiveButton("保存"){_,_-> 
                val chosen=if(tier.selectedItemPosition==0) "free" else "paid"
                val selectedModel=model.text.toString().trim().ifBlank{if(chosen=="free")"openrouter/free" else "openai/gpt-4o-mini"}
                prefs.edit().putString("endpoint",endpoint.text.toString().trim().ifBlank{"https://openrouter.ai/api/v1/chat/completions"})
                    .putString("model",selectedModel).putString("tier",chosen).putString("key",key.text.toString().trim()).apply()
                toast("OpenRouter 配置已保存")
            }
            .setNeutralButton("开启聊天内容识别"){_,_->
                prefs.edit().putBoolean("capture_enabled",true).apply()
                startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
                toast("请在系统无障碍设置中找到小美 AI 并手动开启")
            }.setNegativeButton("取消",null).show()
    }
    private fun ai(prompt:String,done:(String)->Unit){
        val ep=prefs.getString("endpoint","").orEmpty();val model=prefs.getString("model","").orEmpty();val key=prefs.getString("key","").orEmpty()
        if(ep.isBlank()||model.isBlank()||key.isBlank()){done("请先点击首页右上角⚙配置AI服务。");return}
        Thread{val answer=try{AiClient.chat(ep,model,key,prompt)}catch(e:Exception){"AI请求失败："+e.message};handler.post{done(answer)}}.start()
    }
    private fun floating(){
        if(!Settings.canDrawOverlays(this)){startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,Uri.parse("package:"+packageName)));toast("请允许小美显示在其他应用上层");return}
        try{startService(Intent(this,OverlayService::class.java));toast("悬浮小美已开启，长按悬浮球可关闭")}catch(e:Exception){toast("启动失败："+e.message)}
    }
    private fun copy(s:String){val cm=getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager;cm.setPrimaryClip(ClipData.newPlainText("小美AI建议",s));toast("已复制，请检查后自行发送")}
    private fun toast(s:String)=Toast.makeText(this,s,Toast.LENGTH_SHORT).show()
}
