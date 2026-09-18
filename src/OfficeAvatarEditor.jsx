import { useEffect, useRef, useState } from 'react';
import { X, Upload, UserRound } from 'lucide-react';
import { validateAvatarUrl, prepareOfficeAvatar } from './officeProfiles.js';

export function OfficeAvatar({ src, className = '' }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return <span className={`ow-avatar ${className}`}>{src && !failed ? <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)}/> : <UserRound aria-hidden="true"/>}</span>;
}
const loadImage = src => new Promise((resolve,reject) => {
  const image = new Image(); const timer = setTimeout(() => { image.src = ''; reject(new Error('图片加载超时，请检查链接后重试。')); },15000);
  image.referrerPolicy='no-referrer';
  image.onload=()=>{clearTimeout(timer);resolve(image);};
  image.onerror=()=>{clearTimeout(timer);reject(new Error('无法读取这张图片，请使用可直接打开的图片链接。'));};
  image.src=src;
});
async function readUpload(file) {
  if (!['image/jpeg','image/png','image/webp','image/gif','image/avif'].includes(file.type)) throw new Error('请选择 JPG、PNG、WebP、GIF 或 AVIF 图片。');
  if(file.size > 12 * 1024 * 1024) throw new Error('图片不能超过 12 MB。');
  const url=URL.createObjectURL(file);
  try {
    const img=await loadImage(url); const canvas=document.createElement('canvas'); canvas.width=384;canvas.height=384;
    const context=canvas.getContext('2d'); if(!context) throw new Error('当前浏览器无法处理图片。');
    const side=Math.min(img.naturalWidth,img.naturalHeight);
    context.drawImage(img,(img.naturalWidth-side)/2,(img.naturalHeight-side)/2,side,side,0,0,384,384);
    return canvas.toDataURL('image/webp',.88);
  } finally { URL.revokeObjectURL(url); }
}
export function OfficeAvatarEditor({ seat, label, person, saved, sources, onSave, onClose }) {
  const [sourceKey,setSourceKey]=useState(person.sourceKey);
  const [avatar,setAvatar]=useState(saved?.avatar || '');
  const [url,setUrl]=useState(''); const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const dialog=useRef(null); const alive=useRef(true);
  useEffect(()=>{
    alive.current=true;const previous=document.activeElement;dialog.current?.querySelector('button')?.focus();
    return ()=>{alive.current=false;previous?.focus();};
  },[]);
  const source=sources.find(p=>p.key===sourceKey);
  const task=async fn=>{setBusy(true);setError('');try{const image=await fn();if(alive.current){setAvatar(image);setUrl('');}}catch(e){if(alive.current)setError(e.message);}finally{if(alive.current)setBusy(false);}};
  const save=entry=>{const result=onSave(seat,entry);if(result.ok)onClose();else setError(result.error || '暂时无法保存，请重试。');};
  const commit = async () => {
    setBusy(true);
    setError('');
    try {
      const entry = await prepareOfficeAvatar({sourceKey,avatar,url},loadImage);
      if (alive.current) save(entry);
    } catch (error) {
      if (alive.current) setError(error.message);
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const keys=e=>{
    if(e.key==='Escape'){e.stopPropagation();onClose();}
    if(e.key==='Tab'){
      const nodes=[...dialog.current.querySelectorAll('button:not(:disabled),select:not(:disabled),input:not(:disabled)')].filter(el=>el.offsetParent!==null);
      const first=nodes[0],last=nodes.at(-1);
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
    }
  };
  return <div className="ow-overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <section className="ow-editor" role="dialog" aria-modal="true" aria-labelledby="ow-editor-title" ref={dialog} onKeyDown={keys}>
      <header><h2 id="ow-editor-title">{label}头像</h2><button className="ow-icon" aria-label="关闭头像编辑" onClick={onClose}><X size={21}/></button></header>
      <div className="ow-editor-preview"><OfficeAvatar src={avatar || source?.avatar}/><span>{source?.name || label}</span></div>
      <label className="ow-field">使用“我”或角色头像<select value={sourceKey} disabled={busy} onChange={e=>{setSourceKey(e.target.value);setAvatar('');setError('');}}>
        <option value="">不关联人物</option>{sources.map(p=><option value={p.key} key={p.key}>{p.kind==='me'?'我':'角色'} · {p.name}</option>)}
      </select></label>
      <label className={`ow-upload ${busy?'is-busy':''}`}><Upload size={18}/>{busy?'正在读取图片…':'上传本地头像'}<input aria-label="上传本地头像" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" disabled={busy} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)task(()=>readUpload(file));}}/></label>
      <form onSubmit={e=>{e.preventDefault();const src=validateAvatarUrl(url);if(!src){setError('请输入有效的 HTTP 或 HTTPS 图片链接。');return;}task(async()=>{await loadImage(src);return src;});}}>
        <label className="ow-field">网页图片 URL<input aria-label="网页图片 URL" type="url" placeholder="https://…" value={url} onChange={e=>setUrl(e.target.value)} disabled={busy}/></label>
        <button className="ow-outline" disabled={busy || !url.trim()}>预览链接头像</button>
      </form>
      <p className="ow-editor-note">仅在工作 APP 中使用，不会修改“我”或角色的原头像。</p>
      {error&&<p className="ow-error" role="alert">{error}</p>}
      <footer><button className="ow-outline" disabled={busy} onClick={()=>save(null)}>恢复默认</button><button className="ow-save" disabled={busy} onClick={commit}>保存头像</button></footer>
    </section>
  </div>;
}
