# Misskey-Upstream-Abgleich

Dieser Stand dokumentiert gezielte Übernahmen aus [Misskey 2026.10.1](https://github.com/misskey-dev/misskey/releases/tag/2026.10.1). Er ist **kein vollständiger Merge** der Version.

- Gemeinsame Ausgangsbasis: Misskey `2026.9.1`, Commit `7f05994f003a1d84e80aa89aef7de4925880f408`.
- Geplanter Upstream-Zielstand: Misskey `2026.10.1`, Commit `4840fa6d576128ba916ba69169258ca177d40faf`.
- Aktueller Status: **P1 teilweise und P2 als gezielter Backport; DB-/Federation-Validierung für P2 noch ausstehend**. Die FediKey-Versionsnummer bleibt bis zum vollständigen Abgleich unverändert.

## Übernommene Änderungen (P1, erster Schritt)

- Node.js-Docker-Basis `26.12.1-trixie`, Mindestversion `22.23.4` und aktualisierte Engines (`27a426c02d`).
- `fastify` von `5.12.1` auf `5.12.7` und `sanitize-html` von `2.17.7` auf `2.18.1`, inklusive FediKey-kompatibel ergänztetem pnpm-Lockfile (Upstream-Sicherheitsupdates [#17990](https://github.com/misskey-dev/misskey/pull/17990), [#18039](https://github.com/misskey-dev/misskey/pull/18039)).
- Advisory Lock bei paralleler Registrierung gleicher lokaler Benutzernamen und sicherer Umgang mit nicht angemeldeten Nutzern bei rollenbasierten APIs ([#18035](https://github.com/misskey-dev/misskey/pull/18035)).
- Query-Parameter in ActivityPub-HTTP-Signaturen, inklusive Unit-Tests ([#17941](https://github.com/misskey-dev/misskey/pull/17941)).
- Test auf nicht authentifizierte Benutzersuche aus [#18035](https://github.com/misskey-dev/misskey/pull/18035).

## Noch offen

- `pnpm` 11 → 12 und die vollständige Abhängigkeitsaktualisierung. Diese Versionen sollen erst mit einem neu generierten und getesteten Lockfile folgen. Die eigenen `@node-rs/argon2`-Abhängigkeiten müssen erhalten bleiben.
- Sentry SDK 10 → 11, inklusive datensparsamer `dataCollection`-Vorgaben und Konfiguration.
- Verbleibende Upstream-Änderungen und neue Funktionen (Ankündigungsarchivierung, Follow-Schutz, Clip-Spalte).
- Build und Tests mit Node.js 26.12.1 / pnpm 11.25.0 gegen eine Testdatenbank. Nicht direkt produktiv ausrollen.

Jede weitere Upstream-Übernahme wird separat dokumentiert. Erst nach abgeschlossenem Review kann dieser Referenzstand als vollständig synchronisiert markiert werden.


## Übernommene Änderungen (P2)

Aufbauend auf `security/misskey-2026.10.1`, Commit `b9566b3615`:

- Chatraum-Einladungen beachten Blockierungen in beiden Richtungen; beim Blockieren werden vorhandene Einladungen entfernt ([#18041](https://github.com/misskey-dev/misskey/pull/18041), `3e01e6ed2e`).
- Accountmigration übernimmt Follower auf dem Zielserver korrekt ([#18023](https://github.com/misskey-dev/misskey/pull/18023), `ebd9c80ee3`), einschließlich Federation-Regressionstest.
- Lokale Emojis werden auf entfernten Renotes in Backend und Frontend eingeschränkt ([#17406](https://github.com/misskey-dev/misskey/pull/17406), `9e3d8d11db`), einschließlich Tests und zugehöriger Review-Korrektur aus `fa478ce762`.
- URL-Normalisierung für verbotene und sensible Wörter ([#18044](https://github.com/misskey-dev/misskey/pull/18044), `e60942b3f2`), einschließlich `mfm-js 0.28.0`, Unit-/E2E-Tests und zusätzlicher Pfad-Tests aus `fa478ce762`. FediKeys Notizbearbeitung nutzt bereits dieselbe Prüfung auf verbotene Wörter.
- Streaming optimiert Reaktionsaufbereitung, wiederverwendet Instanz-Mutes und bündelt Aktivitätsupdates je Benutzer; WebSocket-Nutzlast und Sendepuffer werden begrenzt ([#18021](https://github.com/misskey-dev/misskey/pull/18021), `8802b29c13`). Die vorhandene Rollenprüfung bleibt erhalten.

Der Lockfile wurde mit pnpm 11.25.0 neu aufgelöst und normalisiert. Eigene Argon2-Abhängigkeiten bleiben erhalten. Der Frontend-Regressionstest liegt unter `test/unit`, damit ihn die bestehende Vitest-Konfiguration tatsächlich ausführt.

### Lokale Validierung von P2

- PASS: Backend-Build; Backend-Typprüfung einschließlich Unit-/Federation-Testtypen.
- PASS: 16 URL-/Decoder-Unit-Tests und 2 Frontend-Emoji-Tests.
- PASS: Änderungsbezogenes ESLint, SPDX und Locale-Schutz.
- BLOCKIERT: ReactionService-Tests benötigen PostgreSQL auf Port 54312; der lokale Docker-Daemon ist nicht zugänglich. DB-/E2E-/Federation-Läufe müssen in CI bzw. der isolierten Testumgebung bestätigt werden.
- Keine API-Schema- oder Datenbankmigration geändert; Versionsnummer unverändert. Kein vollständiger Abgleich mit 2026.10.1.
