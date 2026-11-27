package com.xiaomei.ai

import android.app.Activity
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.*
import android.content.Context

class MainActivity : Activity() {
    private val bg = Color.rgb(255, 247, 251)
    private val pink = Color.rgb(231, 91, 151)
    private val deep = Color.rgb(105, 50, 82)
    private val ink = Color.rgb(72, 48, 64)
    private val muted = Color.rgb(151, 119, 139)
    private val prefs by lazy { getSharedPreferences("relationship_assistant", Context.MODE_PRIVATE) }
    private var module = "情感挽回"
    private var stage = 0
    private lateinit var chat: LinearLayout
    private lateinit var input: EditText
    private lateinit var scroll: ScrollView

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()
    private fun shape(color: Int, radius: Int = 20) = GradientDrawable().apply {
        setColor(color); cornerRadius = dp(radius).toFloat()
        setStroke(dp(1), 0xFFF4DCE8.toInt())
    }
    private fun text(value: String, size: Float, color: Int = ink, bold: Boolean = false) =
        TextView(this).apply {
            text = value; textSize = size; setTextColor(color)
            if (bold) setTypeface(typeface, Typeface.BOLD)
            setLineSpacing(dp(3).toFloat(), 1f)
        }
    private fun gap(parent: LinearLayout, h: Int) {
        parent.addView(View(this), LinearLayout.LayoutParams(1, dp(h)))
    }
    private fun button(value: String, action: () -> Unit) = Button(this).apply {
        text = value; isAllCaps = false; textSize = 14f; setTextColor(Color.WHITE)
        background = GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT,
            intArrayOf(0xFFF28DB8.toInt(), 0xFFE65A98.toInt())).apply { cornerRadius = dp(18).toFloat() }
        setPadding(dp(16), dp(10), dp(16), dp(10)); setOnClickListener { action() }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        home()
    }

    private fun home() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(24), dp(20), dp(20))
            background = GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,
                intArrayOf(0xFFFFF0F7.toInt(), bg, 0xFFF8F1FF.toInt()))
        }
        val scroller = ScrollView(this).apply { addView(root) }
        val header = LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL }
        val logo = TextView(this).apply {
            text = "♡"; textSize = 36f; gravity = Gravity.CENTER; setTextColor(Color.WHITE)
            background = GradientDrawable(GradientDrawable.Orientation.TL_BR,
                intArrayOf(0xFFFF9EC8.toInt(), 0xFFE65A98.toInt())).apply { cornerRadius = dp(20).toFloat() }
            layoutParams = LinearLayout.LayoutParams(dp(58), dp(58)).apply { rightMargin = dp(14) }
        }
        val brand = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        brand.addView(text("情感助手", 25f, deep, true))
        brand.addView(text("让每一段关系，都更清晰一点", 12f, muted))
        header.addView(logo); header.addView(brand, LinearLayout.LayoutParams(0, -2, 1f))
        root.addView(header); gap(root, 22)

        val hero = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; setPadding(dp(22), dp(22), dp(22), dp(22))
            background = GradientDrawable(GradientDrawable.Orientation.TL_BR,
                intArrayOf(0xFFFFD8E9.toInt(), 0xFFFFF0F6.toInt(), 0xFFEFE5FF.toInt())).apply { cornerRadius = dp(28).toFloat() }
        }
        hero.addView(text("你好呀～", 23f, deep, true)); gap(hero, 7)
        hero.addView(text("先说说你正在经历什么，\n我会一步一步陪你理清。", 17f, deep, true)); gap(hero, 10)
        hero.addView(text("不需要一次填写很多资料。我们从最重要的问题开始。", 13f, muted)); gap(hero, 15)
        hero.addView(button("开始分析  ›") { openModule("情感挽回") })
        root.addView(hero); gap(root, 24)
        root.addView(text("选择你现在需要的帮助", 19f, deep, true)); gap(root, 5)
        root.addView(text("每个板块都会由 AI 逐步提问、分析并跟进", 12f, muted)); gap(root, 14)

        val modules = listOf(
            Triple("💗", "情感挽回", "分手、冷战、失联，梳理原因与修复路径"),
            Triple("💕", "关系推进", "从认识、暧昧到稳定相处，找到自然的下一步"),
            Triple("🎁", "引导付出", "坦诚沟通礼物、约会预算与经济投入边界")
        )
        modules.forEachIndexed { index, item ->
            val colors = listOf(0xFFFFEAF2.toInt(), 0xFFF0E9FF.toInt(), 0xFFFFF0E2.toInt())
            val tile = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL; setPadding(dp(18), dp(17), dp(18), dp(17))
                background = shape(Color.WHITE, 22); elevation = dp(2).toFloat()
                setOnClickListener { openModule(item.second) }
            }
            tile.addView(text(item.first, 27f)); gap(tile, 6)
            tile.addView(text(item.second, 18f, deep, true)); gap(tile, 5)
            tile.addView(text(item.third, 12f, muted)); gap(tile, 10)
            tile.addView(text("立即进入  ›", 13f, pink, true))
            root.addView(tile, LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(12) })
        }
        val note = text("温柔提醒：关系需要双方自愿。我们提供分析与沟通建议，不替任何人做决定。", 11f, muted)
        note.gravity = Gravity.CENTER
        root.addView(note)
        setContentView(scroller)
    }

    private fun openModule(name: String) {
        module = name; stage = 0
        val old = prefs.getString("chat_$module", "").orEmpty()
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; setPadding(dp(16), dp(16), dp(16), dp(12)); setBackgroundColor(bg)
        }
        val header = LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL }
        header.addView(text("‹", 32f, deep).apply {
            setPadding(0, 0, dp(16), 0); setOnClickListener { home() }
        })
        val title = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        title.addView(text(module, 21f, deep, true))
        title.addView(text("情感助手 · 分步引导模式", 11f, muted))
        header.addView(title); root.addView(header)
        gap(root, 12)
        scroll = ScrollView(this).apply { isFillViewport = true }
        chat = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(4), dp(4), dp(4), dp(12)) }
        scroll.addView(chat)
        root.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))
        input = EditText(this).apply {
            hint = "把你的情况告诉我…"; textSize = 14f; setTextColor(ink)
            setPadding(dp(14), dp(12), dp(14), dp(12)); background = shape(Color.WHITE, 16)
        }
        val composer = LinearLayout(this).apply { gravity = Gravity.CENTER_VERTICAL }
        composer.addView(input, LinearLayout.LayoutParams(0, dp(52), 1f).apply { rightMargin = dp(8) })
        composer.addView(button("发送") { sendMessage() })
        root.addView(composer)
        setContentView(root)
        if (old.isBlank()) {
            addBubble("ai", firstQuestion())
        } else {
            old.lines().takeLast(30).forEach { line ->
                if (line.startsWith("我：")) addBubble("me", line.removePrefix("我："))
                else if (line.startsWith("AI：")) addBubble("ai", line.removePrefix("AI："))
            }
            addBubble("ai", "我们接着上次的内容。你现在最想先解决哪一个具体问题？")
        }
    }

    private fun firstQuestion(): String = when (module) {
        "情感挽回" -> "我先了解一下关系现状。你们现在属于哪一种情况？\n① 刚分手  ② 冷战中  ③ 失联/断联  ④ 对方提出分开但还在联系"
        "关系推进" -> "我们先确认你们目前的阶段。\n① 刚认识  ② 正在暧昧  ③ 已经约会  ④ 已恋爱但关系停滞"
        else -> "我们先从真实需求开始。你希望讨论哪一种经济投入？\n① 礼物  ② 约会/共同消费  ③ 旅行预算  ④ 日常经济支持"
    }

    private fun addBubble(who: String, message: String) {
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; setPadding(dp(13), dp(11), dp(13), dp(11))
            background = shape(if (who == "me") 0xFFFFE1EE.toInt() else Color.WHITE, 17)
        }
        box.addView(text(message, 14f, ink))
        val row = LinearLayout(this).apply { gravity = if (who == "me") Gravity.END else Gravity.START }
        row.addView(box, LinearLayout.LayoutParams(-2, -2).apply { leftMargin = dp(34); rightMargin = dp(34) })
        chat.addView(row, LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(10) })
        scroll.post { scroll.fullScroll(View.FOCUS_DOWN) }
    }

    private fun sendMessage() {
        val answer = input.text.toString().trim()
        if (answer.isEmpty()) return
        input.setText("")
        addBubble("me", answer)
        val old = prefs.getString("chat_$module", "").orEmpty()
        prefs.edit().putString("chat_$module", (old + "\\n我：" + answer).takeLast(8000)).apply()
        stage++
        val reply = when (module) {
            "情感挽回" -> listOf(
                "明白了。分开/冷淡大概持续多久了？",
                "这段时间里，对方有没有明确说过最在意或最无法接受的原因？尽量用对方原话描述。",
                "最近一次你们有交流是什么时候？当时双方分别说了什么？",
                "我先帮你梳理：哪些是已确认事实，哪些是你的猜测。你觉得目前最难改变的卡点是什么？"
            )
            "关系推进" -> listOf(
                "了解。你们最近一次互动是什么时候？是谁主动开启的？",
                "对方通常会怎样回应你？是积极延展话题、礼貌回复，还是经常中断？",
                "你希望关系自然走到哪一步？例如继续聊天、约见面，还是确认彼此想法？",
                "我会优先考虑双方舒适度。你觉得对方目前释放出的最明确积极信号是什么？"
            )
            else -> listOf(
                "这个需求对你来说最重要的原因是什么？是实际需要、共同体验，还是希望感受到对方的重视？",
                "你们之前谈过金钱和消费观念吗？对方当时怎么表达？",
                "你希望提出一个怎样具体、合理且双方都能承担的安排？",
                "我们可以把表达整理成清楚、真诚、不施压的沟通方式。对方如果拒绝，你能接受怎样的替代方案？"
            )
        }
        val response = reply[(stage - 1).coerceAtMost(reply.lastIndex)]
        addBubble("ai", response)
        val updated = prefs.getString("chat_$module", "").orEmpty()
        prefs.edit().putString("chat_$module", (updated + "\\nAI：" + response).takeLast(8000)).apply()
    }
}
