const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Proxy-Token',
  'Access-Control-Max-Age': '86400'
};
const json = (data, status=200) => new Response(JSON.stringify(data), {status, headers:{...cors,'Content-Type':'application/json; charset=utf-8'}});
function isBlockedHost(host) {
  const h=host.toLowerCase().replace(/^\[|\]$/g,'');
  if (h==='localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h==='::1' || h==='::') return true;
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(h)) {
    const p=h.split('.').map(Number);
    if(p.some(x=>x>255)) return true;
    return p[0]===0 || p[0]===10 || p[0]===127 || p[0]>=224 || (p[0]===169&&p[1]===254) || (p[0]===172&&p[1]>=16&&p[1]<=31) || (p[0]===192&&p[1]===168);
  }
  return h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80:');
}
function validUrl(value){let u;try{u=new URL(value)}catch{throw new Error('目标 URL 无效')};if(!['http:','https:'].includes(u.protocol))throw new Error('仅允许 HTTP/HTTPS');if(isBlockedHost(u.hostname))throw new Error('禁止访问本机或内网地址');return u;}

function safeDirectory(value) {
  const raw=String(value||'WebHomeTV').trim().replace(/^\/+|\/+$/g,'');
  if(!raw) return ['WebHomeTV'];
  const parts=raw.split('/');
  if(parts.length>12 || parts.some(p=>!p || p==='.' || p==='..' || /[\\\u0000-\u001f\u007f%?#:]/.test(p) || p.length>80))
    throw new Error('坚果云目录格式无效：每级目录不能包含空段、.、..、反斜杠、百分号或特殊控制字符');
  return parts;
}
function safeFile(value) {
  const file=String(value||'WebHomeTV-sync-v1.json');
  if(!/^[\w.-]+\.json$/i.test(file)) throw new Error('同步文件名不合法');
  return file;
}
function appendPath(base, segment, directory=false) {
  const next=new URL(encodeURIComponent(segment)+(directory?'/':''), base.href.endsWith('/')?base.href:base.href+'/');
  return next;
}
async function davRequest(url, method, headers, body) {
  return fetch(url.toString(), {method,headers,body,redirect:'manual'});
}
async function ensureDirectory(base, parts, headers) {
  let current=new URL(base.href.endsWith('/')?base.href:base.href+'/');
  for(const part of parts) {
    const next=appendPath(current,part,true);
    let probe=await davRequest(next,'PROPFIND',{...headers,'Depth':'0'});
    if(probe.status===207 || probe.status===200) { current=next; continue; }
    if(probe.status===401 || probe.status===403) throw new Error('坚果云 WebDAV 授权失败（HTTP '+probe.status+'），请核对注册邮箱和第三方应用密码');
    if(probe.status===301 || probe.status===302 || probe.status===307 || probe.status===308) throw new Error('坚果云目录检查遇到重定向（HTTP '+probe.status+'），请确认 WebDAV 地址为 https://dav.jianguoyun.com/dav/');
    if(probe.status!==404) throw new Error('检查坚果云目录失败（HTTP '+probe.status+'）');
    const made=await davRequest(next,'MKCOL',headers);
    if(made.status===201 || made.status===200 || made.status===204) { current=next; continue; }
    // 部分 WebDAV 服务对已存在目录返回 405；再 PROPFIND 确认目录确实存在。
    if(made.status===405 || made.status===301 || made.status===409) {
      const verify=await davRequest(next,'PROPFIND',{...headers,'Depth':'0'});
      if(verify.status===207 || verify.status===200) { current=next; continue; }
      if(verify.status===401 || verify.status===403) throw new Error('坚果云 WebDAV 授权失败（HTTP '+verify.status+'）');
      throw new Error('创建/确认坚果云目录失败（MKCOL '+made.status+'，PROPFIND '+verify.status+'）');
    }
    if(made.status===401 || made.status===403) throw new Error('坚果云 WebDAV 授权失败（HTTP '+made.status+'），请核对注册邮箱和第三方应用密码');
    throw new Error('创建坚果云目录失败（HTTP '+made.status+'）');
  }
  return current;
}

export default {
 async fetch(request, env) {
  if(request.method==='OPTIONS') return new Response(null,{status:204,headers:cors});
  const url=new URL(request.url);
  if(url.pathname==='/health') return json({ok:true,service:'WebHomeTV Site List Proxy',version:'1.2.0'});
  if(!['/fetch','/sync'].includes(url.pathname)) return json({error:'Not found'},404);
  if(request.method!=='POST') return json({error:'仅支持 POST'},405);
  if(!env.PROXY_TOKEN) return json({error:'Worker 尚未配置 PROXY_TOKEN Secret'},503);
  if(request.headers.get('X-Proxy-Token')!==env.PROXY_TOKEN) return json({error:'代理令牌错误'},401);
  let body;try{body=await request.json()}catch{return json({error:'请求体必须是 JSON'},400)}
  if(url.pathname==='/sync'){
   if(!['test','read','write'].includes(String(body.action||''))) return json({error:'不支持的同步操作'},400);
   let parts,file,base;
   try {
    parts=safeDirectory(body.dir);
    file=safeFile(body.file);
    const supplied=String(body.baseUrl||'https://dav.jianguoyun.com/dav/');
    base=new URL(supplied);
    if(base.protocol!=='https:'||base.hostname!=='dav.jianguoyun.com'||base.username||base.password) throw new Error('仅允许坚果云官方 HTTPS WebDAV 地址');
    base.search='';base.hash='';
    if(!base.pathname.endsWith('/'))base.pathname+='/';
   } catch(e) { return json({error:e.message||'WebDAV 参数无效'},400); }
   const username=String(body.username||''),appPassword=String(body.appPassword||'');
   if(!username||!appPassword)return json({error:'缺少坚果云账号或第三方应用密码'},400);
   const auth='Basic '+btoa(unescape(encodeURIComponent(username+':'+appPassword)));
   const upstreamHeaders={'Authorization':auth,'Cache-Control':'no-store'};
   try {
    // 测试连接也检查/创建所选目录，确保目录配置可实际写入。
    const dirUrl=await ensureDirectory(base,parts,upstreamHeaders);
    if(body.action==='test') return json({ok:true,status:207,directory:parts.join('/')});
    const target=appendPath(dirUrl,file,false);
    if(body.action==='read') {
     const r=await davRequest(target,'GET',upstreamHeaders);
     if(r.status===404) {
      // v1.4.0 默认把同步文件放在 WebDAV 根目录；升级后默认目录为 WebHomeTV。
      // 仅在默认目录且新位置尚无文件时回退读取旧根目录文件，后续正常写入会迁移到新目录。
      if(parts.length===1 && parts[0]==='WebHomeTV') {
       const legacyTarget=appendPath(base,file,false);
       const legacy=await davRequest(legacyTarget,'GET',upstreamHeaders);
       if(legacy.ok) {
        const legacyText=await legacy.text();
        if(legacyText.length>5*1024*1024)return json({error:'旧版云端同步文件超过 5 MB，拒绝读取'},413);
        let legacyPayload;try{legacyPayload=JSON.parse(legacyText)}catch{return json({error:'旧版云端同步文件不是有效 JSON'},502)}
        return json({ok:true,exists:true,payload:legacyPayload,directory:parts.join('/'),legacyRoot:true});
       }
       if(legacy.status===401||legacy.status===403)return json({error:'坚果云 WebDAV 读取授权失败（HTTP '+legacy.status+'）'},401);
       if(legacy.status!==404)return json({error:'读取旧版根目录同步文件失败（HTTP '+legacy.status+'）'},502);
      }
      return json({ok:true,exists:false,directory:parts.join('/')});
     }
     if(r.status===401||r.status===403)return json({error:'坚果云 WebDAV 读取授权失败（HTTP '+r.status+'）'},401);
     if(r.status>=300&&r.status<400)return json({error:'读取坚果云文件遇到重定向（HTTP '+r.status+'）'},502);
     if(!r.ok)return json({error:'读取坚果云文件失败（HTTP '+r.status+'）'},502);
     const text=await r.text();if(text.length>5*1024*1024)return json({error:'云端同步文件超过 5 MB，拒绝读取'},413);
     let payload;try{payload=JSON.parse(text)}catch{return json({error:'云端同步文件不是有效 JSON'},502)}
     return json({ok:true,exists:true,payload,directory:parts.join('/')});
    }
    if(body.action==='write') {
     if(!body.payload||typeof body.payload!=='object')return json({error:'缺少加密同步内容'},400);
     const text=JSON.stringify(body.payload);if(text.length>5*1024*1024)return json({error:'同步文件超过 5 MB，拒绝上传'},413);
     const r=await davRequest(target,'PUT',{...upstreamHeaders,'Content-Type':'application/json; charset=utf-8'},text);
     if(r.status===401||r.status===403)return json({error:'坚果云 WebDAV 写入授权失败（HTTP '+r.status+'）'},401);
     if(r.status>=300&&r.status<400)return json({error:'写入坚果云文件遇到重定向（HTTP '+r.status+'）'},502);
     if(!r.ok)return json({error:'写入坚果云文件失败（HTTP '+r.status+'）。目录已确认存在；请检查坚果云 WebDAV 写入权限或空间状态。'},502);
     return json({ok:true,status:r.status,directory:parts.join('/')});
    }
    return json({error:'不支持的同步操作'},400);
   } catch(e) { return json({error:'坚果云 WebDAV 操作失败：'+e.message},502); }
  }
  // 原有 /fetch 代理功能保留
  let current;try{current=validUrl(body.url)}catch(e){return json({error:e.message},400)}
  const method=['GET','HEAD'].includes(String(body.method||'GET').toUpperCase())?String(body.method||'GET').toUpperCase():'GET';
  const supplied=body.headers&&typeof body.headers==='object'?body.headers:{};
  const headers=new Headers();
  const allowed=['user-agent','referer','cookie','accept','accept-language','content-type','authorization'];
  for(const [k,v] of Object.entries(supplied)){if(allowed.includes(k.toLowerCase()) && typeof v==='string' && v.length<8192)headers.set(k,v)}
  if(!headers.has('User-Agent'))headers.set('User-Agent','Mozilla/5.0 WebHomeTV-Windows/0.2');
  let upstream;
  try{
   for(let i=0;i<6;i++){
    upstream=await fetch(current.toString(),{method,headers,redirect:'manual'});
    if([301,302,303,307,308].includes(upstream.status)){
      const loc=upstream.headers.get('Location');if(!loc)break;
      const next=validUrl(new URL(loc,current).toString());
      if(i===5)return json({error:'重定向次数过多'},502);
      current=next;continue;
    }
    break;
   }
   const outHeaders=new Headers(cors);
   outHeaders.set('Content-Type',upstream.headers.get('Content-Type')||'application/octet-stream');
   outHeaders.set('Cache-Control','no-store');
   const cd=upstream.headers.get('Content-Disposition');if(cd)outHeaders.set('Content-Disposition',cd);
   return new Response(method==='HEAD'?null:upstream.body,{status:upstream.status,headers:outHeaders});
  }catch(e){return json({error:'上游请求失败：'+e.message},502)}
 }
};
