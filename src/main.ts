import { Plugin, Notice, PluginSettingTab, Setting } from 'obsidian';
import { RecordStore } from './store';
import { PersonalOSView, VIEW_TYPE } from './view';
import type { Draft } from './contract';

type SettingsData={openOnStartup:boolean;draft:Draft};
const defaults:SettingsData={openOnStartup:false,draft:{body:'',updatedAt:0}};
export default class PersonalOSPlugin extends Plugin{
  store!:RecordStore;
  draft:Draft={body:'',updatedAt:0};
  private options:SettingsData={...defaults,draft:{...defaults.draft}};
  private draftTimer:number|undefined;
  private draftVersion=0;
  private refreshTimer:number|undefined;
  async onload(){
    const config=await this.loadData() as Partial<SettingsData>|null;
    this.options={...defaults,...config,draft:{...defaults.draft,...config?.draft}};
    this.draft={...this.options.draft};
    this.store=new RecordStore(this.app);
    this.registerView(VIEW_TYPE,leaf=>new PersonalOSView(leaf,this));
    this.addRibbonIcon('notebook-tabs','PersonalOS 记录',()=>{void this.openHome();});
    this.addCommand({id:'open-home',name:'打开记录列表',callback:()=>{void this.openHome();}});
    this.addCommand({id:'quick-capture',name:'快速记录（保留草稿）',callback:()=>{void this.openCapture();}});
    this.addCommand({id:'today-journal',name:'打开今日原生日记',callback:async()=>{
      try{await this.app.workspace.getLeaf(true).openFile(await this.store.openToday());}
      catch(e){new Notice('打开日记失败：'+String(e));}
    }});
    this.registerEvent(this.app.vault.on('create',()=>this.scheduleRefresh()));
    this.registerEvent(this.app.vault.on('delete',()=>this.scheduleRefresh()));
    this.registerEvent(this.app.vault.on('rename',()=>this.scheduleRefresh()));
    this.registerEvent(this.app.vault.on('modify',()=>this.scheduleRefresh()));
    this.addSettingTab(new PersonalSettings(this));
    if(this.options.openOnStartup)this.app.workspace.onLayoutReady(()=>{void this.openHome();});
  }
  onunload(){window.clearTimeout(this.refreshTimer);window.clearTimeout(this.draftTimer);void this.flushDraft();this.app.workspace.detachLeavesOfType(VIEW_TYPE);}
  logger(_event:string,_path:string){ /* no remote telemetry, no personal content logging */ }
  private scheduleRefresh(){window.clearTimeout(this.refreshTimer);this.refreshTimer=window.setTimeout(()=>this.refreshHome(),350);}
  private refreshHome(){for(const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)){(leaf.view as PersonalOSView).refreshList();}}
  async openHome():Promise<PersonalOSView>{
    const leaves=this.app.workspace.getLeavesOfType(VIEW_TYPE);
    const leaf=leaves[0]||this.app.workspace.getLeaf(true);
    if(!leaves.length)await leaf.setViewState({type:VIEW_TYPE,active:true});
    await this.app.workspace.revealLeaf(leaf);
    return leaf.view as PersonalOSView;
  }
  async openCapture(){(await this.openHome()).showCapture();}
  changeDraft(body:string){this.draft={body,updatedAt:Date.now()};this.draftVersion++;window.clearTimeout(this.draftTimer);this.draftTimer=window.setTimeout(()=>{void this.flushDraft();},180);}
  async flushDraft(){window.clearTimeout(this.draftTimer);const version=this.draftVersion;
    this.options.draft={...this.draft};await this.saveData(this.options);
    // Any later edits get their own scheduled write; no asynchronous old state overwrite.
    if(this.draftVersion!==version)this.draftTimer=window.setTimeout(()=>{void this.flushDraft();},100);
  }
  async resetDraft(){this.draft={body:'',updatedAt:0};this.draftVersion++;await this.flushDraft();}
  setStartup(enabled:boolean){this.options.openOnStartup=enabled;void this.saveData(this.options);}
  startupEnabled(){return this.options.openOnStartup;}
}
class PersonalSettings extends PluginSettingTab{
  constructor(private readonly personal:PersonalOSPlugin){super(personal.app,personal);}
  display(){this.containerEl.empty();
    new Setting(this.containerEl).setName('启动时打开记录').setDesc('默认关闭，不打断未完成的笔记编辑。').addToggle(t=>t.setValue(this.personal.startupEnabled()).onChange(v=>this.personal.setStartup(v)));
    new Setting(this.containerEl).setName('恢复未保存草稿').setDesc('草稿仅保存在本设备的插件设置中，不自动上传到 GitHub。').addButton(b=>b.setButtonText('打开草稿').onClick(()=>this.personal.openCapture()));
  }
}
