---
name: Calorie pipeline
description: Calorie targets must keep activity-level TDEE and explicit workout burns mutually exclusive.
---

The calorie pipeline uses a profile activity multiplier when available; that multiplier already includes usual workouts, so scheduled workout calories must not be added again. Legacy profiles without activity level use a sedentary base and add explicit scheduled exercise burns only on active days.

**Why:** Adding workout calories on top of a high/very-active multiplier can inflate weight-loss targets and make the same workout count twice.

**How to apply:** Preserve the breakdown fields (BMR, multiplier, base TDEE, exercise addition, maintenance, deficit, final target) whenever changing calorie logic, and verify both profile-activity and legacy fallback paths.