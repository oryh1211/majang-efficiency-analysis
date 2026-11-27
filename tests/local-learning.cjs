const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

function readImage(directory,id){
  const data=fs.readFileSync(path.join(directory,id+'.rgb'));
  return {width:data.readInt32LE(),height:data.readInt32LE(4),data:data.subarray(8),channels:3};
}

function training(directory,vision,learning){
  const similar=readImage(directory,'user-riichi-14');
  const board=vision.inspect(similar);
  const man=board.marks.find(m=>m.field==='river2'&&m.index===5);
  assert.equal(man.code,'3m');
  assert(man.uncertain);
  const correction=learning.sample(similar,board,man,'2m');
  assert(correction);

  const gray=readImage(directory,'sample-kakan-3');
  const grayBoard=vision.inspect(gray);
  assert(grayBoard.ok);
  const {viewport,handGeometry,scoreboard,riverQuad}=vision.diagnostics;
  const view=viewport(gray),pitch=handGeometry(gray,view).pitch,hud=scoreboard(gray,view,pitch);
  const quad=riverQuad(hud,pitch,3,0,3,false);
  const empty={field:'own',seat:3,index:3,region:'river-3',orientation:0,
    crop:quad.map(p=>[p.x/gray.width,p.y/gray.height]),uncertain:true};
  const background=learning.sample(gray,grayBoard,empty,null);
  assert(background);
  return {samples:[correction,background],similar,man,gray,grayBoard,empty};
}

module.exports={readImage,training};
if(require.main===module){
  const directory=process.argv[2]??'.vision-research';
  const engine=require('../dist/engine');
  require('../dist/board-templates');
  const vision=require('../dist/board-vision');
  const learning=require('../dist/local-learning');
  const {samples,similar,gray,grayBoard,empty}=training(directory,vision,learning);
  const [saved,background]=samples;
  const marker=board=>board.marks.find(m=>m.field==='river2'&&m.index===5);
  const original=vision.inspect(similar),learned=learning.apply(similar,vision.inspect(similar),samples);
  assert.equal(marker(learned).code,'2m');
  assert.equal(marker(learned).uncertain,false);
  assert.equal(marker(original).code,'3m');
  assert.equal(marker(learning.apply(similar,vision.inspect(similar),[])).code,'3m');
  const blocked=vision.inspect(similar);
  marker(blocked).occluded=true;
  assert.equal(learning.sample(similar,blocked,marker(blocked),null),null);
  assert.equal(marker(learning.apply(similar,blocked,samples)).code,'3m');
  const sideways=vision.inspect(similar);
  marker(sideways).orientation=(marker(sideways).orientation+1)%4;
  assert.equal(marker(learning.apply(similar,sideways,samples)).code,'3m');
  const conflict=learning.apply(similar,vision.inspect(similar),[saved,{...saved,label:'3m'}]);
  assert.match(marker(conflict).reason,/冲突/);
  const excess=vision.inspect(similar);
  excess.hand=excess.hand.map((tile,i)=>i<4?engine.parse('2m')[0]:tile);
  vision.auditBoard(excess);
  assert.match(marker(learning.apply(similar,excess,samples)).reason,/规则冲突/);
  assert.equal(marker(excess).code,'3m');
  const grayCandidate=learning.sample(gray,grayBoard,empty);
  assert.equal(learning.identify(grayCandidate,[background],empty)?.label,null);
  assert.match(learning.identify(grayCandidate,[background],{...empty,edgeEvidence:true}).review,/核对/);
  const independent=readImage(directory,'sample-kan-6');
  const before=vision.inspect(independent),after=learning.apply(independent,vision.inspect(independent),[background]);
  assert.deepEqual(after.rivers,before.rivers);
  const realWhite=before.marks.filter(m=>m.code==='5z'&&m.crop);
  assert(realWhite.length);
  for(const mark of realWhite)assert.notEqual(learning.identify(learning.sample(independent,before,mark),
    [{...background,region:mark.region,orientation:mark.orientation}],mark)?.label,null);
  const holdout=readImage(directory,'sample-holdd-6');
  const redBoard=vision.inspect(holdout);
  const red=redBoard.marks.find(m=>m.field==='hand'&&redBoard.hand[m.index].red);
  const redSample=learning.sample(holdout,redBoard,red,'0s');
  assert.equal(redSample.original,'0s');
  assert.equal(learning.identify(redSample,[redSample],red).label,'0s');
  console.log(JSON.stringify({reupload:'3m→2m',gray:'confirmed empty',independentGrayRiverTiles:before.rivers.flat().length,
    independentWhiteTiles:realWhite.length,red: redSample.original},null,2));
}
