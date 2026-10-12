'use strict';
const fs=require('node:fs/promises'),{createReadStream}=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {promisify}=require('node:util'),{execFile}=require('node:child_process');
const {parseArchiveListing,validateManifest,LIMITS}=require('./lib/contract');
async function hashFile(file){const h=crypto.createHash('sha256');for await(const b of createReadStream(file))h.update(b);return h.digest('hex');}
async function prepareSource(filename,root,sevenZip){
 const options={windowsHide:true,timeout:600000,maxBuffer:8*1024**2};
 const {stdout}=await promisify(execFile)(sevenZip,['l','-slt','-sccUTF-8','--',filename],options);
 const entries=parseArchiveListing(stdout,{unpackedBytes:Number.MAX_SAFE_INTEGER,files:LIMITS.files});
 await fs.mkdir(root,{recursive:true});const disk=await fs.statfs(root);const required=entries.reduce((sum,e)=>sum+e.size,0);
 if(!Number.isSafeInteger(required)||required>disk.bavail*disk.bsize)throw Error('SOURCE_DISK_SPACE_REQUIRED');
 const content=path.join(root,'content');await fs.mkdir(content);
 await promisify(execFile)(sevenZip,['x','-y','-sccUTF-8','-o'+content,'--',filename],options);
 const files=new Set();
 for(const entry of entries){
  const file=path.join(content,entry.path),stat=await fs.lstat(file);
  if(stat.isSymbolicLink()||!path.resolve(await fs.realpath(file)).startsWith(path.resolve(content)+path.sep)||(entry.directory?!stat.isDirectory():!stat.isFile()||stat.nlink!==1||stat.size!==entry.size))throw Error('PLUGIN_ARCHIVE_UNSAFE');
  if(!entry.directory)files.add(entry.path);
 }
 if(!files.has('plugin.json')||!files.has('README.md'))throw Error('PLUGIN_MANIFEST_MISSING');
 if((await fs.stat(path.join(content,'plugin.json'))).size>1024**2)throw Error('PLUGIN_MANIFEST_INVALID');
 const manifest=validateManifest(JSON.parse(await fs.readFile(path.join(content,'plugin.json'),'utf8')));
 return {content,manifest,files,sha256:await hashFile(filename)};
}
module.exports={prepareSource,hashFile};
