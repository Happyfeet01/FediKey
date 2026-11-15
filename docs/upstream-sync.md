# Misskey-Upstream-Abgleich 2026.11.0

Dieser Integrationsstand gleicht FediKey mit [Misskey 2026.11.0](https://github.com/misskey-dev/misskey/releases/tag/2026.11.0) ab. Freigabe, Merge nach `main` und produktives Deployment erfolgen separat.

- FediKey-Ausgangspunkt: `ce4fc94dd2add4c2b50d6d122f317a58dcc5766e` (2026.10.1).
- Upstream-Quellstand: `dd7b4905d715d2587fa2f2cb6a88ecac8878ef0d` (2026.11.0).
- Wie beim bisherigen Backport erfolgt die veröffentlichte Integration als Quellabgleich auf FediKeys Historie. Der offizielle Upstream-Commit wird dabei nicht als zusätzlicher Git-Elterncommit importiert. Für künftige Abgleiche deshalb den hier dokumentierten Quellstand verwenden und nicht aus `git merge-base` auf die zuletzt integrierte Version schließen.
- Die 34 Konfliktdateien wurden einzeln mit dem vorherigen Upstream-Quellstand `4840fa6d576128ba916ba69169258ca177d40faf` und FediKeys Abweichungen abgeglichen.
- Notizbearbeitung, History, ActivityPub-Updates, Argon2id/bcrypt-Anmeldung, Nutzersuche und Entfernung von Google Analytics bleiben erhalten. Die native Argon2-Abhängigkeit bleibt im Lockfile und im Backend-Build extern.
- FediKeys zusätzlicher ActivityPub-Update-Pfad verwendet die neue `htmlToMfm`-Optionsstruktur. Ein Regressionstest prüft HTML-Bearbeitungen mit Hashtags und beiden unterstützten Quote-Feldern.
- Die vorhandene Migration `1746949539915-migrateSomeConfigFileSettingsToMeta.js` bleibt bytegleich zum eingesetzten FediKey-Stand. Neu ist nur die Upstream-Migration `1794385801836-FixMetaMigratedConfigColumnDefaults.js` samt Hilfsmodul. Bestehende Metadatenwerte werden nicht überschrieben.
- Crowdin-Übersetzungen außerhalb `ja-JP.yml` bleiben bytegleich zu FediKey `main`; bestehende deutsche/englische FediKey-Texte bleiben erhalten.
- Die bereits nach `test/unit` verschobenen Frontend-Tests werden nicht zusätzlich unter `src` abgelegt.

Laufzeit, Upgrade und dokumentierte Prüfergebnisse: [releases/2026.11.0.md](releases/2026.11.0.md).

# Archiv: Misskey-Upstream-Abgleich 2026.10.1

FediKey ist im Entwicklungsbranch vollständig mit dem Code von [Misskey 2026.10.1](https://github.com/misskey-dev/misskey/releases/tag/2026.10.1) abgeglichen. Dies ist ein Release-Kandidat; die Freigabe und das Zusammenführen in `main` erfolgen separat.

- Frühere Basis: `7f05994f003a1d84e80aa89aef7de4925880f408` (2026.9.1).
- Integrierter Upstream-Stand: `4840fa6d576128ba916ba69169258ca177d40faf` (2026.10.1).
- Grundlage dieses letzten Integrationsschritts: PR #12, `d048da6655aacca4388e65c231555d4c806412f6`.
- Die bisher in PR #10–#12 einzeln übernommenen Änderungen bleiben enthalten. Der vollständige Codeabgleich wird als weiterer Integrationsschritt auf PR #12 aufbereitet; der genaue Upstream-Quellcommit ist oben dokumentiert.

## Vollständig ergänzte Bereiche

- pnpm 12.14.0 und konsistent neu erzeugter Lockfile; sämtliche Paketaktualisierungen des Zielstands einschließlich NestJS 12, Vitest 5 und Sentry 11.8.0.
- Sentry-v11-Adapter einschließlich datensparsamer Vorgaben, Konfigurationshinweisen und Regressionstests.
- Automatische Ankündigungsarchivierung einschließlich UI, Wiederherstellung geplanter Jobs, Datenbankmigration und Tests.
- Verbleibende Korrekturen für Push-Abonnements, Federation, Relay-Antworten, Queue-Verarbeitung, Downloads, Hashtag-Normalisierung, Clip-Zähler, HTML-Linkvorschauen und lokale Bildauslieferung.
- Gemeinsame MFM-Darstellung, Änderungen am eingebetteten Frontend und verbleibende Frontend-/Profilkorrekturen.
- Vollständige API-/SDK-Neugenerierung und Versionsangabe 2026.10.1.

## Bewusst erhaltene FediKey-Abweichungen

- Notizbearbeitung, Bearbeitungshistorie, ActivityPub-Updates und reaktive Live-Anzeige. Die Notizbearbeitung verwendet nach Wegfall von `normalizeForSearch` ebenfalls Upstreams neue `normalizeTag`-Funktion.
- Argon2id-Passwortprüfung und zugehörige native Abhängigkeit; bestehende bcrypt-Kompatibilität bleibt erhalten. `@nestjs/testing` wird passend zu NestJS 12 aktualisiert.
- Verbesserte Nutzersuche, Entfernung von Google Analytics sowie FediKey-spezifische Bedienungs- und Darstellungsänderungen.
- Korrekturen aus unseren vorangegangenen PRs: parameterisierter ReactionService-Test-Mock, Clip-Favoriten-Cache und Datenschutz-Suchindex.
- Bereits in `test/unit` erfasste Frontend-Tests bleiben dort; doppelte, von der aktuellen Testkonfiguration ignorierte Upstream-Kopien werden nicht erneut angelegt.
- Deutsche und englische Übersetzungen werden auf ausdrücklichen Wunsch gepflegt. Die übrigen Sprachdateien bleiben auf dem Stand von PR #12. Diese Locale-Ausnahme ist beabsichtigt; der allgemeine Locale-Schutz des Repositories meldet sie weiterhin.
- Die Rollen-Timeline erhält Upstreams strengere Prüfung auf öffentliche UND erkundbare Rollen beim Abonnieren und bei der Auslieferung.

## Validierung

- Produktionsbuild aller Workspaces und API-/SDK-Neugenerierung bestanden.
- Backend- und Frontend-Typprüfung bestanden.
- Frontend: 187 Tests bestanden.
- PostgreSQL 18.6: alle Migrationen angewendet; `check-migrations` meldet keine ausstehenden Schemaänderungen.
- Backend-Unit-Tests: erster Gesamtlauf 868 bestanden; zwei Testdateien benötigten zusätzlich Meilisearch/FFmpeg. Nach Vervollständigung der isolierten Umgebung bestanden beide Dateien mit 47 Tests. Über die gesamte Suite damit 886 erfolgreiche Fälle und 2 vorgesehene Skips.
- Backend-E2E: 1379 bestanden, 2 Skips und 20 vorhandene TODO-Fälle; alle 32 Testdateien bestanden.
- SDK: 14 Tests und Typ-Tests bestanden.
- Upgrade vom Datenbankschema aus PR #12 mit vorhandenen Argon2id- und bcrypt-Hashes bestanden: nur die zwei neuen Migrationen werden angewendet, Hashes bleiben identisch und verifizierbar. Down/up beider Migrationen und anschließende Schema-Prüfung bestanden.
- Federation und Docker-Image-Prüfungen laufen in GitHub-CI; lokale Federation-Container wurden nicht gestartet.
- Änderungenbezogenes ESLint und SPDX bestanden. YAML-Dateien wurden auf doppelte Schlüssel und gültige Syntax geprüft.

Upgrade-Hinweise: [releases/2026.10.1.md](releases/2026.10.1.md).
