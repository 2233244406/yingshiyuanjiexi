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
export default {
 async fetch(request, env) {
  if(request.method==='OPTIONS') return new Response(null,{status:204,headers:cors});
  const url=new URL(request.url);
  if(url.pathname==='/health') return json({ok:true,service:'WebHomeTV Site List Proxy',version:'1.0.0'});
  if(url.pathname!=='/fetch') return json({error:'Not found'},404);
  if(request.method!=='POST') return json({error:'仅支持 POST'},405);
  if(!env.PROXY_TOKEN) return json({error:'Worker 尚未配置 PROXY_TOKEN Secret'},503);
  if(request.headers.get('X-Proxy-Token')!==env.PROXY_TOKEN) return json({error:'代理令牌错误'},401);
  let body;try{body=await request.json()}catch{return json({error:'请求体必须是 JSON'},400)}
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
