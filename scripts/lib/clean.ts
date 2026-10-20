import type { PluginRecord } from '../../src/lib/types';
import { pluginSeedSchema, utcTimestamp } from '../../src/lib/contracts';
import { calendarWindowSum, isCount, normalizeDaily, normalizeGithubRepository } from '../../src/lib/data-quality';
import { findPlatformGapDates } from '../../src/lib/downloads';

type Seed = Omit<PluginRecord,'scores'>;
export function cleanSeedRecords(input: Seed[], previous: readonly PluginRecord[], now: Date): { records: Seed[]; messages: string[]; fallbackCount: number } {
  const records: Seed[] = []; const messages: string[] = []; let fallbackCount=0;
  const ids = new Set<string>(), repos = new Set<string>(), packages = new Set<string>();
  for (const source of input) {
    const seed = structuredClone(source);
    const notes: string[] = [];
    const repo = normalizeGithubRepository(seed.repo);
    const old = previous.find((item) => item.id === seed.id && normalizeGithubRepository(item.repo) === repo);
    try {
      if (!repo || normalizeGithubRepository(seed.repository.fullName) !== repo || normalizeGithubRepository(seed.repository.url) !== repo) throw new Error('仓库身份不一致');
      if (ids.has(seed.id.toLowerCase()) || repos.has(repo)) { messages.push(seed.id + ' 重复身份已隔离。'); continue; }
      seed.repo = repo; seed.repository.fullName = repo; seed.repository.url = 'https://github.com/' + repo;
      function optionalDate(value: string | null, field: string): string | null {
        if (value === null) return null;
        const parsed = utcTimestamp.safeParse(value);
        if (!parsed.success || Date.parse(value) > now.getTime()) { notes.push(field + ' 时间异常，未参与相关判断。'); return null; }
        return new Date(value).toISOString();
      }
      seed.repository.createdAt = optionalDate(seed.repository.createdAt,'仓库创建');
      seed.repository.pushedAt = optionalDate(seed.repository.pushedAt,'仓库推送');
      seed.github.lastCommitAt = optionalDate(seed.github.lastCommitAt,'最近提交');
      if (!seed.github.lastCommitAt) seed.availability.commits = false;
      if (seed.github.latestRelease) {
        seed.github.latestRelease.publishedAt = optionalDate(seed.github.latestRelease.publishedAt,'版本发布');
        if (!seed.github.latestRelease.publishedAt) { seed.github.latestRelease = null; seed.availability.releases = false; }
      }
      for (const field of ['downloads30d','downloads7d','previous7d'] as const) {
        if (seed.npm[field] !== null && !isCount(seed.npm[field])) { notes.push('npm ' + field + ' 非法，已标记缺失。'); seed.npm[field] = null; }
      }
      if (seed.npm.weeklyChangePct !== null && !Number.isFinite(seed.npm.weeklyChangePct)) { seed.npm.weeklyChangePct = null; notes.push('周变化为非法值，已标记缺失。'); }
      seed.npm.publishedAt = optionalDate(seed.npm.publishedAt,'npm 发布');
      seed.npm.fetchedAt = optionalDate(seed.npm.fetchedAt,'npm 采集');
      seed.security.checkedAt = optionalDate(seed.security.checkedAt,'漏洞检查');
      if (seed.npm.status === 'verified' && normalizeGithubRepository(seed.npm.repositoryUrl) !== repo) throw new Error('npm 仓库映射不匹配');
      if (seed.npm.status === 'verified' && seed.npm.packageName && packages.has(seed.npm.packageName.toLowerCase())) { messages.push(seed.id + ' 重复 npm 映射已隔离。'); continue; }
      if (seed.security.status === 'checked' && (!seed.security.exactMatch || seed.security.packageName !== seed.npm.packageName || seed.security.version !== seed.npm.latestVersion)) throw new Error('漏洞查询不是同一包的精确版本');
      const rawDaily = seed.npm.quality?.rawDaily ?? seed.npm.daily;
      const end = seed.npm.quality?.windowEnd ?? now.toISOString().slice(0,10);
      const start = seed.npm.quality?.windowStart ?? undefined;
      const clean = normalizeDaily(rawDaily, {start,end});
      seed.npm.daily = clean.daily; notes.push(...clean.notes);
      seed.npm.quality = { rawDaily: [...rawDaily], conflictDates: clean.conflictDates, invalidCount: clean.invalidCount, notes: [...(seed.npm.quality?.notes ?? []),...clean.notes], windowStart: start ?? null, windowEnd: end };
      const lastDay = seed.npm.quality.windowEnd ?? clean.daily.at(-1)?.date;
      if (clean.notes.length && lastDay) {
        seed.npm.downloads7d = calendarWindowSum(clean.daily,lastDay,7);
        const previousEnd = new Date(Date.parse(lastDay)-7*86400000).toISOString().slice(0,10);
        seed.npm.previous7d = calendarWindowSum(clean.daily,previousEnd,7);
        seed.npm.weeklyChangePct = seed.npm.downloads7d === null || seed.npm.previous7d === null ? null : seed.npm.previous7d > 0 ? (seed.npm.downloads7d-seed.npm.previous7d)/seed.npm.previous7d*100 : seed.npm.downloads7d === 0 ? 0 : null;
      }
      if (seed.npm.downloads7d === null || seed.npm.previous7d === null) seed.npm.weeklyChangePct = null;
      seed.availability.npm = seed.npm.status === 'verified' && seed.npm.downloads30d !== null;
      const issues = seed.github.issues, prs = seed.github.pullRequests;
      if (issues.closed90d > issues.opened90d || prs.merged90d > prs.opened90d) throw new Error('窗口分母与计数不一致');
      for (const [window, closed, opened, key] of [[issues,issues.closed90d,issues.opened90d,'closureRate'],[prs,prs.merged90d,prs.opened90d,'mergeRate']] as const) {
        if (!isCount(closed) || !isCount(opened)) throw new Error('窗口计数非法');
        const expected = opened ? closed/opened : null;
        if ((window as unknown as Record<string,unknown>)[key] !== expected) { notes.push(key + ' 已由同一窗口计数重算。'); Object.assign(window,{[key]:expected}); }
      }
      const parsed = pluginSeedSchema.safeParse(seed);
      if (!parsed.success) throw new Error(parsed.error.issues.slice(0,2).map(issue=>issue.path.join('.')+': '+issue.message).join('；'));
      seed.warnings = [...new Set([...seed.warnings,...notes])];
      if (notes.length && seed.dataStatus === 'complete') seed.dataStatus='partial';
      records.push(seed); ids.add(seed.id.toLowerCase()); repos.add(repo); if(seed.npm.status==='verified' && seed.npm.packageName) packages.add(seed.npm.packageName.toLowerCase());
      messages.push(...notes.map(note=>seed.id+': '+note));
    } catch (error) {
      const reason = seed.id + ' 清洗校验失败：' + (error instanceof Error?error.message:String(error));
      messages.push(reason);
      if (old && !ids.has(old.id.toLowerCase()) && !repos.has(repo!) && !(old.npm.status === 'verified' && old.npm.packageName && packages.has(old.npm.packageName.toLowerCase()))) {
        const {scores: _scores,...fallback}=structuredClone(old);
        fallbackCount++;
        records.push({...fallback,dataStatus:'stale',warnings:[...fallback.warnings,reason+'；保留上次有效记录。']});
        ids.add(old.id.toLowerCase()); repos.add(repo!); if(old.npm.status === 'verified' && old.npm.packageName) packages.add(old.npm.packageName.toLowerCase());
      }
    }
  }
  return {records,messages,fallbackCount};
}
/** Only suspicious zero points are masked. Valid positive packages stay usable. */
export function applyNpmGapGuard(records: Seed[]): number {
  const gaps = findPlatformGapDates(records.map(record=>record.npm)); let affected=0;
  for (const record of records) {
    if (record.npm.status !== 'verified') continue;
    const end=record.npm.quality?.windowEnd ?? record.npm.daily.at(-1)?.date;
    if (!end) continue;
    const earliest=new Date(Date.parse(end)-13*86400000).toISOString().slice(0,10);
    if (!record.npm.daily.some(day=>day.date>=earliest && day.date<=end && day.downloads===0 && gaps.has(day.date))) continue;
    record.npm.downloads7d=null;record.npm.previous7d=null;record.npm.weeklyChangePct=null;
    const reason='周下载窗口包含疑似平台统计缺失的零值日，周变化暂不可用。';
    record.npm.reason=[record.npm.reason,reason].filter(Boolean).join(' ');
    record.warnings=[...new Set([...record.warnings,reason])];
    if(record.dataStatus==='complete')record.dataStatus='partial';affected++;
  }
  return affected;
}
