import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import vm from 'node:vm';

const root=process.cwd();
const publicRoot=resolve(root,'public');
const html=await readFile(resolve(publicRoot,'index.html'),'utf8');
const failures=[];
const requireText=(needle,message)=>{if(!html.includes(needle))failures.push(message);};
requireText('<!doctype html>','Missing HTML doctype.');
requireText('<html dir="rtl" lang="ar">','Root document must be Arabic RTL.');
requireText('name="viewport"','Missing responsive viewport.');
requireText('id="view"','Main application view is missing.');
requireText('href="./styles.css"','Design-system stylesheet is missing.');
const scripts=[...html.matchAll(/<script\s+defer\s+src="\.\/([^"]+)"\s*><\/script>/gi)].map((match)=>match[1]);
if(scripts.length<5)failures.push('Expected ordered application modules.');
let combined='';
for(const file of scripts){
  const code=await readFile(resolve(publicRoot,file),'utf8').catch(()=>null);
  if(code===null){failures.push(`Missing script: ${file}`);continue;}
  combined+=`\n${code}`;
  try{new vm.Script(code,{filename:`public/${file}`});}catch(error){failures.push(`JavaScript syntax error in ${file}: ${error.message}`);}
}
for(const [needle,message] of [['BigInt','BigInt money logic is missing.'],['parseTrialBalance','Trial-balance engine is missing.'],['runJournalTests','ISA 240 tests are missing.'],['deriveOpinion','Opinion engine is missing.'],['verifyLog','Audit-log verification is missing.']])if(!combined.includes(needle))failures.push(message);
if(/\beval\s*\(|new\s+Function\s*\(/.test(combined))failures.push('Dynamic code execution is forbidden.');
const rootFiles=await readdir(root);
for(const name of ['.env','.env.local','.env.production'])if(rootFiles.includes(name))failures.push(`Secret-bearing file must not be committed: ${name}`);
if(failures.length){console.error('Static validation failed:');failures.forEach((item)=>console.error(`- ${item}`));process.exit(1);}
console.log(`Static validation passed (${scripts.length} scripts, ${combined.length.toLocaleString('en-US')} JavaScript characters).`);
