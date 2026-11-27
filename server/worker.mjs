import {contributions,database} from './contributions.mjs';
import {assets} from './assets.mjs';

export default {
  async fetch(request,env){
    const path=new URL(request.url).pathname;
    if(path==='/api/contributions'){
      try{
        return await contributions(request,env.DB&&env.SAMPLE_SOURCE_SECRET?
          database(env.DB,env.SAMPLE_SOURCE_SECRET):null,request.headers.get('CF-Connecting-IP'));
      }catch{return Response.json({error:'贡献库暂不可用'},{status:503});}
    }
    const asset=assets[path==='/'?'/index.html':path];
    if(!asset)return new Response('Not found',{status:404});
    if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405});
    return new Response(request.method==='HEAD'?null:asset.body,{headers:{
      'Content-Type':asset.type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'
    }});
  }
};
