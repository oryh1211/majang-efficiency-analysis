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
  function waitShapes(counts,win,fixed){
    const c=counts.slice(), shapes=new Set();c[win]++;
    function walk(sets,pair,used){
      const i=c.findIndex(Boolean);
      if(i<0){if(sets===4&&pair)used.forEach(shape=>shapes.add(shape));return;}
      function take(ids,shape,nextSets,nextPair){
        for(const j of ids)c[j]--;
        walk(nextSets,nextPair,ids.includes(win)?used.concat(shape):used);
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
  function danger(i, river, known) {
    if (river.some(t=>id(t)===i)) return {score:0,label:'现物'};
    if (i>=27) {
      if (known[i]===4) return {score:2,label:'四枚可见字牌，留意国士'};
      return {score:Math.max(12,64-14*known[i]),label:'字牌 · 已见 '+known[i]+' 枚'};
    }
    const n=i%9;
    const safe = j => river.some(t=>id(t)===j);
    let open=0, covered=0, blocked=0, possible=0;
    for (const start of [n-2,n-1,n]) {
      if (start<0 || start>6) continue;
      possible++;
      const a=i-n+start;
      const others=[a,a+1,a+2].filter(j=>j!==i);
      if (others.some(j=>known[j]===4)) {blocked++;continue;}
      if (n===start && start<6 && safe(i+3) || n===start+2 && start>0 && safe(i-3)) covered++;
      else open++;
    }
    return {score:12+open*23+Math.max(0,3-known[i])*3,
      label:blocked===possible?'壁挡顺子，留意单骑或双碰':covered?'有筋，仍可能点炮':'无现物依据'};
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
    if(locked&&melds.some((group,i)=>group.length!==4||!options.closedGroups?.[i]))throw new Error('明副露后不能立直。');
    if(!Number.isInteger(north)||north<0||north>4||(!three&&north))throw new Error('请检查拔北枚数。');
    if(three&&(rivers[1].length||ready[1]))throw new Error('三麻没有对家，请清空对家牌河和立直状态。');
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
        if(shanten(c,melds.length).value<s.value) waits.push({id:j,left:4-known[j],yaku:s.value===0?confirmedYaku():[],shapes:s.value===0?waitShapes(c.map((n,i)=>n-Number(i===j)),j,melds.length):[]});
        c[j]--;
      }
      const hopes=melds.length?[]:yakuman(c,visible.map((n,i)=>three&&i>0&&i<8?4:n));
      visible[i]--;
      c[i]++;
      const furiten=s.value===0 && waits.some(w=>w.id===i || own.some(o=>id(o)===w.id));
      const risk=rivers.map(r=>danger(i,r,known));
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
              blocked ||=cut===j||r.tile.id===j||own.some(t=>t.id===j);
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
    return {rows,best,protectLead,forbidden:[...forbidden],big:[...new Map(big.reverse().map(x=>[x.yaku,x])).values()].reverse(),hasThreat,complete:!options.afterCall&&shanten(c,melds.length).value===-1};
  }
  root.Riichi={parse,name,notation,counts,dora,shanten,analyze};
  if (typeof module!=='undefined') module.exports=root.Riichi;
})(globalThis);
