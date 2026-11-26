(() => {
  const $=id=>document.getElementById(id);
  const {parse,name,notation,analyze}=Riichi;
  const tileName=t=>t.red?'赤'+name(t.id):name(t.id);
  function el(tag,className='',content='') {
    const node=document.createElement(tag);
    if(className) node.className=className;
    node.textContent=content;
    return node;
  }
  function face(tile,action) {
    const node=el(action?'button':'span','tile');
    if(action){node.type='button';node.addEventListener('click',action);}
    node.title=tileName(tile);
    node.setAttribute('aria-label',tileName(tile));
    node.append(TileVision.art(tile));
    return node;
  }
  function toInput(tiles) {
    return tiles.map(t=>t.red?'0'+notation(t.id).at(-1):notation(t.id)).join('');
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
  function render(data,ready,locked) {
    const target=$('results');
    target.replaceChildren();
    const say=(text,kind='sub status')=>target.append(el('p',kind,text));
    if($('melds').value.trim())say('固定牌组计入向听和进张，和牌须满足役。');
    if(data.forbidden.length)say('本巡禁打 '+data.forbidden.map(name).join('、'),'status warning');
    if(data.protectLead)say('南场末局领先，攻守平衡排序提高了对标记对手的防守权重。');
    if(data.complete) say('当前牌形已完成。请先确认和牌役种，以下供选择舍牌时参考。','status warning');
    if(locked) say('已立直。若本巡不和牌，常规切牌仅限摸切。');
    if(!data.hasThreat) say('尚未标记防守对象。排序以牌效率为主，牌河风险仅供参考。');
    say('效率首选：切'+tileName(data.best.tile)+' · '+(data.best.s.value===0?'听牌':data.best.s.value+' 向听')+' · '+data.best.ukeire+' 枚进张');
    const list=el('ol','result-list');
    const players=['上家','对家','下家'];
    data.rows.slice(0,3).forEach((r,i)=>{
      const card=el('li','result-card');
      const heading=el('div','result-top');
      heading.append(el('span','rank',i+1),face(r.tile),el('strong','','切 '+tileName(r.tile)));
      if(data.hasThreat&&r.threat===0) heading.append(el('span','tag','对所有防守对象为现物'));
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
      if(r.s.value===0&&$('melds').value.trim())card.append(el('p','waits','已确认有役的完成张：'+(r.waits.filter(w=>w.left&&w.yaku.length).map(w=>name(w.id)+'（'+w.yaku.join('、')+'）').join(' · ')||'暂无')+'。其余完成张可能含尚未判定的役。'));
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
    say('进张枚数为未见上限。筋与壁只是风险线索，只有现物能排除对相应对手的荣和放铳。');
    if(data.rows.some(r=>r.s.value===0)) say('振听提示依据自家牌河与本次舍牌。荣和仍须满足役及当巡振听条件。');
  }
  let uploadMode=false;
  let screenshotAccepted=false,review=null;
  function run(event) {
    event?.preventDefault();
    if(uploadMode&&(!screenshotAccepted||review?.marks.some(m=>m.uncertain)||(review?.afterCall&&review.latest===undefined)))return;
    showError();
    try {
      const ready=[0,1,2].map(i=>$('ready'+i).checked||$('guard'+i).checked);
      const scores=$('scores').value.trim().split(/\s+/).filter(Boolean).map(Number);
      if(scores.length&&(scores.length!==Number($('players').value)||scores.some(n=>!Number.isFinite(n))))throw Error('请按人数填写点数，自己在前。');
      const locked=$('locked').checked;
      const indicators=parse($('indicators').value);
      if(indicators.length>5) throw new Error('最多可录入五张宝牌指示牌。');
      render(analyze(parse($('hand').value),indicators,[0,1,2].map(i=>parse($('river'+i).value)),parse($('own').value),parse($('extra').value).concat(...[0,1,2].map(i=>parse($('shown'+i).value))),ready,$('mode').value,locked,{three:$('players').value==='3',melds:$('melds').value.trim().split(/\s+/).filter(Boolean).map(parse),north:Number($('north').value),afterCall:!!review?.afterCall,called:parse($('called').value),latest:review?.latest,closedGroups:review?.melds?.map(group=>!!group.closed),wind:Number($('wind').value),roundWind:({'东':27,'南':28})[$('round').value[0]],finalRound:$('round').value==='南'+$('players').value+'局',scores,remaining:$('remaining').value===''?null:Number($('remaining').value)}),ready,locked);
    } catch(error){emptyResult("请检查牌局",error.message);showError(error.message);}
  }
  $('form').addEventListener('submit',run);
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
  let uploadSequence=0;
  const inputs=['hand','indicators','own','extra','locked','river0','river1','river2','ready0','ready1','ready2'];
  function changeMode(isUpload,hideForm) {
    for(const i of [0,1,2]){$('guard'+i).checked=false;$('shown'+i).value='';}for(const field of ['round','wind','scores','remaining'])$(field).value='';review=null;$('called').value='';$('called').hidden=$('called-label').hidden=true;$('markers').replaceChildren();$('correction').replaceChildren();uploadMode=isUpload;
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
    if(board.afterCall)row('出牌时机',[],'吃碰后待切牌');else row('本巡摸牌',board.hand.slice(-1));
    for(const [i,group] of (board.melds??[]).entries()){
      const tile=group.tiles[group.called];
      row((group.closed?'自家暗杠 ':'自家副露 ')+(i+1),group.tiles,group.closed?'暗杠':((group.added?'加杠 · ':group.tiles.length===4?'大明杠 · ':'')+'横放 '+tileName(tile)+(i===board.latest?' · 本巡':'')));
    }
    for(const [i,seat] of ['上家','对家','下家','自家'].entries()){
      if(board.three&&i===1)continue;
      const river=board.rivers[i];
      row(seat,river,(board.ready[i]?'已立直':'未立直')+' · '+(river.length?'舍牌':'牌河为空'));
    }
  }
  function drawMarkers(board){
    const layer=$('markers');layer.replaceChildren();
    const editor=$('correction');editor.replaceChildren();
    for(const m of board.marks){
      const field=m.field, seat=field==='own'||field==='locked'?3:Number(field.slice(-1));
      const status=field==='locked'||field.startsWith('ready');
      const title=field==='meld'?'自家副露 '+(m.group+1)+(m.index===board.melds[m.group].called?' · 被鸣牌':''):field==='hand'?'手牌':field==='indicators'?'宝牌指示牌':['上家','对家','下家','自家'][seat]+(status?'立直状态':'牌河');
      const label=title+(m.index===undefined?'':'第 '+(m.index+1)+' 张');
      const mark=el('button','marker'+(m.uncertain?' uncertain':''),m.uncertain?'?':'');mark.type='button';mark.title=label;mark.setAttribute('aria-label','校对'+label);
      Object.assign(mark.style,{left:m.x*100+'%',top:m.y*100+'%',width:m.w*100+'%',height:m.h*100+'%'});
      mark.onclick=()=>{
        editor.replaceChildren(el('strong','',label));
        if(m.occluded)editor.append(el('p','', '牌面可能被遮挡，请核对该位置。'));
        const values=field==='meld'?board.melds[m.group].tiles:field==='hand'?board.hand:field==='indicators'?board.indicators:board.rivers[seat];
        function done(){m.uncertain=false;m.occluded=false;acceptBoard(board);}
        if(field==='own'||field.startsWith('river')){
          const empty=el('button','demo','此处无牌');
          empty.type='button';
          empty.onclick=()=>{
            values.splice(m.index,1);
            board.marks=board.marks.filter(marker=>marker!==m);
            for(const marker of board.marks)if(marker.field===field&&marker.index>m.index)marker.index--;
            acceptBoard(board);
          };
          editor.append(empty);
        }
        if(field==='meld'&&board.afterCall&&board.melds[m.group].tiles.length===3){
          const select=el('button','demo','设为本巡副露');
          select.onclick=()=>{board.latest=m.group;acceptBoard(board);};
          editor.append(select);
        }
        if(status){
          for(const yes of [true,false]){const b=el('button','demo',yes?'已立直':'未立直');b.onclick=()=>{board.ready[seat]=yes;done()};editor.append(b);}
        }else if(field==='indicators'){
          const input=el('input');input.value=toInput(values);input.placeholder='例如 4p';const b=el('button','demo','确认指示牌');
          b.onclick=()=>{try{const list=parse(input.value);if(!list.length||list.length>5)throw Error('请输入一至五张指示牌');board.indicators=list;done();}catch(e){input.setCustomValidity(e.message);input.reportValidity();}};input.oninput=()=>input.setCustomValidity('');editor.append(input,b);
        }else{
          const tiles=el('div','tiles');for(const t of TileVision.variants){if(board.three&&t.id>0&&t.id<8)continue;tiles.append(face(t,()=>{
            const group=field==='meld'?board.melds[m.group]:null;
            if(group?.closed){
              group.tiles=group.tiles.map((old,i)=>i===m.index?t:{id:t.id,red:old.id===t.id&&old.red&&!t.red});
            }else values[m.index]=t;
            done();
          }));}editor.append(tiles);
        }
      };layer.append(mark);
    }
  }
  function acceptBoard(board) {
    review=board;drawMarkers(board);screenshotAccepted=true;
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
    if(board.marks.some(m=>m.uncertain)){setVisionStatus('请点击截图上的黄色标记逐项确认。');emptyResult('等待校对','确认所有黄色标记后自动重算。');return;}
    if(board.afterCall&&board.latest===undefined){
      setVisionStatus('已识别各组吃碰。请在截图上点选刚完成的那一组，以确定本巡禁打牌。');
      emptyResult('待确认本巡副露','点选副露中的任一张，然后选择「设为本巡副露」。');
      return;
    }
    setVisionStatus((board.meldCount?'已自动识别 '+board.meldCount+' 组自家副露。':'')+'点击截图中的牌面或座位可校对，修改后自动重算。');
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
      const board=BoardVision.inspect(BoardVision.sourceImage(image));
      if(board.ok)acceptBoard(board);
      else {
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
  for(const event of ['dragenter','dragover','dragleave','drop']) $('drop').addEventListener(event,e=>{
    e.preventDefault();
    $('drop').classList.toggle('active',event==='dragenter'||event==='dragover');
    if(event==='drop')upload(e.dataTransfer.files[0]);
  });
})();
