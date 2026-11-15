# Wöchentlicher Upstream-Abgleich mit Misskey

FediKey übernimmt das Versionsschema von Misskey. Jede Woche wird geprüft, welche
Änderungen [misskey-dev/misskey](https://github.com/misskey-dev/misskey) seit dem
zuletzt integrierten Release (der Version in `package.json`) erhalten hat, und
sinnvolle Änderungen werden übernommen — ohne die eigenen FediKey-Funktionen
(insbesondere die Notizbearbeitung) zu überschreiben.

## 1. Bericht erzeugen

```sh
node scripts/upstream-compare.mjs
# optional mit gespeichertem Bericht (in docs/, damit der Verweis im Bericht aufgelöst wird):
node scripts/upstream-compare.mjs --out docs/upstream-compare-$(date +%F).md
```

Das Skript legt das Remote `upstream` (misskey-dev/misskey) automatisch an,
fetcht es (`--filter=blob:none`) und vergleicht:

- **Baseline**: Tag der Version aus `package.json` (z. B. `2026.10.1`) — das ist
  der zuletzt integrierte Upstream-Stand.
- **Ziel**: neuestes Release-Tag von upstream (z. B. `2026.11.0`) sowie
  `upstream/develop` für Commits nach dem Release.
- **Eigene Änderungen**: Tree-Diff `Baseline..HEAD` — alle Dateien, die FediKey
  gegenüber dem Baseline-Stand verändert hat.

Der Bericht listet die neuen Upstream-Commits gruppiert (Security, Fixes,
Features, Performance, Migrationen, Release-Artefakte), neue
Datenbank-Migrationen, API-/SDK-Änderungen und alle Dateien, die **sowohl
upstream als auch in FediKey** geändert wurden (Konfliktpotenzial).

Optionen: `--baseline REV`, `--target REV`, `--out DATEI`, `--no-fetch`.

## 2. Bericht bewerten

- Security-Commits und Fixes für produktiv genutzte Bereiche zuerst.
- Neue Migrationen notieren — sie laufen beim nächsten Start automatisch, müssen
  aber vor dem Upgrade der Instanz geprüft werden (Backup, Testinstanz zuerst).
- API-Änderungen in `packages/misskey-js` erfordern nach der Übernahme
  `pnpm build-misskey-js-with-types`.
- Die Konfliktliste im Bericht ist die wichtigste Sektion: Dateien mit dem
  Vermerk **geschützt (FediKey-Feature)** enthalten eigene Implementierungen.

## 3. Änderungen übernehmen

Nie direkt auf `main` arbeiten:

```sh
git checkout -b upstream/2026.11.0
# entweder gezielt cherry-picken:
git cherry-pick <commit>...
# oder das Release mergen und Konflikte manuell lösen:
git merge 2026.11.0
```

Beim Lösen von Konflikten gilt:

- **Geschützte Bereiche** (FediKey-eigene Funktionen) behalten immer die
  FediKey-Version. Dazu gehören insbesondere:
  - `packages/backend/src/core/NoteEditService.ts`
  - `packages/backend/src/models/NoteEdit.ts` und die Migration `1791284200000-NoteEditing.js`
  - Endpunkte `notes/edit` und `notes/versions`
  - ActivityPub-Verarbeitung für Note-Updates (`ApNoteService.ts`, `ApInboxService.ts`, `ApRendererService.ts`)
  - `NoteEntityService.ts`, `models/Note.ts`, `json-schema/note.ts` (Notiz-Edit/updatedAt)
  - Frontend: `MkNote.vue`, `MkNoteHeader.vue`, `MkPostForm.vue`, `types/post-form.ts`, `composables/use-note.ts`, `utility/get-note-menu.ts`
- Nie blind `git merge -X ours` / `-X theirs` verwenden.
- Bestehende Migrationen niemals bearbeiten; bei Schemaänderungen neue
  Migration mit `node -e "console.log(Date.now())"` als Zeitstempel anlegen.
- Locale-Dateien außer `locales/ja-JP.yml` nicht von Hand anfassen (Crowdin-Sync);
  FediKey pflegt de-DE/en-US bewusst selbst.
- Neue Dateien brauchen den SPDX-Header (`node scripts/check-spdx.mjs`).

## 4. Validieren

| Prüfung | Befehl |
| --- | --- |
| Lint (geänderte Dateien) | `pnpm exec eslint --quiet <dateien>` |
| Backend-Unit-Tests | `pnpm --filter backend test` |
| Backend-E2E | `pnpm --filter backend test:e2e` (`.config/test.yml` nötig) |
| Föderation | `pnpm --filter backend test:fed` |
| Migration-Diff | `pnpm --filter backend check-migrations` |
| misskey-js neu generieren | `pnpm build-misskey-js-with-types` |
| Gesamtbuild | `pnpm build` |
| SPDX | `node scripts/check-spdx.mjs` |
| Locale-Safety | keine `locales/*.yml` außer `ja-JP.yml` geändert |

Danach PR gegen `main` stellen. Erst nach bestandener CI und manuellem Review
mergen — niemals ohne Freigabe mergen oder pushen.

## 5. Versionierung

Die Version in `package.json` bleibt an Misskey gekoppelt. Wird ein neues
Upstream-Release übernommen (z. B. `2026.11.0`), wird die Version entsprechend
angehoben. Dadurch wird dieses Release automatisch die **Baseline des nächsten
wöchentlichen Abgleichs** — das Skript liest sie aus `package.json` aus.

## Historie

- Letzter vollständiger Abgleich: [upstream-sync.md](upstream-sync.md) (Misskey 2026.10.1).
