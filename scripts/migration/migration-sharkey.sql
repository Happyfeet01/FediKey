-- SPDX-FileCopyrightText: Happyfeet01 and FediKey contributors
-- SPDX-License-Identifier: AGPL-3.0-only
-- Production bridge: database checked against the Compose configuration.
-- Adapted from the successfully tested Sharkey history bridge.
-- Source: uploaded schema + running Sharkey NoteEditService (2025.4.7).
-- Preserve source rows; never invent unavailable historical CW/files/polls.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '30min';
SET LOCAL search_path = public;
SELECT set_config('fedikey.expected_database', :'expected_db', true);

DO $$
DECLARE columns_found text[];
BEGIN
  IF current_database() <> current_setting('fedikey.expected_database') THEN
    RAISE EXCEPTION 'Connected database differs from the configured production database';
  END IF;
  SELECT array_agg(column_name::text ORDER BY column_name)
  INTO columns_found FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'note_edit';
  IF columns_found IS DISTINCT FROM
    ARRAY['cw','fileIds','id','newText','noteId','oldDate','oldText','updatedAt']::text[] THEN
    RAISE EXCEPTION 'Unexpected source note_edit schema: %', columns_found;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='note'
      AND column_name='updatedAt' AND data_type='timestamp with time zone') THEN
    RAISE EXCEPTION 'Source note.updatedAt is missing or has the wrong type';
  END IF;
  IF EXISTS (SELECT 1 FROM public.migrations WHERE name IN (
    'NoteUpdatedAt1695901659683','RevertNoteEdit1696388600237',
    'NoteEditing1791284200000')) THEN
    RAISE EXCEPTION 'Bridge or conflicting migrations already registered';
  END IF;
  IF EXISTS (SELECT 1 FROM public.note_edit e
    LEFT JOIN public.note n ON n.id=e."noteId"
    LEFT JOIN public."user" u ON u.id=n."userId"
    WHERE n.id IS NULL OR u.id IS NULL) THEN
    RAISE EXCEPTION 'Orphan history or missing note author; repair preflight first';
  END IF;
END $$;

LOCK TABLE public.migrations, public.note_edit IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.note, public."user" IN SHARE MODE;
CREATE SCHEMA IF NOT EXISTS fedikey_recovery;
CREATE TABLE fedikey_recovery.sharkey_note_edit AS TABLE public.note_edit;
CREATE TABLE fedikey_recovery.sharkey_note_update_dates AS
  SELECT id, "updatedAt" FROM public.note WHERE "updatedAt" IS NOT NULL;
CREATE TABLE fedikey_recovery.sharkey_migrations AS TABLE public.migrations;
CREATE TABLE fedikey_recovery.history_provenance AS
  SELECT id,
    ARRAY['cw','fileIds','hasPoll','replyId','renoteId','visibility']::text[] AS unavailable_historical_fields
  FROM public.note_edit;

CREATE TYPE public.note_edit_visibility_enum AS ENUM ('public','home','followers','specified');
ALTER TABLE public.note_edit RENAME COLUMN "oldText" TO "text";
ALTER TABLE public.note_edit RENAME COLUMN "cw" TO "newCw";
ALTER TABLE public.note_edit ALTER COLUMN "newCw" TYPE text;
ALTER TABLE public.note_edit ADD COLUMN "cw" text;
ALTER TABLE public.note_edit ADD COLUMN "userId" varchar(32);
ALTER TABLE public.note_edit ADD COLUMN "renoteId" varchar(32);
ALTER TABLE public.note_edit ADD COLUMN "replyId" varchar(32);
ALTER TABLE public.note_edit ADD COLUMN "visibility" public.note_edit_visibility_enum;
-- The old service did not store historic poll state. False is the target
-- schema default, NOT proof that an old revision had no poll (see provenance).
ALTER TABLE public.note_edit ADD COLUMN "hasPoll" boolean NOT NULL DEFAULT false;

UPDATE public.note_edit e SET
  "userId"=n."userId",
  "visibility"=n.visibility::text::public.note_edit_visibility_enum
FROM public.note n WHERE n.id=e."noteId";
-- Old references and old CW cannot be reconstructed reliably: keep NULL.
-- Original fileIds (normally empty in this Sharkey service) remain unchanged.
ALTER TABLE public.note_edit ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE public.note_edit ALTER COLUMN "visibility" SET NOT NULL;
ALTER TABLE public.note_edit RENAME CONSTRAINT "PK_736fc6e0d4e222ecc6f82058e08" TO "PK_fedikey_note_edit";
ALTER TABLE public.note_edit ADD CONSTRAINT "FK_7f1ded0f6e8a5bef701b7e698ab"
  FOREIGN KEY ("userId") REFERENCES public."user"(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.note."updatedAt" IS 'The updated date of the Note.';
COMMENT ON COLUMN public.note_edit."noteId" IS 'The ID of note.';
COMMENT ON COLUMN public.note_edit."userId" IS 'The ID of author.';
COMMENT ON COLUMN public.note_edit."renoteId" IS 'The ID of renote target.';
COMMENT ON COLUMN public.note_edit."replyId" IS 'The ID of reply target.';
COMMENT ON COLUMN public.note_edit."updatedAt" IS 'The updated date of the Note.';
COMMENT ON COLUMN public.note_edit."oldDate" IS 'The old date from before the edit.';
COMMENT ON COLUMN public.note_edit."hasPoll" IS 'Whether this revision had a poll.';

-- The old add/drop pair would destroy existing edit timestamps. The bridge
-- retains the column and implements NoteEditing's target schema itself.
-- Register ONLY those three transitions; all other migrations still run.
INSERT INTO public.migrations ("timestamp",name) VALUES
  (1695901659683,'NoteUpdatedAt1695901659683'),
  (1696388600237,'RevertNoteEdit1696388600237'),
  (1791284200000,'NoteEditing1791284200000');

DO $$
BEGIN
  IF (SELECT count(*) FROM public.note_edit) <>
     (SELECT count(*) FROM fedikey_recovery.sharkey_note_edit) THEN
    RAISE EXCEPTION 'History row count changed';
  END IF;
  IF EXISTS (SELECT 1 FROM fedikey_recovery.sharkey_note_edit s
    LEFT JOIN public.note_edit e ON e.id=s.id
    WHERE e.id IS NULL OR e."noteId" IS DISTINCT FROM s."noteId"
      OR e.text IS DISTINCT FROM s."oldText"
      OR e."newText" IS DISTINCT FROM s."newText"
      OR e."newCw" IS DISTINCT FROM s.cw
      OR e."fileIds" IS DISTINCT FROM s."fileIds"
      OR e."oldDate" IS DISTINCT FROM s."oldDate"
      OR e."updatedAt" IS DISTINCT FROM s."updatedAt") THEN
    RAISE EXCEPTION 'Source history values were not preserved';
  END IF;
  IF EXISTS (SELECT 1 FROM fedikey_recovery.sharkey_note_update_dates s
    LEFT JOIN public.note n ON n.id=s.id
    WHERE n.id IS NULL OR n."updatedAt" IS DISTINCT FROM s."updatedAt") THEN
    RAISE EXCEPTION 'Note edit timestamps changed';
  END IF;
END $$;
COMMIT;

SELECT count(*) AS history_rows_preserved FROM public.note_edit;
SELECT name FROM public.migrations WHERE name IN (
  'NoteUpdatedAt1695901659683','RevertNoteEdit1696388600237',
  'NoteEditing1791284200000') ORDER BY "timestamp";
