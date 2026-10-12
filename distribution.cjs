'use strict';
const crypto=require('node:crypto');
function removeEntries(envelope,publicKey,targets){
 if(!envelope||typeof envelope.payload!=='string'||!crypto.verify(null,Buffer.from(envelope.payload),publicKey,Buffer.from(envelope.signature,'base64')))throw Error('Catalog signature invalid');
 const data=JSON.parse(envelope.payload);
 if(data.schemaVersion!==1||!Array.isArray(data.plugins))throw Error('Invalid catalog');
 return data.plugins.filter(item=>!targets.some(t=>t.plugin_id===item.manifest.id&&(t.scope==='plugin'||t.version===item.manifest.version)));
}
function signCatalog(plugins,key){const payload=JSON.stringify({schemaVersion:1,generatedAt:new Date().toISOString(),plugins});return Buffer.from(JSON.stringify({payload,signature:crypto.sign(null,Buffer.from(payload),key).toString('base64')}));}
module.exports={removeEntries,signCatalog};
