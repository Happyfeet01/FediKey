# FediKey note-editing test guide

This guide is for testing the `feature/note-editing` branch in an isolated environment. Do not point this setup at the production database or production file storage.

## 1. Clone the test branch

```bash
git clone https://github.com/Happyfeet01/FediKey.git fedikey-note-edit-test
cd fedikey-note-edit-test
git switch feature/note-editing
git pull --ff-only
```

If the repository is cloned through SSH instead, use your normal SSH URL.

## 2. Create an isolated Docker configuration

```bash
cp compose_example.yml compose.yml
cp .config/docker_example.yml .config/default.yml
cp .config/docker_example.env .config/docker.env
mkdir -p files db redis
```

Edit `.config/default.yml` and set a test-only URL. The URL must never be changed after the instance has started.

At minimum, check these values:

```yaml
url: https://YOUR-TEST-HOST/
port: 3000

db:
  host: db
  port: 5432
  db: misskey
  user: example-misskey-user
  pass: example-misskey-pass

redis:
  host: redis
  port: 6379
```

Use matching PostgreSQL credentials in `.config/docker.env`.

If another service already uses host port 3000, change only the host side of the mapping in `compose.yml`, for example:

```yaml
ports:
  - "3100:3000"
```

The instance URL still needs to match the URL used through the reverse proxy.

## 3. Build the branch

```bash
docker compose build --pull web
```

This runs the full Misskey/FediKey production build inside the Docker build.

## 4. Start PostgreSQL and Redis

```bash
docker compose up -d db redis
docker compose ps
```

Both services should become healthy.

## 5. Run the migration explicitly

```bash
docker compose run --rm web pnpm --filter backend migrate
```

The note-editing migration should add:

- `note.updatedAt`
- the `note_edit` table
- its foreign keys and index

You can verify the schema with:

```bash
docker compose exec db psql -U example-misskey-user -d misskey -c '\d note'
docker compose exec db psql -U example-misskey-user -d misskey -c '\d note_edit'
```

## 6. Start FediKey

```bash
docker compose up -d web
docker compose logs -f --tail=200 web
```

The web container should become healthy and stay running without migration or dependency-injection errors.

## 7. Local functional test

Create a test account and a normal note, then check the following in the UI.

1. Open the note menu and choose **Edit**.
2. Change the text and content warning.
3. Confirm that the note keeps the same URL and note ID.
4. Confirm that the pencil/edited marker appears.
5. Open the edit history and verify the previous text.
6. Refresh the page and verify that the edited text persists.
7. Open a second browser session and verify that an already visible note refreshes after an edit.

Also test:

- add and remove an attachment
- edit a note that already has replies
- edit a note that already has reactions
- edit a quote without changing the quote target
- edit a channel note without changing its channel
- edit a followers-only and specified note without changing visibility
- edit a local-only note and verify that it stays local-only

The editor intentionally does not allow changing account, visibility, local-only state, reply target, quote target or channel.

## 8. Poll test

Create a poll and cast at least one vote from another account.

First edit only the note text. Existing poll votes must remain.

Then edit the poll choices. The old vote state must be removed and the counters reset. The voter must be able to vote again in the changed poll.

Also verify that an edit containing an already expired absolute `expiresAt` value is rejected.

## 9. Database/history check

After at least two real edits:

```bash
docker compose exec db psql -U example-misskey-user -d misskey -c \
  'SELECT "noteId", "oldDate", "updatedAt", "text", "newText", "cw", "newCw" FROM note_edit ORDER BY "updatedAt" DESC LIMIT 20;'
```

Each real change should produce one history row. Sending an edit that changes nothing should not create another row.

## 10. ActivityPub federation test

For a real federation test, use two independently reachable HTTPS instances, for example A and B.

1. Account B follows account A.
2. A creates a public note.
3. Confirm that the note reaches B.
4. A edits the note.
5. Confirm that B shows the new text without creating a second note.
6. Confirm that B exposes one edit-history entry for the previous text.
7. Edit the same note again and confirm the history grows.
8. Send or reproduce an older ActivityPub `Update` after a newer one and confirm it does not roll the note back.
9. Create and edit a local-only note on A and confirm B receives nothing.

The outgoing ActivityPub object should be an `Update` whose object keeps the original note ID and carries an `updated` timestamp.

## 11. Automated tests

Once the environment has the development dependencies available, the focused backend test can be run with:

```bash
pnpm --filter backend test:e2e -- note-edit
```

The federation suite contains a note-editing test that checks delivery of an `Update` to a remote follower and creation of remote edit history.

For the full relevant checks:

```bash
pnpm --filter backend test
pnpm --filter backend test:e2e
pnpm --filter backend test:fed
pnpm --filter backend check-migrations
pnpm --filter frontend test
pnpm lint
pnpm build
```

The backend federation suite is exposed as `test:fed` in `packages/backend/package.json`.

## 12. Rollback

Because this is an isolated test installation, the safest rollback is to remove the test stack and its dedicated volumes/data directories:

```bash
docker compose down
```

Only remove `db`, `redis` and `files` after confirming that they belong exclusively to this test installation.

Do not test this branch against the production FediKey/Misskey database until local editing, history, polls and two-instance federation have all passed.
