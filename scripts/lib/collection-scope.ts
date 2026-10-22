import type { PluginConfig, PluginRecord } from '../../src/lib/types';
/** Oldest or never-fetched first, so a cap rotates through the verified catalogue. */
export function selectCollectionScope(configs: PluginConfig[], previous: PluginRecord[], maximum: number): PluginConfig[] {
  if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > 1000) throw new Error('采集数量必须是 1–1000 的整数');
  const byId = new Map(previous.map(plugin => [plugin.id, plugin]));
  const age = (config: PluginConfig): number => {
    const old = byId.get(config.id);
    if (!old || old.repo.toLowerCase() !== config.repo.toLowerCase()) return 0;
    const time = Date.parse(old.lastUpdatedAt);
    return Number.isFinite(time) ? time : 0;
  };
  return configs.map((config, index) => ({ config, index }))
    .sort((a, b) => age(a.config) - age(b.config) || a.index - b.index)
    .slice(0, maximum).map(item => item.config);
}
