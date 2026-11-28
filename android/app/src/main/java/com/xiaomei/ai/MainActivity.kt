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
            text = "♥"; textSize = 34f; gravity = Gravity.CENTER; setTextColor(Color.WHITE)
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
        hero.addView(text("把你的情况告诉我，\n我来帮你分析并找到下一步。", 17f, deep, true)); gap(hero, 10)
        hero.addView(text("不需要一次填写很多资料。我们从最重要的问题开始。", 13f, muted)); gap(hero, 15)
        hero.addView(button("开始分析  ›") { openModule("情感挽回") })
        root.addView(hero); gap(root, 24)
        root.addView(text("选择你现在需要的帮助", 19f, deep, true)); gap(root, 5)
        root.addView(text("少问无关问题，先分析，再给你能执行的办法", 12f, muted)); gap(root, 14)

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
        title.addView(text("情感助手 · 主动分析与行动建议", 11f, muted))
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
        "情感挽回" -> "先别急着做挽回动作。通常最重要的是分清：对方是在情绪上想暂时拉开距离，还是已经对关系作出决定。你可以先告诉我发生了什么，我会帮你判断眼下最稳妥的一步。"
        "关系推进" -> "关系推进不靠一味主动，而是看互动有没有形成来回。把最近一次互动告诉我，我先帮你判断对方的投入程度，再给你一个自然的下一步。"
        else -> "谈经济投入，关键不是让对方掏钱，而是把需求、能力和双方认可的分担方式说清楚。告诉我你现在想商量的具体事情，我会帮你整理成直接、得体又不施压的表达。"
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
        val response = when (module) {
            "情感挽回" -> when {
                answer.contains("分手") || answer.contains("分开") || answer.contains("不想") ->
                    "从你说的情况看，现在最重要的不是马上解释或挽回，而是先弄清对方提出分开的核心原因。\n\n建议你先暂停连续追问和长篇解释，避免让对方更有压力。接下来可以发：\n「我听到了你的想法，我不会逼你现在给答案。我也想认真看看我们之间到底出了什么问题，等彼此平静一点再谈。」\n\n这一步的目的不是保证复合，而是先稳住沟通空间。"
                answer.length < 18 ->
                    "我先给你一个初步判断：目前信息还不够下定论，但不建议急着连续发消息或用承诺换回应。先保持沟通克制，把注意力放在对方明确表达过的原因上。\n\n如果方便，把对方最近说过的关键一句话发给我，我可以据此把方案收窄。"
                else ->
                    "我把你刚才说的情况整理了一下。眼下优先处理的不是所有矛盾，而是最影响关系走向的那个核心问题。\n\n先做三件事：暂停情绪化追问；把事实和自己的猜测分开；选择一个双方都能平静沟通的时机。你可以把这段话作为开场：\n「我想把事情谈清楚，不是为了争输赢，而是想知道我们是否还有一起调整的意愿。」"
            }
            "关系推进" -> when {
                answer.contains("不回") || answer.contains("冷淡") || answer.contains("慢") ->
                    "如果对方回复变慢，先别用更高频率的消息去补。更有效的做法是发一条轻松、具体、容易回应的内容，然后观察对方是否主动延展话题。\n\n可以这样说：\n「刚看到一个东西让我想到你，感觉你可能会喜欢。」\n\n发出后先留出空间，不要紧接着追问。"
                else ->
                    "从关系推进的角度，建议你先做一个低压力、具体的小动作，而不是急着确认关系。\n\n可以试试：「这周我想去试试那家店，感觉你可能也会喜欢。你有兴趣一起去吗？」\n\n对方如果积极回应，就把时间地点落实；如果含糊或拒绝，就尊重节奏，不连续施压。"
            }
            else -> when {
                answer.contains("礼物") ->
                    "礼物需求可以直说，重点是表达偏好，而不是把礼物当作感情考试。可以说：\n「我其实挺喜欢有心意的小礼物。如果你愿意在特别的日子准备一份，我会很开心。当然也想听听你对这件事的看法。」\n\n先看双方对心意和消费的理解是否一致。"
                answer.contains("旅行") || answer.contains("预算") ->
                    "旅行费用最好在出发前讲清楚。可以直接说：\n「这次旅行我估算总预算大约是____，我希望我们提前商量怎么分担，按各自能力和实际安排来定。你觉得怎样比较合适？」\n\n明确金额和分担方式，比用暗示让对方猜更容易达成共识。"
                else ->
                    "你可以把经济需求说清楚，同时给对方真实选择空间。建议表达为：\n「我想和你商量一件实际的事：____。这对我来说确实重要，我希望知道你是否愿意、也是否有能力一起承担。我们可以讨论一个双方都舒服的方式。」\n\n对方的回应也能帮助你判断双方的价值观和投入是否匹配。"
            }
        }
        val typing = text("正在整理思路…", 12f, muted).apply { setPadding(dp(10), dp(4), dp(10), dp(8)) }
        chat.addView(typing)
        scroll.post { scroll.fullScroll(View.FOCUS_DOWN) }
        android.os.Handler(mainLooper).postDelayed({
            chat.removeView(typing)
            addBubble("ai", response)
            val updated = prefs.getString("chat_$module", "").orEmpty()
            prefs.edit().putString("chat_$module", (updated + "\\nAI：" + response).takeLast(8000)).apply()
        }, (850L + response.length.coerceAtMost(180) * 12L))
    }
}
