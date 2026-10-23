import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { discoverPlugins } from '../../scripts/lib/discovery';
import { runCollection } from '../../scripts/collect';
import { makeSeed, NOW } from './helpers';
import { computeStats, scorePlugins } from '../../src/lib/scoring';
import { writeLatest, writeStatus, updateHistory, writeSnapshot } from '../../scripts/lib/store';
import { selectCollectionScope } from '../../scripts/lib/collection-scope';
import type { PluginConfig } from '../../src/lib/types';
vi.mock('../../scripts/lib/github',()=>({collectGithub:vi.fn(async(repo:string,client:any)=>{
  await client.get('https://api.github.com/repos/'+repo);
  const seed=makeSeed({id:repo.split('/')[1]});
  return {repository:seed.repository,github:seed.github,warnings:[],availability:{repository:true,commits:true,issues:true,pullRequests:true,releases:true}};
})}));
vi.mock('../../scripts/lib/npm',()=>({collectNpm:vi.fn(async(_package:string|null,repo:string)=>makeSeed({id:repo.split('/')[1]}).npm)}));
vi.mock('../../scripts/lib/osv',()=>({collectOsv:vi.fn(async(pkg:string)=>makeSeed({id:pkg.split('/').at(-1)}).security)}));
vi.mock('../../scripts/lib/discovery',()=>({discoverPlugins:vi.fn(async(_client:any,existing:any[],target:number)=>({plugins:existing,report:{targetPlugins:target,previousPlugins:existing.length,totalPlugins:existing.length,addedPlugins:0,checkedCandidates:0,rejectedCandidates:0,searchRequests:0,exhausted:true,stopReason:'no_more_verified_plugins',warnings:[]}}))}));
const dirs:string[]=[];
afterEach(async()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();process.exitCode=0;await Promise.all(dirs.splice(0).map(dir=>rm(dir,{recursive:true,force:true})));});
async function setup(){
 const dir=await mkdtemp(path.join(tmpdir(),'orbit-run-'));dirs.push(dir);
 const plugins=scorePlugins([makeSeed({id:'a'}),makeSeed({id:'b'})],NOW);
 const latest={schemaVersion:1 as const,generatedAt:NOW.toISOString(),lastAttemptAt:NOW.toISOString(),lastSuccessAt:NOW.toISOString(),runId:'previous',
 sources:{github:{status:'ok' as const,fetchedAt:NOW.toISOString()},npm:{status:'ok' as const,fetchedAt:NOW.toISOString()},osv:{status:'ok' as const,fetchedAt:NOW.toISOString()}},plugins,stats:computeStats(plugins)};
 await writeLatest(dir,latest);await updateHistory(dir,latest,null,NOW);await writeSnapshot(dir,latest);
 await writeStatus(dir,{schemaVersion:1,runId:'previous',lastAttemptAt:NOW.toISOString(),lastSuccessAt:NOW.toISOString(),outcome:'success',sources:latest.sources,errorCount:0,messages:[],nextRunHint:'test'});
 const configs=plugins.map(plugin=>({id:plugin.id,repo:plugin.repo,npm:null,category:plugin.category,installCommand:plugin.installCommand,note:'verified'}));
 const config=path.join(dir,'config.json');await writeFile(config,JSON.stringify({plugins:configs}));
 vi.stubEnv('GITHUB_TOKEN','test-token');vi.stubEnv('GITHUB_STEP_SUMMARY','');
 const fetchMock=vi.fn(async(url:string)=>new Response(JSON.stringify({full_name:new URL(url).pathname.slice('/repos/'.length),private:false}),{status:200,headers:{ETag:'"body"','Content-Type':'application/json'}}));
 vi.stubGlobal('fetch',fetchMock);
 return {dir,config,configs,plugins,fetchMock};
}
it('a shared budget stop keeps latest, history and snapshots byte-for-byte unchanged',async()=>{
 const {dir,config,fetchMock}=await setup();
 const beforeLatest=await readFile(path.join(dir,'latest.json'),'utf8'),beforeHistory=await readFile(path.join(dir,'history.json'),'utf8');
 const snapshots=await readdir(path.join(dir,'snapshots'));
 await runCollection(['--data-dir',dir,'--config',config,'--cache-dir',path.join(dir,'cache'),'--max-requests','1','--max-plugins','2','--github-reserve','0']);
 expect(fetchMock).toHaveBeenCalledTimes(1);
 expect(await readFile(path.join(dir,'latest.json'),'utf8')).toBe(beforeLatest);
 expect(await readFile(path.join(dir,'history.json'),'utf8')).toBe(beforeHistory);
 expect(await readdir(path.join(dir,'snapshots'))).toEqual(snapshots);
 const report=JSON.parse(await readFile(path.join(dir,'collection-report.json'),'utf8'));
 expect(report).toMatchObject({stopped:true,requestsMade:1,maxRequests:1,selectedPlugins:2});
 const status=JSON.parse(await readFile(path.join(dir,'status.json'),'utf8'));expect(status.outcome).toBe('partial');expect(status.lastSuccessAt).toBe(NOW.toISOString());
});
it('a scope cap preserves deferred records and does not append artificial history to them',async()=>{
 const {dir,config,fetchMock}=await setup();
 const before=JSON.parse(await readFile(path.join(dir,'history.json'),'utf8'));
 await runCollection(['--data-dir',dir,'--config',config,'--cache-dir',path.join(dir,'cache'),'--max-requests','20','--max-plugins','1','--github-reserve','0']);
 expect(fetchMock).toHaveBeenCalledTimes(1);
 const latest=JSON.parse(await readFile(path.join(dir,'latest.json'),'utf8'));
 expect(latest.plugins).toHaveLength(2);
 expect(latest.plugins.find((item:any)=>item.id==='b')).toMatchObject({lastUpdatedAt:NOW.toISOString(),dataStatus:'stale'});
 const after=JSON.parse(await readFile(path.join(dir,'history.json'),'utf8'));expect(after.plugins.b).toEqual(before.plugins.b);
 expect(JSON.parse(await readFile(path.join(dir,'collection-report.json'),'utf8'))).toMatchObject({selectedPlugins:1,deferredPlugins:1,stopped:false});
});
it('scope selection prioritizes never-fetched and then oldest records, without changing display ranking',()=>{
 const configs:PluginConfig[]=['a','b','c'].map(id=>({id,repo:'owner/'+id,npm:null,category:'interface',installCommand:'dsh plugin x',note:'verified'}));
 const old=scorePlugins([makeSeed({id:'a'}),makeSeed({id:'b'})],NOW);old[0].lastUpdatedAt='2026-10-21T00:00:00Z';old[1].lastUpdatedAt='2026-10-19T00:00:00Z';
 expect(selectCollectionScope(configs,old,2).map(config=>config.id)).toEqual(['c','b']);
 expect(()=>selectCollectionScope(configs,old,0)).toThrow();
});

