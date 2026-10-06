import { describe, expect, it } from "vitest";
import {
  draftVersion,
  forceSaveDraft,
  parseDraft,
  readDraft,
  removeDraftIfCurrent,
  saveDraftIfCurrent,
  type StorageLike,
} from "./draftConflict";

class MemoryStorage implements StorageLike {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

describe("versioned draft conflict handling", () => {
  it("prevents an older tab from overwriting a newer revision", () => {
    const storage = new MemoryStorage();
    const key = "draft";

    const first = saveDraftIfCurrent(
      storage,
      key,
      { title: "tab-a v1" },
      null,
      "tab-a",
      () => "2026-09-20T20:00:00.000Z",
    );
    expect(first.status).toBe("saved");

    const tabBVersion = draftVersion(readDraft<{ title: string }>(storage, key));

    const second = saveDraftIfCurrent(
      storage,
      key,
      { title: "tab-a v2" },
      tabBVersion,
      "tab-a",
      () => "2026-09-20T20:01:00.000Z",
    );
    expect(second.status).toBe("saved");

    const staleWrite = saveDraftIfCurrent(
      storage,
      key,
      { title: "tab-b stale" },
      tabBVersion,
      "tab-b",
      () => "2026-09-20T20:02:00.000Z",
    );

    expect(staleWrite.status).toBe("conflict");
    expect(readDraft<{ title: string }>(storage, key)?.formData.title).toBe(
      "tab-a v2",
    );
  });

  it("rejects same-revision snapshots written by a different tab", () => {
    const storage = new MemoryStorage();
    const key = "draft";

    storage.setItem(
      key,
      JSON.stringify({
        formData: { title: "tab-a" },
        savedAt: "2026-09-20T20:02:30.000Z",
        revision: 2,
        writerId: "tab-a",
      }),
    );

    const staleVersion = { revision: 2, writerId: "tab-b" };
    const staleWrite = saveDraftIfCurrent(
      storage,
      key,
      { title: "tab-b stale" },
      staleVersion,
      "tab-b",
    );
    const staleRemove = removeDraftIfCurrent<{ title: string }>(
      storage,
      key,
      staleVersion,
    );

    expect(staleWrite).toMatchObject({
      status: "conflict",
      current: { revision: 2, writerId: "tab-a" },
    });
    expect(staleRemove).toMatchObject({
      status: "conflict",
      current: { revision: 2, writerId: "tab-a" },
    });
    expect(readDraft<{ title: string }>(storage, key)?.formData.title).toBe(
      "tab-a",
    );
  });

  it("lets an explicit keep-local resolution create the next revision", () => {
    const storage = new MemoryStorage();
    const key = "draft";

    saveDraftIfCurrent(storage, key, { title: "newer" }, null, "tab-a");
    const resolved = forceSaveDraft(
      storage,
      key,
      { title: "my recovered edits" },
      "tab-b",
      () => "2026-09-20T20:03:00.000Z",
    );

    expect(resolved.revision).toBe(2);
    expect(readDraft<{ title: string }>(storage, key)?.formData.title).toBe(
      "my recovered edits",
    );
  });

  it("upgrades legacy snapshots to revision zero when read", () => {
    const legacy = parseDraft<{ title: string }>(
      JSON.stringify({
        formData: { title: "legacy" },
        savedAt: "2026-09-19T10:00:00.000Z",
      }),
    );

    expect(legacy).toEqual({
      formData: { title: "legacy" },
      savedAt: "2026-09-19T10:00:00.000Z",
      revision: 0,
      writerId: "legacy",
    });
  });
});
