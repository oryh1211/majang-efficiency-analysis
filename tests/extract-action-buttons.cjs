const {readImage}=require('./local-learning.cjs');
const {writeFileSync}=require('node:fs');
const seeds=[
  ['sample-chi2-6','chi',740,442,58,28],
  ['sample-chi2-6','skip',906,434,83,38],
  ['sample-kan-5','kan',746,365,34,24]
];
const samples=seeds.map(([id,kind,x,y,w,h])=>{
  const {data,width,height}=readImage(process.argv[2]??'.vision-research',id);
  const patch=[];
  for(let j=0;j<14;j++)for(let i=0;i<24;i++){
    const offset=(Math.round(y+(j+.5)*h/14)*width+Math.round(x+(i+.5)*w/24))*3;
    patch.push(...data.subarray(offset,offset+3));
  }
  return {kind,w:w/width,h:h/height,x:x/width,y:y/height,data:Buffer.from(patch).toString('base64')};
});
writeFileSync('dist/action-buttons.js','globalThis.ActionButtonSamples='+JSON.stringify(samples)+';\n');
