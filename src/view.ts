import { ItemView, Notice, setIcon, TFile, WorkspaceLeaf } from 'obsidian';
import type PersonalOSPlugin from './main';
import { RecordStore, Entry } from './store';
import { Section, displayTitle } from './contract';

export const VIEW_TYPE='personalos-home-view';
type Mode = 'list' | 'capture';
const filters: {id:Section;name:string}[]=[{id:'all',name:'全部'},{id:'capture',name:'收集'},{id:'journal',name:'日记'},{id:'note',name:'笔记'}];
function mk<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, content?:string): HTMLElementTagNameMap[K]{
 const element=document.createElement(tag);element.className=cls;if(content!==undefined)element.textContent=content;return element;
}
function makeButton(text:string,kind:string,onClick:()=>void|Promise<void>,icon?:string){
 const btn=mk('button',kind);btn.type='button';if(icon){const a=mk('span','po-btn-icon');setIcon(a,icon);btn.append(a);}btn.append(mk('span','',text));btn.addEventListener('click',()=>{void onClick();});return btn;
}

export class PersonalOSView extends ItemView {
 private mode:Mode='list';
 private filter:Section='all';
 private query='';
 private searchVersion=0;
 private debounce:number|undefined;
 private editor:HTMLTextAreaElement|null=null;
 private readonly store: RecordStore;
 constructor(leaf:WorkspaceLeaf,private readonly plugin:PersonalOSPlugin){super(leaf);this.store=plugin.store;}
 getViewType(){return VIEW_TYPE;}
 getDisplayText(){return '个人记录';}
 getIcon(){return 'notebook-tabs';}
 async onOpen(){this.contentEl.addClass('personalos-view');this.render();}
 async onClose(){window.clearTimeout(this.debounce);this.searchVersion++;await this.plugin.flushDraft();this.contentEl.removeClass('personalos-view');}

 showCapture(){this.mode='capture';this.render();this.editor?.focus();}
 openList(section:Section='all'){this.mode='list';this.filter=section;this.render();}
 refreshList(){if(this.mode==='list')this.render();}

 private render(){
  const container=this.contentEl;container.replaceChildren();
  const root=mk('div','po-main');container.append(root);
  if(this.mode==='capture')this.renderCapture(root);else this.renderList(root);
 }
 private async readNote(file:TFile){
   // Leave Obsidian in charge of note editing, back navigation and tabs.
   await this.plugin.app.workspace.getLeaf(true).openFile(file);
 }
 private renderList(root:HTMLElement){
  const header=mk('div','po-heading');
  header.append(mk('h1','po-title','记录'));
  const toolbar=mk('div','po-top-actions');
  toolbar.append(makeButton('今日日记','po-btn',async()=>this.openJournal(),'calendar-days'));
  header.append(toolbar);root.append(header);
  const actions=mk('div','po-actions');
  actions.append(makeButton('＋ 记下此刻','po-btn po-btn-primary',()=>this.showCapture()));
  root.append(actions);
  const filtersEl=mk('div','po-filters');filtersEl.setAttribute('role','group');filtersEl.setAttribute('aria-label','记录类型筛选');
  for(const f of filters){
    const active=f.id===this.filter;
    const b=makeButton(f.name,'po-filter'+(active?' is-selected':''),()=>{this.filter=f.id;this.render();});
    b.setAttribute('aria-pressed',String(active));filtersEl.append(b);
  }
  root.append(filtersEl);
  const search=mk('input','po-search');search.type='search';search.value=this.query;search.placeholder='搜索记录标题和内容';search.setAttribute('aria-label','搜索记录');
  root.append(search);
  const results=mk('div','po-results');results.setAttribute('aria-live','polite');root.append(results);
  search.addEventListener('input',()=>{
    this.query=search.value;window.clearTimeout(this.debounce);this.debounce=window.setTimeout(()=>this.updateResults(results),220);
  });
  this.updateResults(results);
 }
 private updateResults(output:HTMLElement){
   const id=++this.searchVersion;
   const query=this.query;
   if(!query.trim()){
     this.renderEntries(output,this.store.entries(this.filter).slice(0,80));return;
   }
   output.replaceChildren(mk('div','po-empty','正在查找…'));
   void this.store.search(query,this.filter,()=>id===this.searchVersion,(found,count)=>{
     if(id!==this.searchVersion)return;
     this.renderEntries(output,found,count);
   });
 }
 private renderEntries(output:HTMLElement,items:Entry[],scanned?:number){
   output.replaceChildren();
   if(!items.length){output.append(mk('p','po-empty',scanned!==undefined?'暂未找到匹配内容':'暂无记录。使用上方按钮开始。'));return;}
   for(const {file,section} of items){
     const b=mk('button','po-item');b.type='button';b.append(mk('span','po-item-title',displayTitle(file.basename,section)));
     const label=section==='journal'?'日记':section==='note'?'笔记':'收集';
     const updated=new Date(file.stat.mtime).toLocaleDateString('zh-CN',{month:'2-digit',day:'2-digit'});
     b.append(mk('span','po-item-meta',`${label} · ${updated}`));
     b.addEventListener('click',()=>{void this.readNote(file);});output.append(b);
   }
   if(items.length===80)output.append(mk('p','po-help','目前显示前 80 条，使用搜索缩小范围。'));
 }
 private renderCapture(root:HTMLElement){
   const header=mk('div','po-heading');header.append(mk('h1','po-title','快速记录'));
   header.append(makeButton('返回记录','po-btn',()=>this.openList(),'arrow-left'));root.append(header);
   const field=mk('textarea','po-editor');field.placeholder='想到什么就写下来，不需要提前分类。';field.rows=8;field.setAttribute('aria-label','快速记录正文');field.value=this.plugin.draft.body;root.append(field);this.editor=field;
   field.addEventListener('input',()=>this.plugin.changeDraft(field.value));
   root.append(mk('p','po-help','未保存内容自动保留在本设备。返回列表后仍可继续编辑。'));
   const actions=mk('div','po-editor-actions');
   actions.append(makeButton('返回（保留草稿）','po-btn',()=>this.openList()));
   const save=makeButton('保存到收集箱','po-btn po-btn-primary',async()=>{
     const body=field.value.trim();if(!body){new Notice('请先填写记录');return;}
     save.disabled=true;
     try{
       const file=await this.store.createCapture(body);
       await this.plugin.resetDraft();
       new Notice('已保存到收集箱');
       this.mode='list';this.filter='all';this.query='';this.render();
       // Do not create an extra tab without the user's intent.
       this.plugin.logger('capture-saved',file.path);
     }catch(e){new Notice('保存失败：'+(e instanceof Error?e.message:'未知错误'));save.disabled=false;}
   },'check');actions.append(save);root.append(actions);
 }
 async openJournal(){
   try{const file=await this.store.openToday();await this.readNote(file);}catch(e){new Notice('打开日记失败：'+String(e));}
 }
}
