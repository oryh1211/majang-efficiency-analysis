const assert = require('node:assert/strict');
const fs = require('node:fs');
const engine = require('../dist/engine');
const { parse, analyze } = engine;

const hand = parse('12234p456778899s');
const context = {
  scores: [25400, 7600, 49800, 17200],
  wind: 29,
  roundWind: 27,
  remaining: 36
};
const cut = (result, notation) => result.rows.find(row => row.tile.id === parse(notation)[0].id);
function state(options = {}, ready = [false, false, false], own = []) {
  return analyze(hand, [], [[], [], []], own, [], ready, 'balanced', false, { ...context, ...options });
}

const early = state();
assert.equal(cut(early, '1p').riichi.label, '倾向立直');
assert.deepEqual(cut(early, '1p').waits.map(w => w.id), [10, 13]);
assert(cut(early, '1p').waits.every(w => w.yaku.includes('平和') && w.yaku.includes('一杯口')));
assert.equal(cut(early, '4p').riichi.label, '倾向默听');
assert.equal(cut(state({}, [true, false, false]), '1p').riichi.label, '倾向默听');
assert.equal(cut(state({ finalRound: true, scores: [49800, 7600, 25400, 17200] }), '1p').riichi.label, '倾向默听');
assert.equal(cut(state({ remaining: 3 }), '1p').riichi.label, '通常不能立直');
assert.equal(cut(state({ scores: [900, 7600, 49800, 41700] }), '1p').riichi.label, '不能立直');
assert.equal(cut(state({}, undefined, parse('5p')), '1p').riichi.damaCopies, 0);
assert.match(cut(state({}, undefined, parse('5p')), '1p').riichi.reason, /振听/);
assert.deepEqual(cut(state({ remaining: null, scores: [] }), '1p').riichi.missing, ['剩余牌数', '自家点数']);
const open = analyze(parse('12234p778899s'), [], [[], [], []], [], [], [], 'balanced', false,
  { ...context, melds: [parse('456s')] });
assert.equal(cut(open, '1p').riichi, null);

if (process.argv[2]) {
  require('../dist/board-templates');
  const vision = require('../dist/board-vision');
  const bytes = fs.readFileSync(process.argv[2]);
  const board = vision.inspect({
    width: bytes.readInt32LE(), height: bytes.readInt32LE(4), channels: 3, data: bytes.subarray(8)
  });
  assert.equal(board.ok, true);
  assert.equal(board.active, true);
  assert.equal(board.afterCall, false);
  assert.deepEqual(board.hand.slice(0, -1), hand.slice(0, 10).concat(hand.slice(11)));
  assert.equal(board.hand.at(-1).id, 25);
  const result = analyze(board.hand, board.indicators, board.rivers.slice(0, 3), board.rivers[3],
    [], board.ready.slice(0, 3), 'balanced', board.ready[3], context);
  const first = result.rows[0];
  assert.equal(first.tile.id, 9);
  assert.equal(first.riichi.label, '倾向立直');
  assert.deepEqual(first.waits.map(w => [w.id, w.left]), [[10,2],[13,4]]);
}
console.log('Riichi strategy and optional real screenshot regression passed.');
