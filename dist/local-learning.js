((root)=>{
  const width=24,height=36,version=1;
  const isRiver=mark=>mark.field==='own'||mark.field.startsWith('river');
  function tileAt(board,mark){
    if(isRiver(mark))return board.rivers[mark.seat];
    if(mark.field==='hand')return board.hand;
    if(mark.field==='meld')return board.melds[mark.group]?.tiles;
  }

  function sample(image,board,mark,label){
    if(!image||mark.occluded||!mark.crop||!tileAt(board,mark)||
      mark.crop.some(([x,y])=>x<0||x>1||y<0||y>1)||mark.status==='occluded')return null;
    if(label===null&&!isRiver(mark))return null;
    const quad=mark.crop.map(([x,y])=>({x:x*image.width,y:y*image.height}));
    const data=new Uint8Array(width*height*3);
    const [a,b,c,d]=quad;
    let blue=0;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const u=(x+.5)/width,v=(y+.5)/height;
      const rgb=root.BoardVision.pixel(image,(a.x*(1-u)+b.x*u)*(1-v)+(d.x*(1-u)+c.x*u)*v,
        (a.y*(1-u)+b.y*u)*(1-v)+(d.y*(1-u)+c.y*u)*v);
      if(rgb[2]>115&&rgb[2]>rgb[0]+32&&rgb[2]>rgb[1]+16)blue++;
      data.set(rgb,(y*width+x)*3);
    }
    if(blue>width*height*.12)return null;
    const tile=tileAt(board,mark)[mark.index];
    const original=mark.originalCode??(tile?(tile.red?'0'+root.Riichi.notation(tile.id).at(-1):root.Riichi.notation(tile.id)):null);
    return {version,width,height,data,shape:root.BoardVision.signature(image,quad),label,
      region:mark.region,orientation:mark.orientation,three:board.three,original};
  }

  function pixelDistance(first,second){
    let sum=0;
    for(let i=0;i<first.length;i++)sum+=Math.abs(first[i]-second[i]);
    return sum/(255*first.length);
  }

  function identify(current,samples,mark){
    const matches=[];
    for(const saved of samples){
      if(saved.version!==version||saved.region!==current.region||saved.orientation!==current.orientation||
        saved.three!==current.three||saved.data?.length!==current.data.length)continue;
      const pixels=pixelDistance(current.data,saved.data);
      if(saved.label===null){
        if(pixels<.060)matches.push({label:null,score:pixels*1.8});
        continue;
      }
      if(!current.shape.ink||!saved.shape?.ink){
        if(saved.label==='5z'&&!current.shape.ink&&!saved.shape?.ink&&current.shape.paper>=176&&pixels<.025)
          matches.push({label:saved.label,score:pixels*3});
        continue;
      }
      if(pixels>.17)continue;
      if(Math.abs(current.shape.red-saved.shape.red)>.095)continue;
      const shape=root.BoardVision.compare(current.shape,{...saved.shape,code:saved.label});
      if(shape<.29)matches.push({label:saved.label,score:shape+pixels*.55});
    }
    matches.sort((a,b)=>a.score-b.score);
    const best=matches[0];
    if(!best)return null;
    if(matches.some(match=>match.label!==best.label&&match.score<best.score+.075))return {review:'本地样本标签冲突'};
    if(best.label===null){
      if(!mark.uncertain||mark.riichi||mark.edgeEvidence||current.shape.paper>=176||current.shape.ink>=10||best.score>.075)
        return {review:'本地空位样本相似，需核对是否有舍牌'};
      return best;
    }
    const strong=mark.uncertain?.273:.215;
    if(best.score>strong)return null;
    return best;
  }

  function apply(image,board,samples){
    if(!board.ok||!samples?.length)return board;
    for(const mark of [...board.marks]){
      if(mark.layoutUncertain||!mark.region||!samples.some(s=>s.region===mark.region&&s.orientation===mark.orientation&&s.three===board.three))continue;
      const crop=sample(image,board,mark);
      if(!crop)continue;
      const match=identify(crop,samples,mark);
      if(!match)continue;
      if(match.review){mark.uncertain=true;mark.reason=match.review;continue;}
      const tiles=tileAt(board,mark);
      const original=tiles[mark.index];
      if(!original)continue;
      if(match.label===null){
        if(board.declarations[mark.seat]===mark.index+1){
          mark.uncertain=true;
          mark.reason='本地空位样本与立直宣言位置冲突';
          continue;
        }
        tiles.splice(mark.index,1);
        const position=board.declarations[mark.seat];
        if(position>mark.index+1)board.declarations[mark.seat]--;
        board.marks=board.marks.filter(m=>m!==mark);
        for(const next of board.marks)if(next.field===mark.field&&next.index>mark.index)next.index--;
        board.learned=(board.learned??0)+1;
        continue;
      }
      const replacement=root.Riichi.parse(match.label)[0];
      if(!replacement||board.three&&replacement.id>0&&replacement.id<8)continue;
      if(mark.field==='meld'&&board.melds[mark.group].closed&&original.id!==replacement.id){
        mark.uncertain=true;
        mark.reason='本地样本与暗杠牌组冲突';
        continue;
      }
      if(mark.issues?.length&&match.label===crop.original)continue;
      tiles[mark.index]=replacement;
      root.BoardVision.auditBoard(board);
      if(mark.issues?.length){
        tiles[mark.index]=original;
        root.BoardVision.auditBoard(board);
        mark.uncertain=true;
        mark.reason='本地样本与牌数或副露规则冲突';
        continue;
      }
      if(mark.uncertain||match.label!==crop.original)board.learned=(board.learned??0)+1;
      mark.originalCode=crop.original;
      mark.code=match.label;
      mark.uncertain=false;
      mark.reason=undefined;
    }
    return root.BoardVision.auditBoard(board);
  }

  function open(){
    return new Promise((resolve,reject)=>{
      const request=root.indexedDB.open('pai-efficiency-local-learning',1);
      request.onupgradeneeded=()=>{
        request.result.createObjectStore('samples',{autoIncrement:true,keyPath:'id'});
        request.result.createObjectStore('preferences');
      };
      request.onerror=()=>reject(request.error);
      request.onsuccess=()=>resolve(request.result);
    });
  }

  async function transaction(store,mode,operation){
    const db=await open();
    try{
      return await new Promise((resolve,reject)=>{
        const tx=db.transaction(store,mode);
        tx.oncomplete=()=>resolve(request.result);
        tx.onabort=()=>reject(tx.error);
        tx.onerror=()=>reject(tx.error);
        const request=operation(tx.objectStore(store));
      });
    }finally{db.close();}
  }
  root.BoardLearning={
    sample,apply,identify,
    enabled:()=>transaction('preferences','readonly',store=>store.get('enabled')).then(Boolean),
    setEnabled:value=>transaction('preferences','readwrite',store=>store.put(value,'enabled')),
    list:()=>transaction('samples','readonly',store=>store.getAll()),
    save:entry=>transaction('samples','readwrite',store=>store.add(entry)),
    remove:id=>transaction('samples','readwrite',store=>store.delete(id)),
    clear:()=>transaction('samples','readwrite',store=>store.clear())
  };
  if(typeof module!=='undefined')module.exports=root.BoardLearning;
})(globalThis);
