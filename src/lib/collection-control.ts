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
  if (timestamp === null && record.automaticPaused) return invalid('暂停状态必须包含更新时间和操作人');
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

/** Only a missing file represents the legacy, not-yet-configured state. */
export function defaultCollectionControl(): CollectionControl {
  return { version: COLLECTION_CONTROL_VERSION, automaticPaused: false, updatedAt: null, updatedBy: null };
}
