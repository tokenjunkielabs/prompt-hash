# Draft conflict resolution

Prompt creator drafts use optimistic concurrency in browser storage instead of last-write-wins autosave.

Each stored snapshot carries a monotonic `revision`, `savedAt`, and per-tab `writerId`. A tab remembers the revision it loaded. Autosave only succeeds when that revision still matches storage; otherwise autosave pauses and the UI surfaces a conflict instead of overwriting the newer snapshot.

The browser `storage` event gives open tabs an early warning when another tab advances or removes the same wallet draft. The compare-before-write check remains authoritative because storage events are advisory and may arrive after local edits.

When a conflict is shown, creators can explicitly load the newer snapshot or keep their current edits. Keeping local edits is a deliberate resolution action that writes a new revision above the latest stored revision. Loading newer applies the remote form values and advances the tab's expected revision. Either path is explicit, so an older tab cannot silently replace a newer draft.

Legacy draft snapshots without revision metadata are read as revision zero and participate in the same conflict protocol on their next save.
