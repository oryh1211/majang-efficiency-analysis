const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { analyze, parse, parseEvents } = require('../dist/engine');
const hand = parse('19m12345p1234567s');

function analyzeHistory(rivers, events = '', options = {}) {
  return analyze(hand, [], rivers.map(parse), [], [], [false, false, false],
    'defense', false, { events: parseEvents(events), ...options });
}

const at = (result, tile) => result.rows.find(row => row.tile.id === parse(tile)[0].id);
const after = '下1\n上1 立直\n下2\n自 摸牌';
const first = analyzeHistory(['2z','','19m'], after);
const swapped = analyzeHistory(['2z','','91m'], after);
assert.equal(first.rows[0].tile.id, 8);
assert.equal(swapped.rows[0].tile.id, 0);
assert.equal(at(first, '9m').risk[0].safe, 'passed');
assert.equal(at(first, '1m').risk[0].safe, undefined);
assert.equal(at(first, '9m').risk[2].safe, 'genbutsu');

const double = analyzeHistory(['2z','3z','19m'], '上1 立直\n下1\n对1 立直\n下2\n自 摸牌');
assert.equal(at(double, '1m').risk[0].safe, 'passed');
assert.equal(at(double, '1m').risk[1].safe, undefined);
assert.equal(at(double, '9m').risk[1].safe, 'passed');

const unresolved = analyzeHistory(['2z','','9m'], '上1 立直\n下1');
assert.equal(at(unresolved, '9m').risk[0].safe, undefined);
const confirmed = analyzeHistory(['2z','','9m'], '上1 立直\n下1\n通过');
assert.equal(at(confirmed, '9m').risk[0].safe, 'passed');
const called = analyzeHistory(['2z','',''], '上1 立直\n下 9m\n对 鸣牌');
assert.equal(at(called, '9m').risk[0].safe, 'passed');
const missing = analyzeHistory(['2z','','19m'], '', { declarations: [1], declaredOpponents: [true,false,false] });
assert.equal(at(missing, '9m').risk[0].safe, undefined);
assert.equal(at(analyzeHistory(['2z','','19m'], after, { declarations: [0] }), '9m').risk[0].safe, undefined);
const movedDeclaration = analyzeHistory(['23z','','19m'], '上1 立直\n下1\n上2\n下2\n自 摸牌', { declarations: [2] });
assert.equal(at(movedDeclaration, '1m').risk[0].safe, undefined);
assert.equal(at(movedDeclaration, '9m').risk[0].safe, 'passed');
assert.throws(() => analyzeHistory(['2z','','19m'], '上1 立直\n下2\n自 摸牌'), /顺序不符/);
assert.throws(() => parseEvents('上1\n和牌'), /格式有误/);

const handCut = analyzeHistory(['3m','',''], '上1 手切');
const drawCut = analyzeHistory(['3m','',''], '上1 摸切');
assert.equal(at(handCut, '1m').risk[0].score, at(drawCut, '1m').risk[0].score-2);
assert.match(at(handCut, '1m').risk[0].label, /早|弱线索/);
assert.doesNotMatch(at(drawCut, '1m').risk[0].label, /弱线索/);
const suji = analyzeHistory(['34m','',''], '上1 手切\n上2');
assert.doesNotMatch(at(suji, '1m').risk[0].label, /弱线索/);

if (process.argv[2]) {
  require('../dist/board-templates');
  const vision = require('../dist/board-vision');
  const templates = vision.decodeTemplates(MahjongSoulTemplates);
  const { viewport, handGeometry, scoreboard, readRivers } = vision.diagnostics;
  function image(name) {
    const bytes = fs.readFileSync(path.join(process.argv[2], name+'.rgb'));
    return { width: bytes.readInt32LE(), height: bytes.readInt32LE(4), channels: 3, data: bytes.subarray(8) };
  }
  function read(name, three = false, topOpponent = -1) {
    const source = image(name);
    const view = viewport(source);
    const p = handGeometry(source, view)?.pitch ?? view.h*.086;
    return readRivers(source, scoreboard(source, view, p), p, templates, three, topOpponent);
  }
  const sideways = read('sample-pon-7', true, 2);
  assert.equal(sideways.declarations[2], 6);
  assert(sideways.marksForReview.some(m => m.riichi && m.seat === 2 && m.index === 5 && m.row === 0));
  const claimed = vision.inspect(image('sample-defense-1'));
  assert.equal(claimed.ok, true);
  assert.equal(claimed.ready[1], true);
  assert.equal(claimed.declarations[1], undefined);
  const uncertainRiichi = analyzeHistory(['2z','3z','19m'], '', { declarations: claimed.declarations });
  assert(uncertainRiichi.rows.every(row=>row.risk.every(risk=>risk.safe!=='passed')));
  const screenshot = vision.inspect(image('user-mixed-kan'));
  assert.equal(screenshot.ok, true);
  assert.equal(screenshot.meldCount, 2);
  const snapshot = analyze(screenshot.hand, screenshot.indicators, screenshot.rivers.slice(0,3), screenshot.rivers[3], [],
    screenshot.ready.slice(0,3), 'balanced', screenshot.ready[3], {
      melds: screenshot.melds.map(g => g.tiles), closedGroups: screenshot.melds.map(g => g.closed),
      declarations: screenshot.declarations
    });
  assert(snapshot.rows.every(row => row.risk.every(risk => risk.safe !== 'passed')));
}
console.log('Defensive timing regression passed.');
