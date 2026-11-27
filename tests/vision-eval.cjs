const path = require('node:path');
const truth = require('./vision-holdout.json');

const fixtureDir = path.resolve(process.argv[2] ?? '.vision-research');
const useLocal = process.argv.includes('--local-learning');
const versions = process.argv.slice(3).filter(arg=>arg!=='--local-learning');
if (!versions.length) versions.push('dist');

function pair(a, b) { return a != null && b != null && a.id === b.id && a.red === b.red; }

function compare(expected, actual) {
  // Compare ordered river lists without turning one omission into a run of errors.
  const n=expected.length, m=actual.length;
  const dp=Array.from({length:n+1},()=>Array(m+1));
  for(let i=n;i>=0;i--)for(let j=m;j>=0;j--){
    if(i===n&&j===m){dp[i][j]={cost:0,items:[]};continue;}
    const candidates=[];
    function add(kind, cost, next, yellow=false) {
      const item={kind,yellow};
      candidates.push({cost:cost+next.cost,items:[item,...next.items]});
    }
    if(i<n&&j<m){
      const correct=pair(expected[i],actual[j].tile);
      add(correct?'correct':'wrong',correct?0:2,dp[i+1][j+1],actual[j].yellow);
    }
    if(i<n)add('missing',1.25,dp[i+1][j]);
    if(j<m)add('extra',1.25,dp[i][j+1],actual[j].yellow);
    dp[i][j]=candidates.sort((a,b)=>a.cost-b.cost)[0];
  }
  return dp[0][0].items;
}

for(const directory of versions){
  const source=path.resolve(directory);
  const rules=require(path.join(source,'engine.js'));
  globalThis.Riichi=rules;
  require(path.join(source,'board-templates.js'));
  const vision=require(path.join(source,'board-vision.js'));
  const {readImage, training}=require('./local-learning.cjs');
  const learning=useLocal?require(path.join(source,'local-learning.js')):null;
  const samples=learning?training(fixtureDir,vision,learning).samples:[];
  const totals={valid:0,invalid:0,rejected:0,falseAdvice:0,clean:0,expected:0,
    correct:0,wrong:0,extra:0,missing:0,wrongUnmarked:0,extraUnmarked:0,corrections:0,learned:0};
  const details=[];
  for(const entry of truth){
    const image=readImage(fixtureDir,entry.id);
    const board=vision.inspect(image);
    if(learning)learning.apply(image,board,samples);
    const valid=['draw','afterCall'].includes(entry.phase);
    const marked=mark=>Boolean(mark.uncertain||mark.issues?.length);
    let advice=false;
    if(board.ok&&!board.marks.some(marked)){
      const calls=board.melds.filter(m=>m.tiles.length===3);
      if(!board.afterCall||calls.length===1){
        try{
          const result=rules.analyze(board.hand,board.indicators,board.rivers.slice(0,3),board.rivers[3],
            [],board.ready.slice(0,3),'balanced',board.ready[3], {
              three:board.three,afterCall:board.afterCall,
              called:board.afterCall?[calls[0].tiles[calls[0].called]]:[],
              latest:board.afterCall?board.melds.indexOf(calls[0]):undefined,
              melds:board.melds.map(m=>m.tiles),closedGroups:board.melds.map(m=>m.closed)
            });
          advice=result.rows.length>0;
        }catch{}
      }
    }
    if(!valid){
      totals.invalid++;
      totals.falseAdvice+=Number(advice);
      details.push({id:entry.id,phase:entry.phase,accepted:board.ok,advice});
      continue;
    }
    totals.valid++;
    totals.rejected+=Number(!board.ok);
    totals.corrections+=board.marks?.filter(marked).length??0;
    totals.learned+=board.learned??0;
    const observations=[];
    function sequence(field, expected, actual = [], group) {
      const relevant=board.marks?.filter(m=>m.field===field&&m.group===group)??[];
      const expectedTiles=rules.parse(expected);
      totals.expected+=expectedTiles.length;
      const comparison=compare(expectedTiles,actual.map((tile,index)=>({
        tile, yellow:relevant.some(m=>marked(m)&&(m.index===undefined||m.index===index))
      })));
      observations.push(...comparison);
    }
    sequence('hand',entry.hand,board.hand);
    sequence('indicators',entry.indicators,board.ok?board.indicators:[]);
    entry.rivers.forEach((r,i)=>sequence(i===3?'own':'river'+i,r,board.rivers?.[i]));
    for(let i=0;i<Math.max(entry.melds.length,board.melds?.length??0);i++)
      sequence('meld',entry.melds[i]?.tiles??'',board.melds?.[i]?.tiles,i);
    const clean=advice&&observations.every(r=>r.kind==='correct')&&board.three===entry.three&&
      board.afterCall===(entry.phase==='afterCall')&&entry.ready.every((ready,i)=>ready===null||board.ready[i]===ready)&&
      entry.melds.every((m,i)=>board.melds[i]?.called===m.called);
    totals.clean+=Number(clean);
    for(const {kind,yellow} of observations){
      totals[kind]++;
      if((kind==='wrong'||kind==='extra')&&!yellow)totals[kind+'Unmarked']++;
    }
    const wrong=observations.filter(r=>r.kind==='wrong').length;
    const silent=observations.filter(r=>r.kind==='wrong'&&!r.yellow).length;
    const extra=observations.filter(r=>r.kind==='extra').length;
    const missing=observations.filter(r=>r.kind==='missing').length;
    details.push({id:entry.id,phase:entry.phase,accepted:board.ok,advice,clean,wrong,silent,extra,missing});
  }
  console.log(JSON.stringify({directory,useLocal,totals,details},null,2));
}
