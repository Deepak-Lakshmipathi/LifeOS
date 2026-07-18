# job-scout profile

Owner-editable. `scout.mjs` reads this file to score each fetched listing —
never edit the scorer's code to change matching, edit this file instead.

## threshold

Minimum match % (0-100) for a listing to be appended to `Career/pipeline.md`.

```
threshold: 60
```

## keywords

One `keyword: weight` pair per line. A listing's title + tags + description
are matched case-insensitively as whole words; every keyword hit adds its
weight. Score = `100 * min(1, hits_weight / max_possible_weight)`, so tune
weights relative to each other, not to an absolute scale.

```
react: 20
typescript: 20
ai: 15
llm: 15
remote: 15
senior: 15
staff: 10
lead: 10
node: 10
frontend: 10
```
