((root) => {
  const suits = 'mpsz';
  const names = ['东','南','西','北','白','发','中'];
  const terminals = [0,8,9,17,18,26,27,28,29,30,31,32,33];
  const all = Array.from({length:34}, (_, i) => i);
  const name = i => i < 27 ? (i % 9 + 1) + '万筒索'[Math.floor(i/9)] : names[i-27];
  const notation = i => (i < 27 ? i%9+1 : i-26) + suits[i < 27 ? Math.floor(i/9) : 3];
  const id = t => typeof t === 'number' ? t : t.id;
  const counts = tiles => tiles.reduce((c,t) => (c[id(t)]++,c), Array(34).fill(0));
  function parse(input) {
    const value = input.toLowerCase().replace(/[\s,，、]+/g,'');
    if (!/^(?:[0-9]+[mps]|[1-7]+z)*$/.test(value)) throw new Error('请输入有效牌谱，例如 123m405p678s123z。');
    return [...value.matchAll(/([0-9]+)([mpsz])/g)].flatMap(([,digits,suit]) =>
      [...digits].map(n => ({id: suits.indexOf(suit)*9+(+n || 5)-1,red:n==='0'})));
  }
  function dora(i) {
    if (i < 27) return i % 9 === 8 ? i-8 : i+1;
    return i === 30 ? 27 : i === 33 ? 31 : i+1;
  }
  const groupCache = new Map();
  function groups(values, honor) {
    const key = (honor?'z':'s')+values.join('');
    if (groupCache.has(key)) return groupCache.get(key);
    const i = values.findIndex(Boolean);
    if (i < 0) return [[0,0,0]];
    const out = new Map();
    function take(indices,m,t,p) {
      for (const j of indices) values[j]--;
      for (const [a,b,c] of groups(values,honor)) {
        if (a+m<=4 && b+t<=4 && c+p<=1) {
          const item = [a+m,b+t,c+p];
          out.set(item.join(),item);
        }
      }
      for (const j of indices) values[j]++;
    }
    take([i],0,0,0);
    if (values[i]>=2) {take([i,i],0,1,0);take([i,i],0,0,1);}
    if (values[i]>=3) take([i,i,i],1,0,0);
    if (!honor) {
      if (i<8 && values[i+1]) take([i,i+1],0,1,0);
      if (i<7 && values[i+2]) {
        take([i,i+2],0,1,0);
        if (values[i+1]) take([i,i+1,i+2],1,0,0);
      }
    }
    const result = [...out.values()];
    if (groupCache.size>50000) groupCache.clear();
    groupCache.set(key,result);
    return result;
  }
  function shanten(c,fixed=0) {
    let states = [[fixed,0,0]];
    for (const [start,end] of [[0,9],[9,18],[18,27],[27,34]]) {
      const next = new Map();
      for (const [a,b,p] of states) for (const [m,t,h] of groups(c.slice(start,end),start===27)) {
        if (a+m>4 || p+h>1) continue;
        const item = [a+m,Math.min(4-a-m,b+t),p+h];
        next.set(item.join(),item);
      }
      states = [...next.values()];
    }
    const regular = Math.min(...states.map(([m,t,p]) => 8-2*m-t-p));
    const pairs = 6-c.filter(n=>n>=2).length+Math.max(0,7-c.filter(Boolean).length);
    const orphans = 13-terminals.filter(i=>c[i]).length-Number(terminals.some(i=>c[i]>=2));
    return {value:fixed?regular:Math.min(regular,pairs,orphans),regular,pairs,orphans};
  }
  function waitShapes(counts,win,fixed,onComplete){
    const c=counts.slice(), shapes=new Set();c[win]++;
    function walk(sets,pair,used,sequences=[],head=-1){
      const i=c.findIndex(Boolean);
      if(i<0){
        if(sets===4&&pair){
          used.forEach(shape=>shapes.add(shape));
          onComplete?.(sequences,head,used);
        }
        return;
      }
      function take(ids,shape,nextSets,nextPair){
        for(const j of ids)c[j]--;
        walk(nextSets,nextPair,ids.includes(win)?used.concat(shape):used,
          onComplete&&ids[0]!==ids[1]?sequences.concat(i):sequences,
          !pair&&nextPair?i:head);
        for(const j of ids)c[j]++;
      }
      if(!pair&&c[i]>=2)take([i,i],'单骑',sets,true);
      if(sets<4&&c[i]>=3)take([i,i,i],'双碰',sets+1,pair);
      if(sets<4&&i<27&&i%9<7&&c[i+1]&&c[i+2])take([i,i+1,i+2],win===i+1?'嵌张':(win===i+2&&i%9===0||win===i&&i%9===6)?'边张':'两面',sets+1,pair);
    }
    walk(fixed,false,[]);
    if(!fixed&&c.filter(n=>n===2).length===7)shapes.add('七对子单骑');
    if(!fixed&&terminals.every(i=>c[i])&&terminals.some(i=>c[i]===2))shapes.add('国士');
    return [...shapes];
  }
  const seatSymbols=['上','对','下','自'];
  const seatNames=['上家','对家','下家','自家'];
  function parseEvents(text) {
    const lines=text.trim().split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
    return lines.map((line,index)=>{
      if(line==='通过'&&index===lines.length-1)return {kind:'resolved'};
      const match=line.match(/^([上对下自])(?:(\d+)|\s+([0-9][mpsz]|摸牌|鸣牌|拔北))((?:\s+(?:手切|摸切|立直))*)$/);
      if(!match)throw new Error('牌谱时序第 '+(index+1)+' 行格式有误。');
      const [,seat,position,value,flags]=match;
      const tags=flags.trim().split(/\s+/).filter(Boolean);
      const cut=tags.includes('手切')?'hand':tags.includes('摸切')?'draw':null;
      if((tags.includes('手切')&&tags.includes('摸切'))||new Set(tags).size!==tags.length)
        throw new Error('牌谱时序第 '+(index+1)+' 行的标记冲突。');
      if(position||/^[0-9][mpsz]$/.test(value??'')){
        const tile=position?undefined:parse(value)[0];
        if(!position&&!tile)throw new Error('牌谱时序第 '+(index+1)+' 行牌面有误。');
        return {kind:'discard',seat:seatSymbols.indexOf(seat),position:position?Number(position):undefined,tile,
          cut,riichi:tags.includes('立直')};
      }
      if(tags.length)throw new Error('只有舍牌事件可标记手切、摸切或立直。');
      return {kind:{摸牌:'draw',鸣牌:'call',拔北:'north'}[value],seat:seatSymbols.indexOf(seat)};
    });
  }

  function defenseHistory(rivers,options,three){
    const ordered=rivers.map((river,seat)=>river.map((tile,index)=>({
      tile,seat,position:index+1,riichi:options.declarations?.[seat]===index+1,cut:null
    })));
    const played=ordered.map(records=>records.map(record=>record.tile));
    const confirmed=Array(4).fill(false);
    const passed=Array.from({length:4},()=>new Map());
    const early=Array.from({length:4},()=>[]);
    const lastCuts=Array(4).fill(null);
    if(!options.events?.length)return {played,confirmed,passed,early,lastCuts};
    const lastPosition=Array(4).fill(0), count=Array(4).fill(0);
    const rounds=Array(4).fill(false);
    for(const [index,event] of options.events.entries()){
      const {seat}=event;
      if(three&&seat===1)throw new Error('三麻牌谱没有对家。');
      if(event.kind!=='discard')continue;
      const record=event.position===undefined?event:ordered[seat]?.[event.position-1];
      if(!record||event.position!==undefined&&event.position!==lastPosition[seat]+1)
        throw new Error('牌谱时序第 '+(index+1)+' 行与牌河顺序不符。');
      if(event.position!==undefined)lastPosition[seat]++;
      else played[seat].push(record.tile);
      count[seat]++;
      lastCuts[seat]=event.cut?{tile:record.tile,position:count[seat],cut:event.cut}:null;
      const declaration=options.declarations?.[seat]!==undefined?
        event.position!==undefined&&record.riichi:event.riichi;
      if(!rounds[seat]&&!declaration&&count[seat]<=3&&event.cut==='hand')
        early[seat].push({id:record.tile.id,position:count[seat]});
      // A following action (or explicit resolution of the final response) proves
      // this discard completed without ron. The declaration itself is excluded.
      const resolved=index+1<options.events.length;
      if(resolved){
        for(let target=0;target<4;target++){
          if(target!==seat&&confirmed[target]&&!passed[target].has(record.tile.id))
            passed[target].set(record.tile.id,{seat,position:count[seat]});
        }
      }
      if(declaration){
        if(rounds[seat])throw new Error(seatNames[seat]+'有重复的立直宣言。');
        rounds[seat]=true;
        if(resolved)confirmed[seat]=true;
      }
    }
    return {played,confirmed,passed,early,lastCuts};
  }

  function danger(i, river, known, passed, early) {
    if (river.some(t=>id(t)===i)) return {score:0,label:'现物',safe:'genbutsu'};
    const proof=passed.get(i);
    if (proof) return {score:0,label:'立直后已通过（'+seatNames[proof.seat]+'第 '+proof.position+' 次舍牌）',safe:'passed'};
    if (i>=27) {
      if (known[i]===4) return {score:2,label:'四枚可见字牌，留意国士'};
      return {score:Math.max(12,64-14*known[i]),label:'字牌 · 已见 '+known[i]+' 枚'};
    }
    const n=i%9;
    const safe = j => river.some(t=>id(t)===j);
    let open=0, covered=0, blocked=0, possible=0, outside;
    for (const start of [n-2,n-1,n]) {
      if (start<0 || start>6) continue;
      possible++;
      const a=i-n+start;
      const others=[a,a+1,a+2].filter(j=>j!==i);
      if (others.some(j=>known[j]===4)) {blocked++;continue;}
      if (n===start && start<6 && safe(i+3) || n===start+2 && start>0 && safe(i-3)) covered++;
      else {
        open++;
        outside??=early.find(t=>Math.floor(t.id/9)===Math.floor(i/9)&&
          (n<=1&&t.id%9<=2&&t.id>i&&a+2===t.id||n>=7&&t.id%9>=6&&t.id<i&&a===t.id));
      }
    }
    const label=blocked===possible?'壁挡顺子，留意单骑或双碰':covered?'有筋，仍可能点炮':'无现物依据';
    return {score:12+open*23+Math.max(0,3-known[i])*3-Number(!!outside)*2,
      label:outside?label+' · 早巡第 '+outside.position+' 张手切 '+name(outside.id)+' 的外侧（弱线索）':label};
  }
  function yakuman(c, visible) {
    function need(i,n) {
      return visible[i]+n>4 ? Infinity : Math.max(0,n-c[i]);
    }
    function triplets(pool, required, pairPool=pool) {
      let best=Infinity;
      for (const pair of pairPool) {
        if (required.includes(pair)) continue;
        const extra=pool.filter(i=>i!==pair&&!required.includes(i)).map(i=>need(i,3)).sort((a,b)=>a-b).slice(0,4-required.length);
        if (extra.length!==4-required.length) continue;
        best=Math.min(best,need(pair,2)+required.reduce((sum,i)=>sum+need(i,3),0)+extra.reduce((a,b)=>a+b,0));
      }
      return best;
    }
    function target(tiles) {return counts(tiles).reduce((sum,n,i)=>n?sum+need(i,n):sum,0);}
    function requiredSets(required, pairs) {
      const groups=all.map(i=>[i,i,i]).concat(all.filter(i=>i<27&&i%9<7).map(i=>[i,i+1,i+2]));
      const base=required.flatMap(i=>[i,i,i]);
      return Math.min(...pairs.flatMap(pair=>required.includes(pair)?[]:
        (required.length===4?[[]]:groups).map(g=>target([...base,pair,pair,...g]))));
    }
    const green = [19,20,21,23,25,32];
    const greenGroups = green.map(i=>[i,i,i]).concat([[19,20,21]]);
    let greenBest=Infinity;
    function greenSearch(start,tiles) {
      if (tiles.length===14) {greenBest=Math.min(greenBest,target(tiles));return;}
      for (let j=start;j<greenGroups.length;j++) greenSearch(j,tiles.concat(greenGroups[j]));
    }
    for (const i of green) greenSearch(0,[i,i]);
    const winds=[27,28,29,30];
    const gates=[0,0,0,1,2,3,4,5,6,7,8,8,8];
    const results = [
      ['国士无双',Math.min(...terminals.map(i=>target([...terminals,i])))],
      ['四暗刻',triplets(all,[]),'双碰须自摸补成第四组暗刻，单骑可荣和但须无振听。'],
      ['大三元',requiredSets([31,32,33],all)],
      ['大四喜',requiredSets(winds,all)],
      ['小四喜',Math.min(...winds.map(i=>requiredSets(winds.filter(j=>j!==i),[i])))],
      ['字一色',triplets(winds.concat([31,32,33]),[])],
      ['清老头',triplets(terminals.slice(0,6),[])],
      ['绿一色',greenBest],
      ['九莲宝灯',Math.min(...[0,9,18].flatMap(base=>gates.slice(2,11).map(i=>target([...gates,i].map(j=>j+base)))))],
    ];
    return results.filter(([,n])=>n<=3).sort((a,b)=>a[1]-b[1]);
  }
  function analyze(hand, indicators=[], rivers=[[],[],[]], own=[], extra=[], ready=[false,false,false], mode='balanced', locked=false, options={}) {
    const {three=false,melds=[],north=0}=options;
    for(const m of melds){
      const ids=m.map(id).sort((a,b)=>a-b);
      const set=ids.every(i=>i===ids[0])&&[3,4].includes(ids.length);
      const sequence=!three&&ids.length===3&&ids[2]<27&&Math.floor(ids[0]/9)===Math.floor(ids[2]/9)&&ids[1]===ids[0]+1&&ids[2]===ids[0]+2;
      if(!set&&!sequence)throw new Error('请检查副露分组，三麻只能碰或杠。');
    }
    if(melds.length>4||hand.length!==14-3*melds.length)throw new Error('手牌须包含本巡摸牌，每组副露减少三张手牌。');
    if(!Number.isInteger(north)||north<0||north>4||(!three&&north))throw new Error('请检查拔北枚数。');
    if(three&&(rivers[1].length||ready[1]))throw new Error('三麻没有对家，请清空对家牌河和立直状态。');
    const menzen=melds.every((group,i)=>group.length===4&&options.closedGroups?.[i]);
    const history=defenseHistory([...rivers,own],options,three);
    locked ||= history.confirmed[3];
    if(locked&&melds.some((group,i)=>group.length!==4||!options.closedGroups?.[i]))throw new Error('明副露后不能立直。');
    ready=ready.map((value,seat)=>value||history.confirmed[seat]);
    const declared=ready.map((value,seat)=>(options.declaredOpponents??ready)[seat]||history.confirmed[seat]);
    const c=counts(hand);
    const inventory=[...hand,...indicators,...rivers.flat(),...own,...extra,...melds.flat(),...Array(north).fill(30)];
    const known=counts(inventory);
    if(three&&known.slice(1,8).some(Boolean))throw new Error('雀魂三麻没有二至八万。');
    const impossible=known.findIndex(n=>n>4);
    if (impossible>=0) throw new Error(name(impossible)+'超过四张，请检查输入或重复记录。');
    const reds=counts(inventory.filter(t=>t.red));
    if (reds.some(n=>n>1)) throw new Error('默认每种花色至多一枚赤五。');
    const visible=known.map((n,i)=>n-c[i]);
    const doraCounts=counts(indicators.map(t=>three&&id(t)===0?8:dora(id(t))));
    const totalDora=north*(1+doraCounts[30])+hand.concat(melds.flat()).reduce((sum,t)=>sum+doraCounts[t.id]+Number(t.red),0);
    function confirmedYaku(){
      const full=c.map((n,i)=>n+melds.flat().filter(t=>t.id===i).length);
      const types=all.filter(i=>full[i]);
      const suits=new Set(types.filter(i=>i<27).map(i=>Math.floor(i/9)));
      const y=[];
      if(types.every(i=>i<27&&i%9!==0&&i%9!==8))y.push('断幺九');
      if(suits.size===1)y.push(types.some(i=>i>=27)?'混一色':'清一色');
      const honorSets=types.filter(i=>i>=27&&full[i]>=3);
      for(const i of honorSets)if(i>=31||i===options.wind||i===options.roundWind)y.push('役牌'+name(i));
      if([31,32,33].every(i=>honorSets.includes(i)))y.push('大三元');
      if(locked)y.push('立直');
      return y;
    }
    function paths(t) {
      const i=t.id;
      c[i]--;
      visible[i]++;
      const s=shanten(c,melds.length);
      const waits=[];
      for(const j of all) if ((!three||j===0||j>=8)&&c[j]<4 && s.value>=0) {
        c[j]++;
        if(shanten(c,melds.length).value<s.value){
          const yaku=new Set(s.value===0?confirmedYaku():[]);
          let shapeYaku=[],shapeHan=0;
          const shapes=s.value===0?waitShapes(c.map((n,i)=>n-Number(i===j)),j,melds.length,
            menzen?(sequences,head,kinds)=>{
              const plainHead=head<27||(options.wind!=null&&options.roundWind!=null&&head<31&&head!==options.wind&&head!==options.roundWind);
              const pinfu=sequences.length===4&&plainHead&&kinds.includes('两面');
              const frequency=new Map();
              for(const start of sequences)frequency.set(start,(frequency.get(start)??0)+1);
              const pairs=[...frequency.values()].reduce((sum,n)=>sum+Math.floor(n/2),0);
              const han=Number(pinfu)+(pairs===2?3:pairs);
              if(han>shapeHan){
                shapeHan=han;
                shapeYaku=[...(pinfu?['平和']:[]),...(pairs?[pairs===2?'二杯口':'一杯口']:[])];
              }
            }:null):[];
          if(shapes.includes('七对子单骑')&&shapeHan<2)shapeYaku=['七对子'];
          shapeYaku.forEach(y=>yaku.add(y));
          if(shapes.includes('国士'))yaku.add('国士无双');
          waits.push({id:j,left:4-known[j],yaku:[...yaku],shapes});
        }
        c[j]--;
      }
      const hopes=melds.length?[]:yakuman(c,visible.map((n,i)=>three&&i>0&&i<8?4:n));
      visible[i]--;
      c[i]++;
      const furiten=s.value===0 && waits.some(w=>w.id===i || history.played[3].some(o=>id(o)===w.id));
      const risk=rivers.map((_,seat)=>danger(i,history.played[seat],known,history.passed[seat],history.early[seat]));
      return {tile:t,s,waits,ukeire:waits.reduce((sum,w)=>sum+w.left,0),kept:totalDora-doraCounts[i]-Number(t.red),
        risk,furiten,hopes, threat:Math.max(...risk.filter((_,j)=>ready[j]).map(r=>r.score),0)};
    }
    const unique=[...new Map(hand.map(t=>[t.id+':'+t.red,t])).values()];
    const forbidden=new Set();
    if(options.afterCall){
      const last=melds[options.latest??(melds.length-1)], called=options.called;
      if(!last||last.length!==3||called?.length!==1||!last.some(t=>t.id===called[0].id))throw new Error('请将刚完成的吃碰填在最后一组，并填写其中被鸣的那张牌。');
      const i=called[0].id;
      forbidden.add(i);
      const sorted=last.map(id).sort((a,b)=>a-b);
      if(sorted[0]!==sorted[2]){
        if(i===sorted[0]&&i%9<6)forbidden.add(i+3);
        if(i===sorted[2]&&i%9>2)forbidden.add(i-3);
      }
    }
    const rows=(locked?[hand.at(-1)]:unique).filter(t=>!forbidden.has(t.id)).map(paths);
    if(!rows.length)throw new Error('没有合法切牌，请检查手牌及最新副露。');
    const efficiency=(a,b)=>a.s.value-b.s.value || b.ukeire-a.ukeire || a.furiten-b.furiten || b.kept-a.kept;
    const best=[...rows].sort(efficiency)[0];
    const hasThreat=ready.some(Boolean);
    const opponentsInRiichi=declared.filter(Boolean).length;
    function adviseRiichi(row){
      if(row.s.value!==0||locked||!menzen)return null;
      const live=row.waits.filter(w=>w.left>0);
      const damaCopies=row.furiten?0:live.filter(w=>w.yaku.length).reduce((total,w)=>total+w.left,0);
      const missing=[];
      if(options.remaining==null)missing.push('剩余牌数');
      if(!Number.isFinite(options.scores?.[0]))missing.push('自家点数');
      function advice(label,reason,conditional=true){
        return {label,reason,damaCopies,missing:conditional?missing:[]};
      }
      if(options.scores?.[0]<1000)return advice('不能立直','自家点数不足 1000，无法支付立直棒。',false);
      if(options.remaining!=null&&options.remaining<(three?3:4))
        return advice('通常不能立直','按正常摸牌顺序已无下一次自家摸牌机会。',false);
      if(!live.length)return advice('建议暂缓','所有牌形完成张都已可见，立直会锁住手牌。',false);
      if(row.furiten)return advice('倾向默听','当前舍牌振听，只能自摸。维持默听可保留换听和弃和余地。',false);
      const wide=live.some(w=>w.shapes.includes('两面'));
      const thin=row.ukeire<=2;
      const late=options.remaining!=null&&options.remaining<=12;
      if(live.some(w=>w.yaku.includes('国士无双')||w.yaku.includes('大三元')))
        return advice('倾向默听','已确认有役满和牌张，立直不会提高役满打点。',false);
      if(options.finalRound&&options.scores?.length>1&&options.scores[0]>Math.max(...options.scores.slice(1))&&damaCopies)
        return advice('倾向默听','南场末局领先，已能默听荣和，保留应对对手进攻的余地。',false);
      if(hasThreat&&(damaCopies||thin||!wide))
        return advice(damaCopies?'倾向默听':'倾向暂缓立直',
          (opponentsInRiichi?'已有对手立直。':'已有标记的防守对象。')+
          (damaCopies?'此切可默听荣和，保留弃和或改良的余地。':'当前听牌较窄，先保留改良和弃和余地。'),false);
      if(late&&(damaCopies||thin))
        return advice(damaCopies?'倾向默听':'倾向暂缓立直','剩余牌数较少，保持手牌可调整。',false);
      if(damaCopies&&(thin||row.kept>=3))
        return advice('倾向默听',thin?'已能默听荣和，但未见和牌张较少。':'已能默听荣和且保留至少 3 枚宝牌。',false);
      if(!damaCopies)
        return advice('倾向立直','目前未确认默听荣和役。若满足宣告条件，立直可确保有役。');
      if(wide&&row.ukeire>=4)
        return advice('倾向立直','有两面听且未见完成张较多，立直可增加打点，代价是锁手并公开听牌。');
      return advice('倾向默听','已有可默听荣和的牌，保留改良和防守余地。',false);
    }
    for(const row of rows)row.riichi=adviseRiichi(row);
    const lead=options.scores?.length?options.scores[0]-Math.max(...options.scores.slice(1)):0;
    const protectLead=options.finalRound&&lead>0&&hasThreat;
    const multiplier=protectLead?(lead<12000?2.0:1.5):1;
    const close=rows.filter(r=>r.s.value===1&&best.s.value===1&&best.ukeire-r.ukeire<=4);
    if(close.length>1&&options.remaining!==0)for(const r of close){
      c[r.tile.id]--;
      let quality=0,wide=0,furiten=0;
      for(const w of r.waits.filter(w=>w.left)){
        c[w.id]++;
        let top=null;
        for(const cut of all.filter(i=>c[i])){
          c[cut]--;
          if(shanten(c,melds.length).value===0){
            let live=0,two=false,blocked=false;
            for(const j of all)if((!three||j===0||j>=8)&&c[j]<4){
              const shapes=waitShapes(c,j,melds.length);
              if(!shapes.length)continue;
              const left=4-known[j]-Number(j===w.id);
              live+=left;two ||=left>0&&shapes.includes('两面');
              blocked ||=cut===j||r.tile.id===j||history.played[3].some(t=>t.id===j);
            }
            const score=live*(blocked?.5:1);
            if(!top||score>top.score)top={score,two,blocked};
          }
          c[cut]++;
        }
        c[w.id]--;
        if(top){quality+=w.left*top.score;if(top.two)wide+=w.left;if(top.blocked)furiten+=w.left;}
      }
      c[r.tile.id]++;
      r.next={quality:quality/Math.max(1,r.ukeire),wide,furiten};
    }
    const score=r=>-r.s.value*100+r.ukeire*2+r.kept*6-Number(r.furiten)*14-r.threat*multiplier*(options.remaining!=null&&options.remaining<15?1.35:1)*(best.s.value===0?1.2:2.4)+(r.next?.quality??0);
    rows.sort((a,b)=>{
      if (mode==='defense' && hasThreat && a.threat!==b.threat) return a.threat-b.threat;
      if (mode==='balanced' && hasThreat) {
        if (best.s.value>=2 && (a.threat===0 || b.threat===0) && a.threat!==b.threat) return a.threat-b.threat;
        return score(b)-score(a)||efficiency(a,b);
      }
      if(a.next&&b.next)return (b.ukeire+b.next.quality)-(a.ukeire+a.next.quality)||efficiency(a,b);
      return efficiency(a,b)||a.threat-b.threat;
    });
    const big=rows.flatMap(r=>r.hopes.map(([yaku,n,condition])=>({tile:r.tile,yaku,n,condition,risk:r.threat})))
      .sort((a,b)=>a.n-b.n||a.risk-b.risk);
    return {rows,best,protectLead,hasTimeline:!!options.events?.length,hasConfirmedRiichi:history.confirmed.slice(0,3).some(Boolean),lastCuts:history.lastCuts,locked,forbidden:[...forbidden],big:[...new Map(big.reverse().map(x=>[x.yaku,x])).values()].reverse(),hasThreat,complete:!options.afterCall&&shanten(c,melds.length).value===-1};
  }
  root.Riichi={parse,parseEvents,name,notation,counts,dora,shanten,analyze};
  if (typeof module!=='undefined') module.exports=root.Riichi;
})(globalThis);
