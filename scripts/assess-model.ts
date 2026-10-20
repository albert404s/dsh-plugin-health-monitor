import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parseLatest} from '../src/lib/contracts';
import {maintenanceScore,riskAssessment,scorePlugins,round} from '../src/lib/scoring';
import {compareScores} from '../src/lib/comparison';
import {cleanSeedRecords,applyNpmGapGuard} from './lib/clean';
import type {PluginRecord,MaintenanceScore} from '../src/lib/types';

const source=path.resolve(process.argv[2] ?? 'public/data/latest.json');
const destination=path.resolve(process.argv[3] ?? 'docs/SCORING-REVIEW.md');
const raw=await readFile(source,'utf8');
const latest=parseLatest(JSON.parse(raw)).data;
const plugins=latest.plugins, now=new Date(latest.generatedAt);
const seed=(plugin:PluginRecord):Omit<PluginRecord,'scores'>=>{const {scores:_scores,...value}=structuredClone(plugin);return value;};
const order=(values:Map<string,number|null>):string[]=>[...values].filter(([,value])=>value!==null).sort(([a,x],[b,y])=>(y!-x!)||a.localeCompare(b)).map(([id])=>id);
const scores=(items:PluginRecord[],kind:'popularity'|'maintenance')=>new Map(items.map(p=>[p.id,p.scores[kind].score]));
function rankStats(base:Map<string,number|null>,next:Map<string,number|null>){
  const ids=[...base.keys()].filter(id=>base.get(id)!==null && next.has(id) && next.get(id)!==null);
  const a=order(new Map(ids.map(id=>[id,base.get(id)!]))), b=order(new Map(ids.map(id=>[id,next.get(id)!])));
  const overlap=a.slice(0,5).filter(id=>b.slice(0,5).includes(id)).length;
  let squared=0,maxShift=0,maxDelta=0;
  for(const [index,id] of a.entries()){const shift=Math.abs(index-b.indexOf(id));squared+=shift*shift;maxShift=Math.max(maxShift,shift);maxDelta=Math.max(maxDelta,Math.abs(base.get(id)!-next.get(id)!));}
  return {overlap,rho:ids.length>1?1-6*squared/(ids.length*(ids.length*ids.length-1)):1,maxShift,maxDelta};
}
function reweight(plugin:PluginRecord,kind:'popularity'|'maintenance',factors:Record<string,number>):number|null{
  const components=plugin.scores[kind].components;
  const designTotal=components.reduce((sum,c)=>sum+c.weight*(factors[c.key]??1),0);
  const values=components.filter(c=>c.included&&c.normalized!==null).map(c=>{
    const scale=kind==='popularity'?1:c.key==='issueHandling'?Math.min(1,plugin.github.issues.opened90d/5):c.key==='issueBacklog'?Math.min(1,plugin.github.issues.openNow/5):c.key==='pullRequests'?Math.min(1,plugin.github.pullRequests.opened90d/3):1;
    return {normalized:c.normalized!,weight:c.weight*(factors[c.key]??1)*scale/designTotal};
  });
  const coverage=values.reduce((sum,c)=>sum+c.weight,0);
  if(coverage<=0 || (kind==='maintenance'&&coverage+1e-9<.45))return null;
  return round(values.reduce((sum,c)=>sum+round(c.normalized*c.weight/coverage,1),0),1);
}
function sensitivity(kind:'popularity'|'maintenance'){
  const keys=plugins[0].scores[kind].components.map(c=>c.key);
  const scenarios:Record<string,number>[]=[];
  for(const key of keys)for(const factor of [.8,1.2])scenarios.push({[key]:factor});
  for(let mask=0;mask<2**keys.length;mask++)scenarios.push(Object.fromEntries(keys.map((key,index)=>[key,mask&(1<<index)?1.2:.8])));
  const base=scores(plugins,kind);
  const results=scenarios.map(factors=>rankStats(base,new Map(plugins.map(p=>[p.id,reweight(p,kind,factors)]))));
  return {scenarios:results.length,minTop5:Math.min(...results.map(r=>r.overlap)),minRho:Math.min(...results.map(r=>r.rho)),maxShift:Math.max(...results.map(r=>r.maxShift)),maxDelta:Math.max(...results.map(r=>r.maxDelta))};
}
const componentKeys=plugins[0].scores.maintenance.components.map(c=>c.key);
const components=componentKeys.map(key=>{
 const values=plugins.flatMap(p=>p.scores.maintenance.components.filter(c=>c.key===key&&c.included&&c.normalized!==null).map(c=>c.normalized!));
 return {key,label:plugins[0].scores.maintenance.components.find(c=>c.key===key)!.label,n:values.length,full:values.filter(v=>v===100).length,min:Math.min(...values),max:Math.max(...values),mean:values.reduce((a,b)=>a+b,0)/values.length};
});
const pairs=plugins.map(p=>[p.scores.maintenance.components.find(c=>c.key==='issueHandling')!,p.scores.maintenance.components.find(c=>c.key==='issueBacklog')!] as const).filter(([a,b])=>a.included&&b.included&&a.normalized!==null&&b.normalized!==null);
const identical=pairs.filter(([a,b])=>Math.abs(a.normalized!-b.normalized!)<.1).length;
const pop=sensitivity('popularity'),maint=sensitivity('maintenance');
let comparable=0;for(let i=0;i<plugins.length;i++)for(let j=i+1;j<plugins.length;j++)if(compareScores(plugins[i].scores.maintenance,plugins[j].scores.maintenance).comparable)comparable++;
const base=plugins.find(p=>p.scores.risk.level==='low'&&p.security.status==='checked') ?? plugins[0];
const tiny=seed(base);tiny.repository.archived=false;tiny.github.issues={...tiny.github.issues,opened90d:1,closed90d:0,closureRate:0,openNow:1,longOpen:0,lowSample:true};tiny.security.vulnerabilities=[];
const tinyRisk=riskAssessment(tiny,now);
const missing=seed(base);missing.npm.status='unavailable';missing.npm.downloads30d=null;missing.availability.npm=false;
const missingScores=scorePlugins([missing,...plugins.filter(p=>p.id!==base.id).map(seed)],now)[0];
const noIssues=seed(base);noIssues.github.issues={...noIssues.github.issues,opened90d:0,closed90d:0,closureRate:null,openNow:0,longOpen:0,lowSample:true};
const noIssueScore=maintenanceScore(noIssues,now);
const noPr=seed(base);noPr.availability.pullRequests=false;noPr.github.pullRequests.available=false;
const noPrScore=maintenanceScore(noPr,now);
const cohortResults=plugins.map(removed=>rankStats(scores(plugins.filter(p=>p.id!==removed.id),'popularity'),scores(scorePlugins(plugins.filter(p=>p.id!==removed.id).map(seed),now),'popularity')));
const extra=seed(plugins[0]);extra.id='assessment-extreme';extra.repo='assessment/extreme';extra.repository.fullName=extra.repo;extra.github.stars=1_000_000;extra.npm.downloads30d=50_000_000;
const added=rankStats(scores(plugins,'popularity'),scores(scorePlugins([...plugins.map(seed),extra],now).filter(p=>p.id!==extra.id),'popularity'));
const replay=scorePlugins(plugins.map(seed),now);
const replayMismatches=plugins.filter((plugin,index)=>plugin.scores.maintenance.score!==replay[index].scores.maintenance.score||plugin.scores.popularity.score!==replay[index].scores.popularity.score).length;
const cleaned=cleanSeedRecords(plugins.map(seed),plugins,now);const guarded=applyNpmGapGuard(cleaned.records);
const lines=[
'# 评分评估与最小修订规范',
'',
'本报告由 npm run assess:model 从本地真实快照重建。它评估方法 1.1.0，不修改当前评分公式或历史。',
'',
'- 快照：'+latest.generatedAt+'；插件数：'+plugins.length,
'- 输入 SHA-256：'+createHash('sha256').update(raw).digest('hex'),
'- 代码起点：团队主分支 41b6908；算法文件未改。重放同一输入与时间，评分不一致记录数：'+replayMismatches+'。',
'',
'## 1. 真实样本中的区分能力',
'',
'| 分项 | 有效样本 | 满分样本 | 最低 / 最高 | 平均 |',
'|---|---:|---:|---:|---:|',
...components.map(c=>'| '+c.label+' | '+c.n+' | '+c.full+' | '+c.min.toFixed(1)+' / '+c.max.toFixed(1)+' | '+c.mean.toFixed(1)+' |'),
'',
'Issue 关闭率与积压分同时参与的 '+pairs.length+' 个样本中，'+identical+' 个归一化得分差小于 0.1。这些样本的当前开放 Issue 大多就是 90 天新开而未关闭的 Issue，两个分项近似重复描述同一件事。样本相关不证明两项永远重复，但目前 20% + 10% 的设计权重容易重复放大同一信号。',
'',
'提交频率在每月 12 次时达到满分。当前样本的满分占比高，说明这个分项对“至少持续维护”有作用，对区分高频项目的作用很小。提高阈值只为拉开名次缺少依据。',
'',
'## 2. 边界案例与缺失数据',
'',
'| 案例 | 当前规则的可复现结果 | 解读 |',
'|---|---|---|',
'| 1 条新 Issue，1 条未关闭，无长期积压 | '+tinyRisk.level+'；命中 '+tinyRisk.flags.map(f=>f.code).join(', ')+' | 比例直接触发高等级，缺少风险规则的小样本保护 |',
'| 0 条新 Issue，0 条开放 | 关闭率分项参与：'+noIssueScore.components.find(c=>c.key==='issueHandling')!.included+' | 保留，不把没有 Issue 视为差，也不当作处理能力满分 |',
'| PR 功能不可用 | PR 分项参与：'+noPrScore.components.find(c=>c.key==='pullRequests')!.included+' | 保留，不记零 |',
'| 同一插件移除可靠下载数据 | 关注度 '+base.scores.popularity.score+' → '+missingScores.scores.popularity.score+'；依据覆盖 '+Math.round(base.scores.popularity.coverage*100)+'% → '+Math.round(missingScores.scores.popularity.coverage*100)+'% | 有效权重改变，不能把分差理解为插件变好或变差 |',
'',
'真实 '+plugins.length*(plugins.length-1)/2+' 对插件中，维护分满足同方法、同参与分项、同有效权重的只有 '+comparable+' 对。前端现已阻止其余组合直接计算分差，原始指标仍能查看。',
'',
'## 3. 权重扰动与头部稳定性',
'',
'方法：逐一把每项设计权重乘 0.8 / 1.2，并枚举所有分项的这两个端点组合；每种情形重新归一设计权重，沿用原始指标、分档与样本折减。有效覆盖不足 45% 仍不输出维护分。比较的是权重不确定性的影响，不是声称哪种权重正确。相同得分按插件 ID 排序。',
'',
'| 维度 | 扰动场景 | 最差 Top 5 重合 | 最低 Spearman rho | 最大名次移动 | 最大分数变化 |',
'|---|---:|---:|---:|---:|---:|',
'| 关注度 | '+pop.scenarios+' | '+pop.minTop5+'/5 | '+pop.minRho.toFixed(3)+' | '+pop.maxShift+' | '+pop.maxDelta.toFixed(1)+' |',
'| 维护活跃度 | '+maint.scenarios+' | '+maint.minTop5+'/5 | '+maint.minRho.toFixed(3)+' | '+maint.maxShift+' | '+maint.maxDelta.toFixed(1)+' |',
'',
'这组稳定性只描述当前快照，不是统计置信度。接近的分数不宜解释成确定的质量差异。',
'',
'## 4. 样本增删的影响',
'',
'- 逐个移除一个收录插件，共 '+cohortResults.length+' 次：保留插件最大关注度变化 '+Math.max(...cohortResults.map(r=>r.maxDelta)).toFixed(1)+' 分；最差 Top 5 重合 '+Math.min(...cohortResults.map(r=>r.overlap))+'/5。',
'- 加入一个明确标注为合成的极端样本（100 万 Stars / 5000 万下载）：原插件最大关注度变化 '+added.maxDelta.toFixed(1)+' 分；原插件内部 Top 5 重合 '+added.overlap+'/5，最低 rho '+added.rho.toFixed(3)+'。此处未把合成样本当成真实项目。',
'',
'人气归一化依赖本次样本的最小值和最大值，样本增删本身就会改变分数。建议保留相对定位，但在后续方法中记录收录集合标识；集合变化时，跨快照变化不直接归因于插件表现。',
'',
'## 5. 最小必要修订，安排在后续独立步骤',
'',
'1. **先补小样本保护。** 比例型维护提醒至少要求 5 条近 90 天新 Issue 且当前开放至少 5 条；样本不足时只展示数量与“样本少”，不因单个比率升为高等级。长期开放 20 条、归档状态与已匹配严重公开漏洞继续作为独立证据。阈值是待验证的候选，应用前补充 1/4/5/20 条、截断与无 Issue 案例。',
'2. **减少重复计分。** 优先试验从维护分移除开放/新开比率分项，把它保留为原始指标和关注提醒；剩余设计权重按总量归一，再运行同一敏感性检查。无需增加新 API 指标就能先消除重复。暂不提交新权重或追求更均匀排名。',
'3. **保留提交频率的饱和语义。** 页面继续展示原始提交次数。只有扩大时间跨度后证实需要区分高频活动，才比较封顶的对数或更平缓分档；不因当前榜单看起来相近就调阈值。',
'4. **继续强制比较口径。** 比较方法版本、参与分项、有效权重与采集时间；区分维护提醒、公开漏洞与数据缺口。前端部分已落地。',
'5. **版本与历史隔离。** 只有批准并实现新规则时才提升方法版本。新旧方法的趋势分别展示，保留原始快照，禁止覆盖旧历史来制造连续趋势。',
'',
'## 6. 数据质量重放与投入边界',
'',
'同一历史快照在评分前清洗的重放：输入 '+plugins.length+' 条，保留 '+cleaned.records.length+' 条；新增清洗提示 '+cleaned.messages.length+' 条；疑似平台零值影响 '+guarded+' 个包的周窗口。正式数据文件未被该评估脚本改写。',
'',
'清洗已经集中处理仓库与 npm 映射、非负整数、UTC 日期、同日去重/冲突、完整日历窗口、正值保护与同身份历史回退。原始 npm 日记录在可选 quality.rawDaily 字段保留；新增字段与 schema v1 向后兼容。当前不引入数据库、机器学习、响应时间 API 或 Python 爬虫。',
'',
'建议实施顺序：小样本与重复计分候选测试 → 相同真实样本与边界重放 → 权重/样本稳定性复测 → 独立版本发布。若现有公开数据仍不足以解释具体问题，再评估响应时间等额外采集，避免提前建设数据平台。',
''];
await mkdir(path.dirname(destination),{recursive:true});
await writeFile(destination,lines.join('\n'),'utf8');
console.log(JSON.stringify({report:destination,snapshot:latest.generatedAt,replayMismatches,identicalIssueComponents:identical,commitCadenceFull:components.find(c=>c.key==='commitCadence')!.full,comparableMaintenancePairs:comparable,popularitySensitivity:pop,maintenanceSensitivity:maint,cleaning:{retained:cleaned.records.length,messages:cleaned.messages,guarded}},null,2));
