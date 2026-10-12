'use strict';
const crypto=require('node:crypto');
const {removeEntries,signCatalog}=require('./distribution.cjs');
async function main(){
 const review=process.env.REVIEW_URL,repo=process.env.GITHUB_REPOSITORY;
 const reviewHeaders={authorization:'Bearer '+process.env.PLUGIN_BUILD_TOKEN,'content-type':'application/json'};
 const headers={authorization:'Bearer '+process.env.GITHUB_TOKEN,'User-Agent':'ME-plugin-removal',Accept:'application/vnd.github+json','content-type':'application/json'};
 async function api(route,method='GET'){const r=await fetch('https://api.github.com/repos/'+repo+route,{method,headers,signal:AbortSignal.timeout(60000)});if(r.status===404)return null;if(!r.ok)throw Error('Removal GitHub HTTP '+r.status);return r.status===204?null:r.json();}
 const queue=await fetch(review+'/v1/plugins/build/deletions',{headers:reviewHeaders,signal:AbortSignal.timeout(30000)});if(!queue.ok)throw Error('Removal queue HTTP '+queue.status);
 const {items}=await queue.json();if(!items.length)return;
 if(items.some(x=>!/^[a-f0-9-]{36}$/.test(x.id)||!/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+){1,8}$/.test(x.plugin_id)||!/^\d{1,5}\.\d{1,5}\.\d{1,5}$/.test(x.version)))throw Error('Invalid removal receipt');
 const key=crypto.createPrivateKey(process.env.CATALOG_SIGNING_KEY),publicKey=crypto.createPublicKey(key);
 const release=await api('/releases/tags/plugin-catalog');
 const canonical=release?.assets.find(a=>a.name==='catalog.json');
 const previous=canonical||release?.assets.filter(a=>/^catalog-next-[a-f0-9]{64}\.json$/.test(a.name)).sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id-a.id)[0];
 if(previous){
  const fetched=await fetch(previous.browser_download_url,{cache:'no-store',signal:AbortSignal.timeout(60000)});if(!fetched.ok)throw Error('Catalog unavailable');
  const plugins=removeEntries(await fetched.json(),publicKey,items),envelope=signCatalog(plugins,key);
  const digest=crypto.createHash('sha256').update(envelope).digest('hex');
  const staged=await fetch(release.upload_url.split('{')[0]+'?name=catalog-next-'+digest+'.json',{method:'POST',headers:{...headers,'content-type':'application/octet-stream'},body:envelope,signal:AbortSignal.timeout(60000)});
  if(!staged.ok)throw Error('Catalog staging HTTP '+staged.status);
  const stagedAsset=await staged.json();if(stagedAsset.digest!=='sha256:'+digest)throw Error('Catalog staging verification failed');
  if(canonical)await api('/releases/assets/'+canonical.id,'DELETE');
  const uploaded=await fetch(release.upload_url.split('{')[0]+'?name=catalog.json',{method:'POST',headers:{...headers,'content-type':'application/octet-stream'},body:envelope,signal:AbortSignal.timeout(60000)});
  if(!uploaded.ok)throw Error('Catalog replacement HTTP '+uploaded.status);
  const asset=await uploaded.json();
  if(asset.digest!=='sha256:'+crypto.createHash('sha256').update(envelope).digest('hex'))throw Error('Catalog replacement verification failed');
 }
 for(const item of items){const tag=item.plugin_id+'-v'+item.version;const published=await api('/releases/tags/'+encodeURIComponent(tag));if(published)await api('/releases/'+published.id,'DELETE');}
 // This workflow is serialized with publishing. Ack only after all distribution removals succeed.
 for(const id of new Set(items.map(i=>i.id))){const r=await fetch(review+'/v1/plugins/build/deletions/'+id+'/complete',{method:'POST',headers:reviewHeaders,body:JSON.stringify({catalogRemoved:true,releasesRemoved:true}),signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('Removal acknowledgement HTTP '+r.status);}
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});module.exports={main};
