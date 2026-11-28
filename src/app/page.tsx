const features = [
  "上传自己的封面照片，或选择甜美主题",
  "每一关独立定价，也支持免费关卡",
  "公开展示提示，私密内容按顺序解锁",
  "上传收款码，双方自行完成转账确认",
  "生成专属分享链接，查看对方留下的回应"
];

export default function Home() {
  return <main className="shell">
    <nav><span className="logo">♡</span><b>心意闯关</b><span className="tag">HEART STUDIO</span></nav>
    <section className="hero">
      <p className="eyebrow">A LITTLE JOURNEY OF HEART</p>
      <h1>把心意，设计成<br/><em>一场逐关解锁的惊喜。</em></h1>
      <p className="lead">上传一张喜欢的封面，设计一关关专属内容。每一关都可以独立定价，也可以免费开放，再把这段小旅程分享给对方。</p>
      <div className="actions"><a className="primary" href="/creator">开始制作 ♡</a><a className="secondary" href="#features">了解玩法</a></div>
      <div className="preview">
        <div className="heart">♡</div><small>A LITTLE SURPRISE FOR YOU</small>
        <h2>给你的一场心意小旅行</h2><p>每打开一扇小门，都有一份认真准备的惊喜。</p>
        <div className="level"><span>01</span><b>第一份小惊喜</b><strong>免费</strong><i>♡</i></div>
        <div className="level"><span>02</span><b>藏起来的悄悄话</b><strong>¥19.90</strong><i>♡</i></div>
        <div className="level"><span>03</span><b>最后一份心意</b><strong>¥29.90</strong><i>♡</i></div>
        <small className="foot">示意内容 · 当前不提供平台代收款或到账核验</small>
      </div>
    </section>
    <section id="features" className="features"><p className="eyebrow">DESIGNED FOR CREATORS</p><h2>让每一份心意，都有自己的打开方式。</h2>
      <div className="grid">{features.map((feature,index)=><article key={feature}><span>0{index+1}</span><b>{feature}</b></article>)}</div>
      <div className="actions"><a className="primary" href="/creator">进入创作者工作台</a></div>
    </section>
    <footer>Heart Studio · 情侣互动闯关体验 · 平台支付尚未开通<br/><a href="/privacy">隐私政策（草案）</a><span> · </span><a href="/terms">服务条款（草案）</a></footer>
  </main>;
}
