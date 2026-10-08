# FediKey

**Ein unabhängiger Misskey-Fork mit ausgewählten Funktionen aus Sharkey.**

FediKey verbindet den aktuellen Misskey-Unterbau mit portierter Notizbearbeitung, Bearbeitungshistorie und Kompatibilität zu bestehenden Sharkey-Passwörtern. Das Projekt entsteht aus dem Betrieb von [Fedihub.space](https://fedihub.space) und wird von [Happyfeet01](https://github.com/Happyfeet01) gepflegt.

FediKey baut auf der Arbeit von [Misskey](https://github.com/misskey-dev/misskey) und [Sharkey](https://activitypub.software/TransFem-org/Sharkey) auf. Es ist ein eigenständiges Projekt und wird nicht von deren Teams veröffentlicht.

[Repository](https://github.com/Happyfeet01/FediKey) · [Fehler melden](https://github.com/Happyfeet01/FediKey/issues) · [Lizenz](LICENSE)

## Entwicklungsstand

FediKey befindet sich in früher Entwicklung. Der aktuelle Unterbau ist **Misskey 2026.9.1**. Diese Versionsnummer bezeichnet die Misskey-Basis; sie ist keine eigenständige FediKey-Release-Nummer.

Seit dem **8. Oktober 2026** läuft FediKey auf Fedihub.space. Zuvor wurden eine separate Testinstallation und die Migration einer Sharkey-2025.4.7-Instanz mit Docker Compose erprobt. Der laufende Betrieb wird weiter beobachtet. Daraus lässt sich noch keine allgemeine Zusage für andere Installationen oder Sharkey-Versionen ableiten.

## Was FediKey ergänzt

- **Notizen bearbeiten:** Text, Inhaltswarnung, Anhänge und Umfragen lassen sich nachträglich ändern.
- **Bearbeitungshistorie:** Frühere Fassungen werden gespeichert und können über die Oberfläche abgerufen werden.
- **Bestehende Beziehungen erhalten:** Notiz-ID und URL bleiben erhalten; Antworten und Reaktionen hängen weiterhin an derselben Notiz.
- **Umfragen berücksichtigen:** Reine Textänderungen erhalten bestehende Stimmen. Änderungen an den Umfrageoptionen setzen den zugehörigen Abstimmungsstand zurück.
- **ActivityPub-Updates:** Bearbeitungen werden als Updates übertragen und empfangen. Ältere Updates sollen einen neueren Stand nicht überschreiben.
- **Sichtbarkeit beachten:** Die Historie unterliegt den Zugriffsregeln der Notiz. Die Bearbeitung ändert weder Sichtbarkeit noch Antwortziel, Zitatziel, Kanal oder den Nur-lokal-Status.
- **Sharkey-Passwörter unterstützen:** Bestehende Argon2id-Passwörter können neben den vom Misskey-Unterbau verwendeten bcrypt-Passwörtern geprüft werden. Die Zwei-Faktor-Anmeldung bleibt Bestandteil des Anmeldeablaufs.

FediKey übernimmt ausgewählte Funktionen aus Sharkey. Eine vollständige Übernahme aller Sharkey-Funktionen ist nicht enthalten.

## Neuinstallation mit Docker Compose

Diese Anleitung richtet eine **neue Instanz mit leeren Datenverzeichnissen** ein. Für eine bestehende Instanz gilt der Abschnitt [Migration von Sharkey](#migration-von-sharkey).

Voraussetzungen sind Git, Docker mit Compose, eine eigene Domain und ein HTTPS-Reverse-Proxy. Docker baut die Anwendung mit den im Repository festgelegten Node.js- und pnpm-Versionen.

### 1. Repository und Konfiguration vorbereiten

```bash
git clone https://github.com/Happyfeet01/FediKey.git
cd FediKey
git switch main

cp compose_example.yml compose.yml
cp .config/docker_example.yml .config/default.yml
cp .config/docker_example.env .config/docker.env
mkdir -p files db redis
sudo chown 991:991 files
```

Bearbeite anschließend die Konfiguration:

| Datei | Erforderliche Anpassungen |
| --- | --- |
| `.config/default.yml` | Öffentliche HTTPS-URL, interner Web-Port, PostgreSQL-Zugang und Redis-Verbindung |
| `.config/docker.env` | PostgreSQL-Datenbank, Benutzer und ein neues, starkes Passwort |
| `compose.yml` | Host-Port und gegebenenfalls die Einbindung in das eigene Reverse-Proxy-Netz |

Die Datenbankangaben in beiden Konfigurationsdateien müssen übereinstimmen. Im Compose-Beispiel heißen die internen Dienste `db` und `redis`; deren Ports sind `5432` und `6379`.

Der Web-Container verwendet standardmäßig UID/GID `991:991`. Er muss `files` beschreiben und `.config/default.yml` lesen können. Konfigurationen mit Zugangsdaten dürfen nicht ins Repository gelangen.

**Lege die öffentliche Instanz-URL vor dem ersten Start endgültig fest.** Eine spätere Änderung ist kein gewöhnlicher Konfigurationswechsel und kann die Föderation beschädigen.

Bei einem Reverse-Proxy auf demselben Host kann die Portfreigabe in `compose.yml` auf Loopback beschränkt werden:

```yaml
ports:
  - "127.0.0.1:3000:3000"
```

Bei einem Reverse-Proxy in einem anderen Container muss dessen Netzwerkzugriff passend eingerichtet werden.

### 2. Image bauen und Datenbank initialisieren

```bash
docker compose build --pull web
docker compose up -d db redis
docker compose ps
```

Warte, bis PostgreSQL und Redis als `healthy` angezeigt werden. Führe dann die Migrationen aus:

```bash
docker compose run --rm --no-deps web pnpm --filter backend migrate
```

Das mitgelieferte Compose-Beispiel nutzt PostgreSQL 18. **Ein Datenverzeichnis einer älteren PostgreSQL-Hauptversion darf nicht direkt mit diesem Image gestartet werden.** Bestehende Daten benötigen einen passenden PostgreSQL-Upgrade- oder Dump/Restore-Ablauf.

### 3. Anwendung starten

```bash
docker compose up -d web
docker compose ps
docker compose logs --tail=100 -f web
```

Richte den HTTPS-Reverse-Proxy einschließlich WebSocket-Unterstützung auf den konfigurierten Web-Port ein. Öffne danach die öffentliche Instanz-URL und schließe die Ersteinrichtung ab.

Die Verzeichnisse `db`, `redis`, `files` und die eigene Konfiguration gehören zur Installation. Sichere insbesondere Datenbank, lokale Dateien und Konfiguration regelmäßig. Prüfe auch, ob sich die Sicherung tatsächlich wiederherstellen lässt.

## Migration von Sharkey

Die bisher erprobte Migration betrifft **Sharkey 2025.4.7 mit Docker Compose**. Dabei waren zusätzliche Anpassungen am Datenbankschema und eine Überführung der vorhandenen Bearbeitungshistorie nötig.

**Ein allgemeiner automatischer Sharkey-Migrationspfad ist derzeit nicht Teil dieses Repositorys.** Ein Austausch des Web-Images allein ersetzt diese Arbeiten nicht.

Für eine Migration sind mindestens folgende Schritte einzuplanen:

1. Ausgangsversion, Datenbankschema, PostgreSQL-Version und verwendete Dienste erfassen.
2. Datenbank, Dateien und Konfiguration sichern und eine Wiederherstellung testen.
3. Eine isolierte Kopie migrieren; sie darf nicht parallel unter der Produktionsidentität föderieren.
4. Schema-Unterschiede und vorhandene Historien vor den FediKey-Migrationen nachvollziehbar überführen.
5. Anmeldung einschließlich Zwei-Faktor-Authentifizierung, Dateien, Notizen, Historien, Suche und Föderation testen.
6. Erst nach erfolgreichem Probelauf die Produktion mit angehaltenen Schreibzugriffen und einem frischen Backup umstellen.

Eine übernommene Historie kann nur Informationen enthalten, die die Ausgangsversion tatsächlich gespeichert hat. Fehlende frühere Inhaltswarnungen, Anhänge oder Umfragezustände lassen sich nicht zuverlässig nachträglich rekonstruieren.

## Tests und Entwicklung

Für die Entwicklung gelten die Versionen aus `package.json` und dem `Dockerfile`. Installiere die Entwicklungsabhängigkeiten mit:

```bash
pnpm install --frozen-lockfile
```

Der gezielte Backend-E2E-Test für die Notizbearbeitung wird so gestartet:

```bash
pnpm --filter backend test:e2e --run test/e2e/note-edit.ts
```

Dafür müssen eine eigene Testkonfiguration sowie separate PostgreSQL- und Redis-Dienste bereitstehen. Die Vorlage liegt unter [`.github/misskey/test.yml`](.github/misskey/test.yml). **Tests dürfen nicht auf die Produktionsdatenbank zeigen.**

Der fokussierte Note-Editing-E2E-Lauf wurde mit **13 bestandenen Tests** abgeschlossen. Zusätzlich wurden Oberfläche, Bearbeitungshistorie, Anmeldung und Bearbeitungen zwischen FediKey und einer Sharkey-Instanz manuell geprüft. Das ersetzt keinen vollständigen Test aller geerbten Misskey-Funktionen.

Der [Note-Editing-Testleitfaden](docs/note-editing-test.md) beschreibt die ursprüngliche separate Branch-Testinstallation und weitere Prüfungen. Seine Checkout-Anweisungen beziehen sich noch auf `feature/note-editing`; für den aktuellen Projektstand ist `main` maßgeblich.

## Mitmachen

Fehlerberichte und Verbesserungsvorschläge sind über die [Issues](https://github.com/Happyfeet01/FediKey/issues) willkommen, auf Deutsch oder Englisch.

Hilfreich sind der verwendete Commit, die Installationsart, reproduzierbare Schritte und relevante Fehlermeldungen. Entferne Passwörter, Tokens und private Daten aus Logs, bevor du sie veröffentlichst. Sicherheitslücken bitte nicht mit ausnutzbaren Details in öffentlichen Issues melden.

Die [technischen Beitragsregeln](CONTRIBUTING.md) stammen aus dem Misskey-Unterbau. Zusätzliche Arbeitsregeln stehen in [AGENTS.md](AGENTS.md).

## Noch offene Arbeiten

Teile der Oberfläche, Paketmetadaten und Dokumentation tragen weiterhin Misskey-Bezeichnungen. Auch bestehende Installationen können noch Sharkey-Links in ihren Branding-Einstellungen enthalten. Eine durchgängige FediKey-Darstellung und eine besser dokumentierte Migration sind weitere Arbeiten am Projekt.

## Herkunft und Lizenz

FediKey basiert auf Misskey; die portierte Notizbearbeitung geht auf Sharkey zurück. Danke an die Entwicklerinnen und Entwickler beider Projekte sowie ihre Mitwirkenden.

Der Anwendungscode steht unter **GNU AGPL v3**; maßgeblich sind die [Lizenzdatei](LICENSE) und die Lizenzhinweise der jeweiligen Dateien und Pakete. Einzelne Pakete und Abhängigkeiten können abweichende Lizenzen haben. Vorhandene Urheber- und Lizenzhinweise bleiben erhalten.
