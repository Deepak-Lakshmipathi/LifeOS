export interface Task {
  id: string;
  title: string;
  done: boolean;
  created_at: number;
  /**
   * Written acceptance criterion — how the user knows the Task is truly
   * finished. Optional; never queried, so it carries no Dexie index.
   * Stored only when non-empty (the seam unsets it on empty/whitespace).
   */
  done_when?: string;
  /**
   * Priority level: 3 = highest, 1 = lowest. Optional; absent means no
   * priority set. Indexed in Dexie v2 for future sort/filter slices.
   * Never store 0 — map "none" to field absent (undefined).
   */
  priority?: 1 | 2 | 3;
  /**
   * Project name the Task belongs to. Optional; absent means unparented
   * (rendered under "Inbox"). Never queried via Dexie — grouping is pure
   * in-memory (ADR-0005). Stored only when non-empty (the seam unsets it
   * on empty/whitespace, mirroring done_when semantics).
   */
  project?: string;
  /**
   * Domain the Task belongs to. Optional; constrained to the 7 canonical
   * domains (see DOMAINS in src/data/domains.ts). Never queried via Dexie —
   * grouping is pure in-memory (ADR-0005/ADR-0006). Stored only when a valid
   * domain string; invalid/empty/whitespace is unset (seam normalizes).
   */
  domain?: string;
  /**
   * Unix timestamp (ms) when the task was last completed (done flipped true).
   * Cleared when the task is un-done. Never queried via Dexie — warmth is
   * pure in-memory over the loaded task list (ADR-0005 extension, S9).
   * No Dexie index; schema stays at v2; no migration required.
   */
  completed_at?: number;
}
