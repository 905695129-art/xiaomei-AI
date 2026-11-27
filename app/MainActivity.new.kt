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
        val head=LinearLayout(this).apply{orientation=0;gravity=Gravity.CENTER_VERTICAL}
        val mark=TextView(this).apply{
            text="🧸";textSize=27f;gravity=Gravity.CENTER
            background=GradientDrawable(GradientDrawable.Orientation.TL_BR,intArrayOf(0xFFFFDCEB.toInt(),0xFFF5E5FF.toInt())).apply{cornerRadius=dp(18).toFloat()}
            layoutParams=LinearLayout.LayoutParams(dp(54),dp(54)).apply{rightMargin=dp(12)}
        }
        val name=LinearLayout(this).apply{orientation=1}
        name.addView(label("小美 AI",27f,deep,true));gap(name,2)
        name.addView(label("让每一次相遇，都更从容",12f,muted))
        head.addView(mark);head.addView(name,LinearLayout.LayoutParams(0,-2,1f))
        head.addView(label("⚙",23f,deep).apply{setPadding(dp(10),dp(8),dp(5),dp(8));setOnClickListener{settings()}})
        r.addView(head);gap(r,18)
        val hero=LinearLayout(this).apply{
            orientation=1;setPadding(dp(21),dp(22),dp(21),dp(20))
            background=GradientDrawable(GradientDrawable.Orientation.TL_BR,intArrayOf(0xFFFFD9E8.toInt(),0xFFFFEEF5.toInt(),0xFFF0E7FF.toInt())).apply{cornerRadius=dp(27).toFloat()}
            elevation=dp(4).toFloat()
        }
        val tag=TextView(this).apply{
            text="  YOUR GROWTH COMPANION  ";textSize=9f;letterSpacing=0.12f
            setTextColor(0xFF9D5879.toInt());setPadding(dp(9),dp(6),dp(9),dp(6));background=bgd(0x66FFFFFF,20)
        }
        hero.addView(tag);gap(hero,13)
        hero.addView(label("成为自己喜欢的样子。",23f,deep,true));gap(hero,7)
        hero.addView(label("从真实展示到自然交流，陪你一步步建立自信，认识值得认真了解的人。",13f,0xFF8D667A.toInt()))
        gap(hero,15);hero.addView(label("自我认知   ·   展示魅力   ·   识别契合   ·   关系成长",11f,deep,true))
        r.addView(hero);gap(r,23)
        val section=LinearLayout(this).apply{orientation=0;gravity=Gravity.CENTER_VERTICAL}
        val heading=LinearLayout(this).apply{orientation=1}
        heading.addView(label("探索成长",20f,deep,true));gap(heading,3)
        heading.addView(label("为交友的每个阶段，准备一份小小助力",12f,muted))
        section.addView(heading,LinearLayout.LayoutParams(0,-2,1f))
        section.addView(label("6 个功能",11f,pink,true).apply{setPadding(dp(10),dp(6),dp(10),dp(6));background=bgd(0xFFFFE5EF.toInt(),20)})
        r.addView(section);gap(r,13)
        val tileColors=listOf(0xFFFFF0F5.toInt(),0xFFF2EDFF.toInt(),0xFFFFF5E9.toInt(),0xFFEDF7F5.toInt(),0xFFFFF0F2.toInt(),0xFFF1F1FF.toInt())
        for(i in 0..2){
            val row=LinearLayout(this).apply{orientation=0}
            for(j in 0..1){
                val k=i*2+j
                val tile=LinearLayout(this).apply{
                    orientation=1;setPadding(dp(15),dp(15),dp(14),dp(15))
                    background=GradientDrawable().apply{setColor(Color.WHITE);cornerRadius=dp(21).toFloat();setStroke(dp(1),0xFFF0E3EA.toInt())}
                    elevation=dp(3).toFloat();setOnClickListener{open(k)}
                }
                val icon=TextView(this).apply{
                    text=icons[k];textSize=23f;gravity=Gravity.CENTER;background=bgd(tileColors[k],15)
                    layoutParams=LinearLayout.LayoutParams(dp(46),dp(46))
                }
                tile.addView(icon);gap(tile,11);tile.addView(label(titles[k],15f,deep,true));gap(tile,5)
                tile.addView(label(desc[k],11f,muted))
                tile.addView(label("进入模块  ›",10f,pink,true).apply{setPadding(0,dp(10),0,0)})
                row.addView(tile,LinearLayout.LayoutParams(0,dp(166),1f).apply{if(j==0)rightMargin=dp(7) else leftMargin=dp(7)})
            }
            r.addView(row);gap(r,11)
        }
        card(r,LinearLayout(this).apply{
            orientation=1;addView(label("随身聊天搭档",17f,deep,true));gap(this,4)
            addView(label("需要灵感时，随时切换六种聊天模式。",12f,muted));gap(this,13)
            addView(button("💗  打开聊天辅助"){open(3)});gap(this,9)
            addView(button("🧸  开启悬浮小美"){floating()})
        })
        val foot=label("真实展示自己  ·  尊重彼此选择  ·  自然建立连接",10f,muted)
        foot.gravity=Gravity.CENTER;r.addView(foot);show(r)
    }
    private fun open(i:Int){when(i){0->course();1->profile();2->screening();3->chat();4->journal();5->date()}}
    private val lessonTitles = ["停止讨好：把注意力放回自己","真实展示：让别人看见你的魅力","温柔而坚定：建立清晰边界","轻松吸引：让交流有来有往","适度留白：保留自己的生活节奏","识别双向奔赴：选择值得的人"]
    private val lessonBodies = ["【核心讲解】吸引力的起点不是争取所有人的认可，而是拥有稳定的自我评价。马基雅维利相关网络内容常谈权力、距离与不讨好；放进亲密关系，我们保留自我主权，不采用故意冷落、忽冷忽热或制造焦虑的操控方式。\n【生活案例】对方几个小时没回复，你反复打开聊天框，连原本安排好的事情也做不下去。新的做法：先回到自己的生活安排，有空、有话想说时再回复，而不是用延迟回复惩罚对方。\n【练习】写下三件即使没有恋爱也会认真经营的事，以及你在关系里最不愿牺牲的三项原则。\n【自测】我是否把对方的回复速度当成对自我价值的判决？","【核心讲解】展示不是包装成另一个人，而是帮助别人理解真实的你。照片、简介、兴趣和生活方式应彼此一致。\n【实操】准备清晰自然的头像、日常生活照、兴趣场景照、全身或环境照。避免盗用他人照片、过度修图或虚构职业收入。\n【简介结构】一句生活态度 + 两个真实兴趣 + 一项愿意分享的体验 + 对相处方式的期待。\n【示例】“平时喜欢城市散步和做饭，周末会去看展或找一家新咖啡馆。希望认识真诚、有好奇心，也愿意认真沟通的人。”\n【练习】挑选三张代表不同生活侧面的真实照片，写出每张希望传达的特点。","【核心讲解】边界不是冷漠，也不是控制别人。边界是清楚说明什么适合我、什么不适合我，以及如何照顾自己。\n【表达模板】“谢谢你想到我，不过这件事我不太方便。”“我愿意继续了解你，但我更喜欢循序渐进。”“我理解你的想法，不过我的感受也很重要。”\n【案例】对方临时要求你深夜见面。你可以提出白天、公共场所的替代安排，不必为了证明喜欢而勉强自己。\n【练习】把最近一次勉强答应的事情，改写成礼貌、明确、不攻击对方的表达。","【核心讲解】聊天不是面试，也不需要靠套路制造神秘感。有效交流包含观察、分享、提问和回应。\n【四步法】观察对方明确表达的细节；分享一点真实经历；提出容易回答的轻问题；接住回答自然延展。\n【示例】“你照片里那家书店看起来很舒服。我最近也在找适合慢慢逛的地方，你更喜欢独立书店还是大型书店？”\n【练习】找一个对方公开资料里的具体兴趣，写一条“观察 + 自己的分享 + 一个轻问题”。","【核心讲解】留白是给彼此空间，不是故意制造不确定和焦虑。自己的生活、朋友、兴趣和计划不应因刚开始的关系全部暂停。\n【实操】保持原有作息；不为测试对方而故意消失；忙碌时简短说明；不把回复速度当作唯一感情指标。\n【案例】周末已有安排，对方临时邀约。说明已有计划，并提出另一个双方方便的时间。\n【练习】规划一周中属于自己的时间，保留至少两项不依赖恋爱关系的活动。","【核心讲解】判断关系是否有真实的双向投入，而不是一味追逐结果。\n【观察维度】主动性：双方是否都愿意发起交流；一致性：言行是否一致；尊重：是否尊重拒绝、时间和边界；可靠性：是否认真对待约定；契合度：生活方式和未来期待是否兼容。\n【决策提示】有好感可以继续了解，但不必过早承诺；长期只有一方努力，可以降低投入并观察；出现威胁、羞辱、控制或金钱索取时，优先保护自己。\n【练习】回顾最近三次互动，记录对方实际行动、你的感受和仍需核实的信息。"]
    private fun course(){
        val r=page("🌷 吸引力成长课","温柔、有边界、有自我：从讨好走向双向吸引")
        val hero=LinearLayout(this).apply{orientation=1;setPadding(dp(17),dp(17),dp(17),dp(17));background=GradientDrawable(GradientDrawable.Orientation.TL_BR,intArrayOf(0xFFFFE0EC.toInt(),0xFFF4EAFE.toInt())).apply{cornerRadius=dp(22).toFloat()}}
        hero.addView(label("不必追着谁证明自己值得被爱。",18f,deep,true));gap(hero,7)
        hero.addView(label("课程借鉴马基雅维利相关公开内容中关于自我主权、边界与不讨好的讨论，并将其转化为健康、温暖、可实践的关系能力。",12f,muted))
        r.addView(hero);gap(r,17);r.addView(label("课程目录 · 6 个单元",18f,deep,true));gap(r,5)
        r.addView(label("每课包含讲解、生活案例和练习。点击进入学习。",12f,muted));gap(r,12)
        lessonTitles.forEachIndexed{index,title->
            val tile=LinearLayout(this).apply{orientation=0;gravity=Gravity.CENTER_VERTICAL;setPadding(dp(15),dp(14),dp(14),dp(14));background=bgd(Color.WHITE,18);elevation=dp(2).toFloat();setOnClickListener{lesson(index)}}
            val num=TextView(this).apply{text=String.format("%02d",index+1);textSize=16f;setTextColor(pink);gravity=Gravity.CENTER;background=bgd(0xFFFFEAF2.toInt(),14);layoutParams=LinearLayout.LayoutParams(dp(43),dp(43)).apply{rightMargin=dp(12)}}
            val textCol=LinearLayout(this).apply{orientation=1;addView(label(title,14f,deep,true));gap(this,4);addView(label(listOf("自我价值与注意力","真实资料与个人表达","表达偏好与拒绝","观察、分享与提问","生活节奏与留白","行动、尊重与契合度")[index],11f,muted))}
            tile.addView(num);tile.addView(textCol,LinearLayout.LayoutParams(0,-2,1f));tile.addView(label("›",25f,pink))
            r.addView(tile,LinearLayout.LayoutParams(-1,-2).apply{bottomMargin=dp(10)})
        }
        gap(r,8);r.addView(label("课程原则：不教冷暴力、不制造焦虑、不把关系变成输赢。吸引力来自自我完整、真实表达和双方自愿。",11f,muted));show(r)
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
        r.addView(label("前三种是主动发起对话；后三种是识别对方内容后回应。AI只生成草稿，不读取其他应用屏幕，也不会自动发送。",11f,muted));show(r)
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
        val endpoint=field("兼容 OpenAI 的 API 地址",prefs.getString("endpoint","https://api.openai.com/v1/chat/completions").orEmpty())
        val model=field("模型名称",prefs.getString("model","gpt-4o-mini").orEmpty())
        val key=field("API Key",prefs.getString("key","").orEmpty()).apply{inputType=129}
        box.addView(endpoint);box.addView(model);box.addView(key)
        AlertDialog.Builder(this).setTitle("AI 服务设置").setView(box).setPositiveButton("保存"){_,_->prefs.edit().putString("endpoint",endpoint.text.toString().trim()).putString("model",model.text.toString().trim()).putString("key",key.text.toString().trim()).apply();toast("设置已保存")}.setNegativeButton("取消",null).show()
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
