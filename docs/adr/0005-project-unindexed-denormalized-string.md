# Project is an unindexed, denormalized string on Task

Slice S4 adds `project?: string` to the `Task` model. Two structural choices arose, and S4 deliberately breaks the precedent S3 set with `priority`.

## No Dexie index — schema stays v2

`priority` was indexed in schema v2 (ADR-0002 discipline: "bump the version when an indexed field changes") because a real future access pattern — sort/filter by priority — justifies the index. `project` has **no such query**. Its only consumer is the pure in-memory helper `groupByProject(tasks)` running over the array `list()` already returns (`orderBy('created_at').reverse().toArray()`); no `SyncProvider` method issues a project-scoped Dexie query, and none is planned in S4 scope. This mirrors `done_when` ("never queried, so it carries no Dexie index").

Indexing `project` would force a needless **schema v3** migration with zero access pattern to serve it — structural/migration cost that doesn't trace to a requirement. Decision: **no index. `LifeOSDb.ts` is unchanged; the store stays `tasks: 'id, created_at, done, priority'`.**

## Project stays a denormalized string, not an entity

S4 keeps Project as a free-text string on the Task; Projects are **derived by grouping**, not stored as their own records. This defers a Project entity (color, domain link, foreign key) until a slice actually needs project-level attributes — coarse-grained first, promote on demand.

## Consequences

- New Task fields continue to widen the seam types only (ADR-0004), not its method surface or the Dexie schema, unless they introduce a query.
- Project-name suggestions are derived from the live task list (`distinctProjects(tasks)`), not persisted.
- **Revisit when:** a later slice introduces a project-filtered/sorted query at the seam (then index, bump to v3), or when the Obsidian vault contract (Project = note) lands in Group D and Project gains real attributes.
