"use client";
import { useEffect, useRef, useState } from "react";
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
  const [previewMode,setPreviewMode] = useState(false);
  const [previewLevelIndex,setPreviewLevelIndex] = useState<number|null>(null);
  const [previewReaction,setPreviewReaction] = useState<string|null>(null);
  const [previewClosing,setPreviewClosing] = useState(false);
  const previewOpenerRef = useRef<HTMLButtonElement|null>(null);
  function openPreviewLevel(index:number, opener:HTMLButtonElement){previewOpenerRef.current=opener;setPreviewReaction(null);setPreviewLevelIndex(index);}
  function closePreviewLevel(){if(previewLevelIndex===null||previewClosing)return;setPreviewClosing(true);window.setTimeout(()=>{setPreviewLevelIndex(null);setPreviewClosing(false);window.requestAnimationFrame(()=>previewOpenerRef.current?.focus());},180);}
  useEffect(()=>{if(previewLevelIndex===null)return;const previous=document.body.style.overflow;document.body.style.overflow="hidden";const focus=window.setTimeout(()=>document.querySelector<HTMLButtonElement>(".creatorJourneyDialogClose")?.focus(),40);const key=(event:KeyboardEvent)=>{if(event.key==="Escape")closePreviewLevel();if(event.key==="Tab"){const dialog=document.querySelector<HTMLElement>(".creatorJourneyDialog");const items=dialog?.querySelectorAll<HTMLElement>('button:not(:disabled),[tabindex]:not([tabindex="-1"])');if(!items?.length)return;const first=items[0],last=items[items.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}};document.addEventListener("keydown",key);return()=>{window.clearTimeout(focus);document.removeEventListener("keydown",key);document.body.style.overflow=previous;};},[previewLevelIndex]);
  const [experienceInfo,setExperienceInfo] = useState({title:"一份专属心意",description:"有人为你准备了一段小小的心意旅程。每打开一扇门，都有一份认真准备的惊喜。",theme:"rose",coverUrl:"",coverPosition:"center"});
  const [themeBusy,setThemeBusy] = useState(false);
  const [coverBusy,setCoverBusy] = useState(false);
  const [coverMessage,setCoverMessage] = useState("");
  const coverPresets=[{id:"preset:rose",label:"甜粉花雾",style:"linear-gradient(135deg,#f9dce5,#fbeef1 55%,#eac1cf)"},{id:"preset:cream",label:"奶油暖光",style:"linear-gradient(135deg,#f4e4c9,#fff8eb 55%,#e9d2aa)"},{id:"preset:lavender",label:"梦幻紫雾",style:"linear-gradient(135deg,#e5daf8,#f8f3ff 55%,#cfc0ed)"},{id:"preset:night",label:"星夜心愿",style:"linear-gradient(135deg,#444064,#8d7ba9 55%,#e6c6d6)"}];
  async function saveCoverPosition(coverPosition:string){setCoverBusy(true);setCoverMessage("");try{const r=await fetch(`/api/creator/experiences/${experienceId}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({coverPosition})});if(!r.ok)throw new Error("封面位置保存失败");setExperienceInfo(old=>({...old,coverPosition}));setCoverMessage("封面构图已保存。");}catch(e){setCoverMessage(e instanceof Error?e.message:"保存失败");}finally{setCoverBusy(false);}}
  async function saveCover(coverUrl:string){setCoverBusy(true);setCoverMessage("");try{const r=await fetch(`/api/creator/experiences/${experienceId}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({coverUrl})});const d=await r.json();if(!r.ok)throw new Error("封面保存失败，请稍后重试。");setExperienceInfo(old=>({...old,coverUrl:d.experience.cover_url||d.experience.coverUrl||coverUrl}));setCoverMessage("封面已保存，分享页预览已同步。");}catch(e){setCoverMessage(e instanceof Error?e.message:"封面保存失败");}finally{setCoverBusy(false);}}
  async function clearCover(){setCoverBusy(true);setCoverMessage("");try{const r=await fetch(`/api/creator/experiences/${experienceId}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({coverUrl:"",coverPosition:"center"})});if(!r.ok)throw new Error("移除封面失败，请稍后重试。");setExperienceInfo(old=>({...old,coverUrl:"",coverPosition:"center"}));setCoverMessage("已移除封面，分享页将使用主题默认样式。");}catch(e){setCoverMessage(e instanceof Error?e.message:"移除失败");}finally{setCoverBusy(false);}}
  async function uploadCover(file?:File){
    if(!file)return;
    const allowed=["image/jpeg","image/png","image/webp","image/gif"];
    if(!allowed.includes(file.type)){setCoverMessage("请选择 JPG、PNG、WEBP 或 GIF 图片。");return;}
    if(file.size>8*1024*1024){setCoverMessage("图片不能超过 8MB。");return;}
    setCoverBusy(true);setCoverMessage("正在检查图片…");
    try{
      const header=new Uint8Array(await file.slice(0,12).arrayBuffer());
      const signatures:Record<string,number[]>={"image/jpeg":[0xff,0xd8,0xff],"image/png":[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a],"image/gif":[0x47,0x49,0x46,0x38],"image/webp":[0x52,0x49,0x46,0x46]};
      const signature=signatures[file.type];
      if(!signature||!signature.every((byte,index)=>header[index]===byte)||(file.type==="image/webp"&&String.fromCharCode(...header.slice(8,12))!=="WEBP"))throw new Error("图片格式与文件内容不一致，请重新选择原始图片。");
      const bitmap=await createImageBitmap(file);
      const pixels=bitmap.width*bitmap.height;
      bitmap.close();
      if(!pixels||pixels>40000000)throw new Error("图片尺寸过大，请选择长宽乘积不超过 4000 万像素的图片。");
      setCoverMessage("正在上传封面…");
      const form=new FormData();
      form.append("file",file);
      const upload=await fetch(`/api/creator/experiences/${experienceId}/cover-upload`,{method:"POST",body:form});
      const result=await upload.json();
      if(!upload.ok)throw new Error(result.error==="STORAGE_NOT_CONFIGURED"?"图片存储尚未配置，暂时无法上传。":result.error==="INVALID_IMAGE_CONTENT"?"图片文件内容或尺寸无效，请重新导出后上传。":result.error==="REQUEST_TOO_LARGE"?"图片不能超过 8MB。":"图片上传失败，请稍后重试。");
      await saveCover(result.publicUrl);
    }catch(e){setCoverMessage(e instanceof Error?e.message:"上传失败");setCoverBusy(false);}
  }

  async function changeTheme(theme:"rose"|"cream"|"lavender"){
    setThemeBusy(true);setMessage("");
    try{
      const response=await fetch(`/api/creator/experiences/${experienceId}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({theme})});
      const data=await response.json();
      if(!response.ok) throw new Error("主题保存失败，请稍后重试。");
      setExperienceInfo(old=>({...old,theme:data.experience.theme||theme}));
      setMessage("分享页主题已保存。");
    }catch(error){setMessage(error instanceof Error?error.message:"主题保存失败");}
    finally{setThemeBusy(false);}
  }
  useEffect(()=>{
    fetch(`/api/creator/experiences/${experienceId}`).then(async r=>{const d=await r.json();if(r.ok&&d.experience)setExperienceInfo({title:d.experience.title||"一份专属心意",description:d.experience.description||"有人为你准备了一段小小的心意旅程。每打开一扇门，都有一份认真准备的惊喜。",theme:["rose","cream","lavender"].includes(d.experience.theme)?d.experience.theme:"rose",coverUrl:d.experience.cover_url||d.experience.coverUrl||"",coverPosition:d.experience.cover_position||"center"});}).catch(()=>{});
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
      const invalidIndex=levels.findIndex(l=>!l.title.trim() || !Number.isFinite(Number(l.priceMinor)) || Number(l.priceMinor)<1 || Number(l.priceMinor)>100000000);
      if(invalidIndex>=0) throw new Error(`请检查第 ${invalidIndex+1} 关：标题不能为空，价格须为 0.01 至 1,000,000 元。`);
      const payload={levels:levels.map(l=>({...(l.id?{id:l.id}:{}),title:l.title.trim(),teaser:l.teaser,priceMinor:Number(l.priceMinor),privateContent:l.privateContent}))};
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
      if(!r.ok) throw new Error(d.error==="UNAUTHORIZED"?"请先登录。":d.error==="EMAIL_NOT_VERIFIED"?"请先到工作台验证邮箱，再发布作品。":"发布失败：请先至少保存一关内容。");
      const url=window.location.origin+d.shareUrl;setShareUrl(url);setMessage("作品已发布，可以复制链接分享。");
    }catch(e){setMessage(e instanceof Error?e.message:"发布失败");}finally{setBusy(false);}
  }
  async function copy(){
    if(!shareUrl)return;
    try{
      if(navigator.clipboard?.writeText){
        await navigator.clipboard.writeText(shareUrl);
      }else{
        const input=document.createElement("textarea");
        input.value=shareUrl;
        input.setAttribute("readonly","");
        input.style.position="fixed";
        input.style.opacity="0";
        document.body.appendChild(input);
        input.select();
        const copied=document.execCommand("copy");
        input.remove();
        if(!copied)throw new Error("COPY_FAILED");
      }
      setMessage("分享链接已复制，可以发送给对方了。");
    }catch{
      setMessage("自动复制暂不可用，请长按上方分享链接并选择复制。");
    }
  }
  if(loading)return <main className="creatorShell"><p className="notice">正在加载关卡…</p></main>;
  return <main className="creatorShell"><a href="/creator" className="back">← 返回工作台</a><section className="creatorCard editorCard"><p className="eyebrow">DESIGN YOUR JOURNEY</p><h1>关卡设计</h1><p className="sub">把每一关设计成一次小互动：留下一段提示、安排一份惊喜，再给对方一个回应你的机会。关卡金额目前仅作展示参考，平台尚未接入收款。</p>
    <section className="themePicker"><div><b>分享页主题</b><span>选择对方打开链接时看到的整体氛围</span></div><div className="themeOptions"><button type="button" className={experienceInfo.theme==="rose"?"themeChoice selected":"themeChoice"} disabled={themeBusy} onClick={()=>changeTheme("rose")}><i className="themeSwatch roseSwatch"/>甜粉</button><button type="button" className={experienceInfo.theme==="cream"?"themeChoice selected":"themeChoice"} disabled={themeBusy} onClick={()=>changeTheme("cream")}><i className="themeSwatch creamSwatch"/>奶油</button><button type="button" className={experienceInfo.theme==="lavender"?"themeChoice selected":"themeChoice"} disabled={themeBusy} onClick={()=>changeTheme("lavender")}><i className="themeSwatch lavenderSwatch"/>梦幻紫</button></div></section>
    <section className="coverEditor"><div className="coverEditorHeading"><b>专属封面</b><span>上传手机相册照片，或选择一款氛围素材</span></div><div className="coverPreview" style={{background:experienceInfo.coverUrl?.startsWith("preset:")?coverPresets.find(x=>x.id===experienceInfo.coverUrl)?.style:undefined}}>{experienceInfo.coverUrl&&!experienceInfo.coverUrl.startsWith("preset:")?<img src={experienceInfo.coverUrl} alt="作品封面预览" style={{objectPosition:experienceInfo.coverPosition}}/>:<span>♡<small>{coverPresets.find(x=>x.id===experienceInfo.coverUrl)?.label||"为这段旅程选择一张封面"}</small></span>}</div><div className="coverPresetGrid">{coverPresets.map(item=><button type="button" key={item.id} disabled={coverBusy} className={experienceInfo.coverUrl===item.id?"coverPreset selected":"coverPreset"} onClick={()=>saveCover(item.id)}><i style={{background:item.style}}/><span>{item.label}</span></button>)}</div>{experienceInfo.coverUrl&&<button type="button" className="coverRemoveButton" disabled={coverBusy} onClick={clearCover}>移除当前封面</button>}<label className="coverUploadButton">从手机相册上传照片<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={coverBusy} onChange={e=>{void uploadCover(e.target.files?.[0]);e.currentTarget.value="";}}/></label><div className="coverPositionPicker"><span>照片构图</span>{[{id:"top",label:"上方"},{id:"center",label:"居中"},{id:"bottom",label:"下方"}].map(item=><button type="button" key={item.id} disabled={coverBusy||!experienceInfo.coverUrl||experienceInfo.coverUrl.startsWith("preset:")} className={experienceInfo.coverPosition===item.id?"active":""} onClick={()=>saveCoverPosition(item.id)}>{item.label}</button>)}</div><small className="coverHint">支持 JPG、PNG、WEBP、GIF，最大 8MB、4000 万像素；会先检查图片格式与尺寸。上传照片需要配置对象存储。</small>{coverMessage&&<p className="coverMessage" role="status">{coverMessage}</p>}</section>
    <div className="previewToolbar"><div><b>男生体验预览</b><span>点开任意一关，体验弹窗、惊喜内容和互动回应；全部为本地模拟</span></div><button type="button" onClick={()=>setPreviewMode(value=>!value)}>{previewMode?"收起预览":"打开互动预览 ↗"}</button></div>
    {previewMode&&<section className={`creatorPreview themePreview-${experienceInfo.theme}`}><div className="creatorPreviewHero">{experienceInfo.coverUrl&&!experienceInfo.coverUrl.startsWith("preset:")?<img className="creatorPreviewCover" src={experienceInfo.coverUrl} alt="封面" style={{objectPosition:experienceInfo.coverPosition}}/>:experienceInfo.coverUrl?<div className="creatorPreviewCover" style={{background:coverPresets.find(x=>x.id===experienceInfo.coverUrl)?.style}}>♡</div>:null}<span>♡</span><small>A LITTLE JOURNEY FOR YOU</small><h2>{experienceInfo.title}</h2><p>{experienceInfo.description}</p></div><div className="creatorPreviewLevels">{levels.map((level,index)=><article key={level.id||index}><span className="creatorPreviewNumber">{String(index+1).padStart(2,"0")}</span><div><b>{level.title.trim()||"未填写关卡标题"}</b><p>{level.teaser.trim()||"一份为你准备的小惊喜，打开后就能看到更多。"}</p></div><strong>¥{(Number(level.priceMinor||0)/100).toFixed(2)}</strong><button type="button" className="creatorPreviewOpen" onClick={event=>openPreviewLevel(index,event.currentTarget)}>打开这一关 ↗</button></article>)}</div><p className="creatorPreviewFoot">创作者专属模拟预览：可查看惊喜内容并试用回应按钮，不创建订单、不写入真实收件箱。</p></section>}
    {previewLevelIndex!==null&&levels[previewLevelIndex]&&<div className={previewClosing?"journeyModalBackdrop closing":"journeyModalBackdrop"} role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)closePreviewLevel();}}><section className="journeyDialog creatorJourneyDialog" role="dialog" aria-modal="true" aria-labelledby="creatorJourneyTitle" aria-describedby="creatorJourneyDescription"><button type="button" className="journeyDialogClose creatorJourneyDialogClose" onClick={closePreviewLevel} aria-label="关闭预览">×</button><div className="journeyDialogGlow" aria-hidden="true"/><div className="journeyDialogSeal">♡</div><p className="journeyDialogEyebrow">A LITTLE SECRET FOR YOU · PREVIEW</p><h2 id="creatorJourneyTitle">{levels[previewLevelIndex].title.trim()||"未填写关卡标题"}</h2><p className="journeyDialogDescription" id="creatorJourneyDescription">{levels[previewLevelIndex].teaser.trim()||"一份为你准备的小惊喜，打开后就能看到更多。"}</p><div className="journeyDialogPrice">¥{(Number(levels[previewLevelIndex].priceMinor||0)/100).toFixed(2)} <span>心意金额参考</span></div><div className="journeyDialogStatus" aria-live="polite">这是创作者预览模式，以下内容仅供你检查效果。</div>{levels[previewLevelIndex].privateContent.trim()&&<div className="privateContentView">{levels[previewLevelIndex].privateContent}</div>}<div className="heartReaction journeyDialogReactions"><span>模拟体验者此刻的回应</span><div>{["心动 ♡","想你 ✨","抱抱 🫶"].map(item=><button type="button" key={item} className={previewReaction===item?"chosenReaction":""} onClick={()=>setPreviewReaction(item)}>{item}</button>)}</div>{previewReaction&&<small aria-live="polite">模拟回应：{previewReaction}。正式分享页会将真实回应送到你的心意收件箱。</small>}</div><button type="button" className="journeyDialogDone" onClick={closePreviewLevel}>预览完成，收好这份心意 ♡</button><p className="journeyDialogFootnote">仅本地模拟 · 不会产生订单或真实互动</p></section></div>}
    {levels.map((level,index)=><article className="levelEditor" key={index}><div className="levelEditorTop"><b>第 {index+1} 关</b><div className="levelEditorControls"><button type="button" className="moveLevel" aria-label={`第 ${index+1} 关上移`} disabled={busy||index===0} onClick={()=>{setIsDirty(true);setLevels(old=>{const next=[...old];[next[index-1],next[index]]=[next[index],next[index-1]];return next;});}}>↑ 上移</button><button type="button" className="moveLevel" aria-label={`第 ${index+1} 关下移`} disabled={busy||index===levels.length-1} onClick={()=>{setIsDirty(true);setLevels(old=>{const next=[...old];[next[index],next[index+1]]=[next[index+1],next[index]];return next;});}}>↓ 下移</button><button type="button" className="removeLevel" disabled={busy||levels.length===1} onClick={()=>{setIsDirty(true);setLevels(old=>old.filter((_,i)=>i!==index));}}>删除此关</button></div></div>
      <label>关卡标题<input disabled={busy} value={level.title} maxLength={80} onChange={e=>change(index,"title",e.target.value)} placeholder="例如：第一份小惊喜"/></label>
      <label>关卡提示（进入前可见）<textarea disabled={busy} value={level.teaser} maxLength={240} onChange={e=>change(index,"teaser",e.target.value)} placeholder="写一小段提示，让对方知道这一关有什么期待…" rows={2}/></label>
      <label>本关心意金额（展示参考，人民币）<div className="priceInput"><span>¥</span><input disabled={busy} type="number" min="0.01" max="1000000" step="0.01" value={(level.priceMinor/100).toFixed(2)} onChange={e=>change(index,"priceMinor",Math.round(Number(e.target.value||0)*100))}/></div></label>
      <label>打开本关后展示的惊喜内容<textarea disabled={busy} value={level.privateContent} maxLength={20000} onChange={e=>change(index,"privateContent",e.target.value)} placeholder="写下打开这一关后，希望对方看到的惊喜…" rows={5}/></label>
    </article>)}
    <button className="addLevel" type="button" disabled={busy||levels.length>=30} onClick={()=>{setIsDirty(true);setLevels(old=>[...old,blank()]);}}>＋ 添加下一关（最多 30 关）</button>
    <div className="editorActions"><button className="primary" disabled={busy} onClick={save}>{busy?"处理中…":isDirty?"保存修改 · 有未保存内容":"保存所有关卡"}</button><button className="publishButton" disabled={busy||isDirty} onClick={publish}>发布并生成分享链接 ↗</button></div>
    {shareUrl&&<div className="shareResult"><span>{shareUrl}</span><button onClick={copy}>复制链接</button><a href={shareUrl} target="_blank" rel="noreferrer">预览</a></div>}
    {isDirty&&<p className="notice" role="status">你有尚未保存的修改。离开页面前请先保存；发布按钮会在保存后开放。</p>}
    {message&&<p className="notice" role="status">{message}</p>}
    <p className="disclaimer">互动体验已开放：对方通过专属链接进入已发布关卡，就能看到你准备的惊喜并留下回应，你会在心意收件箱看到。金额仅作展示参考，当前不收款；请只把专属链接发给你希望邀请的人。</p>
  </section></main>;
}
