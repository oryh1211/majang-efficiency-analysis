const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const engine = require('../dist/engine');
require('../dist/board-templates');
const vision = require('../dist/board-vision');

const mark = (field,index)=>({field,index});
const board = {
  three:true, hand:engine.parse('1111m2m'), indicators:[], melds:[],
  rivers:[engine.parse('1m'),[],[null],[]],
  marks:[...Array.from({length:5},(_,i)=>mark('hand',i)),mark('river0',0),mark('river2',0)]
};
vision.auditBoard(board);
assert.match(board.marks[5].issues[0],/超过四张/);
assert.match(board.marks[4].issues[0],/三麻/);
assert.deepEqual(board.marks[6].issues,[]);
board.rivers[0][0]=engine.parse('9m')[0];
board.marks[5].corrected=true;
vision.auditBoard(board);
assert.deepEqual(board.marks[0].issues,[]);
assert.deepEqual(board.marks[5].issues,[]);
assert.match(board.marks[4].issues[0],/三麻/);

if(process.argv[2]){
  function read(name){
    const b=fs.readFileSync(path.join(process.argv[2],name+'.rgb'));
    return vision.inspect({width:b.readInt32LE(),height:b.readInt32LE(4),channels:3,data:b.subarray(8)});
  }
  const mixed=read('user-mixed-kan');
  assert(mixed.ok);
  assert.equal(mixed.rivers[3][2].id,4);
  const five=mixed.marks.find(m=>m.field==='own'&&m.index===2);
  assert(five.uncertain);
  assert.equal(five.code,'5m');
  assert(Number.isFinite(five.confidence.margin));

  const oldFalseWhite=read('sample-kakan-3');
  assert(oldFalseWhite.ok);
  assert.deepEqual(oldFalseWhite.rivers.map(r=>r.map(t=>t.id)),[[30,17,26],[29,26,27],[8,13,2],[32,27,20]]);
  assert(oldFalseWhite.melds[0].added);

  const similar=read('user-riichi-14');
  assert(similar.ok);
  const other=similar.marks.find(m=>m.field==='river2'&&m.index===5);
  assert(other.uncertain);
  assert.match(other.reason,/万子/);
}
console.log('Recognition uncertainty and positional audit passed.');
