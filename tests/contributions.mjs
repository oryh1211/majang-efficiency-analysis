import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {contributions,database,recognitionVersion,release,screen,signature} from '../server/contributions.mjs';
const sqlite=new DatabaseSync(':memory:');
sqlite.exec(readFileSync(new URL('../drizzle/0000_contributions.sql',import.meta.url),'utf8'));
const d1={prepare(sql){
  const statement=sqlite.prepare(sql);
  return {bind(...args){return {first:()=>statement.get(...args),run:()=>statement.run(...args),
    all:()=>({results:statement.all(...args)})};}};
}};
const db=database(d1,'test-only');
const body={crop:Buffer.alloc(2592,180).toString('base64'),label:'2m',region:'river-2',orientation:3,original:'3m',version:recognitionVersion};
async function submit(entry,source='local-a'){
  return contributions(new Request('https://test.invalid/api/contributions',{method:'POST',
    headers:{Origin:'https://test.invalid','Content-Type':'application/json'},body:JSON.stringify(entry)}),db,source);
}
assert.equal((await submit(body)).status,201);
assert.equal((await (await submit(body,'local-b')).json()).status,'duplicate');
assert.equal((await (await submit({...body,crop:Buffer.alloc(2592,181).toString('base64')},'local-c')).json()).status,'duplicate');
assert.equal((await (await submit({...body,label:'3m'},'local-b')).json()).status,'conflict');
assert.equal((await submit({...body,avatar:'unused'})).status,400);
assert.equal((await submit({...body,crop:'a'.repeat(5000)})).status,413);
for(let i=0;i<19;i++)await submit(body);
assert.equal((await submit(body)).status,429);
const shapes=[170,180,190].map(n=>{
  const glyph=Buffer.alloc(2592,n);
  for(let y=8;y<28;y++)for(let x=8;x<16;x++){
    const i=(y*24+x)*3;
    glyph.set(y<16?[42,42,40]:[164,54,38],i);
  }
  return signature(glyph);
});
const candidates=shapes.map((shape,i)=>({...body,shape,source:String(i)}));
assert.equal(screen(candidates).length,1);
assert.equal(screen(candidates.map(c=>({...c,source:'same'}))).length,0);
assert.equal(screen([...candidates,{...candidates[1],label:'3m',source:'other'}]).length,0);
assert.equal(screen(candidates.map(c=>({...c,label:null}))).length,0);
const baseline={games:5,correct:137,tiles:138,targetErrors:1,silent:0,missing:0,extra:0,silentExtra:0};
const active={current:'base',previous:null,canary:null};
assert.deepEqual(release(active,baseline,{...baseline,version:'new'}),active);
const improving={...baseline,version:'new',correct:138,targetErrors:0};
const trial=release(active,baseline,improving);
assert.equal(trial.canary,.05);
assert.deepEqual(release(trial,baseline,{...improving,missing:1}),active);
console.log('Contribution validation, limits, dedup, disagreement and release gate passed.');
