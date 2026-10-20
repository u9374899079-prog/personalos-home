import { App, TFile, TFolder, Vault } from 'obsidian';
import { captureMarkdown, classify, journalMarkdown, journalPath, PATHS, safeStamp, Section, titleOf, searchName } from './contract';

export type Entry = { file: TFile; section: Exclude<Section, 'all'> };

/** Vault-only operations. No Dropbox API, no network, no global plugin state. */
export class RecordStore {
  constructor(private readonly app: App) {}

  entries(section: Section = 'all'): Entry[] {
    return this.app.vault.getMarkdownFiles()
      .map(file => ({file, section: classify(file.path)}))
      .filter((item): item is Entry => item.section !== null && (section === 'all' || item.section === section))
      .sort((a,b) => b.file.stat.mtime - a.file.stat.mtime);
  }

  async search(term: string, section: Section, shouldContinue: () => boolean, onBatch: (files: Entry[], scanned: number) => void): Promise<void> {
    const needle = term.trim().toLocaleLowerCase();
    const matching: Entry[] = [];
    const entries = this.entries(section);
    if (!needle) { onBatch(entries.slice(0, 80), entries.length); return; }
    for (let i = 0; i < entries.length; i += 12) {
      if(!shouldContinue())return;
      const chunk=entries.slice(i,i+12);
      const found=await Promise.all(chunk.map(async item => {
        if(searchName(item.file.basename,needle))return item;
        try {return (await this.app.vault.cachedRead(item.file)).toLocaleLowerCase().includes(needle) ? item : null;}
        catch {return null;}
      }));
      for(const match of found)if(match)matching.push(match);
      onBatch(matching.slice(0,80),Math.min(i+12,entries.length));
      if(matching.length>=80) return;
      // Yield on large vaults rather than blocking input / rendering for seconds.
      if(i % 96 === 0) await new Promise<void>(resolve => window.setTimeout(resolve,0));
    }
  }

  async ensureDir(directory: string): Promise<void> {
    let current='';
    for(const part of directory.split('/')) {
      current = current ? current+'/'+part : part;
      const found=this.app.vault.getAbstractFileByPath(current);
      if(!found) {try{await this.app.vault.createFolder(current);}catch(e){
        if(!(this.app.vault.getAbstractFileByPath(current) instanceof TFolder))throw e;
      }}
      else if(!(found instanceof TFolder))throw new Error('同名路径不是文件夹：'+current);
    }
  }

  async createCapture(body: string, now: Date = new Date()): Promise<TFile> {
    const trimmed=body.trim(); if(!trimmed)throw new Error('记录不能为空');
    await this.ensureDir(PATHS.capture);
    const title=titleOf(trimmed);
    const encoded=title.slice(0,18);
    // Retry on a collision: never use overwrite/modify for a new capture.
    for(let attempt=0;attempt<8;attempt++){
      const random=Math.random().toString(36).slice(2,10);
      const dest=`${PATHS.capture}/${safeStamp(now)}-${random}-${encoded}.md`;
      if(this.app.vault.getAbstractFileByPath(dest))continue;
      try{return await this.app.vault.create(dest,captureMarkdown(trimmed,now));}catch(err){
        if(this.app.vault.getAbstractFileByPath(dest))continue;
        throw err;
      }
    }
    throw new Error('无法生成唯一的记录名称');
  }

  async openToday(now:Date=new Date()): Promise<TFile> {
    await this.ensureDir(PATHS.journal);
    const dest=journalPath(now);
    const existing=this.app.vault.getAbstractFileByPath(dest);
    if(existing instanceof TFile)return existing;
    if(existing)throw new Error('今日日记路径被文件夹占用');
    try{return await this.app.vault.create(dest,journalMarkdown(now));}
    catch(err){
      const concurrent=this.app.vault.getAbstractFileByPath(dest);
      if(concurrent instanceof TFile)return concurrent; // concurrent device/session created it first
      throw err;
    }
  }

  async createNote(title:string,body:string):Promise<TFile>{
    const headline=titleOf(title);
    await this.ensureDir(PATHS.note);
    for(let attempt=0;attempt<200;attempt++){
      const name=attempt?`${headline}-${attempt+1}.md`:`${headline}.md`;
      const dest=`${PATHS.note}/${name}`;
      if(this.app.vault.getAbstractFileByPath(dest))continue;
      try{return await this.app.vault.create(dest,`---\ntype: note\n---\n# ${title.trim()}\n\n${body.trim()}\n`);}catch(err){
        if(this.app.vault.getAbstractFileByPath(dest))continue;
        throw err;
      }
    }
    throw new Error('同名笔记太多');
  }
}
