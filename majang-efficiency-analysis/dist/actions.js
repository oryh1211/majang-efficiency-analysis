((root)=>{
  const kanNames={ankan:'暗杠',kakan:'加杠',daiminkan:'大明杠'};
  function remove(hand,indices){return hand.filter((_,i)=>!indices.includes(i));}
  function combinations(hand,ids){
    const find=(rest,used=[])=>rest.length?hand.flatMap((tile,i)=>tile.id===rest[0]&&!used.includes(i)?
      find(rest.slice(1),[...used,i]):[]):[used];
    return [...new Map(find(ids).map(indices=>{
      const sorted=indices.sort((a,b)=>a-b);
      return [sorted.map(i=>hand[i].id+':'+hand[i].red).join(','),sorted];
    })).values()];
  }
  function improvement(hand,fixed,known,three){
    const {counts,shanten}=root.Riichi,c=counts(hand);
    const s=shanten(c,fixed).value;
    const tiles=known.flatMap((n,i)=>{
      if(c[i]===4||three&&i>0&&i<8)return [];
      c[i]++;
      const improves=shanten(c,fixed).value<s;
      c[i]--;
      return improves?[{id:i,left:4-n}]:[];
    });
    return {s,tiles,ukeire:tiles.reduce((sum,t)=>sum+t.left,0)};
  }
  function riichiKan(hand,indices,groups,three){
    const draw=hand.length-1;
    if(!indices.includes(draw))return false;
    const {counts}=root.Riichi;
    const before=hand.slice(0,-1),after=remove(hand,indices);
    const original=improvement(before,groups.length,counts(before.concat(groups.flat())),three);
    const changed=improvement(after,groups.length+1,counts(hand.concat(groups.flat())),three);
    const waits=result=>result.tiles.filter(t=>t.left>0).map(t=>t.id+':'+t.left).join();
    return original.s===0&&changed.s===0&&Boolean(waits(original))&&waits(original)===waits(changed);
  }
  function compare(state){
    const {hand,indicators,rivers,melds,three,ready,remaining,phase,target,offered,context={},north=0,extra=[]}=state;
    const response=phase==='response';
    const locked=ready[3];
    const visibleRivers=rivers.map(r=>r.slice());
    const {counts,name,dora,analyze}=root.Riichi;
    if(hand.length!==(response?13:14)-melds.length*3)throw Error('手牌张数与行动时机或副露不符。');
    if(response&&(!target||target.seat===3||three&&target.seat===1||
      target.index!==rivers[target.seat]?.length-1||!rivers[target.seat][target.index]))
      throw Error('请确认刚刚打出的牌是该对手牌河的最后一张。');
    if(response&&(!Array.isArray(offered)||!offered.length))throw Error('请确认截图显示的操作按钮。');
    if(response&&offered.includes('ron'))throw Error('画面有荣和选项，请先确认和牌。本面板仅比较吃碰杠。');
    const groups=melds.map(m=>m.tiles);
    const closed=melds.map(m=>Boolean(m.closed));
    const known=counts([...hand,...groups.flat(),...indicators,...rivers.flat(),...extra,...Array(north).fill(30)]);
    if(known.some(n=>n>4)||three&&known.slice(1,8).some(Boolean))throw Error('请先校对可见牌数。');
    const doraCounts=counts(indicators.map(t=>three&&t.id===0?8:dora(t.id)));
    const kept=tiles=>tiles.reduce((n,t)=>n+doraCounts[t.id]+Number(t.red),north*(1+doraCounts[30]));
    const decisions=[];
    const opponents=context.guards??ready.slice(0,3);
    const threat=opponents.some(Boolean);
    const lead=context.finalRound&&context.scores?.length>1&&context.scores[0]>Math.max(...context.scores.slice(1));
    const cut=(tiles,sets,doors,rivers,afterCall=false,called)=>{
      const result=analyze(tiles,indicators,rivers.slice(0,3),rivers[3],extra,opponents,'balanced',locked,{
        ...context,three,north,closedGroups:doors,melds:sets,afterCall,called:called?[called]:[],remaining,declaredOpponents:ready.slice(0,3)
      });
      return result.rows[0]&&{cut:result.rows[0],forbidden:result.forbidden,complete:result.complete};
    };
    function addDraw(kind,tiles,sets,group){
      const evaluated=improvement(tiles,sets.length,known,three);
      decisions.push({kind,label:kanNames[kind]??'跳过',group,...evaluated,kept:kept(tiles.concat(sets.flat()))});
    }
    function addCut(kind,tiles,sets,doors,rivers,group,called){
      let result;
      try{result=cut(tiles,sets,doors,rivers,Boolean(called),called);}
      catch(error){if(called&&error.message.startsWith('没有合法切牌'))return;throw error;}
      if(!result)return;
      const row=result.cut;
      const yaku=[...new Set(row.waits.flatMap(w=>w.yaku))];
      const honors=new Set([31,32,33,context.wind,context.roundWind]);
      for(const set of sets)if(honors.has(set[0].id)&&set.every(t=>t.id===set[0].id))
        yaku.push('役牌'+name(set[0].id));
      decisions.push({kind,label:{chi:'吃',pon:'碰',continue:'继续出牌'}[kind],group,...result,
        s:row.s.value,ukeire:row.ukeire,kept:row.kept,yaku:[...new Set(yaku)]});
    }
    const mayKan=indicators.length>=1&&indicators.length<5&&
      (remaining>0||remaining==null&&offered?.includes('kan'));
    if(response){
      addDraw('skip',hand,groups);
      const tile=visibleRivers[target.seat].pop();
      const add=(kind,ids)=>{
        if(!offered.includes(kind==='daiminkan'?'kan':kind))return;
        for(const indices of combinations(hand,ids)){
          const group=[tile,...indices.map(i=>hand[i])].sort((a,b)=>a.id-b.id);
          const rest=remove(hand,indices),sets=[...groups,group];
          if(kind==='daiminkan')addDraw(kind,rest,sets,group);
          else addCut(kind,rest,sets,[...closed,false],visibleRivers,group,tile);
        }
      };
      if(!locked&&remaining!==0&&groups.length<4){
        add('pon',[tile.id,tile.id]);
        if(mayKan)add('daiminkan',[tile.id,tile.id,tile.id]);
        if(!three&&target.seat===0&&tile.id<27)
          for(let start=tile.id-2;start<=tile.id;start++){
            if(start<0||start%9>6||Math.floor(start/9)!==Math.floor(tile.id/9))continue;
            add('chi',[start,start+1,start+2].filter(i=>i!==tile.id));
          }
      }
      for(const option of offered)if(!decisions.some(d=>d.kind===(option==='kan'?'daiminkan':option)))
        throw Error('可见操作与已确认的手牌、舍牌或规则不一致，请校对。');
    }else{
      addCut('continue',hand,groups,closed,rivers);
      if(mayKan&&offered?.includes('kan')){
        for(const i of new Set(hand.map(t=>t.id))){
          const [indices]=combinations(hand,Array(4).fill(i));
          if(indices&&(!locked||riichiKan(hand,indices,groups,three))){
            const group=indices.map(j=>hand[j]);
            addDraw('ankan',remove(hand,indices),[...groups,group],group);
          }
        }
        if(!locked)for(const [index,group] of groups.entries()){
          const i=hand.findIndex(t=>t.id===group[0].id);
          if(i>=0&&!closed[index]&&group.length===3&&group.every(t=>t.id===group[0].id)){
            const quad=[...group,hand[i]];
            addDraw('kakan',remove(hand,[i]),groups.map((g,j)=>index===j?quad:g),quad);
          }
        }
      }
    }
    const score=d=>-d.s*24+Math.min(d.ukeire,20)*.55+d.kept*.7+(d.yaku?.length?5:0)-
      (d.kind==='chi'||d.kind==='pon'?2+(d.s===0&&!d.yaku.length?10:0):0)-
      (d.cut?.threat??0)*(lead?3:1.4)-(kanNames[d.kind]?4+Number(threat)*9+Number(lead)*3+Number(remaining<=12&&remaining!=null)*3:0);
    decisions.sort((a,b)=>score(b)-score(a));
    return decisions;
  }
  root.ActionAdvice={compare,riichiKan};
  if(typeof module!=='undefined')module.exports=root.ActionAdvice;
})(globalThis);
