---
change_id: ai-flashcard-review
title: Generate and review AI flashcards
status: implemented
created: 2026-08-20
updated: 2026-08-22
archived_at: null
---

## Notes

from context/foundation/roadmap.md

Planning decisions: proposals use question/answer terminology; plain text; one standalone fact or concept per card;
avoid duplicates; request 5–15 proposals while accepting 1–4 valid results for sparse material; question limit 200
characters; answer limit 500 characters; output language matches the source; source input is 1,000–10,000 characters;
users may edit, accept, or reject every proposal; only accepted cards are saved in one atomic batch. No JavaScript test
runner or automated application tests are introduced in this change.
