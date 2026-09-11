---
change_id: fix-protected-entry-deletion-card-fidelity
title: Correct protected-entry deletion fidelity
status: new
created: 2026-09-11
updated: 2026-09-11
archived_at: null
---

## Notes

Follow up on the 2026-09-11 `conditions-pl` fidelity review. Generated Card 3 incorrectly said that the one-time
administrative code contains the latest generation number; the approved source requires the deletion request to contain
both the code and the latest generation number as separate conditions. Preserve the failed review as evidence and frame
the smallest appropriate product response without silently tuning or retrying the model.
