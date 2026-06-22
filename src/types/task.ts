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
}
