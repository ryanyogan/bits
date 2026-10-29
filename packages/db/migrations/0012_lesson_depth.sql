-- Migration number: 0012 	 Lesson depth preference (decision 053)
--
-- A lesson can explain its idea twice: for someone brand new to AI
-- ('new') or for an engineer who wants the mechanism ('engineer'). The
-- learner picks once, with ?depth= on a lesson URL, and every lesson
-- follows it. Signed out, the choice lives in the session; signed in, it
-- is kept here. Null means never picked (the page shows 'new').
--
-- Additive: a nullable column, so code that doesn't know it keeps working.

alter table users add column lesson_depth text check (lesson_depth in ('new', 'engineer'));