it('a discovered catalog expands real records to 50 and survives the next collection run',async()=>{
 const {dir,config}=await setup();
 const configs:PluginConfig[]=Array.from({length:50},(_,index)=>({id:index===0?'a':index===1?'b':'new-'+index,repo:'owner/'+(index===0?'a':index===1?'b':'new-'+index),npm:null,category:'workflow',installCommand:'dsh plugin --profile web add @owner/plugin-'+index,note:'Verified bundle test fixture'}));
 vi.mocked(discoverPlugins).mockResolvedValueOnce({plugins:configs,report:{targetPlugins:50,previousPlugins:2,totalPlugins:50,addedPlugins:48,checkedCandidates:52,rejectedCandidates:4,searchRequests:1,exhausted:false,stopReason:'target_reached',warnings:[]}});
 await runCollection(['--data-dir',dir,'--config',config,'--cache-dir',path.join(dir,'cache'),'--target-plugins','50','--max-plugins','50','--max-requests','100','--github-reserve','0']);
 const latest=JSON.parse(await readFile(path.join(dir,'latest.json'),'utf8'));
 expect(latest.plugins).toHaveLength(50);expect(latest.stats.pluginCount).toBe(50);
 expect(new Set(latest.plugins.map((item:any)=>item.repo)).size).toBe(50);
 expect(JSON.parse(await readFile(path.join(dir,'catalog.json'),'utf8')).plugins).toHaveLength(50);
 expect(JSON.parse(await readFile(path.join(dir,'collection-report.json'),'utf8')).discovery).toMatchObject({target:50,verified:50,added:48});
 await runCollection(['--data-dir',dir,'--config',config,'--cache-dir',path.join(dir,'cache'),'--max-plugins','1','--max-requests','100','--github-reserve','0']);
 expect(JSON.parse(await readFile(path.join(dir,'latest.json'),'utf8')).plugins).toHaveLength(50);
});
