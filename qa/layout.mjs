/* Mobile-first Obsidian layout smoke tests using a mocked host.
   This does NOT claim to reproduce the real iOS native window. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const source=fs.readFileSync('main.js','utf8');
const css=fs.readFileSync('styles.css','utf8');
const manifest=JSON.parse(fs.readFileSync('manifest.json','utf8'));
fs.mkdirSync('qa-artifacts',{recursive:true});
const bootstrap=String.raw\`
const target=document.querySelector('#target');
class Plugin{
 constructor(){this.app=app;this.manifest={version:'VERSION'};}
 registerView(type,factory){this.factory=factory;}
 addRibbonIcon(){} addCommand(){} registerEvent(){}
}
class ItemView{constructor(){this.app=app;this.contentEl=target;}}
class Modal{constructor(){this.contentEl=document.createElement('div');this.titleEl={setText(){}};}open(){this.onOpen?.();}close(){}}
class Notice{constructor(text){window.notice=text;}}
class TFile{}
HTMLElement.prototype.empty=function(){this.replaceChildren();};
HTMLElement.prototype.addClass=function(c){this.classList.add(c);};
window.setIcon=(el)=>{el.textContent='◇';};
const records=[{path:'10 日记/2026-10-20.md',basename:'2026-10-20',name:'2026-10-20.md',stat:{mtime:Date.now()}}];
const vault={getMarkdownFiles:()=>records,getAllLoadedFiles:()=>records,getName:()=> 'QA Demo',getAbstractFileByPath:()=>null,on:()=>({}),createFolder:async()=>{},create:async(p,body)=>({path:p,basename:p.split('/').pop(),stat:{mtime:Date.now()}})};
const leaf={view:null,setViewState:async function(){this.view=plugin.factory(this);await this.view.onOpen();},openFile:async()=>{}};
const app={isMobile:INNER_WIDTH<601,vault,workspace:{onLayoutReady:f=>f(),getLeavesOfType:()=>leaf.view?[leaf]:[],getLeaf:()=>leaf,revealLeaf:async()=>{}}};
function require(name){if(name==='obsidian')return {Plugin,ItemView,Modal,Notice,setIcon:window.setIcon,TFile};throw Error('Unknown '+name);}
(function(){var module={exports:{}};PLUGIN_SOURCE
window.PluginClass=module.exports;})();
var plugin=new window.PluginClass();
plugin.onload();
\`;
function build(width,height){
 let js=bootstrap.replace('INNER_WIDTH',String(width)).replace('VERSION',manifest.version).replace('PLUGIN_SOURCE',source);
 return '<!DOCTYPE html><html lang="zh"><head><meta name="viewport" content="width=device-width,initial-scale=1">'+
 '<style>html,body{margin:0;height:100%;background:#101215;color:#eee}.native-top{position:fixed;top:0;left:0;right:0;height:92px;background:#111316}.mobile-navbar{position:fixed;bottom:0;left:0;right:0;height:68px;background:#27292c;z-index:10}.workspace-leaf-content{position:absolute;top:92px;bottom:68px;left:0;right:0;overflow:hidden}.view-content{height:100%}</style>'+
 '<style>'+css+'</style></head><body><div class="native-top"></div><div class="workspace-leaf-content" data-type="personalos-home-view"><div class="view-content" id="target"></div></div><div class="mobile-navbar"></div><script>'+
 js.replaceAll('</script>','<\\/script>')+'</script></body></html>';
}
const browser=await chromium.launch({headless:true});
try{
 for(const [name,width,height] of [['iphone',390,844],['small',360,780],['desktop',1200,850]]){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent(build(width,height),{waitUntil:'load'});
  await page.waitForSelector('.ph-tabs');
  assert.equal(errors.length,0,errors.join('\n'));
  assert.equal(await page.locator('.ph-tab').count(),4);
  assert.equal(await page.locator('.ph-build-tag').innerText(),'v'+manifest.version);
  const geo=await page.evaluate(()=>{const r=q=>document.querySelector(q)?.getBoundingClientRect().toJSON();return {top:r('.ph-topbar'),tabs:r('.ph-tabs'),content:r('.ph-surface'),native:r('.mobile-navbar'),width:document.documentElement.scrollWidth,client:document.documentElement.clientWidth};});
  assert.ok(geo.width<=geo.client+1, name+': horizontal overflow');
  if(width<601){
   assert.ok(geo.tabs.top>=geo.top.bottom-1,name+': tabs must follow header');
   assert.ok(geo.tabs.bottom<=geo.content.top+1,name+': tabs must precede content');
   assert.ok(geo.tabs.bottom<=geo.native.top,name+': tabs overlap native toolbar');
  }
  await page.locator('.ph-tab').filter({hasText:'日记'}).click();
  assert.ok(await page.getByText('历史日记').isVisible());
  await page.locator('.ph-tab').filter({hasText:'资料'}).click();
  assert.ok(await page.getByText('最近笔记').isVisible());
  await page.locator('.ph-tab').filter({hasText:'今天'}).click();
  await page.locator('.ph-surface').evaluate(el=>el.scrollTop=el.scrollHeight);
  const last=await page.evaluate(()=>document.querySelector('.ph-area-tile:last-child').getBoundingClientRect().bottom);
  assert.ok(last<=geo.native.top+1,name+': last tile is obscured');
  await page.screenshot({path:'qa-artifacts/'+name+'.png',fullPage:false});
  console.log('PASS '+name+' '+width+'x'+height);
  await page.close();
 }
}finally{await browser.close();}
