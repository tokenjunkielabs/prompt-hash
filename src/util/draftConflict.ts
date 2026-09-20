export type DraftEnvelope<T> = {
  formData: T;
  savedAt: string;
  revision: number;
  writerId: string;
};

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type DraftSaveResult<T> =
  | { status: "saved"; draft: DraftEnvelope<T> }
  | { status: "conflict"; current: DraftEnvelope<T> | null };

export type DraftRemoveResult<T> =
  | { status: "removed" }
  | { status: "conflict"; current: DraftEnvelope<T> | null };

export function parseDraft<T>(raw: string | null): DraftEnvelope<T> | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<DraftEnvelope<T>> & { formData?: T };
    if (!parsed || typeof parsed !== "object" || !parsed.formData) return null;

    return {
      formData: parsed.formData,
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : "",
      revision:
        typeof parsed.revision === "number" &&
        Number.isInteger(parsed.revision) &&
        parsed.revision >= 0
          ? parsed.revision
          : 0,
      writerId: typeof parsed.writerId === "string" ? parsed.writerId : "legacy",
    };
  } catch {
    return null;
  }
}

export function readDraft<T>(
  storage: StorageLike,
  key: string,
): DraftEnvelope<T> | null {
  return parseDraft<T>(storage.getItem(key));
}

export function saveDraftIfCurrent<T>(
  storage: StorageLike,
  key: string,
  formData: T,
  expectedRevision: number | null,
  writerId: string,
  now: () => string = () => new Date().toISOString(),
): DraftSaveResult<T> {
  const current = readDraft<T>(storage, key);
  const actualRevision = current?.revision ?? null;

  if (actualRevision !== expectedRevision) {
    return { status: "conflict", current };
  }

  const draft: DraftEnvelope<T> = {
    formData,
    savedAt: now(),
    revision: (current?.revision ?? 0) + 1,
    writerId,
  };
  storage.setItem(key, JSON.stringify(draft));
  return { status: "saved", draft };
}

export function forceSaveDraft<T>(
  storage: StorageLike,
  key: string,
  formData: T,
  writerId: string,
  now: () => string = () => new Date().toISOString(),
): DraftEnvelope<T> {
  const current = readDraft<T>(storage, key);
  const draft: DraftEnvelope<T> = {
    formData,
    savedAt: now(),
    revision: (current?.revision ?? 0) + 1,
    writerId,
  };
  storage.setItem(key, JSON.stringify(draft));
  return draft;
}

export function removeDraftIfCurrent<T>(
  storage: StorageLike,
  key: string,
  expectedRevision: number | null,
): DraftRemoveResult<T> {
  const current = readDraft<T>(storage, key);
  const actualRevision = current?.revision ?? null;

  if (actualRevision !== expectedRevision) {
    return { status: "conflict", current };
  }

  storage.removeItem(key);
  return { status: "removed" };
}

export function changedDraftFields<T extends Record<string, unknown>>(
  local: T,
  remote: T,
): string[] {
  const keys = new Set([...Object.keys(local), ...Object.keys(remote)]);
  return [...keys].filter(
    (key) => JSON.stringify(local[key]) !== JSON.stringify(remote[key]),
  );
}
