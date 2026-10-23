export const COLLECTION_CONTROL_VERSION = 1;
export const COLLECTION_CONTROL_FILENAME = 'collection-control.json';

export interface CollectionControl {
  version: 1;
  automaticPaused: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

/** Dependency-free so the browser and the lightweight Node 24 workflow gate share validation. */
export function parseCollectionControl(value: unknown): CollectionControl {
  const invalid = (reason: string): never => {
    throw new Error('collection-control.json 状态校验失败：' + reason);
  };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid('必须是 JSON 对象');
  const record = value as Record<string, unknown>;
  const keys = ['version', 'automaticPaused', 'updatedAt', 'updatedBy'];
  if (Object.keys(record).length !== keys.length || keys.some((key) => !Object.hasOwn(record, key))) {
    return invalid('必须且只能包含 version、automaticPaused、updatedAt、updatedBy');
  }
  if (record.version !== COLLECTION_CONTROL_VERSION) return invalid('不支持的状态版本');
  if (typeof record.automaticPaused !== 'boolean') return invalid('automaticPaused 必须是布尔值');
  const timestamp = record.updatedAt;
  if (timestamp !== null) {
    if (typeof timestamp !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(timestamp)) {
      return invalid('updatedAt 必须是 UTC ISO 时间或 null');
    }
    const date = new Date(timestamp);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 19) !== timestamp.slice(0, 19)) {
      return invalid('updatedAt 不是有效日期');
    }
  }
  const actor = record.updatedBy;
  if (actor !== null && (typeof actor !== 'string' || actor.length > 100 || !/^[A-Za-z0-9][A-Za-z0-9_.\-[\]]*$/.test(actor))) {
    return invalid('updatedBy 必须是 GitHub 操作人或 null');
  }
  if ((timestamp === null) !== (actor === null)) return invalid('更新时间和操作人必须同时存在或同时为空');
  return {
    version: COLLECTION_CONTROL_VERSION,
    automaticPaused: record.automaticPaused,
    updatedAt: timestamp as string | null,
    updatedBy: actor as string | null,
  };
}

export const collectionControlSchema = {
  parse: parseCollectionControl,
  safeParse(value: unknown): { success: true; data: CollectionControl } | { success: false; error: Error } {
    try {
      return { success: true, data: parseCollectionControl(value) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  },
};

/** Missing legacy controls also default to manual-only collection, without inventing audit fields. */
export function defaultCollectionControl(): CollectionControl {
  return { version: COLLECTION_CONTROL_VERSION, automaticPaused: true, updatedAt: null, updatedBy: null };
}

export const COLLECTION_SETTINGS_FILENAME = 'collection-settings.json';
export interface CollectionSettings {
  version: 1;
  targetPlugins: number;
  maxPlugins: number;
  maxRequests: number;
  githubReserve: number;
  updatedAt: string | null;
  updatedBy: string | null;
}
export function defaultCollectionSettings(): CollectionSettings {
  return { version: 1, targetPlugins: 20, maxPlugins: 100, maxRequests: 600, githubReserve: 100, updatedAt: null, updatedBy: null };
}
export function boundedCollectionInteger(value: unknown, label: string, min: number, max: number): number {
  const number = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isSafeInteger(number) || number < min || number > max) {
    throw new Error(label + '必须是 ' + min + '–' + max + ' 的整数');
  }
  return number;
}
export function parseCollectionSettings(value: unknown): CollectionSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('采集设置必须是对象');
  const input = value as Record<string, unknown>;
  const keys = ['version', 'maxPlugins', 'maxRequests', 'githubReserve', 'updatedAt', 'updatedBy'];
  if (Object.keys(input).some(key => ![...keys, 'targetPlugins'].includes(key)) || keys.some(key => !Object.hasOwn(input, key)) || input.version !== 1) throw new Error('采集设置字段或版本不兼容');
  const audit = parseCollectionControl({ version: 1, automaticPaused: false, updatedAt: input.updatedAt, updatedBy: input.updatedBy });
  return { version: 1,
    targetPlugins: boundedCollectionInteger(Object.hasOwn(input, 'targetPlugins') ? input.targetPlugins : 20, '收录目标', 1, 1000),
    maxPlugins: boundedCollectionInteger(input.maxPlugins, '采集数量', 1, 1000),
    maxRequests: boundedCollectionInteger(input.maxRequests, '请求预算', 1, 10000),
    githubReserve: boundedCollectionInteger(input.githubReserve, 'GitHub 预留额度', 0, 1000),
    updatedAt: audit.updatedAt, updatedBy: audit.updatedBy,
  };
}
