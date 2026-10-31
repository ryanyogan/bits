-- Migration number: 0013 	 Theme preference (decision 062)
--
-- bits draws in a dark or a light theme. By default it follows the
-- device (prefers-color-scheme); a learner can pin one, in Settings or
-- with the footer's ?theme= links. Signed out, the choice lives in the
-- session; signed in, it is kept here. Null means "follow the system".
--
-- Additive: a nullable column, so code that doesn't know it keeps working.

alter table users add column theme text check (theme in ('dark', 'light'));
