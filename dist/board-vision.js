((root) => {
  const width=24,height=36,bins=20;
  // All table positions use the detected hand-tile pitch as their scale.
  const limit=(n,min,max)=>Math.max(min,Math.min(max,n));
  const point=(x,y)=>({x,y});
  const rectangle=(x,y,w,h)=>[point(x,y),point(x+w,y),point(x+w,y+h),point(x,y+h)];
  function pixel(image,x,y) {
    const at=(limit(Math.round(y),0,image.height-1)*image.width+limit(Math.round(x),0,image.width-1))*(image.channels||4);
    return [image.data[at],image.data[at+1],image.data[at+2]];
  }
  const light=([r,g,b])=>(r+g+b)/3;
  const neutral=([r,g,b])=>Math.max(r,g,b)-Math.min(r,g,b)<38;
  const ivory=rgb=>neutral(rgb)&&Math.min(...rgb)>150;
  const gold=([r,g,b])=>r>120&&g>92&&r>b+14&&g>b+8&&r>g+4;
  const cyan=([r,g,b])=>g>110&&b>112&&g>r+24&&b>r+30;
  function signature(image,quad) {
    const [a,b,c,d]=quad;
    const pixels=[];
    for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
      const u=.065+.87*(x+.5)/width,v=.072+.856*(y+.5)/height;
      pixels.push(pixel(image,(a.x*(1-u)+b.x*u)*(1-v)+(d.x*(1-u)+c.x*u)*v,
        (a.y*(1-u)+b.y*u)*(1-v)+(d.y*(1-u)+c.y*u)*v));
    }
    const levels=pixels.map(light).sort((a,b)=>a-b);
    const paper=levels[Math.floor(levels.length*.73)];
    const glyph=new Float32Array(pixels.length);
    let x0=width,x1=-1,y0=height,y1=-1,total=0,red=0;
    for(let y=0;y<height;y++) for(let x=0;x<width;x++){
      const i=y*width+x;
      const [r,g,b]=pixels[i];
      const depth=limit((paper-light(pixels[i])-18)/Math.max(55,paper*.58),0,1);
      if(depth<.12)continue;
      glyph[i]=depth;total+=depth;
      if(r>g+31&&r>b+25)red+=depth;
      if(depth>=.25){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
    }
    const data=new Uint8Array(bins*bins);
    if(x1<0||total<7)return {data,red:0,ratio:0,ink:0,paper};
    const dx=x1-x0+1,dy=y1-y0+1;
    for(let y=0;y<bins;y++) for(let x=0;x<bins;x++){
      let sum=0;
      for(const sy of [.25,.75]) for(const sx of [.25,.75]){
        const u=x0+Math.floor((x+sx)*dx/bins),v=y0+Math.floor((y+sy)*dy/bins);
        sum+=glyph[v*width+u];
      }
      data[y*bins+x]=Math.round(sum*63.75);
    }
    return {data,red:red/total,ratio:dx/dy,ink:total,paper};
  }
  function compare(a,b) {
    if(!a.ink||!b.ink)return Boolean(a.ink)!==Boolean(b.ink)?1:0;
    let best=1;
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
      let diff=0,sum=0,topDiff=0,topSum=0;
      for(let y=0;y<bins;y++) for(let x=0;x<bins;x++){
        const ox=x+dx,oy=y+dy;
        const v=a.data[y*bins+x],w=ox>=0&&ox<bins&&oy>=0&&oy<bins?b.data[oy*bins+ox]:0;
        diff+=Math.abs(v-w);sum+=v+w;
        if(y<bins*.44){topDiff+=Math.abs(v-w);topSum+=v+w;}
      }
      const emphasis=b.code?.endsWith('m')&&a.red>.19&&a.red<.77?.30:0;
      best=Math.min(best,(1-emphasis)*diff/Math.max(1,sum)+emphasis*topDiff/Math.max(1,topSum)+.012*(Math.abs(dx)+Math.abs(dy)));
    }
    return best+Math.abs(a.red-b.red)*.34+Math.min(1,Math.abs(Math.log(a.ratio/b.ratio)))*.13;
  }
  let reference;
  function match(image,quad,templates) {
    const seen=signature(image,quad);
    if(seen.paper<110) return {tile:null,error:1,margin:0};
    const ranked=new Map();
    for(const t of templates){
      const key=t.code;
      const cost=compare(seen,t);
      if(cost<(ranked.get(key)??Infinity))ranked.set(key,cost);
    }
    const [[code,error],second]=[...ranked].sort((a,b)=>a[1]-b[1]);
    return {tile:root.Riichi.parse(code)[0],code,error,margin:second[1]-error};
  }
  const confident=(result,max=.39,margin=.055)=>result.tile&&result.error<=max&&result.margin>=margin;
  function matchFace(image,region,templates,max,margin) {
    const [x,y,w,h]=region;
    const samples=[
      region,[x+w*.07,y+h*.035,w*.88,h*.93],[x+w*.12,y+h*.04,w*.83,h*.91],
      [x+w*.08,y+h*.085,w*.85,h*.86],[x+w*.015,y+h*.045,w*.94,h*.90]
    ].map(rect=>match(image,rectangle(...rect),templates));
    const candidates=samples.filter(r=>confident(r,max,margin)).sort((a,b)=>a.error-b.error);
    const best=candidates[0];
    if(!best||candidates.some(t=>t.code!==best.code&&t.error-best.error<.05))return null;
    if(candidates.filter(t=>t.code===best.code).length<2&&(!confident(best,max-.025,margin+.027)))return null;
    return best.tile;
  }
  function decodeTemplates(data) {
    return data.map(([code,red,ratio,ink,mask])=>({code,red,ratio,ink,data:Uint8Array.from(atob(mask),c=>c.charCodeAt(0))}));
  }
  function sourceImage(source) {
    const scale=Math.min(1,1280/source.width);
    const canvas=document.createElement('canvas');
    canvas.width=Math.round(source.width*scale);canvas.height=Math.round(source.height*scale);
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(source,0,0,canvas.width,canvas.height);
    return ctx.getImageData(0,0,canvas.width,canvas.height);
  }
  function density(image,x,y,w,h,predicate,columns=14,rows=10) {
    let count=0;
    for(let j=0;j<rows;j++) for(let i=0;i<columns;i++){
      if(predicate(pixel(image,x+w*(i+.5)/columns,y+h*(j+.5)/rows)))count++;
    }
    return count/(columns*rows);
  }
  function span(flags) {
    const runs=[];
    let start=-1;
    for(let x=0;x<=flags.length;x++) {
      if(flags[x]&&start<0)start=x;
      if(!flags[x]&&start>=0){runs.push([start,x]);start=-1;}
    }
    return runs;
  }
  function viewport(image) {
    function black(y) {return density(image,image.width*.12,y,image.width*.76,1,rgb=>Math.max(...rgb)<12,40,1)>.96;}
    let top=0,bottom=image.height;
    while(top<image.height*.13&&black(top))top++;
    while(bottom>image.height*.87&&black(bottom-1))bottom--;
    return {w:image.width,h:bottom-top,top,bottom};
  }
  function handGeometry(image,view) {
    const {w,h,bottom}=view;
    const referencePitch=h*.086;
    const profile=Array.from({length:w},(_,x)=>density(image,x,bottom-h*.126,1,h*.107,
      rgb=>ivory(rgb)&&light(rgb)>172,1,33));
    const spans=span(profile.map(n=>n>.42));
    const begins=spans.filter(([a,b])=>b-a>=referencePitch*.10&&Math.abs(a-(w/2-7.8*referencePitch))<referencePitch*.38);
    let best=null;
    for(const [edge] of begins)for(const shift of [-1,0,1]) {
      const start=edge+shift;
      for(let pitch=referencePitch*.93;pitch<referencePitch*1.08;pitch+=.12){
        let score=0;
        for(let i=0;i<12;i++){
          const x=Math.round(start+i*pitch);
          const edge=Math.min(profile[x-1],profile[x-2],profile[x-3]);
          score+=.45*profile[x+3]+.30*profile[x+8]+.25*profile[x+Math.round(pitch*.86)]-.75*edge;
        }
        if(!best||score>best.score)best={start,pitch,score};
      }
    }
    if(!best||best.score<.85) return null;
    const {start,pitch}=best;
    const covered=x=>density(image,x+pitch*.08,bottom-h*.126,pitch*.83,h*.104,ivory,13,18)>.38||
      [.04,.92].every(edge=>density(image,x+pitch*edge,bottom-h*.12,pitch*.035,h*.09,ivory,3,18)>.69);
    const found=Array.from({length:13},(_,i)=>start+i*pitch).filter(covered);
    let count=13;
    const findDraw=n=>{const expected=start+(n+.32)*pitch;
    const last=spans.find(([a,b])=>Math.abs(a-expected)<pitch*.16&&b-a>pitch*.10&&covered(a)&&
      density(image,a-pitch*.19,bottom-h*.12,pitch*.13,h*.106,ivory,4,16)<.34);
    if(last)return last;
    // Dense circle patterns can break a single face into narrow bright runs.
    const isolated=covered(expected)&&
      density(image,expected-pitch*.23,bottom-h*.12,pitch*.14,h*.09,ivory,5,16)<.16&&
      density(image,expected+pitch*1.04,bottom-h*.12,pitch*.12,h*.09,ivory,5,16)<.18;
    return isolated?[expected,expected+pitch]:undefined;};
    let last=findDraw(count);
    for(const n of [10,7,4,1])if(!last&&covered(start)&&Array.from({length:n},(_,i)=>covered(start+i*pitch)).every(Boolean)){last=findDraw(n);if(last)count=n;}

    const verticalBounds=x=>span(Array.from({length:image.height},(_,y)=>
      y>bottom-2*pitch&&density(image,x+pitch*.05,y,pitch*.91,1,ivory,24,1)>.33))
      .reduce((runs,[a,b])=>{
        if(runs.length&&a-runs.at(-1)[1]<6)runs.at(-1)[1]=b;
        else runs.push([a,b]);
        return runs;
      },[]).filter(([a,b])=>b-a>pitch*1.08);
    const bounds=verticalBounds(start).at(-1)??found.slice(1,4).map(x=>verticalBounds(x).at(-1)).find(Boolean);
    const [faceTop,faceBottom]=bounds??[];
    // An apparent split inside a continuing row can be caused by a dark tile
    // illustration or a replay badge.
    if(last&&count<=10&&[count+1,count+2].every(i=>start+i*pitch<w*.76&&covered(start+i*pitch)))last=undefined;
    if(last&&density(image,last[0]-pitch*.23,faceTop+pitch*.12,pitch*.16,pitch*.90,ivory,12,20)>.25)last=undefined;
    if(last)found.push(last[0]);
    const hasMelds=density(image,w*.80,bottom-h*.126,w*.17,h*.108,ivory,28,18)>.20&&!last&&found.length<13;
    // After chi or pon the concealed tiles form one continuous row.
    let consecutive=0;
    while(consecutive<13&&covered(start+consecutive*pitch))consecutive++;
    const emptyGap=consecutive<13&&density(image,start+(consecutive+.15)*pitch,bottom-h*.12,pitch*.63,h*.085,ivory,11,14)<.12;
    const callCount=hasMelds&&emptyGap&&[2,5,8,11].includes(consecutive)&&!found.some(x=>x>=start+consecutive*pitch&&x<start+(consecutive+2)*pitch)?consecutive:0;
    if(!last)count=13;
    return {start,pitch,count,draw:last,found,faceTop,faceBottom,hasMelds,callCount};
  }
  function mixedMeldLayout(image,view,hand,count) {
    const {w,bottom}=view;
    const {start,pitch}=hand;
    const minX=start+(14-3*count+.75)*pitch;
    const back=rgb=>Math.max(...rgb)-Math.min(...rgb)>42&&light(rgb)>101;
    let best=null;
    for(const depth of [.48,.56,.64,.72,.80,.88,.96]){
      const y=bottom-depth*pitch;
      const runs=[];
      for(const [test,isBack] of [[ivory,false],[back,true]]){
        const flags=Array.from({length:w},(_,x)=>x>minX&&
          density(image,x,y-pitch*.025,1,pitch*.05,test,1,7)>.55);
        for(const [a,b] of span(flags)){
          if(b-a<pitch*.57||b-a>pitch*(isBack?.87:1.18))continue;
          if(isBack&&density(image,a+(b-a)*.16,y-pitch*.16,(b-a)*.68,pitch*.13,back,12,7)<.66)continue;
          runs.push({a,b,back:isBack,turned:!isBack&&b-a>pitch*.855});
        }
      }
      runs.sort((a,b)=>a.a-b.a);
      if(!runs.length||runs.at(-1).b<w-pitch*1.6||runs.at(-1).b>w-pitch*.45)continue;
      function partition(end,groups,cost){
        if(groups.length===count){
          if(!groups.some(g=>g[0].back||g.length===4))return;
          // A neighboring face belongs to the rack when separated only by a tile seam.
          if(end&&runs[end].a-runs[end-1].b<pitch*.16)return;
          const error=cost+(depth>.76?.45:0);
          if(!best||error<best.error)best={groups:[...groups].reverse(),y,error};
          return;
        }
        for(const size of [3,4]){
          if(end<size)continue;
          const group=runs.slice(end-size,end);
          if(group.slice(1).some((t,i)=>t.a-group[i].b>pitch*.2||t.a<group[i].b))continue;
          const closed=size===4&&group.every((t,i)=>t.back===(i===0||i===3)&&!t.turned);
          const open=group.every(t=>!t.back)&&group.filter(t=>t.turned).length===1;
          if(!closed&&!open)continue;
          const widthError=group.reduce((sum,t)=>sum+Math.abs((t.b-t.a)/pitch-(t.turned?.97:.74)),0);
          partition(end-size,[...groups,group],cost+widthError);
        }
      }
      partition(runs.length,[],0);
    }
    return best;
  }

  function readOwnMelds(image,view,hand,count,three,templates) {
    if(!count)return [];
    const {pitch,start}=hand;
    const {w,bottom}=view;
    // The short horizontal face and tall upright faces share a bottom edge.
    // Sample near that edge, where tile art occupies little of the row.
    const minX=start+(14-3*count+.25)*pitch;
    let layout=null;
    for(const line of [.48,.56,.64,.72,.80,.88,.96]){
      const y=bottom-line*pitch;
      const runs=span(Array.from({length:w},(_,x)=>x>minX&&
        density(image,x,y-pitch*.025,1,pitch*.05,ivory,1,7)>.55));
      const suitable=runs.filter(([a,b])=>b-a>=pitch*.57&&b-a<=pitch*1.18);
      const lastFour=suitable.slice(-4);
      const openQuad=count===1&&lastFour.length===4&&lastFour[0][0]>w*.76&&
        lastFour.slice(1).every(([a],i)=>a-lastFour[i][1]<pitch*.16)&&
        lastFour.filter(([a,b])=>b-a>pitch*.855).length===1;
      const groupSize=openQuad?4:3;
      const faces=suitable.slice(-groupSize*count);
      if(faces.length!==groupSize*count||faces.at(-1)[1]<w-pitch*1.6||faces.at(-1)[1]>w-pitch*.45)continue;
      const groups=[];
      let error=0;
      for(let i=0;i<faces.length;i+=groupSize){
        const group=faces.slice(i,i+groupSize).map(([a,b])=>({a,b,turned:b-a>pitch*.855}));
        if(group.filter(t=>t.turned).length!==1||group.slice(1).some((t,j)=>t.a-group[j].b>pitch*.2)){error=Infinity;break;}
        error+=group.reduce((sum,t)=>sum+Math.abs((t.b-t.a)/pitch-(t.turned?.97:.74)),0);
        groups.push(group);
      }
      if(line>.76)error+=.45;
      if(Number.isFinite(error)&&(!layout||groupSize>layout.groupSize||groupSize===layout.groupSize&&error<layout.error))layout={groups,error,y,groupSize};
    }
    if(count>1)layout=mixedMeldLayout(image,view,hand,count)??layout;
    if(!layout)return count===1?readSingleConcealedQuad(image,view,hand,templates):null;
    const allowed=three?templates.filter(t=>!/^[2-8]m$|^0m$/.test(t.code)):templates;
    return layout.groups.reverse().map(group=>{
      const closed=group[0].back===true;
      const called=group.findIndex(t=>t.turned);
      const inset=bottom-layout.y>pitch*.77?.25:0;
      const horizontal=group[called];
      const upper=group.length===3?rectangle(horizontal.a-pitch*.19,bottom-pitch*(1.79+inset),
        (horizontal.b-horizontal.a)*.96,pitch*.53):null;
      const stack=upper&&faceCoverage(image,upper)>=.76?upper:null;
      const blankFaces=group.map(({a,b,turned})=>{
        const w=b-a;
        const top=bottom-pitch*((turned?1.12:1.33)+inset),h=pitch*(turned?.43:.62);
        const x=a+w*.24-pitch*.052;
        return density(image,x,top,w*.52,h,ivory,18,18)>.96;
      });
      if(!closed&&blankFaces.every(Boolean)){
        const white={id:31,red:false};
        const tiles=group.map(()=>white);
        const marks=group.map(({a,b,turned},index)=>({
          index,quad:rectangle(a-pitch*.085,bottom-pitch*((turned?1.22:1.42)+inset),b-a,pitch*(turned?.60:.81)),uncertain:false
        }));
        if(stack){tiles.push(white);marks.push({index:3,quad:stack,uncertain:false});}
        return {called,tiles,marks,added:!!stack};
      }
      const readings=(closed?group.slice(1,3):group).map(({a,b,turned})=>{
        const candidates=[];
        const shears=group[0].back!==undefined?[.075,.12,.16]:[.09];
        for(const offset of [-.07,0,.10,.19,.27,.37])for(const rise of [-.145,-.085,-.025,.045])for(const shear of shears){
          const base=bottom-pitch*(.42+inset+offset), top=base-pitch*((turned?.68:.88)+rise);
          const dx=pitch*shear, shift=(base-layout.y)*.14;
          const quad=[point(a+shift-dx,top),point(b+shift-dx,top),point(b+shift,base),point(a+shift,base)];
          for(const rotation of turned?[1,3]:[0]){
            const coverage=faceCoverage(image,quad);
            if(coverage<.32)continue;
            const r=match(image,quad.slice(rotation).concat(quad.slice(0,rotation)),allowed);
            if(r.tile)candidates.push({...r,quad,coverage});
          }
        }
        if(!candidates.length){
          const y=layout.y-pitch*(turned?.5:.69);
          candidates.push({tile:{id:31,red:false},code:'5z',error:1,margin:0,
            quad:rectangle(a-pitch*.08,y,b-a,layout.y-y)});
        }
        return candidates.sort((a,b)=>a.error-b.error);
      });
      if(readings.some(list=>!list.length))return {called,tiles:[],marks:[]};
      if(stack){
        readings.push([1,3].map(rotation=>({...match(image,stack.slice(rotation).concat(stack.slice(0,rotation)),allowed),
          quad:stack,coverage:faceCoverage(image,stack)})).filter(r=>r.tile).sort((a,b)=>a.error-b.error));
      }
      if(readings.some(list=>!list.length))return {called,tiles:[],marks:[]};
      const best=readings.map(list=>list[0]);
      const valid=tiles=>{
        const ids=tiles.map(r=>r.tile.id).sort((a,b)=>a-b);
        return ids.every(id=>id===ids[0])||(!three&&ids.length===3&&ids[2]<27&&ids[0]%9<=6&&ids[1]===ids[0]+1&&ids[2]===ids[0]+2);
      };
      const alternatives=readings.map(list=>[...new Map([...list].reverse().map(r=>[r.code,r])).values()]);
      let chosen=best;
      if(!valid(best)){
        let cost=Infinity;
        function select(prefix,nextCost){
          if(nextCost>=cost)return;
          if(prefix.length===alternatives.length){
            if(valid(prefix)){chosen=prefix;cost=nextCost;}
            return;
          }
          for(const tile of alternatives[prefix.length])select([...prefix,tile],nextCost+tile.error);
        }
        select([],0);
      }
      const tiles=chosen.map(r=>r.tile);
      const isSet=tiles.every(t=>t.id===tiles[0].id);
      const agreesOnClosedQuad=closed&&tiles[0].id%9!==4&&best.every(r=>r.tile.id===tiles[0].id&&confident(r,.24,.09));
      const detectsWholeSet=agreesOnClosedQuad||isSet&&(tiles[0].id>=27||closed&&tiles[0].id%9!==4)&&
        best.some(r=>r.tile.id===tiles[0].id&&r.coverage>=.50&&confident(r,.27,.12))&&
        !best.some(r=>r.tile.id!==tiles[0].id&&r.coverage>=.55&&confident(r,.28,.10));
      const marks=chosen.map((r,index)=>({
        index:index+Number(closed),quad:r.quad,
        uncertain:!detectsWholeSet&&(r.coverage<.66||r.code!==best[index].code||!confident(r,.39,.034)||!valid(chosen))
      }));
      if(closed){
        const back={id:tiles[0].id,red:false};
        tiles.unshift(back);
        tiles.push(back);
      }
      return {called,closed,added:!!stack,tiles,marks};
    });
  }
  function readSingleConcealedQuad(image,view,hand,templates) {
    const p=hand.pitch;
    const {w,bottom}=view;
    const draft=[];
    // A concealed quad shows two face-up tiles between two matching backs.
    const backColor=rgb=>Math.max(...rgb)-Math.min(...rgb)>42&&light(rgb)>123;
    for(const line of [.78,.84,.88,.92,.96]){
      const y=bottom-line*p;
      const faces=span(Array.from({length:w},(_,x)=>x>w*.77&&density(image,x,y,1,p*.045,rgb=>ivory(rgb)||backColor(rgb),1,5)>.55))
        .filter(([a,b])=>b-a>p*.57&&b-a<p*.93);
      if(faces.length!==4)continue;
      if(faces.at(-1)[1]<w-p*1.6||faces.at(-1)[1]>w-p*.46||
        faces.some(([a],i)=>i>0&&a-faces[i-1][1]>p*.20))continue;
      for(const delta of [-.04,.02,.08]){
        const base=y+delta*p,top=base-p*.79;
        const quads=faces.map(([a,b])=>[point(a-p*.13,top),point(b-p*.13,top),point(b-p*.04,base),point(a-p*.04,base)]);
        if(![0,3].every(i=>density(image,faces[i][0]+p*.18,top+p*.16,p*.36,p*.43,
          backColor,9,9)>.53))continue;
        const visible=[1,2].map(i=>match(image,quads[i],templates));
        for(const i of [0,1]){
          const anchor=visible[i];
          if(!anchor.tile||!confident(anchor,.42,.025))continue;
          const codes=templates.filter(t=>root.Riichi.parse(t.code)[0].id===anchor.tile.id);
          // The other face can be partly hidden by the replay overlay.
          const other=visible[1-i];
          if(other.tile?.id!==anchor.tile.id&&confident(other,.31,.06))continue;
          const glyph=signature(image,quads[2-i]);
          const alternate=codes.map(t=>({tile:root.Riichi.parse(t.code)[0],error:compare(glyph,t)}))
            .filter(r=>!anchor.tile.red||!r.tile.red).sort((a,b)=>a.error-b.error)[0];
          const actual=i===0?[anchor,alternate]:[alternate,anchor];
          draft.push({actual,quads,cost:anchor.error+Math.min(alternate.error,.65)});
        }
      }
    }
    if(!draft.length)return null;
    const {actual,quads}=draft.sort((a,b)=>a.cost-b.cost)[0];
    const back={id:actual[0].tile.id,red:false};
    return [{closed:true,called:-1,tiles:[back,...actual.map(r=>r.tile),back],marks:actual.map((r,i)=>({
      index:i+1,quad:quads[i+1],uncertain:!confident(r,.43,.025)
    }))}];
  }
  function scoreboard(image,view,pitch) {
    const {w,h,top}=view;
    const ys=[];
    for(let y=Math.round(top+h*.345);y<top+h*.446;y++)for(let x=Math.round(w*.475);x<w*.525;x++){
      if(cyan(pixel(image,x,y)))ys.push(y);
    }
    if(ys.length<20)return null;
    ys.sort((a,b)=>a-b);
    const x=w/2,y=(ys[Math.floor(ys.length*.07)]+ys[Math.floor(ys.length*.93)])/2;
    const rel=(dx,dy,dw,dh,test)=>density(image,x+dx*pitch,y+dy*pitch,dw*pitch,dh*pitch,test,32,17);
    const seats=[
      rel(-1.15,-.52,.64,1.01,gold),
      rel(-.64,-.74,1.28,.27,gold),
      rel(.50,-.51,.67,1.02,gold),
      rel(-.64,.65,1.28,.29,gold)
    ];
    const active=rel(-.50,.83,1.0,.25,([r,g,b])=>r>224&&g>174&&r>b+32&&g>b+26)>.29;
    return {x,y,seats,active};
  }
  function doraRegions(image,view,pitch) {
    const {w,h,top}=view;
    const min=Math.floor(w*.004),max=Math.ceil(w*.19),scanY=top+h*.056,scanH=h*.060;
    const bright=Array.from({length:max-min},(_,i)=>density(image,min+i,scanY,1,scanH,ivory,1,24));
    const edge=Array.from({length:max-min},(_,i)=>{
      let sum=0;
      for(let j=0;j<20;j++){
        const y=scanY+scanH*j/20;
        const a=pixel(image,min+i-1,y),b=pixel(image,min+i+1,y);
        sum+=a.reduce((n,c,k)=>n+Math.abs(c-b[k]),0)/765;
      }
      return sum/20;
    });
    let best=null;
    for(let left=w*.008;left<w*.027;left+=.5)for(let step=h*.046;step<h*.056;step+=.25) {
      const brightAt=dx=>bright[Math.round(left+step*dx)-min]??0;
      let value=brightAt(.10)+brightAt(.23)+brightAt(.80)+brightAt(.90)-2*brightAt(-.035);
      for(let i=1;i<=5;i++){
        const n=Math.round(left+i*step)-min;
        value+=.8*Math.max(edge[n]??0,edge[n-1]??0,edge[n-2]??0);
      }
      if(!best||value>best.value)best={left,step,value};
    }
    if(!best||best.value<2.65)return null;
    const {left,step}=best;
    const cells=Array.from({length:5},(_,i)=>[left+i*step,left+(i+.96)*step]);
    const first=span(Array.from({length:Math.round(h*.155)},(_,j)=>
      density(image,left+step*.05,top+j,step*.84,1,ivory,20,1)>.37)).reduce((runs,[a,b])=>{
      if(runs.length&&a-runs.at(-1)[1]<step*.22)runs.at(-1)[1]=b;
      else runs.push([a,b]);
      return runs;
    },[]).find(([a,b])=>b-a>pitch*.53&&a>h*.018);
    if(!first)return null;
    const [y0,y1]=first.map(n=>n+top);
    return cells.map(([left,right])=>[left,y0,right-left,y1-y0]);
  }
  function doraRack(image,view,pitch,templates) {
    const slots=doraRegions(image,view,pitch);
    if(!slots)return null;
    const out=[];
    let closed=false;
    for(const region of slots){
      const paper=density(image,...region,ivory);
      if(paper<.32){closed=true;continue;}
      if(closed||paper<.39)return null;
      const tile=matchFace(image,region,templates,.38,.062);
      if(!tile)return null;
      out.push(tile);
    }
    return out.length?out:null;
  }
  const locations=['上家','对家','下家','自家'];
  function riichiMarks(image,hud,p) {
    const {x,y}=hud;
    const white=rgb=>neutral(rgb)&&Math.min(...rgb)>183;
    const dot=([r,g,b])=>r>110&&r>g+47&&r>b+42;
    const pink=([r,g,b])=>r>172&&g>92&&b>84&&r>g+21&&r>b+16&&Math.abs(g-b)<34;
    return [
      [-1.51,-.55,.16,1.0,true],[-.49,-1.10,.98,.15,false],
      [1.39,-.48,.16,1.0,true],[-.49,1.05,.98,.15,false]
    ].map(([dx,dy,w,h,vertical])=>{
      const line=Array.from({length:35},(_,i)=>{
        const along=(i+.5)/35;
        return [-.06,-.03,0,.03,.06].map(shift=>pixel(image,
          x+p*(dx+w*(vertical?.5:along)+(vertical?shift:0)),
          y+p*(dy+h*(vertical?along:.5)+(vertical?0:shift))));
      });
      const whites=line.filter(pixels=>pixels.some(white)).length/line.length;
      const colored=line.filter(pixels=>pixels.some(pink)).length/line.length;
      const reds=line.some(pixels=>pixels.some(dot));
      if(whites>.63&&reds||colored>.54&&line.some(pixels=>pixels.some(white)))return true;
      if(whites>.40||colored>.31)return null;
      return false;
    });
  }
  function riverQuad(hud,p,seat,row,offset,sideways,adjustX=0,adjustY=0) {
    const {x,y}=hud;
    let u,v,w,h,tilt;
    if(seat===3){
      u=-2.01-.063*row+(.65+.028*row)*offset;
      v=1.30+row*.65;w=(sideways?.83:.62)+.024*row;h=(sideways?.44:.59)+.026*row;tilt=.035;
    }else if(seat===1){
      w=(sideways?.72:.535)-.014*row;h=(sideways?.32:.445)-.016*row;
      u=1.695+row*.055-(.564-.013*row)*offset-w;
      v=-1.86-row*.455+(sideways?.10:0);tilt=-.025;
    }else if(seat===0){
      u=-2.71-row*.78-offset*.050;
      v=-1.36+.384*offset+.0048*offset*offset;
      w=(sideways?.54:.73)+offset*.015;h=(sideways?.56:.365)+.010*offset;tilt=-.055;
    }else{
      u=2.06+row*.80-offset*.037;
      w=(sideways?.56:.77)-offset*.012;h=(sideways?.56:.42)-offset*.013;
      v=.737-offset*.453+.010*offset*offset-(sideways?.16:0);tilt=.045;
    }
    const quad=[point(x+p*(u+adjustX),y+p*(v+adjustY)),point(x+p*(u+w+adjustX),y+p*(v+adjustY)),
      point(x+p*(u+w+tilt+adjustX),y+p*(v+h+adjustY)),point(x+p*(u+tilt+adjustX),y+p*(v+h+adjustY))];
    let rotation=[1,2,3,0][seat];
    if(sideways)rotation=(rotation+1)%4;
    return quad.slice(rotation).concat(quad.slice(0,rotation));
  }
  function faceCoverage(image,quad) {
    const [a,b,c,d]=quad;
    let count=0;
    const sides=[0,0,0,0];
    for(const u of [.14,.27,.5,.73,.86])for(const v of [.13,.29,.48,.69,.86]){
      const x=(a.x*(1-u)+b.x*u)*(1-v)+(d.x*(1-u)+c.x*u)*v;
      const y=(a.y*(1-u)+b.y*u)*(1-v)+(d.y*(1-u)+c.y*u)*v;
      if(!ivory(pixel(image,x,y)))continue;
      count++;
      if(u<.3)sides[0]++;
      if(u>.7)sides[1]++;
      if(v<.3)sides[2]++;
      if(v>.65)sides[3]++;
    }
    return sides.every(Boolean)?count/25:0;
  }
  function readRivers(image,hud,pitch,templates,three=false,topOpponent=-1) {
    const marks=riichiMarks(image,hud,pitch);
    const rivers=[];
    const ready=[];
    const marksForReview=[];
    const man=t=>t?.id<9;
    const overlay=([r,g,b])=>b>110&&b>r+32&&b>g+12;
    function occlusion(quad){
      const [a,b,c,d]=quad;
      let covered=0;
      for(const u of [.18,.34,.50,.66,.82])for(const v of [.20,.35,.50,.65,.80]){
        const x=(a.x*(1-u)+b.x*u)*(1-v)+(d.x*(1-u)+c.x*u)*v;
        const y=(a.y*(1-u)+b.y*u)*(1-v)+(d.y*(1-u)+c.y*u)*v;
        covered+=Number(overlay(pixel(image,x,y)));
      }
      return covered>=7;
    }
    for(let logicalSeat=0;logicalSeat<4;logicalSeat++){
      if(three&&logicalSeat===1){ready.push(false);rivers.push([]);continue;}
      const seat=topOpponent===logicalSeat?1:logicalSeat;
      const river=[];
      let turned=false,ended=false;
      for(let row=0;row<4;row++){
        let offset=0;
        const obscured=[];
        for(let slot=0;slot<(row===3?5:6);slot++){
          const base=riverQuad(hud,pitch,seat,row,offset,false);
          const coverage=faceCoverage(image,base);
          const sidewaysBase=riverQuad(hud,pitch,seat,row,offset,true);
          const sidewaysCoverage=faceCoverage(image,sidewaysBase);
          const mayTurn=!turned&&(marks[seat]!==false||sidewaysCoverage>=.55&&sidewaysCoverage-coverage>=.18);
          const denseFace=coverage>=.24&&coverage<.32?match(image,base,templates):null;
          const rescued=denseFace?.tile?.id!==31&&confident(denseFace??{},.24,.09);
          if(!rescued&&coverage<.30&&(!mayTurn||sidewaysCoverage<.36)){
            if(occlusion(base))obscured.push(base);
            ended=true;offset++;continue;
          }
          const gap=ended;
          const tryTile=(sideways,dx,dy,inset=0)=>{
            let quad=riverQuad(hud,pitch,seat,row,offset,sideways,dx,dy);
            if(inset){
              const cx=quad.reduce((sum,t)=>sum+t.x,0)/4,cy=quad.reduce((sum,t)=>sum+t.y,0)/4;
              quad=quad.map(t=>point(t.x+(cx-t.x)*inset,t.y+(cy-t.y)*inset));
            }
            const cover=faceCoverage(image,quad);
            if(cover<.32)return null;
            const r=match(image,quad,templates);
            return {...r,sideways,quad,rank:r.error+(1-cover)*.22+Math.abs(dx)*.25+Math.abs(dy)*.25};
          };
          const center=rescued?{...denseFace,sideways:false,quad:base,rank:denseFace.error+(1-coverage)*.22}:tryTile(false,0,0);
          const variants=[center];
          if(!confident(center??{},.25,.08)){
            for(const dx of [-.055,0,.055])for(const dy of [-.085,-.043,0,.043,.085]){
              if(dx||dy)variants.push(tryTile(false,dx,dy));
              variants.push(tryTile(false,dx,dy,.10));
            }
          }
          if(mayTurn){
            variants.push(tryTile(true,0,0));
            for(const dx of [-.04,.04])for(const dy of [-.045,.045]){
              const candidate=tryTile(true,dx,dy);
              if(candidate)variants.push(candidate);
            }
          }
          const picks=variants.filter(r=>r?.tile).sort((a,b)=>a.rank-b.rank);
          let choice=picks.find(r=>confident(r,.35,.047))??picks[0];
          if(choice?.sideways&&marks[seat]===false&&!confident(choice,.29,.08))
            choice=picks.find(r=>!r.sideways)??choice;
          const disputedMan=man(center?.tile)&&man(choice?.tile)&&center.code!==choice.code&&
            center.error<=.35&&center.rank-choice.rank<=.09;
          if(disputedMan&&center.error<=.31)choice=center;
          const field=seat===3?'own':'river'+logicalSeat;
          const quad=choice?.quad??base;
          const blocked=occlusion(quad);
          const alternatives=picks.some(c=>c.code!==choice?.code&&c.rank-choice.rank<.020&&confident(c,.37,.035));
          const uncertain=gap||blocked||disputedMan||!choice||!confident(choice,.37,.047)||alternatives;
          if(choice)for(const hidden of obscured.splice(0)){
            marksForReview.push({field,index:river.length,quad:hidden,uncertain:true,occluded:true});
            river.push({id:31,red:false});
          }
          marksForReview.push({field,index:river.length,quad,uncertain,occluded:blocked});
          turned ||= choice?.sideways;
          river.push(choice?.tile??{id:31,red:false});
          offset+=choice?.sideways?1.31:1;
        }
      }
      const [dx,dy]=[[-1.48,0],[0,-1.05],[1.45,0],[0,1.1]][seat];
      marksForReview.push({field:seat===3?'locked':'ready'+logicalSeat,quad:rectangle(hud.x+(dx-.2)*pitch,hud.y+(dy-.14)*pitch,.4*pitch,.28*pitch),uncertain:marks[seat]===null&&!turned||marks[seat]===false&&turned});
      ready.push(Boolean(marks[seat]||turned));rivers.push(river);
    }
    return {ok:true,rivers,ready,marksForReview};
  }
  const redraw='请重新上传自己摸牌或吃碰后、出牌前的完整雀魂截图。';
  function fail(code,detail,observed) {return {ok:false,code,message:detail+' '+redraw,observed};}
  function inspect(image,templates) {
    reference ??=root.MahjongSoulTemplates&&decodeTemplates(root.MahjongSoulTemplates);
    templates ??=reference;
    if(!templates||image.width<620||image.width/image.height<1.36||image.width/image.height>2.52)
      return fail('layout','无法识别完整雀魂牌桌。');
    const view=viewport(image);
    const hand=handGeometry(image,view);
    const pitch=hand?.pitch??view.h*.086;
    const hud=scoreboard(image,view,pitch);
    if(!hud)return fail('layout','无法定位牌桌中央的局况面板。');
    const indicators=doraRack(image,view,pitch,templates);
    const observed={indicators,drawn:Boolean(hand?.draw),active:hud.active};
    const [left,opposite,right,self]=hud.seats;
    const topOpponent=Math.min(left,opposite,self)>.045&&right<.018?2:
      Math.min(right,opposite,self)>.045&&left<.018?0:-1;
    const three=topOpponent>=0||(Math.min(left,right,self)>.07&&opposite<.015);
    // The seat light can dim between animation frames. Require both a full
    // concealed draw and the separate countdown in that case.
    const timerInk=([r,g,b])=>r>165&&g>101&&r>g+8&&g>b+28;
    const timer=density(image,hud.x+4.7*pitch,view.bottom-3.7*pitch,2.8*pitch,1.35*pitch,timerInk,60,30);
    const timedDraw=hand?.count===13&&hand.draw&&hand.found.length===14&&timer>.034&&timer<.48;
    const afterCall=Boolean(hand?.callCount&&hand.faceTop&&!hand.draw);
    const tilesInHand=afterCall?hand.callCount:(hand?.count??13)+1;
    const meldCount=(14-tilesInHand)/3;
    const melds=hand?readOwnMelds(image,view,hand,meldCount,three,templates):null;
    const ownReplayChoice=afterCall&&melds?.length===meldCount&&Array.from({length:tilesInHand},(_,i)=>{
      const x=hand.start+(i+.12)*pitch;
      return density(image,x,view.bottom-.48*pitch,.76*pitch,.29*pitch,
        ([r,g,b])=>r>177&&r>g+45&&g>b+20,14,9);
    }).some(region=>region>.65);
    const frameHasQuad=Boolean(hand?.draw&&melds?.some(m=>m.closed&&indicators?.length>=2||m.added&&m.marks.every(mark=>!mark.uncertain)));
    if(!hud.active&&!timedDraw&&!frameHasQuad&&!ownReplayChoice)return fail('turn','未能同时确认自家回合与独立摸牌。',observed);
    if(hand?.hasMelds&&!hand.draw&&!afterCall)return fail('open-hand','检测到副露。可切换手动录入，分别填写未副露手牌与每组明副露。',observed);
    if(Math.min(topOpponent===0?opposite:left,three?1:opposite,topOpponent===2?opposite:right,self)<.022)
      return fail('layout','四家座位或宝牌指示牌无法可靠确认。',observed);
    if(!afterCall&&(!hand?.draw||!hand.faceTop||hand.found.length<hand.count+1))
      return fail('turn','未确认独立摸牌。',observed);
    const {start,faceTop,faceBottom,draw}=hand;
    const points=[];
    const reading=Array.from({length:tilesInHand},(_,i)=>{
      const x=!afterCall&&i===hand.count?draw[0]:start+i*pitch;
      const rect=[x,faceTop,pitch*.985,faceBottom-faceTop];
      const tile=matchFace(image,rect,templates,.39,.054);
      points.push({field:'hand',index:i,quad:rectangle(...rect),uncertain:!tile});
      return tile??match(image,rectangle(...rect),templates).tile??{id:31,red:false};
    });
    if(reading.some(t=>!t))return fail('hand','有手牌牌面无法可靠确认。',observed);
    observed.hand=reading;
    const table=readRivers(image,hud,pitch,templates,three,topOpponent);
    if(!table.ok)return fail('river',table.reason,observed);
    const {rivers,ready}=table;
    const rack=doraRegions(image,view,pitch);
    points.push({field:'indicators',quad:rectangle(...(rack?[rack[0][0],rack[0][1],rack[0][2]*5,rack[0][3]]:[0,view.top,image.width*.17,view.h*.14])),uncertain:!indicators});
    observed.indicators=indicators??[];
    if(meldCount&&(!melds||melds.some(group=>group.tiles.length<3)||afterCall&&melds.every(group=>group.tiles.length===4)))
      return fail('meld-layout','无法定位自家吃碰牌面。请确保右下角副露完整可见。',observed);
    const meldMarks=(melds??[]).flatMap((group,i)=>group.marks.map(mark=>({...mark,field:'meld',group:i})));
    const marks=points.concat(table.marksForReview,meldMarks).map(({quad,...rest})=>({...rest,x:Math.min(...quad.map(p=>p.x))/image.width,y:Math.min(...quad.map(p=>p.y))/image.height,w:(Math.max(...quad.map(p=>p.x))-Math.min(...quad.map(p=>p.x)))/image.width,h:(Math.max(...quad.map(p=>p.y))-Math.min(...quad.map(p=>p.y)))/image.height}));
    return {ok:true,...observed,rivers,ready,three,marks,afterCall,meldCount,melds};
  }
  root.BoardVision={sourceImage,inspect};
  if(typeof module!=='undefined')module.exports={...root.BoardVision,rectangle,signature,match,decodeTemplates,
    diagnostics:{viewport,handGeometry,readOwnMelds,scoreboard,doraRegions,doraRack,readRivers,riichiMarks,riverQuad,faceCoverage,density,span,pixel,ivory}};
})(globalThis);
