import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {classify,journalPath,localDay,titleOf,captureMarkdown,journalMarkdown,safeStamp,searchName,displayTitle} from '../src/contract';
const d = new Date(2026,9,20,9,4,5);
test('local dates use device day, not UTC',()=>{assert.equal(localDay(d),'2026-10-20');assert.equal(journalPath(d),'10 日记/2026-10-20.md')});
test('real v3 contract remains readable',()=>{assert.equal(classify('01 收集/记录/a.md'),'capture');assert.equal(classify('10 日记/2026-10-20.md'),'journal');assert.equal(classify('20 笔记/a.md'),'note');});
test('system files and nested irregular journals are never silently treated as journals',()=>{assert.equal(classify('90 系统/a.md'),null);assert.equal(classify('10 日记/2026/x.md'),null);});
test('filename-safe title',()=>{assert.equal(titleOf('  跟进 / 工厂: 工艺  \n下一行'),'跟进 工厂 工艺')});
test('capture body preserved verbatim',()=>{const s=captureMarkdown('想法 / 电镀\n下一行',d);assert.ok(s.includes('想法 / 电镀\n下一行'));assert.ok(s.includes('type: capture'));});
test('journal initial content is only generated when missing',()=>{assert.ok(journalMarkdown(d).includes('2026-10-20'));});
test('capture unique safe timestamp',()=>{assert.equal(safeStamp(d),'2026-10-20-090405');});
test('Chinese case-insensitive search',()=>{assert.ok(searchName('PersonalOS 会议.md','会议'));assert.ok(searchName('INVESTMENT.md','investment'));});

test('user sees the note title, not an internal timestamp and random id',()=>{assert.equal(displayTitle('2026-10-20-194601-ab12cd34-开会记录','capture'),'开会记录');assert.equal(displayTitle('2026-10-20-1946-213-4152-开会记录','capture'),'开会记录')});
