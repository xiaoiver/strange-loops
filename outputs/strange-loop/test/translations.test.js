import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COPY } from '../src/copy.js';
import { GARDEN_COPY } from '../src/garden-copy.js';
import { LANGUAGES } from '../src/languages.js';
import { displayWord, createHistory, appendStep, restoreHistory } from '../src/miu-system.js';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const gardenSource=readFileSync(new URL('../src/garden.js',import.meta.url),'utf8');
const paths=[...html.matchAll(/data-i18n(?:-html|-aria)?="([^"]+)"/g)].map(match=>match[1]);
const gardenKeys=[...new Set([...gardenSource.matchAll(/\bt\.([A-Za-z]+)/g)].map(match=>match[1]))];

test('all seven languages cover every live UI field, chapter, hint, dialogue and status',()=>{
  for(const lang of LANGUAGES){
    const copy=COPY[lang],garden=GARDEN_COPY[lang];
    for(const path of paths) assert.equal(typeof path.split('.').reduce((value,key)=>value?.[key],copy),'string',`${lang}: ${path}`);
    for(const key of gardenKeys) assert.notEqual(garden[key],undefined,`${lang}: garden.${key}`);
    for(const key of Object.keys(GARDEN_COPY.en.helpText)) assert.equal(typeof garden.helpText[key],'string',`${lang}: hint ${key}`);
    for(const key of Object.keys(GARDEN_COPY.en.lines)){
      assert.equal(garden.lines[key][0],GARDEN_COPY.en.lines[key][0]);
      assert.equal(typeof garden.lines[key][1],'string');
    }
    for(const key of Object.keys(COPY.en.status)) assert.equal(typeof copy.status[key],typeof COPY.en.status[key],`${lang}: status ${key}`);
    assert.equal(copy.chapters.length,8);
    assert.equal(Object.keys(copy.letterNames).length,26);
    assert.ok(Object.values(copy.letterNames).every(value=>typeof value==='string'&&value.length));
    assert.equal(garden.rules.length,4);assert.equal(garden.reasons.length,4);
    const rendered=[garden.liveCount(0),garden.liveCount(1),garden.groupsNote(3,2),garden.nudge(garden.rules[1]),copy.status.view('G'),copy.lightAria('G',true),copy.status.light('G',true),copy.dialogues.G[1]('G')].join('\n');
    assert.doesNotMatch(rendered,/undefined|\{\d+\}/,lang);
  }
});

test('translated symbols preserve the same derivation and reachable goal',()=>{
  const history=createHistory();
  appendStep(history,2,0);appendStep(history,2,0);appendStep(history,1,4);appendStep(history,3,1);
  const saved=JSON.stringify(history);
  for(const lang of LANGUAGES){
    const restored=restoreHistory(JSON.parse(saved));
    const word=restored.nodes[restored.current].word;
    assert.equal(word,'MUIU');
    assert.equal(displayWord(word,lang),lang==='zh'?'WUJU':'MUIU');
    assert.deepEqual(GARDEN_COPY[lang].examples,lang==='zh'?GARDEN_COPY.zh.examples:GARDEN_COPY.en.examples);
  }
  assert.equal(JSON.stringify(history),saved);
});
