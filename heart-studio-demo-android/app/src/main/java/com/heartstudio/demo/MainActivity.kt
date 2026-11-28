package com.heartstudio.demo

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView

private const val HEART_STUDIO_PREVIEW = "https://905695129-art.github.io/xiaomei-AI/"
private val Rose = Color(0xFFC47D91)
private val Canvas = Color(0xFFFFF9F7)
private val Ink = Color(0xFF503B40)

class MainActivity : ComponentActivity() {
    private var webView: WebView? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            var loading by remember { mutableStateOf(true) }
            var failed by remember { mutableStateOf(false) }
            var progress by remember { mutableIntStateOf(0) }
            var canGoBack by remember { mutableStateOf(false) }
            var reloadKey by remember { mutableIntStateOf(0) }

            BackHandler(enabled = canGoBack) {
                webView?.goBack()
                canGoBack = webView?.canGoBack() == true
            }

            MaterialTheme(colorScheme = lightColorScheme(
                primary = Rose,
                background = Canvas,
                surface = Color.White
            )) {
                Box(Modifier.fillMaxSize().background(Canvas)) {
                    key(reloadKey) {
                        AndroidView(
                            modifier = Modifier.fillMaxSize(),
                            factory = { context ->
                                WebView(context).apply {
                                    webView = this
                                    settings.javaScriptEnabled = true
                                    settings.domStorageEnabled = true
                                    settings.loadsImagesAutomatically = true
                                    settings.javaScriptCanOpenWindowsAutomatically = false
                                    settings.setSupportMultipleWindows(false)
                                    settings.allowFileAccess = false
                                    settings.allowContentAccess = false
                                    webViewClient = object : WebViewClient() {
                                        override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                                            loading = true
                                            failed = false
                                        }
                                        override fun onPageFinished(view: WebView?, url: String?) {
                                            loading = false
                                            failed = false
                                            canGoBack = view?.canGoBack() == true
                                        }
                                        override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                                            if (request?.isForMainFrame == true) {
                                                loading = false
                                                failed = true
                                            }
                                        }
                                        override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                                            val target = request?.url ?: return false
                                            return if (target.scheme == "https" && target.host == "905695129-art.github.io") {
                                                false
                                            } else {
                                                true
                                            }
                                        }
                                    }
                                    webChromeClient = object : WebChromeClient() {
                                        override fun onProgressChanged(view: WebView?, newProgress: Int) {
                                            progress = newProgress
                                            if (newProgress >= 100) loading = false
                                        }
                                    }
                                    loadUrl(HEART_STUDIO_PREVIEW)
                                }
                            },
                            update = { }
                        )
                    }

                    if (loading && !failed) {
                        LinearProgressIndicator(
                            progress = { progress / 100f },
                            modifier = Modifier.fillMaxWidth().align(Alignment.TopCenter),
                            color = Rose,
                            trackColor = Color(0xFFF6E4E8)
                        )
                    }

                    if (failed) {
                        Column(
                            modifier = Modifier.align(Alignment.Center).padding(28.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text("暂时连接不上心意旅程", color = Ink, fontSize = 21.sp, fontWeight = FontWeight.Bold)
                            Spacer(Modifier.height(10.dp))
                            Text("请检查网络后重试。应用会直接打开你认可的 GitHub 交互预览网页。", color = Color(0xFF967F83), fontSize = 13.sp)
                            Spacer(Modifier.height(20.dp))
                            Button(onClick = { failed = false; loading = true; progress = 0; reloadKey++ }) {
                                Text("重新加载")
                            }
                        }
                    }
                }
            }
        }
    }

    override fun onDestroy() {
        webView?.apply {
            stopLoading()
            destroy()
        }
        webView = null
        super.onDestroy()
    }
}
