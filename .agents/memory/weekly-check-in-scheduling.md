---
name: Weekly check-in scheduling
description: The weekly goal check-in cadence is anchored to account creation and persisted completion rows.
---

Weekly goal check-ins must be completion-driven: the first due time is account creation plus seven days, and every later due time is seven days after the latest completed check-in row. A missed due date stays due until completion; dismissing the modal must not advance the schedule.

**Why:** Local-storage timestamps treated a new account as immediately due and counted modal dismissal as completion, which could hide missed check-ins and create duplicate scheduling behavior.

**How to apply:** Use the authenticated user’s immutable account creation timestamp plus `/goal-checkins` rows as the source of truth. Keep a temporary in-session guard only to prevent a dismissed modal from reopening repeatedly in the same app session, and keep server-side retry protection scoped narrowly enough not to rewrite existing progress.