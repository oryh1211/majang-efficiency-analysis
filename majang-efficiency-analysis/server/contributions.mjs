const tile=/^(?:[0-9][mps]|[1-7]z)$/;
const regions=new Set(['hand','meld','river-0','river-1','river-2','river-3']);
const fields=['crop','label','region','orientation','original','version'];
export const recognitionVersion='2026-11-27.1';
const pixels=24*36*3;
const response=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
async function digest(value){
  const bytes=await crypto.subtle.digest('SHA-256',typeof value==='string'?new TextEncoder().encode(value):value);
  return Array.from(new Uint8Array(bytes),i=>i.toString(16).padStart(2,'0')).join('');
}
const validLabel=value=>value===null||typeof value==='string'&&tile.test(value);

export function validate(body){
  if(!body||Object.keys(body).length!==fields.length||!fields.every(k=>Object.hasOwn(body,k)))return null;
  if(!validLabel(body.label)||!validLabel(body.original)||!regions.has(body.region)||
    body.label===null&&!body.region.startsWith('river-')||
    !Number.isInteger(body.orientation)||body.orientation<0||body.orientation>3||body.version!==recognitionVersion||
    typeof body.crop!=='string'||body.crop.length!==pixels*4/3||!/^[A-Za-z0-9+/]+$/.test(body.crop))return null;
  return Uint8Array.from(atob(body.crop),c=>c.charCodeAt(0));
}
export function signature(data){
  const bins=[];
  for(let y=0;y<36;y+=4)for(let x=0;x<24;x+=4)for(let channel=0;channel<3;channel++){
    let sum=0;
    for(let v=y;v<y+4;v++)for(let u=x;u<x+4;u++)sum+=data[(v*24+u)*3+channel];
    bins.push(sum/16);
  }
  return bins;
}
export function distance(a,b){
  return a.reduce((sum,v,i)=>sum+Math.abs(v-b[i]),0)/(a.length*255);
}
function manGlyph(shape){
  let paper=0,dark=0,red=0;
  for(let i=0;i<shape.length;i+=3){
    const [r,g,b]=shape.slice(i,i+3);
    if(Math.min(r,g,b)>150&&Math.max(r,g,b)-Math.min(r,g,b)<45)paper++;
    if(Math.max(r,g,b)<125)dark++;
    if(r>g+15&&r>b+13)red++;
  }
  return paper>=10&&dark>=2&&red>=2;
}
export function screen(rows){
  const candidates=[];
  for(const a of rows){
    if(!/^[1-9]m$/.test(a.label)||!(/^[1-9]m$/.test(a.original))||a.original===a.label||a.conflict||!manGlyph(a.shape))continue;
    const neighborhood=rows.filter(b=>b.region===a.region&&b.orientation===a.orientation&&
      distance(a.shape,b.shape)<.077);
    if(neighborhood.some(b=>b.conflict||b.label!==a.label))continue;
    const sources=new Set(neighborhood.filter(b=>manGlyph(b.shape)).map(b=>b.source));
    if(sources.size>=3&&!candidates.some(b=>b.region===a.region&&b.orientation===a.orientation&&distance(a.shape,b.shape)<.077))
      candidates.push({...a,sources:sources.size});
  }
  return candidates;
}
export function passes(baseline,candidate){
  return baseline.games>=3&&candidate.games===baseline.games&&candidate.tiles===baseline.tiles&&
    candidate.targetErrors<baseline.targetErrors&&candidate.correct>=baseline.correct&&
    candidate.silent<=baseline.silent&&candidate.missing<=baseline.missing&&candidate.extra<=baseline.extra&&
    candidate.silentExtra<=baseline.silentExtra;
}
export function release(state,baseline,trial){
  if(state.canary&&!passes(baseline,trial))return {current:state.previous,previous:null,canary:null};
  if(!state.canary&&trial.version&&trial.version!==state.current&&passes(baseline,trial))
    return {current:trial.version,previous:state.current,canary:0.05};
  return state;
}

