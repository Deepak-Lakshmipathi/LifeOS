// intents/index.ts — the ONLY file every future intent slice appends one line
// to (ADR-0011 Decision 4). Each import's module self-registers its handler
// as a side effect of being loaded — this file has no other logic.
import './create'
// S17 adds: import './update'; import './delete'
// S18 adds: import './voice'
// S19 adds: import './photo'
