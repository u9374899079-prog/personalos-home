'use strict';
/* PersonalOS Home: Obsidian-native view, mobile first. Uses only the vault API.
   No outbound network, Dropbox credentials, Node.js or Electron APIs. */
const {Plugin,ItemView,Modal,Notice,setIcon,TFile,TFolder}=require('obsidian');
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
 constructor(leaf,plugin){super(leaf);this.plugin=plugin;this.section='today';this.ticket=0;this.timer=null;this.composeKind='capture';this.composeBack='today';this.draft={title:'',body:''};}
 getViewType(){return VIEW;}
 getDisplayText(){return 'PersonalOS';}
 getIcon(){return 'layout-dashboard';}
 async onOpen(){this.contentEl.addClass('ph-host');await this.render();this.plugin.queueDiagnostics();}
 async onClose(){clearTimeout(this.timer);this.contentEl.removeClass('ph-host');}
 refresh(){clearTimeout(this.timer);this.timer=setTimeout(()=>{
   if(!this.contentEl.isConnected||this.section==='compose')return;const a=document.activeElement;
   if(a&&this.contentEl.contains(a)&&['INPUT','TEXTAREA'].includes(a.tagName))return;
   this.render();
 },500);}
 async render(){const host=this.contentEl;host.empty();const shell=el('div','ph-shell');host.appendChild(shell);
   const top=el('header','ph-topbar'),brand=el('div','ph-brand');brand.append(el('div','ph-brand-mark','P'),el('span','ph-brand-name','PERSONAL / OS'));
   brand.appendChild(el('span','ph-build-tag','v'+this.plugin.manifest.version));top.appendChild(brand);top.appendChild(this.section==='compose'?btn('返回','arrow-left','ph-top-action',()=>this.leaveCompose()):btn('搜索','search','ph-top-action',()=>this.go('search')));shell.appendChild(top);
   this.surface=el('main','ph-surface');shell.appendChild(this.surface);
   if(this.section==='today')await this.today();
   else if(this.section==='capture')await this.captures();
   else if(this.section==='journal')await this.journal();
   else if(this.section==='library')await this.library();
   else if(this.section==='compose')await this.compose();
   else await this.searchPage();
   const nav=el('nav','ph-tabs');nav.setAttribute('aria-label','主导航');
   for(const [id,name,icon] of SECTIONS){const b=btn(name,icon,'ph-tab'+(id===this.section?' is-active':''),()=>this.go(id));if(id===this.section)b.setAttribute('aria-current','page');nav.appendChild(b);}
   if(this.section==='compose')return;
   shell.appendChild(nav);
   // On iPhone, Obsidian owns the bottom toolbar; our tabs stay above content.
   // Match the same CSS breakpoint so iPad/desktop layouts remain unchanged.
   if(window.matchMedia('(max-width:600px)').matches) shell.insertBefore(nav,this.surface);
 }
 go(id){this.section=id;this.render();}
 title(k,title,subtitle){this.surface.append(el('div','ph-eyebrow',k),el('h1','ph-page-title',title),el('p','ph-page-subtitle',subtitle));}
 header(name,more,section){const a=el('div','ph-section-heading');a.appendChild(el('h2','',name));if(more)a.appendChild(btn(more,'arrow-up-right','ph-text-action',()=>this.go(section)));this.surface.appendChild(a);}
 files(files,empty){const list=el('div','ph-list');this.surface.appendChild(list);if(!files.length){list.appendChild(el('div','ph-empty',empty));return;}
  for(const f of files){const row=btn(f.basename||f.name,'file-text','ph-file-row',()=>this.plugin.openFile(f));row.appendChild(el('small','ph-file-meta',new Intl.DateTimeFormat('zh-CN',{month:'2-digit',day:'2-digit'}).format(new Date(f.stat?.mtime||Date.now()))));list.appendChild(row);}
 }

 openCompose(kind){this.composeKind=kind;this.composeBack=this.section;this.draft={title:'',body:''};this.section='compose';this.render();}
 leaveCompose(){if((this.draft.title||this.draft.body).trim()&&!window.confirm('这段尚未保存的内容将被丢弃，确定返回吗？'))return;this.draft={title:'',body:''};this.go(this.composeBack||'today');}
 async compose(){
   const isNote=this.composeKind==='note';const heading=el('div','ph-compose-top');
   heading.appendChild(btn('返回'+(this.composeBack==='today'?'首页':''),'arrow-left','ph-compose-back',()=>this.leaveCompose()));
   heading.appendChild(el('span','ph-eyebrow',isNote?'NOTE / NEW':'CAPTURE / NEW'));
   this.surface.appendChild(heading);
   this.surface.appendChild(el('h1','ph-page-title',isNote?'新建笔记':'快速记录'));
   this.surface.appendChild(el('p','ph-page-subtitle','编辑完成后保存，页面会自动返回；退出前会提醒未保存内容。'));
   if(isNote){const title=el('input','ph-search-field');title.placeholder='笔记标题';title.setAttribute('aria-label','笔记标题');title.value=this.draft.title;title.addEventListener('input',()=>this.draft.title=title.value);this.surface.appendChild(title);}
   const editor=el('textarea','ph-compose-editor');editor.rows=9;editor.placeholder='此刻有什么想法？';editor.value=this.draft.body;
   editor.setAttribute('aria-label',isNote?'笔记正文':'快速记录正文');editor.addEventListener('input',()=>{this.draft.body=editor.value;});
   this.surface.appendChild(editor);
   const actions=el('div','ph-compose-actions');
   actions.appendChild(btn('取消','x','ph-action ph-action-secondary',()=>this.leaveCompose()));
   const save=btn('保存并返回','check','ph-action ph-action-primary',async()=>{
     if(save.disabled)return;const body=this.draft.body.trim();const title=this.draft.title.trim();
     if(!body&&!(isNote&&title)){new Notice('请先输入内容');return;}
     if(isNote&&!title){new Notice('请输入笔记标题');return;}
     save.disabled=true;
     try{if(isNote)await this.plugin.createNote(title,body);else await this.plugin.createCapture(body);
       this.draft={title:'',body:''};new Notice('保存成功');this.go(this.composeBack||'today');this.plugin.refreshViews();
     }catch(e){save.disabled=false;new Notice('保存失败：'+(e.message||'未知错误'));}
   });actions.appendChild(save);this.surface.appendChild(actions);
 }
 async today(){const hero=el('section','ph-hero');hero.append(el('div','ph-eyebrow',new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'long'}).format(new Date())),el('h1','ph-headline','把重要的事，留在今天。'),el('p','ph-lead','一处记录日常，安静整理生活。'));this.surface.appendChild(hero);
  const acts=el('div','ph-actions-panel');acts.append(btn('快速记录','plus','ph-action ph-action-primary',()=>this.openCompose('capture')),btn('写今日日记','book-open','ph-action ph-action-secondary',()=>this.plugin.openToday()));this.surface.appendChild(acts);
  const stats=el('div','ph-summary-row');for(const [a,b] of [['今天',day()],['记录数',String(this.plugin.captures().length)],['日记篇数',String(this.plugin.journals().length)]]){const item=el('div','ph-meta');item.append(el('span','ph-meta-label',a),el('span','ph-meta-value',b));stats.appendChild(item);}this.surface.appendChild(stats);
  this.header('最近记录','继续阅读','capture');this.files(this.plugin.recent().slice(0,5),'还没有记录，从「快速记录」开始。');
  const part=el('section','ph-mini-section');part.appendChild(el('h2','ph-mini-title','我的空间'));const tiles=el('div','ph-area-grid');for(const [name,path,icon] of AREAS)tiles.appendChild(btn(name,icon,'ph-area-tile',()=>this.plugin.openArea(path)));part.appendChild(tiles);this.surface.appendChild(part);
 }
 async captures(){this.title('CAPTURE / INBOX','收集','想到什么，先记下来。');this.surface.appendChild(btn('记录一条想法','plus','ph-action ph-action-primary ph-full',()=>this.openCompose('capture')));this.header('最近的想法');this.files(this.plugin.captures().slice(0,80),'收集箱目前是空的。');}
 async journal(){this.title('DAILY / JOURNAL','日记','每天一点，回头看见生活的轨迹。');this.surface.appendChild(btn('打开今天的日记','calendar-plus','ph-action ph-action-primary ph-full',()=>this.plugin.openToday()));this.header('历史日记');this.files(this.plugin.journals().slice(0,90),'还没有日记，今天就可以开始。');}
 async library(){this.title('LIBRARY / LIFE','资料','个人生活、工作、资产与长期知识。');this.surface.appendChild(btn('写一篇新笔记','file-plus','ph-action ph-action-primary ph-full',()=>this.openCompose('note')));const tiles=el('div','ph-library-grid');for(const [name,path,icon] of AREAS)tiles.appendChild(btn(name,icon,'ph-library-tile',()=>this.plugin.openArea(path)));this.surface.appendChild(tiles);this.header('最近笔记');this.files(this.plugin.notes().slice(0,70),'还没有独立笔记。');}
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
   this.addCommand({id:'quick-capture',name:'快速记录',callback:()=>this.openComposer('capture')});
   this.addCommand({id:'open-today',name:'打开今日日记',callback:()=>this.openToday()});
   this.addCommand({id:'new-note',name:'新建笔记',callback:()=>this.openComposer('note')});
   this.addCommand({id:'ui-diagnostics',name:'界面诊断（复制设备布局信息）',callback:()=>this.showLayoutDiagnostics()});
   this.addCommand({id:'reset-old-vault',name:'一次性清理旧版文件与文件夹（保留插件与同步设置）',callback:()=>this.offerLegacyCleanup()});
   for(const ev of ['create','modify','delete','rename'])this.registerEvent(this.app.vault.on(ev,(file)=>{if(!this._cleaning&&!file?.path?.startsWith('90 系统/界面诊断-'))this.refreshViews();}));
   this.app.workspace.onLayoutReady(()=>this.show());
 }



 offerLegacyCleanup(){
  const files=this.app.vault.getAllLoadedFiles();
  const protectedPath=(p)=>p==='.obsidian'||p.startsWith('.obsidian/')||p.startsWith('90 系统/界面诊断-');
  const targets=files.filter(f=>f instanceof TFile&&!protectedPath(f.path));
  const m=new Modal(this.app);
  m.titleEl.setText('一次性清理旧版笔记库');
  const panel=m.contentEl;panel.appendChild(el('p','', '发现 '+targets.length+' 个内容文件。此操作只在当前本地笔记库执行，并通过 Obsidian 自身回收站处理文件；不清理或重置 .obsidian 插件、BRAT 和 Dropbox 授权。'));
  panel.appendChild(el('p','', '注意：如果 Remotely Save 仍指向旧的远程文件夹，同步可能把旧文件再次下载回来。清理前应先停止旧路径同步，并确认所有设备使用同一个新目录。'));
  const action=el('div','ph-modal-actions');
  action.appendChild(btn('暂不清理',null,'ph-button ph-button-subtle',()=>m.close()));
  const confirm=btn('确定清理当前库','trash-2','ph-button ph-button-primary',async()=>{
   confirm.disabled=true;
   let gone=0,failed=0;this._cleaning=true;
   try{
    for(const f of targets){try{await this.app.fileManager.trashFile(f);gone++;}catch(e){failed++;}}
    const keep=new Set(['00 首页','01 收集','01 收集/记录','10 日记','20 笔记','30 个人生活','40 工作相关','50 资产管理','90 系统']);
    const folders=this.app.vault.getAllLoadedFiles().filter(f=>f instanceof TFolder&&!protectedPath(f.path)&&f.path!=='/'&&!keep.has(f.path)).sort((a,b)=>b.path.length-a.path.length);
    for(const folder of folders){if(folder.children?.length===0){try{await this.app.vault.delete(folder);}catch(e){}}}
    for(const dir of keep){await this.ensure(dir);}
   }finally{this._cleaning=false;this.refreshViews();m.close();}
   new Notice('清理完成：'+gone+' 个文件移入回收站；失败 '+failed+' 个。');
  });action.appendChild(confirm);panel.appendChild(action);
  m.open();
 }
 async openComposer(kind){await this.show();const leaf=this.app.workspace.getLeavesOfType(VIEW)[0];if(leaf?.view?.openCompose)leaf.view.openCompose(kind);}
 queueDiagnostics(){clearTimeout(this._diagTimer);this._diagTimer=setTimeout(()=>this.writeDiagnostics().catch(()=>{}),1500);}
 async writeDiagnostics(){
   // Privacy-safe geometry only: no note names, note bodies, Dropbox authorization or user identifiers.
   const leaf=this.app.workspace.getLeavesOfType(VIEW)[0],view=leaf?.view;
   if(!view?.contentEl?.isConnected)return;
   const rect=(selector,scope=document)=>{const x=scope.querySelector(selector);if(!x)return null;const r=x.getBoundingClientRect();return {top:Math.round(r.top),bottom:Math.round(r.bottom),width:Math.round(r.width),height:Math.round(r.height)};};
   const scope=view.contentEl;
   const data={version:this.manifest.version,utc:new Date().toISOString(),viewport:{width:window.innerWidth,height:window.innerHeight,visualHeight:Math.round(window.visualViewport?.height||window.innerHeight)},
     safeAreaTopCSS:getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-top').trim(),
     activeView:rect('.workspace-leaf-content[data-type="personalos-home-view"]'),
     pluginShell:rect('.ph-shell',scope),pluginHeader:rect('.ph-topbar',scope),
     personalNavigation:rect('.ph-tabs',scope),content:rect('.ph-surface',scope),
     obsidianBottomBar:rect('.mobile-navbar'),obsidianViewHeader:rect('.view-header')};
   const type=this.app.isMobile?'移动端':'桌面端';
   const path='90 系统/界面诊断-'+type+'.md';
   await this.ensure('90 系统');
   const text='# PersonalOS 布局诊断 '+type+'\n\n此文件由 PersonalOS 自动生成，仅包含窗口尺寸和界面位置，不含笔记正文或同步凭据。\n\n~~~json\n'+JSON.stringify(data,null,2)+'\n~~~\n';
   const file=this.app.vault.getAbstractFileByPath(path);
   if(file instanceof TFile)await this.app.vault.modify(file,text);else await this.app.vault.create(path,text);
 }
 async showLayoutDiagnostics(){
   const leaf=this.app.workspace.getLeavesOfType(VIEW)[0],view=leaf?.view;
   const rect=(node)=>{if(!node)return null;const r=node.getBoundingClientRect();return {top:Math.round(r.top),bottom:Math.round(r.bottom),height:Math.round(r.height),width:Math.round(r.width)};};
   const loaded=this.app.vault.getAllLoadedFiles();
   const details={version:this.manifest.version,localVault:this.app.vault.getName(),markdownFiles:this.app.vault.getMarkdownFiles().length,
     folders:loaded.filter(f=>Array.isArray(f.children)).length,
     viewport:{width:window.innerWidth,height:window.innerHeight,visualHeight:Math.round(window.visualViewport?.height||window.innerHeight)},
     pluginHeader:rect(view?.contentEl?.querySelector('.ph-topbar')),
     pluginNavigation:rect(view?.contentEl?.querySelector('.ph-tabs')),
     contentArea:rect(view?.contentEl?.querySelector('.ph-surface')),
     obsidianBottomNavigation:rect(document.querySelector('.mobile-navbar')),
     obsidianTopBar:rect(document.querySelector('.view-header'))};
   const modal=new Modal(this.app);modal.titleEl.setText('PersonalOS 界面诊断');
   modal.contentEl.appendChild(el('p','', '仅包含屏幕布局、库名和文件数量，不读取笔记正文与同步凭据。'));
   const t=el('textarea','ph-modal-textarea');t.readOnly=true;t.rows=12;t.value=JSON.stringify(details,null,2);modal.contentEl.appendChild(t);
   modal.contentEl.appendChild(btn('复制诊断信息','copy','ph-button ph-button-primary',async()=>{try{await navigator.clipboard.writeText(t.value);new Notice('诊断信息已复制，可以粘贴到 ChatGPT');}catch{t.focus();t.select();new Notice('请长按选择并复制文本');}}));
   modal.open();
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
 async openFile(file){let leaf=this.editLeaf;if(!leaf||!leaf.parent)leaf=this.app.workspace.getLeaf(true);this.editLeaf=leaf;await leaf.openFile(file);await this.app.workspace.revealLeaf(leaf);}
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
