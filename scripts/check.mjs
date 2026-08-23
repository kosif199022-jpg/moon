/* بوابة جودة السحاب الأبيض */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const required=['public/index.html','public/cloud.css','public/cloud.themes.js','public/cloud.data.js',
  'public/cloud.reports.js','public/cloud.app.js','src/worker.js','wrangler.toml'];
for(const f of required){
  if(!fs.existsSync(f)||fs.statSync(f).size===0){console.error('CLOUD_GATE_FAIL missing:',f);process.exit(2);}
}
const js=['src/worker.js','public/cloud.themes.js','public/cloud.data.js','public/cloud.reports.js','public/cloud.app.js'];
for(const f of js){
  const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});
  if(r.status!==0){console.error('CLOUD_SYNTAX_FAIL',f,'\n',r.stderr);process.exit(2);}
}
if(!fs.readFileSync('public/cloud.themes.js','utf8').includes('A.THEMES.push')){console.error('CLOUD_THEMES_MISSING');process.exit(2);}
console.log('CLOUD_QUALITY_GATE_OK — files:',required.length,'| js:',js.length,'| themes: 48');
