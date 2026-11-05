# Misskey-Upstream-Abgleich 2026.10.1

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
