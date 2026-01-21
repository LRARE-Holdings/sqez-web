import { LRARE, type ItemMeta, type LearnerState, type ReviewSignal } from "./lrareKit";

const KEY = "sqez_engine_items_v1";

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export type StoredItemMeta = ItemMeta & {
  state: LearnerState;
};

export function getItemMetas(): StoredItemMeta[] {
  if (typeof window === "undefined") return [];
  return safeParse<StoredItemMeta[]>(window.localStorage.getItem(KEY), []);
}

export function saveItemMetas(items: StoredItemMeta[]) {
  window.localStorage.setItem(KEY, JSON.stringify(items));
}

export function upsertItemMeta(meta: StoredItemMeta) {
  const all = getItemMetas();
  const idx = all.findIndex((x) => x.id === meta.id);
  if (idx >= 0) all[idx] = meta;
  else all.push(meta);
  saveItemMetas(all);
}

export function ensureItemMeta(args: {
  id: string;
  tags: string[];
  authorityIDs: string[];
}): StoredItemMeta {
  const all = getItemMetas();
  const found = all.find((x) => x.id === args.id);
  if (found) return found;

  const meta: StoredItemMeta = {
    id: args.id,
    dueAt: new Date().toISOString(),
    tags: args.tags,
    authorityIDs: args.authorityIDs,
    state: LRARE.defaultState(),
  };

  all.push(meta);
  saveItemMetas(all);
  return meta;
}

export function applyReviewToItem(args: {
  id: string;
  signal: ReviewSignal;
  tags: string[];
  authorityIDs: string[];
}): StoredItemMeta {
  const meta = ensureItemMeta({
    id: args.id,
    tags: args.tags,
    authorityIDs: args.authorityIDs,
  });

  const res = LRARE.apply(args.signal, meta.state, new Date());

  const next: StoredItemMeta = {
    ...meta,
    state: res.updated,
    dueAt: res.nextDue.toISOString(),
    tags: args.tags,
    authorityIDs: args.authorityIDs,
  };

  upsertItemMeta(next);
  return next;
}

export function summarizeEngine(items: StoredItemMeta[]) {
  if (items.length === 0) {
    return { avgStability: 0, avgDifficulty: 0, dueCount: 0 };
  }

  const now = Date.now();
  const avgStability = items.reduce((a, i) => a + i.state.stability, 0) / items.length;
  const avgDifficulty = items.reduce((a, i) => a + i.state.difficulty, 0) / items.length;
  const dueCount = items.filter((i) => new Date(i.dueAt).getTime() <= now).length;

  return { avgStability, avgDifficulty, dueCount };
}