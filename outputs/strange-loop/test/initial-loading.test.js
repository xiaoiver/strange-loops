import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { within } from '../src/startup-assets.js';
import { LOADING_COPY } from '../src/loading-copy.js';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const bootstrap=html.match(/<script id="loading-bootstrap">([\s\S]*?)<\/script>/)[1];
function screen({search='',saved=null,pageLocale,reduced=false}={}){
  const nodes=Object.fromEntries(['loading-screen','loading-message','loading-retry','exhibit','enter'].map(id=>[id,{hidden:id==='loading-retry',inert:id==='exhibit',dataset:{state:'loading'},classList:{add(){}},contains(node){return node===nodes['loading-retry'];},setAttribute(key,value){this[key]=value;},focus(){this.focused=true;}}]));
  const timers=new Map(),frames=[],events={},windowEvents={};let next=0;
  const document={getElementById:id=>nodes[id],documentElement:{dataset:{locale:pageLocale}},addEventListener:(name,fn)=>events[name]=fn};
  const window={addEventListener:(name,fn)=>windowEvents[name]=fn};
  runInNewContext(bootstrap,{document,window,URLSearchParams,location:{search,href:`https://example.test/experiences/geb${search}`},localStorage:{getItem:()=>saved},matchMedia:()=>({matches:reduced}),requestAnimationFrame:fn=>frames.push(fn),setTimeout:(fn,ms)=>{timers.set(++next,{fn,ms});return next;},clearTimeout:id=>timers.delete(id)});
  return {nodes,document,api:window.exhibitLoading,timers,frames,events,windowEvents};
}

test('loading exists before the main bundle and disables exhibition controls',()=>{
  assert.ok(html.indexOf('id="loading-screen"')<html.indexOf('id="app-script"'));
  assert.match(html,/<div id="exhibit" inert aria-busy="true">/);
  const s=screen({search:'?lang=en&s=CAT'});
  assert.equal(s.nodes['loading-message'].textContent,'Loading the exhibition');
  assert.equal(s.nodes['loading-retry'].href,'https://example.test/experiences/geb?lang=en&s=CAT');
  assert.equal(s.nodes.exhibit.inert,true);
});

test('a failed or slow bundle has a retry action without falsely unlocking the app',()=>{
  const s=screen();
  [...s.timers.values()][0].fn();
  assert.equal(s.nodes['loading-retry'].hidden,false);
  assert.equal(s.nodes['loading-message'].textContent,'仍在加载，请稍等。');
  s.events.error({target:{id:'app-script'}});
  assert.equal(s.nodes['loading-message'].textContent,'无法加载，请重试。');
  assert.equal(s.nodes.exhibit.inert,true);
});

test('ready waits for a painted frame, releases focus, and cancels the slow warning',()=>{
  const s=screen({reduced:true});
  s.document.activeElement=s.nodes['loading-retry'];
  s.api.finish();s.api.finish();
  assert.equal(s.timers.size,0);assert.equal(s.frames.length,1);
  assert.equal(s.nodes.exhibit.inert,true);
  s.frames[0]();const finish=[...s.timers.values()][0];assert.equal(finish.ms,0);finish.fn();
  assert.equal(s.nodes['loading-screen'].hidden,true);assert.equal(s.nodes.exhibit.inert,false);
  assert.equal(s.nodes.exhibit['aria-busy'],'false');assert.equal(s.nodes.enter.focused,true);
  s.api.fail();assert.equal(s.nodes['loading-screen'].hidden,true);
});

test('loader language follows shared URL, page language and saved preference',()=>{
  assert.equal(screen({search:'?lang=zh',pageLocale:'en'}).nodes['loading-message'].textContent,'正在加载展厅');
  assert.equal(screen({saved:'en'}).nodes['loading-message'].textContent,'Loading the exhibition');
  const s=screen({saved:'en'});s.api.setLocale('zh');s.api.setStage('companions');
  assert.equal(s.nodes['loading-message'].textContent,'正在加载同行者');
});

test('every language loads and reports errors before the main bundle is available',()=>{
  for(const [language,copy] of Object.entries(LOADING_COPY)){
    const s=screen({search:`?lang=${language}`});
    assert.equal(s.nodes['loading-message'].textContent,copy.app);
    s.api.fail();
    assert.equal(s.nodes['loading-message'].textContent,copy.failed);
    assert.equal(s.nodes['loading-retry'].textContent,copy.retry);
  }
});

test('an unavailable optional asset has a deadline and late failure is consumed',async()=>{
  await assert.rejects(within(new Promise(()=>{}),5),/timed out/);
  assert.equal(await within(Promise.resolve('ready'),5),'ready');
  let reject;const late=new Promise((resolve,r)=>{reject=r;});
  await assert.rejects(within(late,5),/timed out/);reject(new Error('late network failure'));
});