export async function contributions(request,db,sourceAddress){
  if(!db)return response({error:'贡献库暂不可用'},503);
  if(request.method==='GET')return response({available:true});
  if(request.method!=='POST')return response({error:'不支持该请求'},405);
  if(request.headers.get('Origin')!==new URL(request.url).origin||
    !request.headers.get('Content-Type')?.startsWith('application/json'))return response({error:'请求来源无效'},403);
  if(!sourceAddress)return response({error:'无法确认提交来源'},403);
  if(Number(request.headers.get('Content-Length'))>4200)return response({error:'裁剪过大'},413);
  const reader=request.body?.getReader();
  if(!reader)return response({error:'缺少裁剪'},400);
  const bytes=new Uint8Array(4200);
  let length=0;
  for(;;){
    const chunk=await reader.read();
    if(chunk.done)break;
    if(length+chunk.value.length>bytes.length){await reader.cancel();return response({error:'裁剪过大'},413);}
    bytes.set(chunk.value,length);length+=chunk.value.length;
  }
  let body,data;
  try{body=JSON.parse(new TextDecoder().decode(bytes.subarray(0,length)));data=validate(body);}catch{}
  if(!data)return response({error:'裁剪或字段无效'},400);
  const hour=Math.floor(Date.now()/3600000);
  const source=await db.source(sourceAddress);
  if(!await db.allow(source,hour))return response({error:'提交次数已达上限，稍后再试'},429);
  const shape=signature(data);
  const key=await digest(data);
  const status=await db.add({...body,key,source,shape});
  if(status!=='duplicate')await db.screen?.(body.region,body.orientation);
  return response({status},status==='accepted'?201:200);
}

export function database(db,secret){
  return {
    source:address=>digest(secret+'\n'+address),
    async allow(source,hour){
      const result=await db.prepare('INSERT INTO sample_limits VALUES (?, ?, 1) ON CONFLICT(source,hour) DO UPDATE SET hits=hits+1 WHERE hits<20 RETURNING hits')
        .bind(source,hour).first();
      if(result?.hits===1)await db.prepare('DELETE FROM sample_limits WHERE hour<?').bind(hour-24).run();
      return Boolean(result);
    },
    async add(entry){
      const {key,label,original,region,orientation,crop,source,shape}=entry;
      const peers=await db.prepare('SELECT hash,label,shape FROM samples WHERE region=? AND orientation=? ORDER BY rowid DESC LIMIT 400')
        .bind(region,orientation).all();
      const near=peers.results.find(p=>p.hash===key||distance(JSON.parse(p.shape),shape)<.032);
      if(near){
        if(near.label===label)return 'duplicate';
        await db.prepare('UPDATE samples SET conflict=1 WHERE region=? AND orientation=? AND hash=?').bind(region,orientation,near.hash).run();
        return 'conflict';
      }
      const result=await db.prepare('INSERT INTO samples(hash,label,original,region,orientation,crop,source,shape) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(region,orientation,hash) DO UPDATE SET conflict=MAX(conflict,samples.label IS NOT excluded.label) RETURNING conflict')
        .bind(key,label,original,region,orientation,crop,source,JSON.stringify(shape)).first();
      return result?.conflict?'conflict':'accepted';
    },
    async screen(region,orientation){
      const entries=await db.prepare('SELECT hash,label,original,region,orientation,source,shape,conflict FROM samples WHERE region=? AND orientation=? ORDER BY rowid DESC LIMIT 400')
        .bind(region,orientation).all();
      const candidates=screen(entries.results.map(row=>({...row,shape:JSON.parse(row.shape)})));
      await db.prepare('INSERT INTO candidate_groups VALUES (?,?,?) ON CONFLICT(region,orientation) DO UPDATE SET hashes=excluded.hashes')
        .bind(region,orientation,JSON.stringify(candidates.map(c=>c.hash))).run();
    }
  };
}
