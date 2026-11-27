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
    private val pink = Color.rgb(222,112,157)
    private val deep = Color.rgb(126,65,94)
    private val ink = Color.rgb(78,59,68)
    private val muted = Color.rgb(154,130,141)
    private val bg = Color.rgb(255,247,250)
    private val prefs by lazy { getSharedPreferences("xiaomei", MODE_PRIVATE) }
    private val handler = Handler(Looper.getMainLooper())
    private lateinit var result: TextView

    private val titles = listOf("吸引力课程","展示面工坊","优质男筛选","聊天辅助","关系成长记","约会与复盘")
    private val icons = listOf("🌷","📸","💎","💬","🧸","✨")
    private val desc = listOf("学习自然建立吸引力","优化照片、资料与个人介绍","识别契合点与需要核实的问题","理解对话并生成自然回复","记住对象、话题和交流进度","安全邀约与关系复盘")

    override fun onCreate(state: Bundle?) { super.onCreate(state); routeIntent(intent) }
    override fun onNewIntent(intent: Intent) { super.onNewIntent(intent); setIntent(intent); routeIntent(intent) }
    private fun routeIntent(intent: Intent?) {
        val module = intent?.getIntExtra("xiaomei_module", -1) ?: -1
        if (module in 0..5) open(module) else home()
    }
    private fun dp(n:Int) = (n*resources.displayMetrics.density).toInt()
    private fun bgd(c:Int,r:Int=18):GradientDrawable = GradientDrawable().apply { setColor(c); cornerRadius=dp(r).toFloat() }
    private fun label(s:String,size:Float=14f,c:Int=ink,b:Boolean=false)=TextView(this).apply {
        text=s; textSize=size; setTextColor(c); if(b)setTypeface(typeface,Typeface.BOLD); setLineSpacing(dp(2).toFloat(),1f)
    }
    private fun button(s:String,action:()->Unit)=Button(this).apply {
        text=s; textSize=14f; isAllCaps=false; setTextColor(Color.WHITE); background=bgd(pink,15); setOnClickListener{action()}
    }
    private fun field(h:String,v:String="",lines:Int=1)=EditText(this).apply {
        hint=h; setText(v); textSize=14f; setTextColor(ink); setHintTextColor(0xFFBDAAB5.toInt())
        setPadding(dp(13),dp(10),dp(13),dp(10)); background=bgd(Color.WHITE,14)
        minLines=lines; gravity=if(lines>1) Gravity.TOP else Gravity.CENTER_VERTICAL
    }
    private fun column()=LinearLayout(this).apply { orientation=1; setPadding(dp(18),dp(14),dp(18),dp(24)); setBackgroundColor(bg) }
    private fun gap(parent:LinearLayout,n:Int=12){ parent.addView(View(this),LinearLayout.LayoutParams(1,dp(n))) }
    private fun show(v:android.view.View){ setContentView(ScrollView(this).apply{isFillViewport=true;addView(v)}) }
    private fun card(parent:LinearLayout,v:View){ val box=LinearLayout(this).apply{orientation=1;setPadding(dp(15),dp(15),dp(15),dp(15));background=bgd(Color.WHITE,20);elevation=dp(2).toFloat()};box.addView(v);parent.addView(box,LinearLayout.LayoutParams(-1,-2).apply{bottomMargin=dp(12)}) }
    private fun page(title:String,sub:String):LinearLayout{
        val r=column(); val h=LinearLayout(this).apply{orientation=0;gravity=Gravity.CENTER_VERTICAL}
        h.addView(label("‹",34f,deep).apply{setPadding(0,0,dp(14),0);setOnClickListener{home()}})
        val t=LinearLayout(this).apply{orientation=1};t.addView(label(title,22f,deep,true));t.addView(label(sub,12f,muted));h.addView(t);r.addView(h);gap(r,18);return r
    }
    private fun addField(r:LinearLayout,title:String,e:EditText){r.addView(label(title,13f,deep,true));gap(r,5);r.addView(e,LinearLayout.LayoutParams(-1,if(e.minLines>1)dp(105) else dp(50)));gap(r,12)}
    private fun home(){
        val r=column()
        val head=LinearLayout(this).apply{orientation=0;gravity=Gravity.CENTER_VERTICAL}
        val name=LinearLayout(this).apply{orientation=1};name.addView(label("小美 AI",28f,deep,true));name.addView(label("女性成长 · 展示面 · 高质量交友",12f,muted))
        head.addView(name,LinearLayout.LayoutParams(0,-2,1f));head.addView(label("⚙",24f,deep).apply{setOnClickListener{settings()}});r.addView(head);gap(r,16)
        val hero=LinearLayout(this).apply{orientation=1;setPadding(dp(19),dp(19),dp(19),dp(19));background=GradientDrawable(GradientDrawable.Orientation.TL_BR,intArrayOf(0xFFFFDCE9.toInt(),0xFFFFEFF5.toInt(),0xFFF0E7FF.toInt())).apply{cornerRadius=dp(24).toFloat()}}
        hero.addView(label("🧸  先成为自己喜欢的样子",19f,deep,true));gap(hero,7)
        hero.addView(label("学习展示真实魅力，识别适合自己的对象，用舒服自然的方式建立关系。",13f,0xFF8D667A.toInt()))
        gap(hero,12);hero.addView(label("了解自己 → 优化展示 → 识别契合 → 自然交流 → 关系成长",11f,deep,true));r.addView(hero);gap(r,18)
        r.addView(label("成长功能台",19f,deep,true));r.addView(label("六大模块，陪你走完整个交友流程",12f,muted));gap(r,10)
        for(i in 0..2){
            val row=LinearLayout(this).apply{orientation=0}
            for(j in 0..1){
                val k=i*2+j
                val tile=LinearLayout(this).apply{orientation=1;setPadding(dp(13),dp(13),dp(12),dp(13));background=bgd(Color.WHITE,19);elevation=dp(2).toFloat();setOnClickListener{open(k)}}
                tile.addView(label(icons[k],25f));gap(tile,7);tile.addView(label(titles[k],15f,deep,true));gap(tile,4);tile.addView(label(desc[k],11f,muted))
                row.addView(tile,LinearLayout.LayoutParams(0,dp(145),1f).apply{if(j==0)rightMargin=dp(7) else leftMargin=dp(7)})
            };r.addView(row);gap(r,10)
        }
        card(r,LinearLayout(this).apply{orientation=1;addView(label("随时陪伴",16f,deep,true));gap(this,8);addView(button("💗 打开聊天辅助"){open(3)});gap(this,8);addView(button("🧸 开启悬浮小美"){floating()})})
        val foot=label("真实展示自己 · 尊重彼此选择 · 不把技巧变成操纵",11f,muted);foot.gravity=Gravity.CENTER;r.addView(foot);show(r)
    }
    private fun open(i:Int){when(i){0->course();1->profile();2->screening();3->chat();4->journal();5->date()}}
    private fun course(){
        val r=page("🌷 吸引力课程","从自我认知到自然建立关系")
        val lessons=listOf(
            "第1课｜明确自己的择偶期待\n区分外在条件、生活方式、价值观和长期目标。",
            "第2课｜理解真实吸引力\n不是讨好或表演，而是清晰表达特点、兴趣和边界。",
            "第3课｜认识适合自己的男性\n观察资料真实性、言行一致性、尊重程度和生活目标。",
            "第4课｜自然开启交流\n从共同兴趣和具体细节切入，分享与提问保持平衡。",
            "第5课｜判断是否值得继续\n关注持续行动、沟通质量、尊重程度和现实安排。",
            "第6课｜安全推进关系\n充分了解后再约见，首次见面选择公共场所。"
        )
        lessons.forEach{val t=label(it,14f);t.setPadding(dp(13),dp(13),dp(13),dp(13));t.background=bgd(Color.WHITE,15);r.addView(t,LinearLayout.LayoutParams(-1,-2).apply{bottomMargin=dp(9)})};show(r)
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
        val r=page("💬 聊天辅助","理解上下文，给你可选择的自然回复")
        val context=field("粘贴你愿意分享的对话或聊天背景","",5)
        val goal=field("本轮交流目标","轻松接话，了解共同兴趣")
        val style=field("表达风格","温柔自然、轻松、有边界")
        addField(r,"聊天上下文",context);addField(r,"交流目标",goal);addField(r,"表达风格",style)
        result=label("分析结果和三种可选回复会显示在这里。");card(r,result)
        r.addView(button("✨ 分析并生成三种回复"){
            if(context.text.toString().isBlank()){toast("先填写对话内容");return@button}
            ai("你是小美AI女性交友沟通顾问。仅根据提供的对话分析对方明确表达的内容、交流阶段和自然话题。给出三种短回复：温柔自然、轻松俏皮、真诚深入。口语化，不故意冷落、不制造嫉妒、不虚构经历、不推断对方内心，尊重拒绝和边界。交流目标："+goal.text+"；风格："+style.text+"；对话："+context.text){result.text=it}
        })
        gap(r,8);r.addView(button("复制建议，由我自己检查和发送"){copy(result.text.toString())})
        r.addView(label("建议只提供必要对话片段，不要粘贴手机号、住址或证件等敏感信息。",11f,muted));show(r)
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
