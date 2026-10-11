# Test plan: better user search

This change affects only the `users/search` endpoint (the Users tab of global search).
It does **not** change `users/search-by-username-and-host`, chat recipient
selection, note search, or ActivityPub account discovery.

## Behavior

- `Liane Dubowy` should match `Liane M. Dubowy` (tokens may have words between them).
- `Liane Dubowi` should return an existing `Liane Dubowy` account (pg_trgm).
- Exact username and display name matches rank above partial/fuzzy matches.
- Accounts with `updatedAt` older than 30 days remain searchable.
- Muted and suspended users remain excluded. Origin (all/local/remote) and
  limit/offset still apply.
- Search is limited to **accounts already known to this server**; it does not
  discover all unknown Fediverse accounts by display name.

## Migration

**Test on an isolated test database first.** The new migration
`1791700000000-ImproveUserSearch.js` enables the PostgreSQL `pg_trgm`
extension and creates two GIN indexes on the `user` table. The migrations
are transactional by default, so index creation may temporarily block writes
on the user table. It does not rebuild the large `note` table.

Check disk space and keep a recent database backup before running migrations.
FediKey production setups that start directly with `pnpm --filter backend start`
must run the database migration explicitly before deploying the new web image:

```sh
pnpm --filter backend migrate
```

Run this only against the intended **test** database first, using the test
instance's configuration. Do not migrate the production database to test a branch.

## Automated tests

With an isolated E2E PostgreSQL and Redis configuration, run:

```sh
pnpm --filter backend test:e2e --run test/e2e/users.ts
```

Check name-token matching, misspelled surname, inactive profiles, ranking,
and stable pagination.

## Manual smoke checks

1. Search exact usernames, multi-part display names, and typo variants.
2. Search an older, known remote account.
3. Verify Local and Remote filtering and muted/suspended accounts.
4. Repeat a note search separately; note-search timeouts are **not** fixed by
   this change.
5. Inspect slow SQL queries (especially profile-description fallbacks)
   before considering a production rollout.
