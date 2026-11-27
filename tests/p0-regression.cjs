const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
require('../dist/board-templates');
const vision = require('../dist/board-vision');
const engine = require('../dist/engine');

const fixtureDir = path.resolve(process.argv[2] ?? '.vision-research');

function image(name) {
  const bytes = fs.readFileSync(path.join(fixtureDir, name + '.rgb'));
  return { width: bytes.readInt32LE(0), height: bytes.readInt32LE(4), channels: 3, data: bytes.subarray(8) };
}

function inspect(name) {
  return vision.inspect(image(name));
}

function expectTurn(name, afterCall, count) {
  const board = inspect(name);
  assert.equal(board.ok, true, name);
  assert.equal(board.afterCall, afterCall, name);
  assert.equal(board.meldCount, count, name);
  return board;
}

function recommendation(board) {
  return engine.analyze(board.hand, board.indicators, board.rivers.slice(0, 3), board.rivers[3],
    [], board.ready.slice(0, 3), 'balanced', board.ready[3], {
      three: board.three,
      afterCall: board.afterCall,
      called: board.afterCall ? [board.melds[0].tiles[board.melds[0].called]] : [],
      melds: board.melds.map(group => group.tiles),
      closedGroups: board.melds.map(group => group.closed)
    });
}

function checkPictures() {
  const mixed = expectTurn('user-mixed-kan', false, 2);
  assert.deepEqual(mixed.rivers[3].map(t => t.id), [29, 0, 4, 9, 15, 11, 11, 12]);
  assert(mixed.marks.find(m => m.field === 'own' && m.index === 2).uncertain);
  assert.deepEqual(mixed.melds.map(m => [m.closed, m.called, m.tiles.map(t => t.id)]),
    [[false, 1, [32, 32, 32]], [true, -1, [26, 26, 26, 26]]]);
  assert(mixed.marks.filter(m => m.field === 'meld').every(m => !m.uncertain));

  const pon = expectTurn('sample-pon-4', true, 1);
  assert(pon.three);
  assert(!pon.marks.some(m => m.uncertain));
  assert.deepEqual(recommendation(pon).forbidden, [31]);
  assert(recommendation(pon).rows.length >= 3);

  const chi = expectTurn('sample-chi2-7', true, 1);
  assert(!chi.three);
  assert(chi.marks.some(m => m.field === 'meld' && m.uncertain));

  const twoMelds = expectTurn('sample-p0d-3', true, 2);
  assert.equal(twoMelds.hand.length, 8);
  assert(twoMelds.marks.some(m => m.field === 'meld' && m.uncertain));

  const later = image('sample-pon-7');
  const { viewport, handGeometry, scoreboard, readRivers } = vision.diagnostics;
  const view = viewport(later);
  const { pitch } = handGeometry(later, view);
  const rivers = readRivers(later, scoreboard(later, view, pitch), pitch,
    vision.decodeTemplates(MahjongSoulTemplates), true, 2);
  assert.deepEqual(rivers.rivers[3].map(t => t.id), [29, 0, 8, 27, 17, 20, 10]);
  assert(rivers.rivers[2].some(t => t.id === 13 && t.red));
  assert(rivers.ready[2]);

  const openKan = expectTurn('sample-openkan-6', false, 1);
  assert.deepEqual(openKan.melds[0].tiles.map(t => [t.id, t.red]),
    [[22, false], [22, true], [22, false], [22, false]]);
  assert.equal(openKan.melds[0].called, 1);

  const closedKan = expectTurn('sample-kan-6', false, 1);
  assert(closedKan.melds[0].closed);
  assert.deepEqual(closedKan.melds[0].tiles.map(t => t.id), [4, 4, 4, 4]);

  const previousPon = expectTurn('sample-kakan-2', false, 1);
  assert.equal(previousPon.melds[0].tiles.length, 3);
  const addedKan = expectTurn('sample-kakan-3', false, 1);
  assert(addedKan.melds[0].added);
  assert.equal(addedKan.melds[0].tiles.length, 4);

  for (const name of ['sample-pon-3', 'sample-pon-7', 'sample-chi2-6', 'sample-p0a-1',
    'sample-p0a-2', 'sample-p0d-4', 'sample-openkan-5', 'sample-kan-8', 'sample-kakan-4']) {
    assert.equal(inspect(name).ok, false, name);
  }
}

class Element {
  value = '';
  children = [];
  style = {};
  classList = { toggle() {} };
  events = {};
  parentElement = {};
  attributes = {};
  addEventListener(type, callback) { this.events[type] = callback; }
  setAttribute(key, value) { this.attributes[key] = value; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  getContext() { return { drawImage() {} }; }
}

async function checkCorrection() {
  const nodes = new Map();
  const get = id => {
    if (!nodes.has(id)) nodes.set(id, new Element());
    return nodes.get(id);
  };
  const document = { createElement: () => new Element(), getElementById: get };
  const variants = Array.from({ length: 34 }, (_, id) => ({ id, red: false }));
  const context = {
    document, Riichi: engine, BoardVision: { inspect: vision.inspect, auditBoard: vision.auditBoard, sourceImage: value => value },
    TileVision: { variants, art: () => new Element() },
    createImageBitmap: async value => value, setTimeout
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../dist/app.js'), 'utf8'), context);
  get('file').events.change({ target: { files: [{ ...image('user-mixed-kan'), close() {} }] } });
  await new Promise(resolve => setTimeout(resolve, 20));

  const marker = title => get('markers').children.find(element => element.title === title);
  const pick = name => get('correction').children.flatMap(e => e.children)
    .find(tile => tile.title === name).events.click();
  assert.equal(get('results').children[0].children[0].textContent, '等待校对');
  const snapshot = ['hand', 'indicators', 'melds', 'river0', 'river1', 'river2'].map(id => get(id).value);
  marker('自家牌河第 3 张').onclick();
  pick('5万');
  assert.deepEqual(['hand', 'indicators', 'melds', 'river0', 'river1', 'river2'].map(id => get(id).value), snapshot);
  assert(!marker('自家牌河第 3 张').className.includes('uncertain'));
  marker('对家牌河第 7 张').onclick();
  pick('8索');
  const list=()=>get('results').children.find(element=>element.className==='result-list');
  assert.equal(list().children.length, 3);
  const ownBefore=engine.parse(get('own').value);
  marker('自家牌河第 1 张').onclick();
  get('correction').children.find(element=>element.textContent==='后移一张').onclick();
  assert.deepEqual(engine.parse(get('own').value), [ownBefore[1],ownBefore[0],...ownBefore.slice(2)]);
  assert.deepEqual(['hand','indicators','melds','river0','river2'].map(id=>get(id).value),
    [snapshot[0],snapshot[1],snapshot[2],snapshot[3],snapshot[5]]);
  assert.equal(list().children.length,3);

  get('manual').events.click();
  get('hand').value='19m12345p1234567s';
  get('river0').value='23z';
  get('river2').value='19m';
  get('mode').value='defense';
  get('events').value=['上1 立直','下1','上2','下2','自 摸牌'].join('\n');
  get('events').events.change();
  const top=()=>list().children[0].children[0].children[2].textContent;
  assert.equal(top(),'切 1万');
  get('declaration0').value='2';
  get('declaration0').events.change();
  assert.equal(top(),'切 9万');
}

(async () => {
  checkPictures();
  await checkCorrection();
  console.log('P0 screenshots and in-page correction passed.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
