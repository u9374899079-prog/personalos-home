'use strict';
/* PersonalOS Home: Obsidian-native view, mobile first. Uses only the vault API.
   No outbound network, Dropbox credentials, Node.js or Electron APIs. */
const {Plugin,ItemView,Modal,Notice,setIcon,TFile}=require('obsidian');
const VIEW='personalos-home-view';
const DIR={capture:'01 收集/记录',journal:'10 日记',notes:'20 笔记'};
const SECTIONS=[['today','今天','house'],['capture','收集','inbox'],['journal','日记','calendar-days'],['library','资料','library']];
const AREAS=[['个人生活','30 个人生活','heart'],['工作相关','40 工作相关','briefcase-business'],['资产管理','50 资产管理','wallet']];
function day(d){d=d||new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function hm(d){d=d||new Date();return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');}
function safe(s){return String(s||'记录').replace(/[\\/:*?"<>|\x00-\x1f]/g,' ').replace(/\s+/g,' ').trim().slice(0,48)||'记录';}
function el(tag,cls,text){const a=document.createElement(tag);if(cls)a.className=cls;if(text!==undefined)a.textContent=text;return a;}
function btn(label,icon,cls,callback){const a=el('button',cls||'ph-action');a.type='button';if(icon){const v=el('span','ph-icon');setIcon(v,icon);a.appendChild(v);}a.appendChild(el('span','',label));a.addEventListener('click',callback);return a;}
class EntryModal extends Modal{
 constructor(app,plugin,kind){super(app);this.plugin=plugin;this.kind=kind;this.saving=false;}
 onOpen(){const root=this.contentEl;root.empty();root.addClass('ph-modal');
  root.appendChild(el('div','ph-modal-kicker',this.kind==='note'?'KNOWLEDGE / NOTE':'CAPTURE / QUICK'));
  root.appendChild(el('h2','ph-modal-title',this.kind==='note'?'写一篇笔记':'留下此刻的想法'));
  if(this.kind==='note'){this.title=el('input','ph-modal-input');this.title.placeholder='笔记标题';this.title.setAttribute('aria-label','笔记标题');root.appendChild(this.title);}
  this.body=el('textarea','ph-modal-textarea');this.body.placeholder='写下你想记录的内容…';this.body.rows=7;root.appendChild(this.body);
  const foot=el('div','ph-modal-actions');foot.appendChild(btn('取消',null,'ph-button ph-button-subtle',()=>this.close()));
  const save=btn('保存记录','check','ph-button ph-button-primary',async()=>{
   if(this.saving)return;const content=this.body.value.trim();const title=this.kind==='note'?this.title.value.trim():'';
   if(!content&&!title){new Notice('请先输入内容');return;}if(this.kind==='note'&&!title){new Notice('请输入标题');return;}
   this.saving=true;save.disabled=true;
   try{if(this.kind==='note')await this.plugin.createNote(title,content);else await this.plugin.createCapture(content);
    new Notice('记录已保存');this.close();this.plugin.refreshViews();
   }catch(e){new Notice('保存失败：'+(e.message||'未知错误'));this.saving=false;save.disabled=false;}
  });foot.appendChild(save);root.appendChild(foot);
  setTimeout(()=>{if(this.title)this.title.focus();else this.body.focus();},50);
 }
 onClose(){this.contentEl.empty();}
}
class PersonalView extends ItemView{
 constructor(leaf,plugin){super(leaf);this.plugin=plugin;this.section='today';this.ticket=0;this.timer=null;}
 getViewType(){return VIEW;}
 getDisplayText(){return 'PersonalOS';}
 getIcon(){return 'layout-dashboard';}
 async onOpen(){this.contentEl.addClass('ph-host');await this.render();}
 async onClose(){clearTimeout(this.timer);this.contentEl.removeClass('ph-host');}
 refresh(){clearTimeout(this.timer);this.timer=setTimeout(()=>{
   if(!this.contentEl.isConnected)return;const a=document.activeElement;
   if(a&&this.contentEl.contains(a)&&['INPUT','TEXTAREA'].includes(a.tagName))return;
   this.render();
 },500);}
 async render(){const host=this.contentEl;host.empty();const shell=el('div','ph-shell');host.appendChild(shell);
   const top=el('header','ph-topbar'),brand=el('div','ph-brand');brand.append(el('div','ph-brand-mark','P'),el('span','ph-brand-name','PERSONAL / OS'));
   brand.appendChild(el('span','ph-build-tag','v'+this.plugin.manifest.version));top.appendChild(brand);top.appendChild(btn('搜索','search','ph-top-action',()=>this.go('search')));shell.appendChild(top);
   this.surface=el('main','ph-surface');shell.appendChild(this.surface);
   if(this.section==='today')await this.today();
   else if(this.section==='capture')await this.captures();
   else if(this.section==='journal')await this.journal();
   else if(this.section==='library')await this.library();
   else await this.searchPage();
   const nav=el('nav','ph-tabs');nav.setAttribute('aria-label','主导航');
   for(const [id,name,icon] of SECTIONS){const b=btn(name,icon,'ph-tab'+(id===this.section?' is-active':''),()=>this.go(id));if(id===this.section)b.setAttribute('aria-current','page');nav.appendChild(b);}
   shell.appendChild(nav);
 }
 go(id){this.section=id;this.render();}
 title(k,title,subtitle){this.surface.append(el('div','ph-eyebrow',k),el('h1','ph-page-title',title),el('p','ph-page-subtitle',subtitle));}
 header(name,more,section){const a=el('div','ph-section-heading');a.appendChild(el('h2','',name));if(more)a.appendChild(btn(more,'arrow-up-right','ph-text-action',()=>this.go(section)));this.surface.appendChild(a);}
 files(files,empty){const list=el('div','ph-list');this.surface.appendChild(list);if(!files.length){list.appendChild(el('div','ph-empty',empty));return;}
  for(const f of files){const row=btn(f.basename||f.name,'file-text','ph-file-row',()=>this.plugin.openFile(f));row.appendChild(el('small','ph-file-meta',new Intl.DateTimeFormat('zh-CN',{month:'2-digit',day:'2-digit'}).format(new Date(f.stat?.mtime||Date.now()))));list.appendChild(row);}
 }
 async today(){const hero=el('section','ph-hero');hero.append(el('div','ph-eyebrow',new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'long'}).format(new Date())),el('h1','ph-headline','把重要的事，留在今天。'),el('p','ph-lead','一处记录日常，安静整理生活。'));this.surface.appendChild(hero);
  const acts=el('div','ph-actions-panel');acts.append(btn('快速记录','plus','ph-action ph-action-primary',()=>new EntryModal(this.app,this.plugin,'capture').open()),btn('写今日日记','book-open','ph-action ph-action-secondary',()=>this.plugin.openToday()));this.surface.appendChild(acts);
  const stats=el('div','ph-summary-row');for(const [a,b] of [['今天',day()],['记录数',String(this.plugin.captures().length)],['日记篇数',String(this.plugin.journals().length)]]){const item=el('div','ph-meta');item.append(el('span','ph-meta-label',a),el('span','ph-meta-value',b));stats.appendChild(item);}this.surface.appendChild(stats);
  this.header('最近记录','继续阅读','capture');this.files(this.plugin.recent().slice(0,5),'还没有记录，从「快速记录」开始。');
  const part=el('section','ph-mini-section');part.appendChild(el('h2','ph-mini-title','我的空间'));const tiles=el('div','ph-area-grid');for(const [name,path,icon] of AREAS)tiles.appendChild(btn(name,icon,'ph-area-tile',()=>this.plugin.openArea(path)));part.appendChild(tiles);this.surface.appendChild(part);
 }
 async captures(){this.title('CAPTURE / INBOX','收集','想到什么，先记下来。');this.surface.appendChild(btn('记录一条想法','plus','ph-action ph-action-primary ph-full',()=>new EntryModal(this.app,this.plugin,'capture').open()));this.header('最近的想法');this.files(this.plugin.captures().slice(0,80),'收集箱目前是空的。');}
 async journal(){this.title('DAILY / JOURNAL','日记','每天一点，回头看见生活的轨迹。');this.surface.appendChild(btn('打开今天的日记','calendar-plus','ph-action ph-action-primary ph-full',()=>this.plugin.openToday()));this.header('历史日记');this.files(this.plugin.journals().slice(0,90),'还没有日记，今天就可以开始。');}
 async library(){this.title('LIBRARY / LIFE','资料','个人生活、工作、资产与长期知识。');this.surface.appendChild(btn('写一篇新笔记','file-plus','ph-action ph-action-primary ph-full',()=>new EntryModal(this.app,this.plugin,'note').open()));const tiles=el('div','ph-library-grid');for(const [name,path,icon] of AREAS)tiles.appendChild(btn(name,icon,'ph-library-tile',()=>this.plugin.openArea(path)));this.surface.appendChild(tiles);this.header('最近笔记');this.files(this.plugin.notes().slice(0,70),'还没有独立笔记。');}
 async searchPage(){this.title('FIND / SEARCH','搜索','查找自己的笔记与记录。');const input=el('input','ph-search-field');input.type='search';input.placeholder='搜索标题、内容或关键词';this.surface.appendChild(input);const results=el('div','ph-search-results');results.appendChild(el('div','ph-empty','输入关键词开始搜索。'));this.surface.appendChild(results);let timeout=0;input.addEventListener('input',()=>{clearTimeout(timeout);timeout=setTimeout(()=>this.performSearch(input.value,results),240);});setTimeout(()=>input.focus(),60);}
 async performSearch(value,box){const ticket=++this.ticket,query=value.trim().toLocaleLowerCase();box.empty();if(!query){box.appendChild(el('div','ph-empty','输入关键词开始搜索。'));return;}
  const hits=[];for(const f of this.app.vault.getMarkdownFiles()){if(ticket!==this.ticket)return;if(f.path.startsWith('90 系统/')||f.path.startsWith('00 首页/'))continue;
   if(f.basename.toLocaleLowerCase().includes(query))hits.push(f);else{try{const body=await this.app.vault.cachedRead(f);if(body.toLocaleLowerCase().includes(query))hits.push(f);}catch(e){}}
   if(hits.length>=40)break;
  }
  if(ticket!==this.ticket)return;if(!hits.length){box.appendChild(el('div','ph-empty','未找到相关记录。'));return;}
  for(const f of hits)box.appendChild(btn(f.basename,'file-text','ph-file-row',()=>this.plugin.openFile(f)));
 }
}
module.exports=class PersonalOSHome extends Plugin{
 async onload(){this.registerView(VIEW,leaf=>new PersonalView(leaf,this));this.addRibbonIcon('layout-dashboard','PersonalOS 首页',()=>this.show());
   this.addCommand({id:'open-personal-home',name:'打开 PersonalOS',callback:()=>this.show()});
   this.addCommand({id:'quick-capture',name:'快速记录',callback:()=>new EntryModal(this.app,this,'capture').open()});
   this.addCommand({id:'open-today',name:'打开今日日记',callback:()=>this.openToday()});
   this.addCommand({id:'new-note',name:'新建笔记',callback:()=>new EntryModal(this.app,this,'note').open()});
   for(const ev of ['create','modify','delete','rename'])this.registerEvent(this.app.vault.on(ev,()=>this.refreshViews()));
   this.app.workspace.onLayoutReady(()=>this.show());
 }
 onunload(){this.app.workspace.detachLeavesOfType(VIEW);}
 async show(){let leaves=this.app.workspace.getLeavesOfType(VIEW);let leaf=leaves[0]||this.app.workspace.getLeaf(true);if(!leaves.length)await leaf.setViewState({type:VIEW,active:true});await this.app.workspace.revealLeaf(leaf);}
 refreshViews(){for(const leaf of this.app.workspace.getLeavesOfType(VIEW))if(leaf.view&&leaf.view.refresh)leaf.view.refresh();}
 md(){return this.app.vault.getMarkdownFiles();}
 captures(){return this.md().filter(x=>x.path.startsWith(DIR.capture+'/')).sort((a,b)=>b.stat.mtime-a.stat.mtime);}
 journals(){return this.md().filter(x=>/^10 日记\/\d{4}-\d{2}-\d{2}\.md$/.test(x.path)).sort((a,b)=>b.basename.localeCompare(a.basename));}
 notes(){return this.md().filter(x=>x.path.startsWith(DIR.notes+'/')).sort((a,b)=>b.stat.mtime-a.stat.mtime);}
 recent(){return [...this.captures(),...this.journals(),...this.notes()].sort((a,b)=>b.stat.mtime-a.stat.mtime);}
 async ensure(path){let n='';for(const p of path.split('/')){n=n?n+'/'+p:p;if(!this.app.vault.getAbstractFileByPath(n))await this.app.vault.createFolder(n);}}
 async openFile(file){await this.app.workspace.getLeaf(true).openFile(file);}
 async openArea(folder){await this.ensure(folder);const path=folder+'/说明.md';let f=this.app.vault.getAbstractFileByPath(path);if(!(f instanceof TFile)){try{f=await this.app.vault.create(path,'# '+folder.split('/').at(-1)+'\n\n在这里整理相关资料。\n');}catch(e){f=this.app.vault.getAbstractFileByPath(path);if(!(f instanceof TFile))throw e;}}await this.openFile(f);}
 async openToday(){await this.ensure(DIR.journal);const date=day(),path=DIR.journal+'/'+date+'.md';let f=this.app.vault.getAbstractFileByPath(path);if(!(f instanceof TFile)){
   const contents='---\ntype: daily\ndate: '+date+'\ntags: [daily]\n---\n# '+date+'\n\n## 今天发生了什么\n\n## 一件重要的事\n\n## 明天\n';
   try{f=await this.app.vault.create(path,contents);}catch(e){f=this.app.vault.getAbstractFileByPath(path);if(!(f instanceof TFile))throw e;}
  }await this.openFile(f);}
 async createCapture(body){await this.ensure(DIR.capture);const now=new Date(),heading=body.split(/\r?\n/)[0].trim().slice(0,32)||'速记',suffix=String(now.getMilliseconds()).padStart(3,'0')+'-'+Math.floor(Math.random()*9000+1000);
   const name=day(now)+'-'+hm(now).replace(':','')+'-'+suffix+'-'+safe(heading)+'.md';
   return this.app.vault.create(DIR.capture+'/'+name,'---\ntype: capture\ncreated: '+day(now)+' '+hm(now)+'\n---\n# '+heading.replace(/^#+\s*/,'')+'\n\n'+body+'\n');}
 async createNote(title,body){await this.ensure(DIR.notes);const n=safe(title);let path=DIR.notes+'/'+n+'.md',i=2;while(this.app.vault.getAbstractFileByPath(path)){path=DIR.notes+'/'+n+'-'+i+'.md';i++;}
  return this.app.vault.create(path,'---\ntype: note\ncreated: '+day()+' '+hm()+'\n---\n# '+title.replace(/\n/g,' ')+'\n\n'+body+'\n');}
};
