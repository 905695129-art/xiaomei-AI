"use client";
import { useEffect, useState } from "react";

type Experience = { id: string; slug: string; title: string; description: string; status: string };
type CreatorSession = { id: string; created_at: string; expires_at: string; is_current: boolean };
export default function CreatorPage() {
  const [mode,setMode] = useState<"login"|"register">("register");
  const [email,setEmail] = useState(""); const [password,setPassword] = useState(""); const [displayName,setDisplayName] = useState("");
  const [currentPassword,setCurrentPassword] = useState(""); const [newPassword,setNewPassword] = useState("");
  const [user,setUser] = useState<{email:string;displayName:string}|null>(null);
  const [experiences,setExperiences] = useState<Experience[]>([]);
  const [sessions,setSessions] = useState<CreatorSession[]>([]);
  const [emailVerified,setEmailVerified] = useState(false); const [verificationEmail,setVerificationEmail] = useState("");
  const [title,setTitle] = useState(""); const [slug,setSlug] = useState("");
  const [editingId,setEditingId] = useState<string|null>(null);
  const [editTitle,setEditTitle] = useState(""); const [editDescription,setEditDescription] = useState("");
  const [message,setMessage] = useState("正在检查登录状态…"); const [busy,setBusy] = useState(false);

  async function load() {
    const r=await fetch("/api/creator/experiences");
    if(r.ok){const d=await r.json();setExperiences(d.experiences);setUser(v=>v??{email:"已登录",displayName:"创作者"});const sr=await fetch("/api/auth/sessions",{cache:"no-store"});if(sr.ok){const sd=await sr.json();setSessions(sd.sessions||[]);}else{setSessions([]);}const vr=await fetch("/api/auth/verification",{cache:"no-store"});if(vr.ok){const vd=await vr.json();setEmailVerified(Boolean(vd.verified));setVerificationEmail(vd.email||"");}else{setEmailVerified(false);setVerificationEmail("");}setMessage("");}
    else {setUser(null);setSessions([]);setMessage("登录或注册后即可创建作品。");}
  }
  useEffect(()=>{load().catch(()=>setMessage("暂时无法连接服务器。"));},[]);
  async function auth(e:React.FormEvent) {
    e.preventDefault();setBusy(true);setMessage("");
    try {
      const r=await fetch("/api/auth",{method:"POST",headers:{"Content-Type":"application/json","x-heart-mode":mode},body:JSON.stringify({email,password,displayName})});
      const d=await r.json();
      if(!r.ok) throw new Error(d.message||({EMAIL_EXISTS:"该邮箱已注册，请切换到登录。",INVALID_CREDENTIALS:"邮箱或密码不正确。",SERVICE_NOT_CONFIGURED:"数据库尚未配置。"} as Record<string,string>)[d.error]||"操作失败，请稍后重试。");
      setUser(d.user);setMessage("登录成功。");await load();
    } catch(e){setMessage(e instanceof Error?e.message:"请求失败");} finally{setBusy(false);}
  }
  async function create(e:React.FormEvent) {
    e.preventDefault();setBusy(true);setMessage("");
    try{
      const r=await fetch("/api/creator/experiences",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title,slug:slug.toLowerCase().replace(/[^a-z0-9-]/g,"-"),description:""})});
      const d=await r.json();if(!r.ok)throw new Error(d.error==="UNAUTHORIZED"?"请先登录。":"创建失败：请检查分享标识是否重复，且仅使用 3-48 位小写字母、数字和短横线。");
      setTitle("");setSlug("");await load();setMessage("作品创建成功。现在可以进入作品卡片编辑关卡。");
    }catch(e){setMessage(e instanceof Error?e.message:"请求失败");}finally{setBusy(false);}
  }
  function beginEdit(x:Experience){setEditingId(x.id);setEditTitle(x.title);setEditDescription(x.description||"");}
  async function saveDetails(e:React.FormEvent){
    e.preventDefault();if(!editingId)return;setBusy(true);setMessage("");
    try{
      const r=await fetch(`/api/creator/experiences/${editingId}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:editTitle,description:editDescription})});
      const d=await r.json();if(!r.ok)throw new Error(d.error==="INVALID_INPUT"?"标题不能为空，简介最多 1000 字。":"保存作品信息失败，请稍后重试。");
      setEditingId(null);await load();setMessage("作品名称和介绍已更新。");
    }catch(e){setMessage(e instanceof Error?e.message:"保存失败");}finally{setBusy(false);}
  }
  async function archive(x:Experience) {
    const next=x.status==="archived"?"draft":"archived";
    if(next==="archived"&&!window.confirm("归档后，体验者将无法通过分享链接打开此作品；已有订单记录会保留。确定归档吗？")) return;
    setBusy(true);setMessage("");
    try {
      const r=await fetch(`/api/creator/experiences/${x.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:next})});
      if(!r.ok)throw new Error("操作失败，请刷新后重试。");
      await load();setMessage(next==="archived"?"作品已归档，历史记录保留。":"作品已恢复为草稿。");
    } catch(e){setMessage(e instanceof Error?e.message:"操作失败");} finally{setBusy(false);}
  }
  async function logout(){await fetch("/api/auth/logout",{method:"POST"});setUser(null);setExperiences([]);setSessions([]);setMessage("已退出登录。")}
  async function changePassword(e:React.FormEvent){
    e.preventDefault();setBusy(true);setMessage("");
    try{
      const r=await fetch("/api/auth/password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({currentPassword,newPassword})});
      const d=await r.json();
      if(!r.ok)throw new Error(({INVALID_CURRENT_PASSWORD:"当前密码不正确。",PASSWORD_UNCHANGED:"新密码不能与当前密码相同。",INVALID_INPUT:"新密码至少需要 10 位。",TOO_MANY_ATTEMPTS:"修改密码尝试次数过多，请 15 分钟后再试。",UNAUTHORIZED:"登录状态已失效，请重新登录。"} as Record<string,string>)[d.error]||"密码修改失败，请稍后重试。");
      setCurrentPassword("");setNewPassword("");await load();setMessage("密码已更新，其他设备的登录会话也已撤销。");
    }catch(e){setMessage(e instanceof Error?e.message:"操作失败");}finally{setBusy(false);}
  }
  async function sendVerification(){
    setBusy(true);setMessage("");
    try{
      const r=await fetch("/api/auth/verification",{method:"POST"});
      const d=await r.json();
      if(!r.ok)throw new Error(({EMAIL_DELIVERY_NOT_CONFIGURED:"邮件服务尚未配置，暂时无法发送验证邮件。",TOO_MANY_ATTEMPTS:"发送次数过多，请一小时后再试。",UNAUTHORIZED:"登录状态已失效，请重新登录。"} as Record<string,string>)[d.error]||"验证邮件发送失败，请稍后重试。");
      setMessage(d.message||"验证邮件已发送，请检查收件箱。");
    }catch(e){setMessage(e instanceof Error?e.message:"发送失败");}finally{setBusy(false);}
  }
  async function revokeOtherSessions(){
    if(!window.confirm("这会让其他设备上的创作者账户退出登录，但保留当前设备。确定继续吗？"))return;
    setBusy(true);setMessage("");
    try{
      const r=await fetch("/api/auth/sessions",{method:"POST"});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error==="UNAUTHORIZED"?"登录状态已失效，请重新登录。":"暂时无法撤销其他设备的登录。");
      setMessage(d.revokedCount>0?`已让其他 ${d.revokedCount} 个登录会话退出。`:"没有发现其他有效登录设备。");
    }catch(e){setMessage(e instanceof Error?e.message:"操作失败");}finally{setBusy(false);}
  }
  return <main className="creatorShell"><a href="/" className="back">♡ 心意闯关</a><section className="creatorCard"><p className="eyebrow">CREATOR STUDIO</p><h1>创作者工作台</h1><p className="sub">创建你的专属心意作品，再逐步设计每一道关卡。</p>
  {!user ? <><div className="switch"><button className={mode==="register"?"chosen":""} onClick={()=>setMode("register")}>注册</button><button className={mode==="login"?"chosen":""} onClick={()=>setMode("login")}>登录</button></div><form onSubmit={auth} className="form">{mode==="register"&&<label>显示昵称<input value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="怎么称呼你" maxLength={40}/></label>}<label>邮箱<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com"/></label><label>密码<input type="password" required minLength={10} value={password} onChange={e=>setPassword(e.target.value)} placeholder="至少 10 位"/></label><button className="primary" disabled={busy}>{busy?"请稍候…":mode==="register"?"创建创作者账户":"登录工作台"}</button></form></>:<>
    <div className="welcome"><b>{user.displayName||user.email}</b><div className="welcomeActions"><a href="/creator/orders">订单记录 ↗</a><button disabled={busy} onClick={revokeOtherSessions}>退出其他设备</button><button onClick={logout}>退出</button></div></div><section className="verificationPanel"><h2>邮箱状态</h2><p>{verificationEmail}</p>{emailVerified?<span className="verifiedBadge">✓ 已验证</span>:<><span className="unverifiedBadge">尚未验证</span><button type="button" disabled={busy} onClick={sendVerification}>发送验证邮件</button></>}</section><section className="sessionPanel"><h2>登录设备</h2><p>这里只显示当前账户的有效登录会话。退出其他设备不会影响当前设备。</p>{sessions.length===0?<span>暂未读取到有效会话。</span>:<ul>{sessions.map(s=><li key={s.id}><b>{s.is_current?"当前设备":"其他设备"}</b><span>登录时间：{new Date(s.created_at).toLocaleString()}</span><span>有效期至：{new Date(s.expires_at).toLocaleString()}</span></li>)}</ul>}</section><section className="passwordPanel"><h2>修改登录密码</h2><form className="form" onSubmit={changePassword}><label>当前密码<input type="password" autoComplete="current-password" required value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)}/></label><label>新密码<input type="password" autoComplete="new-password" minLength={10} maxLength={128} required value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="至少 10 位"/></label><button className="primary" disabled={busy}>更新密码</button></form><p>修改成功后，其他设备会自动退出登录。</p></section>
    <form onSubmit={create} className="form createForm"><label>作品名称<input required maxLength={80} value={title} onChange={e=>setTitle(e.target.value)} placeholder="例如：给你的一场心意旅行"/></label><label>分享标识<input required minLength={3} maxLength={48} value={slug} onChange={e=>setSlug(e.target.value)} placeholder="my-heart-story"/></label><button className="primary" disabled={busy}>＋ 创建作品</button></form>
    <h2>我的作品</h2>{experiences.length===0?<p className="empty">还没有作品，创建第一份心意吧。</p>:<div className="experienceList">{experiences.map(x=><div className="experienceWrap" key={x.id}>
      <article className="experience experienceItem"><div><b>{x.title}</b><span>{x.status==="published"?"已发布":x.status==="archived"?"已归档":"草稿"} · /{x.slug}</span></div><div className="experienceActions"><button type="button" disabled={busy} onClick={()=>beginEdit(x)}>编辑信息</button>{x.status!=="archived"&&<a href={`/creator/${x.id}`}>编辑关卡 →</a>}{x.status==="published"&&<a href={`/p/${x.slug}`} target="_blank" rel="noreferrer">预览分享页 ↗</a>}<button type="button" disabled={busy} onClick={()=>archive(x)}>{x.status==="archived"?"恢复草稿":"归档"}</button></div></article>
      {editingId===x.id&&<form className="detailsEditor" onSubmit={saveDetails}><label>作品名称<input required maxLength={80} value={editTitle} onChange={e=>setEditTitle(e.target.value)}/></label><label>作品介绍<textarea maxLength={1000} rows={3} value={editDescription} onChange={e=>setEditDescription(e.target.value)} placeholder="写一段分享页上展示的介绍…"/></label><div><button className="saveDetails" disabled={busy}>保存信息</button><button type="button" className="cancelDetails" onClick={()=>setEditingId(null)}>取消</button></div></form>}
    </div>)}</div>}
  </>}
  {message&&<p className="notice" role="status">{message}</p>}<p className="disclaimer">当前版本尚未开通真实支付。请勿在此收取真实款项。</p></section></main>;
}
