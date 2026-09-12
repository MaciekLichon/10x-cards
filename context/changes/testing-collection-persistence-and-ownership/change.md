---
change_id: testing-collection-persistence-and-ownership
title: Testing collection persistence and ownership
status: implementing
created: 2026-09-12
updated: 2026-09-12
archived_at: null
---

## Notes

Risks covered: #3, #4, #6. Test types planned: Database + API integration.
Risk response intent:

- Risk #3: prove that only selected edits persist and failed saves remain visible.
- Risk #4: prove that denied access leaves owner data private and intact.
- Risk #6: prove that only the intended card changes and failures stay visible.
