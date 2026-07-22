---
agent: email-triage
date: 2026-07-13
status: approved # pending | approved | rejected
---
## Change
Lower draft threshold: also draft for label bill when amount > ₹5,000.
## Diff
```
- draft when: label in {urgent, reply-needed}
+ draft when: label in {urgent, reply-needed} OR (label == bill AND amount > 5000)
```
## Why
3 bill emails last week needed manual replies.
