# Misskey-Upstream-Abgleich

Dieser Stand dokumentiert gezielte Übernahmen aus [Misskey 2026.10.1](https://github.com/misskey-dev/misskey/releases/tag/2026.10.1). Er ist **kein vollständiger Merge** der Version.

- Gemeinsame Ausgangsbasis: Misskey `2026.9.1`, Commit `7f05994f003a1d84e80aa89aef7de4925880f408`.
- Geplanter Upstream-Zielstand: Misskey `2026.10.1`, Commit `4840fa6d576128ba916ba69169258ca177d40faf`.
- Aktueller Status: **P1 – teilweise übernommen, ungetesteter Draft**. Die FediKey-Versionsnummer bleibt bis zum vollständigen Abgleich unverändert.

## Übernommene Änderungen (P1, erster Schritt)

- Node.js-Docker-Basis `26.12.1-trixie`, Mindestversion `22.23.4` und aktualisierte Engines (`27a426c02d`).
- `fastify` von `5.12.1` auf `5.12.7` und `sanitize-html` von `2.17.7` auf `2.18.1`, inklusive FediKey-kompatibel ergänztetem pnpm-Lockfile (Upstream-Sicherheitsupdates [#17990](https://github.com/misskey-dev/misskey/pull/17990), [#18039](https://github.com/misskey-dev/misskey/pull/18039)).
- Advisory Lock bei paralleler Registrierung gleicher lokaler Benutzernamen und sicherer Umgang mit nicht angemeldeten Nutzern bei rollenbasierten APIs ([#18035](https://github.com/misskey-dev/misskey/pull/18035)).
- Query-Parameter in ActivityPub-HTTP-Signaturen, inklusive Unit-Tests ([#17941](https://github.com/misskey-dev/misskey/pull/17941)).
- Test auf nicht authentifizierte Benutzersuche aus [#18035](https://github.com/misskey-dev/misskey/pull/18035).

## Noch offen

- `pnpm` 11 → 12 und die vollständige Abhängigkeitsaktualisierung. Diese Versionen sollen erst mit einem neu generierten und getesteten Lockfile folgen. Die eigenen `@node-rs/argon2`-Abhängigkeiten müssen erhalten bleiben.
- Sentry SDK 10 → 11, inklusive datensparsamer `dataCollection`-Vorgaben und Konfiguration.
- Weitere Sicherheits-/Backend-Korrekturen sowie die neuen Misskey-Funktionen, insbesondere moderationsrelevante Änderungen.
- Build und Tests mit Node.js 26.12.1 / pnpm 11.25.0 gegen eine Testdatenbank. Nicht direkt produktiv ausrollen.

Jede weitere Upstream-Übernahme wird separat dokumentiert. Erst nach abgeschlossenem Review kann dieser Referenzstand als vollständig synchronisiert markiert werden.
