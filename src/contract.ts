/** Pure data contract: never imports Obsidian; safe to verify independently. */
export type Section = 'all' | 'capture' | 'journal' | 'note';
export type Draft = { body: string; updatedAt: number };
export const PATHS = Object.freeze({
  capture: '01 收集/记录',
  journal: '10 日记',
  note: '20 笔记',
});
export function localDay(at: Date = new Date()): string {
  return `${at.getFullYear()}-${String(at.getMonth()+1).padStart(2,'0')}-${String(at.getDate()).padStart(2,'0')}`;
}
export function journalPath(at: Date = new Date()): string {return `${PATHS.journal}/${localDay(at)}.md`;}
export function classify(path: string): Section | null {
  if(path.startsWith(`${PATHS.capture}/`) && path.endsWith('.md')) return 'capture';
  if(/^10 日记\/\d{4}-\d\d-\d\d\.md$/.test(path))return 'journal';
  if(path.startsWith(`${PATHS.note}/`) && path.endsWith('.md'))return 'note';
  return null;
}
export function titleOf(body: string): string {
  const first=(body.split(/\r?\n/).find(v=>v.trim())||'记录').trim();
  return (first.replace(/[\\/:*?"<>|\x00-\x1f]/g,' ').replace(/\s+/g,' ').trim().slice(0,35)||'记录');
}
export function safeStamp(at: Date = new Date()): string {
  return localDay(at)+'-'+String(at.getHours()).padStart(2,'0')+String(at.getMinutes()).padStart(2,'0')+String(at.getSeconds()).padStart(2,'0');
}
export function captureMarkdown(body: string, at: Date = new Date()): string {
  return `---\ntype: capture\ncreated: ${at.toISOString()}\n---\n# ${titleOf(body)}\n\n${body.trim()}\n`;
}
export function journalMarkdown(at: Date = new Date()): string {
  return `---\ntype: daily\ndate: ${localDay(at)}\n---\n# ${localDay(at)}\n\n## 今天\n\n`;
}
export function searchName(name: string, term: string): boolean {
  return name.toLocaleLowerCase().includes(term.trim().toLocaleLowerCase());
}

/** Strip internal capture id from the title shown in the user-facing list. */
export function displayTitle(name:string,section:Section):string{
 if(section==='capture'){
  return name.replace(/^\d{4}-\d\d-\d\d-\d{6}-[a-z0-9]{8}-/i,'')
    .replace(/^\d{4}-\d\d-\d\d-\d{4}-\d{3}-\d{4}-/,'')||'记录';
 }
 return name;
}
