(() => {
  const $=id=>document.getElementById(id);
  const {parse,parseEvents,name,notation,analyze}=Riichi;
  const declarationFields=[0,1,2,3].map(i=>'declaration'+i);
  const tileName=t=>t.red?'赤'+name(t.id):name(t.id);
  function el(tag,className='',content='') {
    const node=document.createElement(tag);
    if(className) node.className=className;
    node.textContent=content;
    return node;
  }
  function face(tile,action) {
    if(!tile)return el('span','tile unread','?');
    const node=el(action?'button':'span','tile');
    if(action){node.type='button';node.addEventListener('click',action);}
    node.title=tileName(tile);
    node.setAttribute('aria-label',tileName(tile));
    node.append(TileVision.art(tile));
    return node;
  }
  function toInput(tiles) {
    return tiles.filter(Boolean).map(t=>t.red?'0'+notation(t.id).at(-1):notation(t.id)).join('');
  }
  function setHand(tiles) {$('hand').value=toInput(tiles);paintHand();}
  function paintHand() {
    const view=$('hand-tiles');
    view.replaceChildren();
    try {
      const hand=parse($('hand').value);
      $('tile-count').textContent=hand.length+' 张';
      hand.forEach((t,i)=>view.append(face(t,uploadMode?null:()=>setHand(hand.filter((_,j)=>i!==j)))));
    } catch {$('tile-count').textContent='牌谱格式有误';}
  }
  $('hand').addEventListener('input',paintHand);
  for (const ids of [[4,13,22],[0,8,33]]) {
    const target=$(ids[0]===4?'hero-tiles':'empty-tiles');
    for(const id of ids) target.append(face({id,red:false}));
  }
  for(let s=0;s<4;s++){
    const row=el('div','tiles');
    for(const t of TileVision.variants.filter(t=>Math.floor(t.id/9)===s)) {
      row.append(face(t,()=>{
        try {
          const hand=parse($('hand').value);
          if(hand.length<14) setHand([...hand,t]);
        } catch {showError('请先修正手牌栏中的牌谱。');}
      }));
    }
    $('palette').append(row);
  }
  function showError(message='') {
    $('error').textContent=message;$('error').hidden=!message;
  }
  function render(data) {
    const target=$('results');
    target.replaceChildren();
    const say=(text,kind='sub status')=>target.append(el('p',kind,text));
    if($('melds').value.trim())say('固定牌组计入向听和进张，和牌须满足役。');
    if(data.forbidden.length)say('本巡禁打 '+data.forbidden.map(name).join('、'),'status warning');
    if(data.protectLead)say('南场末局领先，攻守平衡排序提高了对标记对手的防守权重。');
    if(data.complete) say('当前牌形已完成。请先确认和牌役种，以下供选择舍牌时参考。','status warning');
    if(data.locked) say('已立直。若本巡不和牌，常规切牌仅限摸切。');
    if(!data.hasThreat) say('尚未标记防守对象。排序以牌效率为主，牌河风险仅供参考。');
    say('效率首选：切'+tileName(data.best.tile)+' · '+(data.best.s.value===0?'听牌':data.best.s.value+' 向听')+' · '+data.best.ukeire+' 枚进张');
    if(data.rows.some(r=>r.riichi)){
      const context=[];
      if($('round').value)context.push($('round').value);
      if($('scores').value.trim())context.push('自家 '+$('scores').value.trim().split(/\s+/)[0]+' 点');
      if($('remaining').value!=='')context.push('余 '+$('remaining').value+' 张');
      if(context.length)say('立直判断场况：'+context.join(' · '));
      const edit=el('button','demo','补充或修改场况');
      edit.type='button';
      edit.onclick=()=>{$('decision-context').open=true;$('round').scrollIntoView({block:'center'});};
      target.append(edit);
    }
    const list=el('ol','result-list');
    const players=['上家','对家','下家'];
    data.rows.slice(0,3).forEach((r,i)=>{
      const card=el('li','result-card');
      const heading=el('div','result-top');
      heading.append(el('span','rank',i+1),face(r.tile),el('strong','','切 '+tileName(r.tile)));
      if(data.hasThreat&&r.threat===0) heading.append(el('span','tag','对所有防守对象有安全依据'));
      const stats=el('div','stats');
      for(const text of [r.s.value===0?'听牌':r.s.value+' 向听','进张 '+r.ukeire+' 枚','保留宝牌 '+r.kept+' 枚']) stats.append(el('span','chip',text));
      const delta=r.ukeire-data.best.ukeire;
      if(r.s.value===data.best.s.value)stats.append(el('span','chip','较效率首选 '+(delta>0?'+':'')+delta+' 枚'));
      if(!r.furiten)stats.append(el('span','chip',r.s.value===0?'无舍牌振听':'尚未听牌'));
      if(r.s.value===0)stats.append(el('span','chip','听 '+r.waits.length+' 种 · '+[...new Set(r.waits.flatMap(w=>w.shapes))].join('／')));
      if(r.furiten) stats.append(el('span','chip warning','舍牌振听 · 只能自摸'));
      const waits=r.waits.filter(t=>t.left>0).map(t=>name(t.id)+' ×'+t.left);
      card.append(heading,stats,el('p','waits',(r.s.value===0?'未见的牌形完成张：':'有效进张：')+(waits.length?waits.join(' · '):'0 枚')));
      card.append(el('p','risks',r.risk.flatMap((a,j)=>($('players').value!=='3'||j!==1)?[players[j]+' '+a.label]:[]).join(' ｜ ')));
      if(r.next)card.append(el('p','waits','下一巡有效摸入中，'+r.next.wide+' 枚可转两面，'+(r.ukeire-r.next.wide)+' 枚转其他听形，'+r.next.furiten+' 枚在所选最优留张下振听。'));
      if(r.riichi){
        const advice=el('div','riichi-advice');
        advice.append(el('strong','',r.riichi.label),el('p','',r.riichi.reason));
        if(r.riichi.missing.length)advice.append(el('small','','宣告前请核对'+r.riichi.missing.join('和')+'。'));
        card.append(advice);
      }
      if(r.s.value===0){
        const wins=r.waits.filter(w=>w.left&&w.yaku.length).map(w=>name(w.id)+'（'+w.yaku.join('、')+'）');
        const title=r.riichi?'默听荣和已确认有役的牌':'已确认有役的完成张';
        card.append(el('p','waits',title+'：'+(r.furiten&&r.riichi?'当前振听':wins.join(' · ')||'暂无')+'。'));
      }
      for(const j of [0,1,2])if($('shown'+j).value.trim())card.append(el('p','risks',players[j]+'明牌 '+$('shown'+j).value));
      list.append(card);
    });
    target.append(list);
    const [first,second]=data.rows;
    if(second)say('切'+tileName(first.tile)+'为'+first.s.value+'向听、'+first.ukeire+'枚进张，切'+tileName(second.tile)+'为'+second.s.value+'向听、'+second.ukeire+'枚进张。'+(first.threat<second.threat?'首选对当前防守对象的危险度较低。':first.kept>second.kept?'首选还多保留宝牌。':''));
    if(data.big.length) {
      const big=el('section','big');
      big.append(el('h3','gold','役满路线'));
      for(const r of data.big) big.append(el('p','',r.yaku+' · 切 '+tileName(r.tile)+' · 距目标牌形最少 '+r.n+' 张。'+(r.condition??'')));
      big.append(el('p','sub','以门前牌形和已见枚数估算，可在上方比较效率与防守。'));
      target.append(big);
    }
    const recent=data.lastCuts.flatMap((cut,seat)=>{
      if(!cut||seat===3)return [];
      const phase=cut.position<=3?'早巡':cut.position>=9?'晚巡':'';
      return [players[seat]+'第 '+cut.position+' 张'+phase+(cut.cut==='hand'?'手切':'摸切')+' '+tileName(cut.tile)];
    });
    if(recent.length)say('牌谱最近舍牌：'+recent.join(' ｜ '));
    if(!data.hasTimeline)say('跨家舍牌先后未知。可在「舍牌时序与立直宣言」录入已核实的牌谱。');
    else if(!data.hasConfirmedRiichi)say('已录入全桌时序，尚无已确认成立的对手立直。');
    say('进张枚数为未见上限。现物和立直后已通过仅对所标座位有效。筋、壁和早巡外侧属于风险线索。');
    if(data.rows.some(r=>r.s.value===0)) say('振听提示依据自家牌河与本次舍牌。荣和仍须满足役及当巡振听条件。');
  }
  let uploadMode=false;
  let screenshotAccepted=false,review=null;
  const needsReview=mark=>mark.uncertain||mark.issues?.length;
  const reviewLabel=(board,m)=>{
    const field=m.field, seat=field==='own'||field==='locked'?3:Number(field.slice(-1));
    const status=field==='locked'||field.startsWith('ready');
    const title=field==='meld'?'自家副露 '+(m.group+1)+(m.index===board.melds[m.group].called?' · 被鸣牌':''):field==='hand'?'手牌':field==='indicators'?'宝牌指示牌':['上家','对家','下家','自家'][seat]+(status?'立直状态':'牌河');
    return title+(m.index===undefined?'':'第 '+(m.index+1)+' 张');
  };
  function run(event) {
    event?.preventDefault();
    if(uploadMode&&(!screenshotAccepted||review?.marks.some(needsReview)||(review?.afterCall&&review.latest===undefined)))return;
    showError();
    try {
      const declaredOpponents=[0,1,2].map(i=>$('ready'+i).checked);
      const ready=declaredOpponents.map((declared,i)=>declared||$('guard'+i).checked);
      const scores=$('scores').value.trim().split(/\s+/).filter(Boolean).map(Number);
      if(scores.length&&(scores.length!==Number($('players').value)||scores.some(n=>!Number.isFinite(n))))throw Error('请按人数填写点数，自己在前。');
      const remaining=$('remaining').value===''?null:Number($('remaining').value);
      if(remaining!==null&&(!Number.isInteger(remaining)||remaining<0||remaining>70))throw Error('请输入 0 至 70 之间的剩余牌数。');
      if(review&&(review.phase==='response'||review.kanConfirmed)){
        renderActions(review,remaining,scores,ready);
        return;
      }
      const locked=$('locked').checked;
      const rivers=[0,1,2].map(i=>parse($('river'+i).value));
      const own=parse($('own').value);
      const declarations=declarationFields.map((field,i)=>{
        const text=$(field).value.trim();
        if(text==='')return undefined;
        const position=Number(text);
        if(!Number.isInteger(position)||position<0||position>[...rivers,own][i].length)
          throw Error('立直宣言位置超出对应牌河。');
        return review&&!review.declarationOverrides[i]?undefined:position;
      });
      const events=parseEvents($('events').value);
      const indicators=parse($('indicators').value);
      if(indicators.length>5) throw new Error('最多可录入五张宝牌指示牌。');
      render(analyze(parse($('hand').value),indicators,rivers,own,parse($('extra').value).concat(...[0,1,2].map(i=>parse($('shown'+i).value))),ready,$('mode').value,locked,{three:$('players').value==='3',melds:$('melds').value.trim().split(/\s+/).filter(Boolean).map(parse),north:Number($('north').value),afterCall:!!review?.afterCall,called:parse($('called').value),latest:review?.latest,closedGroups:review?.melds?.map(group=>!!group.closed),wind:Number($('wind').value),roundWind:({'东':27,'南':28})[$('round').value[0]],finalRound:$('round').value==='南'+$('players').value+'局',scores,remaining,declaredOpponents,declarations,events}));
    } catch(error){emptyResult("请检查牌局",error.message);showError(error.message);}
  }
  $('form').addEventListener('submit',run);
  for(const field of ['round','wind','scores','remaining'])$(field).addEventListener('change',()=>{if($('hand').value.trim())run();});
  for(const [seat,field] of declarationFields.entries())$(field).addEventListener('change',()=>{
    const value=$(field).value.trim();
    if(review){
      review.declarations[seat]=value===''?undefined:Number(value);
      review.declarationOverrides[seat]=value!=='';
      if(value!==''&&Number(value)>0){
        review.ready[seat]=true;
        $(seat===3?'locked':'ready'+seat).checked=true;
      }
    }
    if($('hand').value.trim())run();
  });
  $('events').addEventListener('change',()=>{if($('hand').value.trim())run();});
  $('demo').addEventListener('click',()=>{
    manual();
    $('hand').value='12346m455p227s556z';$('indicators').value='4p';
    $('river0').value='19m18s1z';$('river1').value='9p1m';$('river2').value='19s';
    $('own').value='';$('extra').value='';$('locked').checked=false;
    $('ready0').checked=true;$('ready1').checked=$('ready2').checked=false;
    $('mode').value='balanced';$('board').open=true;
    paintHand();run();
  });
  const preview=$('preview'),ctx=preview.getContext('2d');
  const learning=globalThis.BoardLearning;
  let reviewImage,learningEnabled=false,learningEpoch=0,contributionAvailable=false;
  let failedImage;
  let uploadSequence=0;
  const inputs=['hand','indicators','own','extra','locked','river0','river1','river2','ready0','ready1','ready2'];
  function changeMode(isUpload,hideForm) {
    reviewImage=undefined;
    failedImage=undefined;
    $('review-response').hidden=true;
    $('action-input').replaceChildren();
    for(const i of [0,1,2]){$('guard'+i).checked=false;$('shown'+i).value='';}for(const field of ['round','wind','scores','remaining','events',...declarationFields])$(field).value='';review=null;$('called').value='';$('called').hidden=$('called-label').hidden=true;$('markers').replaceChildren();$('correction').replaceChildren();uploadMode=isUpload;
    $('melds').readOnly=isUpload;
    $('melds-label').textContent=isUpload?'自动识别的自家副露':'自己的明副露（每组用空格分隔）';
    $('players').disabled=isUpload;$('players').value='4';$('melds').value='';$('north').value='0';
    screenshotAccepted=false;
    $('form').hidden=hideForm;
    $('vision').hidden=!isUpload;
    $('palette').parentElement.hidden=isUpload;
    $('manual-hint').hidden=isUpload;
    for(const id of inputs){
      const control=$(id);
      control.disabled=isUpload;
      if(control.type==='checkbox')control.checked=false;
      else control.value='';
    }
    $('read-board').replaceChildren();
    paintHand();
    showError();
  }
  function emptyResult(title,message) {
    const empty=el('div','empty');
    empty.append(el('h3','',title),el('p','',message));
    $('results').replaceChildren(empty);
  }
  function manual() {
    uploadSequence++;
    changeMode(false,false);
    emptyResult('等待手牌','输入 14 张门前手牌，或上传完整雀魂截图。');
  }
  $('manual').addEventListener('click',manual);
  function setVisionStatus(text,error=false) {
    const status=$('vision-status');
    status.textContent=text;
    status.classList.toggle('error',error);
  }
  function showReading(board) {
    const result=$('read-board');result.replaceChildren();
    function row(title,tiles,lead='') {
      const line=el('div','reading');
      line.append(el('strong','',title));
      if(lead)line.append(el('span','',lead));
      for(const t of tiles)line.append(face(t));
      result.append(line);
    }
    row('宝牌指示牌',board.indicators);
    row('宝牌',board.indicators.map(t=>({id:board.three&&t.id===0?8:Riichi.dora(t.id),red:false})));
    if(board.phase==='response')row('出牌时机',[],'鸣牌响应 · 用户确认');
    else if(board.afterCall)row('出牌时机',[],'吃碰后待切牌');else row('本巡摸牌',board.hand.slice(-1));
    for(const [i,group] of (board.melds??[]).entries()){
      const tile=group.tiles[group.called];
      row((group.closed?'自家暗杠 ':'自家副露 ')+(i+1),group.tiles,group.closed?'暗杠':((group.added?'加杠 · ':group.tiles.length===4?'大明杠 · ':'')+'横放 '+tileName(tile)+(i===board.latest?' · 本巡':'')));
    }
    for(const [i,seat] of ['上家','对家','下家','自家'].entries()){
      if(board.three&&i===1)continue;
      const river=board.rivers[i];
      const declaration=board.declarations[i];
      row(seat,river,(board.ready[i]?'已立直':'未立直')+' · '+(declaration?'第 '+declaration+' 张宣言':(river.length?'舍牌':'牌河为空')));
    }
  }
  function drawMarkers(board){
    const layer=$('markers');layer.replaceChildren();
    const editor=$('correction');editor.replaceChildren();
    for(const m of board.marks){
      const field=m.field, seat=field==='own'||field==='locked'?3:Number(field.slice(-1));
      const status=field==='locked'||field.startsWith('ready');
      const label=reviewLabel(board,m);
      const isDeclaration=board.declarations[seat]===m.index+1;
      const mark=el('button','marker'+(needsReview(m)?' uncertain':''),needsReview(m)?'?':isDeclaration?'立':'');mark.type='button';mark.title=label;mark.setAttribute('aria-label','校对'+label);
      Object.assign(mark.style,{left:m.x*100+'%',top:m.y*100+'%',width:m.w*100+'%',height:m.h*100+'%'});
      mark.onclick=()=>{
        editor.replaceChildren(el('strong','',label));
        for(const reason of [m.reason,...(m.issues??[])].filter(Boolean))editor.append(el('p','sub',reason));
        const values=field==='meld'?board.melds[m.group].tiles:field==='hand'?board.hand:field==='indicators'?board.indicators:board.rivers[seat];
        const remember=el('input');
        remember.type='checkbox';
        const eligible=learning&&reviewImage&&m.crop&&!m.occluded;
        if(eligible&&learningEnabled){
          const option=el('label','remember');
          option.append(remember,document.createTextNode(' 记住这次校对'));
          editor.append(option);
        }
        const contribute=el('input');contribute.type='checkbox';
        if(eligible&&contributionAvailable){
          const option=el('label','remember');
          option.append(contribute,document.createTextNode(' 贡献这个样本（提交前预览）'));
          editor.append(option);
        }
        function rememberSample(label){
          if(!eligible||!remember.checked&&!contribute.checked)return;
          const entry=learning.sample(reviewImage,board,m,label);
          if(!entry){learningStatus('无法确认裁剪内容，本次校对未保存。');return;}
          if(remember.checked&&learningEnabled)learning.save(entry).then(()=>refreshLearning('已保存这次校对。')).catch(learningError);
          if(contribute.checked)previewContribution(entry);
        }
        function done(){m.uncertain=false;m.occluded=false;m.reason=undefined;m.status='corrected';m.corrected=true;acceptBoard(board);}
        if(field==='own'||field.startsWith('river')){
          if(board.phase==='response'&&seat!==3&&m.index===values.length-1){
            const target=el('button','demo','设为刚打出的牌');
            target.type='button';
            target.onclick=()=>{board.target=m;acceptBoard(board);};
            editor.append(target);
          }
          const declaration=el('button','demo',isDeclaration?'取消宣言标记':'标记立直宣言牌');
          declaration.type='button';
          declaration.onclick=()=>{
            board.declarations[seat]=isDeclaration?0:m.index+1;
            board.declarationOverrides[seat]=true;
            if(!isDeclaration)board.ready[seat]=true;
            acceptBoard(board);
          };
          editor.append(declaration);
          for(const delta of [-1,1]){
            const position=m.index+delta;
            if(position<0||position>=values.length)continue;
            const move=el('button','demo',delta<0?'前移一张':'后移一张');
            move.type='button';
            move.onclick=()=>{
              const other=board.marks.find(marker=>marker.field===field&&marker.index===position);
              const index=m.index;
              [values[index],values[position]]=[values[position],values[index]];
              if(other)other.index=index;
              m.index=position;
              if(board.declarations[seat]===index+1)board.declarations[seat]=position+1;
              else if(board.declarations[seat]===position+1)board.declarations[seat]=index+1;
              acceptBoard(board);
            };
            editor.append(move);
          }
          const empty=el('button','demo','此处无牌');
          empty.type='button';
          empty.onclick=()=>{
            if(m.occluded)return;
            rememberSample(null);
            values.splice(m.index,1);
            if(board.target===m)board.target=undefined;
            if(board.declarations[seat]===m.index+1)board.declarations[seat]=0;
            else if(board.declarations[seat]>m.index+1)board.declarations[seat]--;
            board.marks=board.marks.filter(marker=>marker!==m);
            for(const marker of board.marks)if(marker.field===field&&marker.index>m.index)marker.index--;
            acceptBoard(board);
          };
          if(!m.occluded)editor.append(empty);
        }
        if(field==='meld'&&board.afterCall&&board.melds[m.group].tiles.length===3){
          const select=el('button','demo','设为本巡副露');
          select.onclick=()=>{board.latest=m.group;acceptBoard(board);};
          editor.append(select);
        }
        if(status){
          for(const yes of [true,false]){const b=el('button','demo',yes?'已立直':'未立直');b.onclick=()=>{board.ready[seat]=yes;if(!yes){board.declarations[seat]=0;board.declarationOverrides[seat]=true;}done()};editor.append(b);}
        }else if(field==='indicators'){
          const input=el('input');input.value=toInput(values);input.placeholder='例如 4p';const b=el('button','demo','确认指示牌');
          b.onclick=()=>{try{const list=parse(input.value);if(!list.length||list.length>5)throw Error('请输入一至五张指示牌');board.indicators=list;done();}catch(e){input.setCustomValidity(e.message);input.reportValidity();}};input.oninput=()=>input.setCustomValidity('');editor.append(input,b);
        }else{
          const tiles=el('div','tiles');for(const t of TileVision.variants){if(board.three&&t.id>0&&t.id<8)continue;tiles.append(face(t,()=>{
            rememberSample(toInput([t]));
            m.originalCode??=values[m.index]?toInput([values[m.index]]):null;
            const group=field==='meld'?board.melds[m.group]:null;
            if(group?.closed){
              group.tiles=group.tiles.map((old,i)=>i===m.index?t:{id:t.id,red:old.id===t.id&&old.red&&!t.red});
            }else values[m.index]=t;
            m.code=toInput([t]);
            done();
          }));}editor.append(tiles);
        }
      };layer.append(mark);
    }
  }
  function acceptBoard(board) {
    BoardVision.auditBoard?.(board);
    review=board;
    board.declarations??=Array(4).fill(undefined);
    board.declarationOverrides??=Array(4).fill(false);
    for(const [seat,field] of declarationFields.entries())$(field).value=String(board.declarations[seat]??'');
    drawMarkers(board);screenshotAccepted=true;
    $('players').value=board.three?'3':'4';
    $('form').hidden=false;
    setHand(board.hand);
    $('indicators').value=toInput(board.indicators);
    for(let i=0;i<3;i++){
      $('river'+i).value=toInput(board.rivers[i]);
      $('ready'+i).checked=board.ready[i];
    }
    $('own').value=toInput(board.rivers[3]);
    $('locked').checked=board.ready[3];
    $('board').open=false;
    $('melds').value=(board.melds??[]).map(group=>toInput(group.tiles)).join(' ');
    $('called').hidden=$('called-label').hidden=true;
    if(board.afterCall&&board.melds.filter(group=>group.tiles.length===3).length===1)board.latest=board.melds.findIndex(group=>group.tiles.length===3);
    $('called').value=board.latest===undefined?'':toInput([board.melds[board.latest].tiles[board.melds[board.latest].called]]);
    showReading(board);
    actionControls(board);
    const pending=board.marks.filter(needsReview);
    if(pending.length){
      const positions=pending.slice(0,4).map(m=>reviewLabel(board,m)).join('、');
      setVisionStatus('待确认 '+pending.length+' 处：'+positions+(pending.length>4?'等。':'。'));
      emptyResult('等待校对','点选原图黄标，确认后自动重算。');return;
    }
    if(board.afterCall&&board.latest===undefined){
      setVisionStatus('已识别各组吃碰。请在截图上点选刚完成的那一组，以确定本巡禁打牌。');
      emptyResult('待确认本巡副露','点选副露中的任一张，然后选择「设为本巡副露」。');
      return;
    }
    setVisionStatus((board.meldCount?'已自动识别 '+board.meldCount+' 组自家副露。':'')+
      (board.learned?'已参考本地样本确认 '+board.learned+' 处。':'')+'点击截图中的牌面或座位可校对，修改后自动重算。');
    run();
  }
  async function upload(file) {
    if(!file)return;
    const seq=++uploadSequence;
    changeMode(true,true);
    preview.hidden=true;
    setVisionStatus('正在识别手牌、副露、宝牌和各家牌河…');
    emptyResult('正在检查截图','确认是自己摸牌或吃碰后待切牌的时机后才会给出建议。');
    let image;
    try {
      image=await createImageBitmap(file);
      if(seq!==uploadSequence)return;
      const scale=Math.min(1,960/image.width,620/image.height);
      preview.width=Math.max(1,Math.round(image.width*scale));
      preview.height=Math.max(1,Math.round(image.height*scale));
      ctx.drawImage(image,0,0,preview.width,preview.height);
      preview.hidden=false;
      await new Promise(resolve=>setTimeout(resolve,0));
      if(seq!==uploadSequence)return;
      const source=BoardVision.sourceImage(image);
      const board=BoardVision.inspect(source);
      if(board.ok){
        if(learningEnabled){
          const epoch=learningEpoch;
          const samples=await learning.list().catch(error=>{learningError(error);return [];});
          if(seq!==uploadSequence)return;
          if(learningEnabled&&epoch===learningEpoch)learning.apply(source,board,samples);
        }
        reviewImage=source;
        acceptBoard(board);
      }
      else {
        if(globalThis.ActionAdvice&&['turn','open-hand'].includes(board.code)){
          failedImage=source;
          $('review-response').hidden=false;
        }
        setVisionStatus(board.message,true);
        emptyResult('请重新上传截图',board.message);
      }
    }catch{
      if(seq===uploadSequence){
        setVisionStatus('无法读取或分析图片，请重新上传完整 PNG、JPEG 或 WebP 截图。',true);
        emptyResult('请重新上传截图','本次未生成切牌建议。');
      }
    }finally{
      image?.close();
    }
  }
  $('file').addEventListener('change',e=>{upload(e.target.files[0]);e.target.value='';});
  $('review-response').onclick=()=>{
    if(!failedImage)return;
    const board=BoardVision.inspect(failedImage,undefined,'response');
    if(!board.ok){setVisionStatus(board.message,true);return;}
    $('review-response').hidden=true;
    reviewImage=failedImage;
    acceptBoard(board);
  };
  function actionControls(board){
    const container=$('action-input');container.replaceChildren();
    if(!globalThis.ActionAdvice)return;
    if(board.phase==='response'){
      const selected=board.target?reviewLabel(board,board.target)+' '+(board.rivers[board.target.seat][board.target.index]?
        tileName(board.rivers[board.target.seat][board.target.index]):'待确认'):'请点选对手刚打出的牌，并设为本次被鸣牌。';
      container.append(el('p','sub',selected),el('p','sub',board.buttons?.length?
        '已检测到部分按钮，确认截图中实际显示的全部操作。':'勾选截图中实际显示的操作。'));
      for(const [key,label] of [['chi','吃'],['pon','碰'],['kan','杠'],['ron','荣和']]){
        if(key==='chi'&&board.three)continue;
        const box=el('input'),line=el('label','remember');
        box.type='checkbox';box.checked=board.offered?.includes(key)??false;
        box.onchange=()=>{
          board.offered??=[];
          if(box.checked)board.offered.push(key);else board.offered=board.offered.filter(action=>action!==key);
          board.optionsConfirmed=false;
          run();
        };
        line.append(box,document.createTextNode(' '+label));container.append(line);
      }
      const confirm=el('button','demo','确认截图中的操作并比较');
      confirm.type='button';confirm.onclick=()=>{board.optionsConfirmed=true;run();};
      container.append(confirm);
      return;
    }
    if(board.afterCall||(!board.hand.some(t=>board.hand.filter(x=>x.id===t.id).length===4)&&
      !board.melds.some(g=>!g.closed&&g.tiles.length===3&&g.tiles.every(t=>t.id===g.tiles[0].id)&&board.hand.some(t=>t.id===g.tiles[0].id))))return;
    const box=el('input'),line=el('label','remember');
    box.type='checkbox';box.checked=!!board.kanConfirmed;
    box.onchange=()=>{board.kanConfirmed=box.checked;run();};
    line.append(box,document.createTextNode(board.buttons?.includes('kan')?' 检测到杠按钮，确认后比较杠与继续出牌':' 截图中有杠按钮，比较杠与继续出牌'));
    container.append(line);
  }
  function renderActions(board,remaining,scores,guards){
    if(board.phase==='response'&&!board.optionsConfirmed){
      emptyResult('等待行动信息','请确认被鸣牌及画面上的全部操作按钮。');return;
    }
    let choices;
    try{
      choices=ActionAdvice.compare({...board,remaining,offered:board.kanConfirmed?['kan']:board.offered,north:Number($('north').value),
        context:{scores,guards,wind:$('wind').value===''?undefined:Number($('wind').value),
          roundWind:({'东':27,'南':28})[$('round').value[0]],finalRound:$('round').value==='南'+$('players').value+'局'}});
    }catch(error){emptyResult('等待行动信息',error.message);return;}
    if(!choices.length){emptyResult('等待行动信息','没有可确认的合法行动。');return;}
    const result=$('results');result.replaceChildren();
    if(choices.length===1&&board.kanConfirmed)result.append(el('p','sub','当前无法验证合法杠牌，请核对杠按钮、立直状态与宝牌指示牌。'));
    const [best,second]=choices;
    const describe=d=>d.label+(d.group?' '+d.group.map(tileName).join(''):'');
    if(second)result.append(el('p','sub','首选'+describe(best)+'，'+best.s+' 向听、未见进张 '+best.ukeire+
      ' 枚；'+describe(second)+'为 '+second.s+' 向听、'+second.ukeire+' 枚。'+
      (best.cut?.threat?'推荐切牌对防守对象仍有风险，请查看逐家依据。':best.kind==='skip'?'跳过保留当前牌姿与防守选择。':'')));
    const grid=el('div','action-grid');result.append(grid);
    for(const [index,choice] of choices.entries()){
      const card=el('article','panel');
      card.append(el('h3','',(index===0?'首选 · ':'')+describe(choice)),
        el('p','sub',choice.s+' 向听 · '+choice.ukeire+' 枚未见进张 · 保留宝牌 '+choice.kept+' 枚'));
      if(choice.cut){
        card.append(el('p','','建议切 '+tileName(choice.cut.tile)),
          el('p','sub',choice.yaku.length?'已确认役或有役完成张 · '+choice.yaku.join('、'):'当前尚未确认有役完成张'));
        if(choice.forbidden.length)card.append(el('p','sub','本巡禁打 '+choice.forbidden.map(name).join('、')));
        choice.cut.risk.forEach((risk,i)=>{if(!board.three||i!==1)card.append(el('p','sub',['上家','对家','下家'][i]+' · '+risk.label));});
      }else if(choice.kind==='skip')card.append(el('p','sub','以自家下一次摸牌评估，手牌和副露不变。'));
      else card.append(el('p','sub','以未知岭上牌评估。杠会增加宝牌，可能提高对手打点。'+
        (choice.kind==='kakan'?'加杠还可能被抢杠。':choice.kind==='ankan'?'暗杠需留意国士无双抢杠。':'')+
        (guards.some(Boolean)?'当前有对手构成威胁，保留防守选择更重要。':'')));
      grid.append(card);
    }
  }
  for(const event of ['dragenter','dragover','dragleave','drop']) $('drop').addEventListener(event,e=>{
    e.preventDefault();
    $('drop').classList.toggle('active',event==='dragenter'||event==='dragover');
    if(event==='drop')upload(e.dataTransfer.files[0]);
  });
  function learningStatus(message){$('learning-status').textContent=message;}
  function learningError(){learningStatus('无法访问浏览器的本地样本。');}
  function sampleImage(entry){
    const canvas=el('canvas');
    canvas.width=entry.width;canvas.height=entry.height;
    canvas.setAttribute('aria-label','样本的局部裁剪');
    const context=canvas.getContext('2d'), picture=context.createImageData(entry.width,entry.height);
    for(let i=0;i<picture.data.length/4;i++){
      picture.data.set(entry.data.subarray(i*3,i*3+3),i*4);
      picture.data[i*4+3]=255;
    }
    context.putImageData(picture,0,0);
    return canvas;
  }
  function previewContribution(entry){
    const dialog=$('contribution-preview');
    const payload={crop:btoa(String.fromCharCode(...entry.data)),label:entry.label,region:entry.region,
      orientation:entry.orientation,original:entry.original,version:'2026-11-27.1'};
    const image=sampleImage(entry);
    const send=el('button','demo','确认发送'),cancel=el('button','demo','取消');
    const details=el('p','sub','发送这块 24 × 36 像素的裁剪与下列字段。');
    const rows=el('dl');
    for(const [key,value] of [['确认标签',payload.label],['区域',payload.region],['朝向',payload.orientation*90+'°'],
      ['原识别',payload.original],['识别版本',payload.version]]){
      rows.append(el('dt','',key),el('dd','',value??'空位'));
    }
    const status=el('p','sub');status.setAttribute('role','status');
    cancel.onclick=()=>dialog.close();
    send.onclick=async()=>{
      send.disabled=true;
      try{
        const response=await fetch('/api/contributions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
        const result=await response.json();
        if(!response.ok)throw Error(result.error);
        status.textContent={accepted:'样本已进入候选库。',duplicate:'这个样本已收录。',conflict:'标签存在冲突，样本已暂停使用。'}[result.status];
        cancel.textContent='关闭';
      }catch(error){status.textContent=error.message||'未能提交';send.disabled=false;}
    };
    dialog.replaceChildren(el('h3','','预览贡献样本'),image,details,rows,send,cancel,status);
    dialog.showModal();
  }
  const regionNames={hand:'手牌',meld:'自家副露','river-0':'左侧牌河','river-1':'顶部牌河','river-2':'右侧牌河','river-3':'自家牌河'};
  let refreshSequence=0;
  async function refreshLearning(message){
    const sequence=++refreshSequence;
    const entries=await learning.list();
    if(sequence!==refreshSequence)return;
    $('learning-clear').disabled=!entries.length;
    const list=$('learning-samples');
    list.replaceChildren();
    for(const entry of entries.reverse()){
      const row=el('div','sample');
      const canvas=sampleImage(entry);
      const name=code=>code?tileName(parse(code)[0]):'空位';
      const description=el('span','',regionNames[entry.region]+' · 朝向 '+entry.orientation*90+'° · '+name(entry.original)+' → '+name(entry.label));
      const remove=el('button','demo','删除');remove.type='button';
      remove.onclick=()=>{learningEpoch++;learning.remove(entry.id).then(()=>refreshLearning('样本已删除。')).catch(learningError);};
      row.append(canvas,description,remove);list.append(row);
    }
    learningStatus((message?message+' ':'')+'当前浏览器有 '+entries.length+' 条样本。');
  }
  if(learning){
    fetch('/api/contributions').then(r=>r.ok?r.json():null).then(data=>{contributionAvailable=data?.available===true;}).catch(()=>{});
    const enabled=$('learning-enabled');
    learning.enabled().then(value=>{
      learningEnabled=enabled.checked=value;
      enabled.disabled=false;
      return refreshLearning();
    }).catch(learningError);
    enabled.onchange=()=>{
      learningEpoch++;
      learningEnabled=enabled.checked;
      if(review)drawMarkers(review);
      learning.setEnabled(learningEnabled).catch(()=>{
        learningEnabled=enabled.checked=false;
        if(review)drawMarkers(review);
        learningError();
      });
    };
    $('learning-clear').onclick=()=>{
      if(!globalThis.confirm('清空此浏览器的全部校对样本？'))return;
      learningEpoch++;
      learning.clear().then(()=>refreshLearning('已清空本地样本。')).catch(learningError);
    };
  }
})();
