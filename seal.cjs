'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {promisify}=require('node:util'),{execFile}=require('node:child_process');
const {PluginPackages,digest}=require('./lib/packages');
function publisher(value){
 if(!value||Object.keys(value).sort().join(',')!=='id,origin'||!['official','community'].includes(value.origin)||typeof value.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.id))throw Error('Invalid server publisher identity');
 return {origin:value.origin,id:value.id};
}
function payload(hashes,identity){return JSON.stringify({schemaVersion:2,purpose:'me-plugin-package',publisher:publisher(identity),files:Object.fromEntries(Object.entries(hashes).filter(([name])=>name!=='signature.json').sort(([a],[b])=>a<b?-1:a>b?1:0))});}
async function seal({filename,receipt,permit,privateKey,sevenZip,directory}){
 if(permit?.allowed!==true||permit.pluginId!==receipt.pluginId||permit.version!==receipt.version||permit.sourceSha256!==receipt.sourceSha256)throw Error('Server permit does not match package');
 const identity=publisher(permit.publisher),packages=new PluginPackages({directory,sevenZip,publicKey:crypto.createPublicKey(privateKey).export({type:'spki',format:'pem'})});
 try{
  const prepared=await packages.prepare(filename),pending=packages.pending.get(prepared.ticket);
  if(prepared.sha256!==receipt.packageSha256||prepared.manifest.id!==receipt.pluginId||prepared.manifest.version!==receipt.version||JSON.stringify(prepared.manifest)!==JSON.stringify(receipt.manifest)||(await fs.stat(filename)).size!==receipt.size)throw Error('Package changed before signing');
  // A submitter must not supply the server attestation reserved filename.
  if(pending.hashes['signature.json'])throw Error('Submitted publisher signature is forbidden');
  const signedPayload=payload(pending.hashes,identity);
  const signature={schemaVersion:2,publisher:identity,signature:crypto.sign(null,Buffer.from(signedPayload),privateKey).toString('base64')};
  await fs.writeFile(path.join(pending.content,'signature.json'),JSON.stringify(signature),{flag:'wx'});
  // Keep retries of the same reviewed bytes/identity reproducible on the publishing runner.
  const fixedTime=new Date('2000-01-01T00:00:00Z');await fs.utimes(path.join(pending.content,'signature.json'),fixedTime,fixedTime);
  await promisify(execFile)(sevenZip,['a','-tzip','-mtc=off','-mta=off',path.resolve(filename),'signature.json'],{cwd:pending.content,windowsHide:true,timeout:120000,maxBuffer:1024**2});
  const verified=await packages.prepare(filename),sealed=packages.pending.get(verified.ticket);
  if(payload(sealed.hashes,identity)!==signedPayload||!crypto.verify(null,Buffer.from(signedPayload),crypto.createPublicKey(privateKey),Buffer.from(signature.signature,'base64')))throw Error('Sealed package changed');
  const bytes=await fs.readFile(filename);
  return {bytes,packageSha256:digest(bytes),size:bytes.length,publisher:identity};
 }finally{await packages.dispose();}
}
module.exports={seal,payload,publisher};
