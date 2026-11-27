"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Level = { id?: string; title: string; teaser: string; priceMinor: number; privateContent: string };
const blank = (): Level => ({ title: "", teaser: "", priceMinor: 990, privateContent: "" });
export default function ExperienceEditor() {
  const { experienceId } = useParams<{ experienceId: string }>();
  const [levels,setLevels] = useState<Level[]>([blank()]);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const [shareUrl,setShareUrl] = useState("");
  const [isDirty,setIsDirty] = useState(false);
  useEffect(()=>{
    fetch(`/api/creator/experiences/${experienceId}/levels`).then(async r=>{
      const d=await r.json();
      if(!r.ok) throw new Error(d.error==="UNAUTHORIZED"?"请先登录创作者账户。":"无法读取关卡，请检查作品是否存在。");
      if(d.levels?.length) setLevels(d.levels.map((x:any)=>({id:x.id,title:x.title,teaser:x.teaser||"",priceMinor:Number(x.price_minor),privateContent:x.private_content||""})));
    }).catch(e=>setMessage(e instanceof Error?e.message:"加载失败")).finally(()=>setLoading(false));
  },[experienceId]);
  function change(index:number,key:keyof Level,value:string|number){
    setIsDirty(true);
    setLevels(old=>old.map((l,i)=>i===index?{...l,[key]:value}:l));
  }
  useEffect(()=>{
    if(!isDirty) return;
    const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};
    window.addEventListener("beforeunload",warn);
    return ()=>window.removeEventListener("beforeunload",warn);
  },[isDirty]);
  async function save(){
    setBusy(true);setMessage("");setShareUrl("");
    try{
      const invalidIndex=levels.findIndex(l=>!l.title.trim() || !Number.isFinite(Number(l.priceMinor)) || Number(l.priceMinor)<0 || Number(l.priceMinor)>100000000);
      if(invalidIndex>=0) throw new Error(`请检查第 ${invalidIndex+1} 关：标题不能为空，价格须为 0 至 1,000,000 元。`);
      const payload={levels:levels.map(l=>({title:l.title.trim(),teaser:l.teaser,priceMinor:Number(l.priceMinor),privateContent:l.privateContent}))};
      const r=await fetch(`/api/creator/experiences/${experienceId}/levels`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const d=await r.json();
      if(!r.ok) throw new Error(d.error==="UNAUTHORIZED"?"登录状态已失效，请重新登录。":"保存失败，请检查每关标题和价格。");
      setLevels(d.levels.map((x:any,i:number)=>({...levels[i],id:x.id,priceMinor:Number(x.price_minor)})));
      setIsDirty(false);
      setMessage("已保存。每关内容独立保存，尚未公开。");
    }catch(e){setMessage(e instanceof Error?e.message:"保存失败");}finally{setBusy(false);}
  }
  async function publish(){
    if(isDirty){setMessage("你有尚未保存的修改。请先点击「保存所有关卡」，再发布，避免发布旧版本。");return;}
    setBusy(true);setMessage("");setShareUrl("");
    try{
      const r=await fetch(`/api/creator/experiences/${experienceId}/publish`,{method:"POST"});
      const d=await r.json();
      if(!r.ok) throw new Error(d.error==="UNAUTHORIZED"?"请先登录。":"发布失败：请先至少保存一关内容。");
      const url=window.location.origin+d.shareUrl;setShareUrl(url);setMessage("作品已发布，可以复制链接分享。");
    }catch(e){setMessage(e instanceof Error?e.message:"发布失败");}finally{setBusy(false);}
  }
  async function copy(){if(shareUrl){await navigator.clipboard.writeText(shareUrl);setMessage("分享链接已复制。");}}
  if(loading)return <main className="creatorShell"><p className="notice">正在加载关卡…</p></main>;
  return <main className="creatorShell"><a href="/creator" className="back">← 返回工作台</a><section className="creatorCard editorCard"><p className="eyebrow">DESIGN YOUR JOURNEY</p><h1>关卡设计</h1><p className="sub">每一关都可以单独定价。公开页面只展示标题、提示和价格，私密内容仅在真实付款验证后开放。</p>
    {levels.map((level,index)=><article className="levelEditor" key={index}><div className="levelEditorTop"><b>第 {index+1} 关</b><button type="button" className="removeLevel" disabled={levels.length===1} onClick={()=>{setIsDirty(true);setLevels(old=>old.filter((_,i)=>i!==index));}}>删除此关</button></div>
      <label>关卡标题<input value={level.title} maxLength={80} onChange={e=>change(index,"title",e.target.value)} placeholder="例如：第一份小惊喜"/></label>
      <label>关卡提示（对方付款前可见）<textarea value={level.teaser} maxLength={240} onChange={e=>change(index,"teaser",e.target.value)} placeholder="写一小段提示，让对方知道这一关有什么期待…" rows={2}/></label>
      <label>本关价格（人民币）<div className="priceInput"><span>¥</span><input type="number" min="0" max="1000000" step="0.01" value={(level.priceMinor/100).toFixed(2)} onChange={e=>change(index,"priceMinor",Math.round(Number(e.target.value||0)*100))}/></div></label>
      <label>解锁后的私密内容<textarea value={level.privateContent} maxLength={20000} onChange={e=>change(index,"privateContent",e.target.value)} placeholder="写下只有对方完成本关付款后才能看到的内容…" rows={5}/></label>
    </article>)}
    <button className="addLevel" type="button" disabled={levels.length>=30} onClick={()=>{setIsDirty(true);setLevels(old=>[...old,blank()]);}}>＋ 添加下一关（最多 30 关）</button>
    <div className="editorActions"><button className="primary" disabled={busy} onClick={save}>{busy?"处理中…":isDirty?"保存修改 · 有未保存内容":"保存所有关卡"}</button><button className="publishButton" disabled={busy||isDirty} onClick={publish}>发布并生成分享链接 ↗</button></div>
    {shareUrl&&<div className="shareResult"><span>{shareUrl}</span><button onClick={copy}>复制链接</button><a href={shareUrl} target="_blank" rel="noreferrer">预览</a></div>}
    {isDirty&&<p className="notice" role="status">你有尚未保存的修改。离开页面前请先保存；发布按钮会在保存后开放。</p>}
    {message&&<p className="notice" role="status">{message}</p>}
    <p className="disclaimer">重要：真实支付尚未接入。当前发布仅用于展示关卡介绍与价格，不能向体验者收款或解锁私密内容。</p>
  </section></main>;
}
