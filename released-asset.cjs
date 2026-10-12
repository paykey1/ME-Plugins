'use strict';
function releasedAsset(release,repository,receipt){
 const tag=receipt.pluginId+'-v'+receipt.version;
 const url='https://github.com/'+repository+'/releases/download/'+tag+'/'+receipt.filename;
 const asset=release?.assets?.find(item=>item.name===receipt.filename);
 if(release?.draft!==false||release.tag_name!==tag||!asset||asset.browser_download_url!==url||asset.digest!=='sha256:'+receipt.packageSha256||asset.size!==receipt.size)throw Error('Published asset verification failed');
 return asset;
}
module.exports={releasedAsset};
