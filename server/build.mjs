import {readdir,readFile,mkdir,writeFile,copyFile} from 'node:fs/promises';
const mime={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',txt:'text/plain; charset=utf-8'};
const assets=Object.create(null);
for(const name of await readdir('dist')){
  const type=mime[name.split('.').at(-1)];
  if(type)assets['/'+name]={type,body:await readFile('dist/'+name,'utf8')};
}
await mkdir('dist/server',{recursive:true});
await writeFile('dist/server/assets.mjs','export const assets=Object.assign(Object.create(null),'+JSON.stringify(assets)+');\n');
await copyFile('server/worker.mjs','dist/server/index.js');
await copyFile('server/contributions.mjs','dist/server/contributions.mjs');
