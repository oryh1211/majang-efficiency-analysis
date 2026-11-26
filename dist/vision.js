(() => {
  const W=64,H=86;
  const variants=[...Array.from({length:34},(_,id)=>({id,red:false})),...[4,13,22].map(id=>({id,red:true}))];
  function art(tile, style=0) {
    const canvas=document.createElement('canvas');
    canvas.width=W;canvas.height=H;
    const ctx=canvas.getContext('2d');
    function rect(x,y,w,h,r,color) {
      ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();
    }
    function glyph(text,x,y,size,color) {
      ctx.font='bold '+size+'px '+(['"KaiTi","STKaiti",serif','"SimSun",serif','"Microsoft YaHei",sans-serif'][style]);
      ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(text,x,y);
    }
    rect(1,6,62,79,7,'#477b55');
    rect(1,1,62,78,7,'#fff8e8');
    const id=tile.id,n=id%9+1;
    const black='#263c35',red='#a82230',green='#288051',blue='#2a5569';
    if(id<9) {
      glyph('一二三四五六七八九'[n-1],32,25,32,tile.red?red:black);
      glyph('萬',32,55,29,red);
    } else if (id<18) {
      layout(n).forEach(([x,y],k)=>{
        ctx.lineWidth=n===1?4:2.7;
        ctx.strokeStyle=tile.red?red:(n===1||n===5&&k===2?red:k%3===0?green:blue);
        for(const radius of (n===1?[17,10,3]:[n>6?5.5:7])) {
          ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.stroke();
        }
      });
    } else if (id<27) {
      if (n===1) {
        ctx.fillStyle=green;ctx.beginPath();ctx.ellipse(30,45,12,16,.55,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(39,28,8,0,Math.PI*2);ctx.fill();
        glyph('›',48,31,18,red);glyph('〃',27,53,20,'#fff8e8');
      } else layout(n).forEach(([x,y],k)=>{
        const color=tile.red||n===5&&k===2||n===7&&k===0?red:green;
        rect(x-3,y-9,6,18,2,color);
        rect(x-4,y-7,8,2,1,color);
        rect(x-4,y+4,8,2,1,color);
      });
    } else {
      const z=id-27;
      if(z===4 && style!==1) {
        ctx.strokeStyle=blue;ctx.lineWidth=style===0?2:3;ctx.strokeRect(12,15,40,47);
        ctx.lineWidth=1;ctx.strokeRect(16,19,32,39);
      } else if(z!==4) glyph('東南西北 發中'[z],32,42,43,z===5?green:z===6?red:black);
    }
    return canvas;
  }
  function layout(n) {
    const pair=y=>[[20,y],[44,y]];
    const diagonal=n=>Array.from({length:n},(_,i)=>[20+i*24/(n-1),20+i*38/(n-1)]);
    switch(n) {
      case 1:return [[32,39]];
      case 2:return [[32,25],[32,53]];
      case 3:return diagonal(3);
      case 4:return [...pair(23),...pair(55)];
      case 5:return [...pair(21),[32,39],...pair(57)];
      case 6:return [...pair(18),...pair(39),...pair(60)];
      case 7:return [...diagonal(3).map(([x,y])=>[x,12+(y-20)*.55]),...pair(48),...pair(64)];
      case 8:return [13,30,47,64].flatMap(pair);
      default:return [18,39,60].flatMap(y=>[15,32,49].map(x=>[x,y]));
    }
  }
  globalThis.TileVision={art,variants};
})();
