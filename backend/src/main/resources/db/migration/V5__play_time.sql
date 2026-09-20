-- Play time: the reward level is a resource rather than a toy.
--
-- Students earn seconds by answering questions correctly and spend them in the game. The heartbeat
-- column is what keeps the accounting server-side: the client says "still playing" and the server
-- bills the wall-clock time since that last call, so refreshing the page, reopening the tab or
-- editing the bundle cannot mint time.
--
-- Declared `timestamp` per the V1 convention: sqlite-jdbc stores an Instant as epoch millis, and
-- the declared name is only an affinity hint.

alter table users add column play_seconds integer not null default 0;
alter table users add column play_heartbeat_at timestamp;
