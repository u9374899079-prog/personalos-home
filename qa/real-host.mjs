import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const artifactDir=path.resolve('qa-artifacts');
fs.mkdirSync(artifactDir,{recursive:true});
const vault=process.env.QA_VAULT;
const report={test:'Obsidian 1.14.4 official Linux binary / actual Electron host',vaultType:'synthetic, isolated',steps:[],errors:[],status:'INCOMPLETE'};
const mark=(label,result,details='')=>{report.steps.push({label,result,details});console.log((result?'PASS ':'FAIL ')+label+(details?' : '+details:''));};
const delay=t=>new Promise(r=>setTimeout(r,t));
let browser;
try{
 browser=await chromium.connectOverCDP('http://127.0.0.1:9222',{timeout:20000});
 let page=null;
 let trustHandled=false;
 const seen=new Set();
 for(let i=0;i<50;i++){
  const pages=browser.contexts().flatMap(c=>c.pages());
  for(const p of pages){
   if(!seen.has(p)){seen.add(p);p.on('pageerror',e=>report.errors.push('renderer:'+String(e)));p.on('console',m=>{if(m.type()==='error')report.errors.push('console:'+m.text().slice(0,450));});}
   if(!trustHandled && await p.getByText('Trust author and enable plugins',{exact:true}).count().catch(()=>0)){
     await p.getByText('Trust author and enable plugins',{exact:true}).click({timeout:10000});
     trustHandled=true;mark('Official first-use plugin trust dialog handled inside disposable QA vault',true);
   }
   if(await p.locator('.ph-shell').count().catch(()=>0)){page=p;break;}
  }
  if(page)break;
  await delay(2000);
 }
 const allPages=browser.contexts().flatMap(c=>c.pages());
 report.pages=await Promise.all(allPages.map(async p=>({url:p.url(),title:await p.title().catch(()=>''),content:await p.locator('body').innerText().then(s=>s.slice(0,1300)).catch(()=>'(unavailable)')})));
 if(!page){
  for(let i=0;i<Math.min(allPages.length,3);i++){
   try{await allPages[i].screenshot({path:path.join(artifactDir,'unopened-'+i+'.png'),timeout:10000});}catch{}
  }
  mark('PersonalOS plugin mounted inside actual Obsidian host',false,'No .ph-shell after startup');
  throw Error('Real Obsidian plugin did not mount; check screenshot and host logs');
 }
 mark('PersonalOS plugin mounted inside actual Obsidian host',true,page.url());
 await page.screenshot({path:path.join(artifactDir,'01-real-obsidian-home.png'),timeout:15000});
 const version=await page.locator('.ph-build-tag').innerText().catch(()=>'missing');
 assert.equal(version,'v3.2.2');mark('Production manifest version rendered',true,version);
 const home=await page.locator('.ph-actions-panel .ph-action-primary').count();
 assert.equal(home,1);mark('Quick capture action present',true);
 await page.locator('.ph-actions-panel .ph-action-primary').click();
 await page.locator('.ph-compose-editor').waitFor({timeout:10000});
 mark('Native host quick capture can open',true);
 await page.screenshot({path:path.join(artifactDir,'02-real-obsidian-capture.png'),timeout:15000});
 await page.locator('.ph-compose-editor').fill('真实 Obsidian 桌面宿主 QA，纯虚构内容，无个人资料。');
 page.once('dialog',dialog=>dialog.dismiss());
 await page.locator('.ph-top-action').click();
 await page.locator('.ph-compose-editor').waitFor({timeout:5000});
 mark('Unsaved draft back action respects cancel',true);
 await page.getByText('保存并返回').click();
 await page.locator('.ph-actions-panel .ph-action-primary').waitFor({timeout:10000});
 const captureDir=path.join(vault,'01 收集/记录');
 const saves=fs.existsSync(captureDir)?fs.readdirSync(captureDir).filter(x=>x.endsWith('.md')):[];
 assert.ok(saves.length>=1);mark('Actual Obsidian vault API wrote markdown file to disk',true,saves[0]);
 const savedBody=fs.readFileSync(path.join(captureDir,saves[0]),'utf8');
 assert.ok(savedBody.includes('真实 Obsidian 桌面宿主 QA'));mark('File content round-trip to physical Markdown',true);
 const journal=path.join(vault,'10 日记','2026-10-20.md');
 const before=fs.readFileSync(journal,'utf8');
 await page.locator('.ph-actions-panel .ph-action-secondary').click();
 await delay(1800);
 assert.equal(fs.readFileSync(journal,'utf8'),before);
 mark('Open today does not overwrite existing daily entry',true);
 await page.screenshot({path:path.join(artifactDir,'03-real-obsidian-diary.png'),timeout:15000});
 report.status='PASS';
}catch(e){report.status='FAIL';report.failure=String(e?.stack||e);console.error(report.failure);process.exitCode=1;
}finally{
 fs.writeFileSync(path.join(artifactDir,'real-host-report.json'),JSON.stringify(report,null,2));
 await browser?.close().catch(()=>{});
}
