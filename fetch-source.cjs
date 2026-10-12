'use strict';
const fs = require('node:fs/promises');
const {createWriteStream}=require('node:fs');
const {pipeline}=require('node:stream/promises');
const {Transform,Readable}=require('node:stream');
const crypto=require('node:crypto');
async function main() {
  const base = process.env.REVIEW_URL, token = process.env.PLUGIN_BUILD_TOKEN;
  if (!base?.startsWith('https://') || !token) throw Error('Missing review configuration');
  const headers = { authorization: 'Bearer ' + token };
  const claim = await fetch(base + '/v1/plugins/build/claim', { method: 'POST', headers, signal: AbortSignal.timeout(30000) });
  if (!claim.ok) throw Error('Queue HTTP ' + claim.status);
  const { submission } = await claim.json();
  if (!submission) { await fs.appendFile(process.env.GITHUB_OUTPUT, 'ready=false\n'); return; }
  if (!/^[a-f0-9-]{36}$/.test(submission.id) || !/^[a-f0-9]{64}$/.test(submission.sourceSha256)) throw Error('Invalid queue receipt');
  await fs.writeFile('claim.json', JSON.stringify(submission));
  await fs.appendFile(process.env.GITHUB_OUTPUT, `submission=${submission.id}\nsource_sha256=${submission.sourceSha256}\n`);
  const response = await fetch(`${base}/v1/plugins/build/${submission.id}/source?sha256=${submission.sourceSha256}`, { headers, signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw Error('Source HTTP ' + response.status);
  const format = response.headers.get('x-source-format'); if (!['zip', '7z'].includes(format)) throw Error('Invalid source format');
  const hash=crypto.createHash('sha256');
  const filename='source.'+format;
  try {
    await pipeline(Readable.fromWeb(response.body),new Transform({transform(chunk,encoding,callback){hash.update(chunk);callback(null,chunk);}}),createWriteStream(filename,{flags:'wx'}));
    if(hash.digest('hex')!==submission.sourceSha256)throw Error('Source hash mismatch');
  }catch(error){await fs.unlink(filename).catch(()=>{});throw error;}
  await fs.writeFile('approved.json', JSON.stringify({ ...submission, format, pluginId: response.headers.get('x-plugin-id'), version: response.headers.get('x-plugin-version') }));
  await fs.appendFile(process.env.GITHUB_OUTPUT, 'ready=true\n');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
