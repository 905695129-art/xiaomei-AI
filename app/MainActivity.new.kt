package com.xiaomei.ai

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.ViewGroup
import android.widget.*

class MainActivity : Activity() {
 private fun dp(v:Int)=(v*resources.displayMetrics.density).toInt()
 private val h=Handler(Looper.getMainLooper())
 private val p by lazy { getSharedPreferences("xiaomei", MODE_PRIVATE) }
 private lateinit var kw:EditText
 private lateinit var raw:EditText
 private lateinit var out:TextView
 private lateinit var state:TextView
 private lateinit var api:EditText
 private lateinit var model:EditText
 private lateinit var key:EditText
 override fun onCreate(b:Bundle?){super.onCreate(b); showHome()}
 private fun showHome(){
  val box=LinearLayout(this).apply{orientation=1;setPadding(dp(18),dp(22),dp(18),dp(24));setBackgroundColor(0xFFFFF4F8.toInt())}
  box.addView(TextView(this).apply{text="小美 AI ✿\n智能获客助手";textSize=27f;setTextColor(0xFF9C4772.toInt())})
  box.addView(TextView(this).apply{text="找人 → 识别需求 → 判断意向 → 个性化开场 → 记录反馈";textSize=13f;setPadding(0,dp(8),0,dp(12))})
  kw=EditText(this).apply{hint="获客关键词，如：情感咨询、相亲、脱单";setText(p.getString("kw","情感咨询"))}
  box.addView(kw)
  box.addView(Button(this).apply{text="一键开始：打开抖音关键词搜索";setOnClickListener{
   val q=kw.text.toString().trim();if(q.isEmpty()){toast("请先填写关键词");return@setOnClickListener}
   p.edit().putString("kw",q).apply()
   if(!android.provider.Settings.canDrawOverlays(this)){
    startActivity(Intent(this@MainActivity, android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION).setData(Uri.parse("package:$packageName")))
    toast("请允许小美AI显示在其他应用上层，然后重新点击")
    return@setOnClickListener
   }
   try{
    startService(Intent(this@MainActivity, OverlayService::class.java))
    val launch=packageManager.getLaunchIntentForPackage("com.ss.android.ugc.aweme")
    if(launch!=null){launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);startActivity(launch);state.text="小美已缩为悬浮窗。请在抖音内搜索：$q"}
    else{startActivity(Intent(Intent.ACTION_VIEW,Uri.parse("https://www.douyin.com/search/"+Uri.encode(q)+"?type=general")));state.text="未检测到抖音 App，已打开网页版。"}
   }catch(e:Exception){toast("启动失败："+e.message)}
  }})
  box.addView(Button(this).apply{text="开启屏幕文字读取权限";setOnClickListener{startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))}})
  box.addView(Button(this).apply{text="读取当前抖音页面可见评论";setOnClickListener{
   val s=p.getString("screen_snapshot","").orEmpty()
   if(s.isBlank())toast("未读到文字：先授权无障碍，再打开评论区")
   else{raw.setText(s);state.text="已读取可见文字，请检查内容。"}
  }})
  box.addView(TextView(this).apply{text="评论内容";textSize=17f;setTextColor(0xFF9C4772.toInt());setPadding(0,dp(12),0,dp(4))})
  raw=EditText(this).apply{hint="读取或粘贴公开可见评论；昵称和时间只记录页面明确显示的内容";minLines=5;gravity=android.view.Gravity.TOP}
  box.addView(raw,ViewGroup.LayoutParams(-1,dp(145)))
  box.addView(Button(this).apply{text="分析潜在客户并生成逐人私信草稿";setOnClickListener{val t=raw.text.toString().trim();if(t.isEmpty())toast("请先读取或粘贴评论")else analyze(t)}})
  box.addView(Button(this).apply{text="保存本次分析";setOnClickListener{
   val s=out.text.toString();if(s.isBlank())toast("暂无分析结果")else{val old=p.getString("history","").orEmpty();p.edit().putString("history",(old+"\n\n---\n"+s).takeLast(20000)).apply();toast("已保存在本机")}
  }})
  box.addView(Button(this).apply{text="查看历史线索";setOnClickListener{out.text=p.getString("history","暂无历史线索")}})
  box.addView(Button(this).apply{text="AI 模型设置（首次配置）";setOnClickListener{settings()}})
  state=TextView(this).apply{text="准备就绪。只辅助筛选和起草，不自动发送私信；请逐人核对、遵守平台规则和对方意愿。";textSize=13f;setPadding(0,dp(12),0,dp(6))}
  box.addView(state)
  out=TextView(this).apply{text="分析结果显示在这里。";textSize=14f;setPadding(0,dp(10),0,dp(18))}
  box.addView(out)
  val sc=ScrollView(this);sc.addView(box);setContentView(sc)
 }
 private fun settings(){
  val b=LinearLayout(this).apply{orientation=1;setPadding(dp(16),0,dp(16),0)}
  api=EditText(this).apply{hint="兼容 OpenAI 的 API 地址";setText(p.getString("endpoint","https://api.openai.com/v1/chat/completions"))}
  model=EditText(this).apply{hint="模型名称";setText(p.getString("model","gpt-4o-mini"))}
  key=EditText(this).apply{hint="API Key";inputType=129;setText(p.getString("key",""))}
  b.addView(api);b.addView(model);b.addView(key)
  AlertDialog.Builder(this).setTitle("AI 模型设置").setView(b).setPositiveButton("保存"){_,_->p.edit().putString("endpoint",api.text.toString().trim()).putString("model",model.text.toString().trim()).putString("key",key.text.toString().trim()).apply();toast("设置已保存")}.setNegativeButton("取消",null).show()
 }
 private fun analyze(t:String){
  val ep=p.getString("endpoint","").orEmpty();val mo=p.getString("model","").orEmpty();val k=p.getString("key","").orEmpty()
  if(ep.isBlank()||mo.isBlank()||k.isBlank()){out.text=local(t)+"\n\n配置模型后可启用深度 AI 分析。";return}
  out.text="正在分析公开评论……"
  Thread{try{
   val prompt="你是谨慎的客户需求分析助手。逐条分析以下公开评论，提取页面明确可见的昵称和时间（不得猜测），标注需求证据、意向高/中/低/未知、理由、自然个性化开场草稿。排除广告、无关、未成年人、明确拒绝联系者。不要推断敏感属性，不编造信息。给出优先级及停止联系条件。关键词："+kw.text+"。评论：\n"+t
   val a=AiClient.chat(ep,mo,k,prompt);h.post{out.text=a}
  }catch(e:Exception){h.post{out.text="AI 调用失败："+e.message+"\n\n"+local(t)}}}.start()
 }
 private fun local(t:String):String{
  val lines=t.lines().map{it.trim()}.filter{it.length>2}.distinct().take(60)
  val need=listOf("怎么办","求建议","相亲","脱单","咨询","怎么挽回","怎么认识","求方法","收费吗")
  val stop=listOf("别联系","不要打扰","别私信","拉黑")
  val b=StringBuilder("本地初筛（非 AI 判断）\n")
  lines.forEachIndexed{i,s->val tag=when{stop.any{s.contains(it)}->"排除：拒绝联系";need.any{s.contains(it)}->"需求线索：待人工核实";else->"意向未知"};b.append((i+1).toString()+". "+tag+"\n"+s+"\n\n")}
  return b.toString()
 }
 private fun toast(s:String)=Toast.makeText(this,s,Toast.LENGTH_SHORT).show()
}
