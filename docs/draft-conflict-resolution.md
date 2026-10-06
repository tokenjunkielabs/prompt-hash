# Draft conflict resolution

Prompt creator drafts use optimistic concurrency in browser storage instead of last-write-wins autosave.

Each stored snapshot carries a monotonic `revision`, `savedAt`, and per-tab `writerId`. A tab remembers the full version token `(revision, writerId)` it loaded. Autosave and removal only succeed when both fields still match storage; otherwise the UI surfaces a conflict instead of overwriting or deleting another tab's snapshot. Including `writerId` means two concurrent snapshots that happen to share the same numeric revision are still distinct versions.

The browser `storage` event gives open tabs an early warning when another tab advances, writes a same-revision snapshot under a different writer ID, or removes the same wallet draft. The compare-before-write version check remains authoritative because storage events are advisory and may arrive after local edits.

When a conflict is shown, creators can explicitly load the newer snapshot or keep their current edits. Keeping local edits is a deliberate resolution action that writes a new revision above the latest stored revision. Loading newer applies the remote form values and advances the tab's expected revision. Either path is explicit, so an older tab cannot silently replace a newer draft.

Legacy draft snapshots without revision metadata are read as revision zero and participate in the same conflict protocol on their next save.
