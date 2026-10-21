/**
 * PersonalOS v3.3 integration contract tests.
 * No real Obsidian vault, Dropbox, or installation writes are permitted.
 * The command IDs were checked against upstream plugin sources.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('main.js','utf8');
const manifest=JSON.parse(fs.readFileSync('manifest.json','utf8'));
assert.equal(manifest.version,'3.3.0');
assert.match(source,/notebook-navigator:open/);
assert.match(source,/quickadd:runQuickAdd/);
assert.match(source,/omnisearch:show-modal/);
assert.match(source,/tasknotes:open-tasks-view/);
assert.ok(!source.includes('npm install'),'Never silently install plugins');
const entries=[
 ['notebook-navigator','notebook-navigator:open'],
 ['quickadd','quickadd:runQuickAdd'],
 ['omnisearch','omnisearch:show-modal'],
 ['tasknotes','tasknotes:open-tasks-view']
];
const observed={commands:[],views:[],composer:[],notices:[],writes:0};
const commands={};
const app={
 commands:{
   commands,
   executeCommandById(id){observed.commands.push(id);return true;}
 },
 plugins:{enabledPlugins:new Set()},
 workspace:{getLeavesOfType:()=>[{view:{go:id=>observed.views.push(id)}}]},
 vault:{
   create:()=>{observed.writes++;throw Error('Unexpected vault write')},
   modify:()=>{observed.writes++;throw Error('Unexpected vault write')},
   delete:()=>{observed.writes++;throw Error('Unexpected vault delete')}
 }
};
class Plugin{constructor(){this.app=app;this.manifest=manifest;}}
class Notice{constructor(msg){observed.notices.push(msg);}}
const exportsModule={exports:{}};
vm.runInNewContext(source,{
 module:exportsModule,
 require(name){
   assert.equal(name,'obsidian');
   return {Plugin,ItemView:class{},Modal:class{},Notice,setIcon(){},TFile:class{},TFolder:class{},Platform:{isMobile:false}};
 },
 window:{}
},{filename:'main.js',timeout:4000});
const instance=new exportsModule.exports();
instance.openComposer=async kind=>observed.composer.push(kind);
instance.show=async()=>{};
assert.equal(instance.isIntegrationEnabled('unknown'),false);
// All four upstream commands execute when registered.
for(const [id,command] of entries){
 commands[command]={id:command};app.plugins.enabledPlugins.add(id);
 assert.equal(instance.isIntegrationEnabled(id),true);
 assert.equal(await instance.launchIntegration(id),true);
}
assert.deepEqual(observed.commands,entries.map(x=>x[1]));
console.log('PASS 4/4 upstream commands invoked');
// Missing integrations safely fall back, without touching the vault.
for(const key of Object.keys(commands))delete commands[key];
app.plugins.enabledPlugins.clear();
assert.equal(await instance.launchIntegration('quickadd'),false);
assert.deepEqual(observed.composer,['capture']);
assert.equal(await instance.launchIntegration('notebook-navigator'),false);
assert.equal(await instance.launchIntegration('omnisearch'),false);
assert.deepEqual(observed.views,['library','search']);
assert.equal(await instance.launchIntegration('tasknotes'),false);
assert.ok(observed.notices.some(x=>x.includes('TaskNotes')));
assert.equal(observed.writes,0);
console.log('PASS 4/4 missing-plugin fallbacks');
console.log('PASS no automatic installation, destructive change or Dropbox access');
