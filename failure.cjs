'use strict';
const fs = require('node:fs/promises');
(async () => {
  const id = process.env.SUBMISSION_ID, sourceSha256 = process.env.SOURCE_SHA256;
  if (!/^[a-f0-9-]{36}$/.test(id || '') || !/^[a-f0-9]{64}$/.test(sourceSha256 || '')) return;
  const response = await fetch(process.env.REVIEW_URL + '/v1/plugins/build/' + id + '/complete', { method: 'POST', headers: { authorization: 'Bearer ' + process.env.PLUGIN_BUILD_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceSha256, failed: true }), signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw Error('Failure receipt HTTP ' + response.status);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
