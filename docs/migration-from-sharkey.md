# Von Sharkey zu FediKey wechseln

Diese Anleitung beschreibt einen Wechsel einer bestehenden Instanz mit Docker Compose. Domain, Konten, Datenbank und Dateien bleiben erhalten. Es handelt sich nicht um einen Kontoumzug auf eine andere Domain.

## Geltungsbereich und Prüfstand

Grundlage ist die bisherige Migration von **Sharkey 2025.4.7** und die dabei verwendete SQL-Brücke. Die Befehle wurden für andere Installationen verallgemeinert und mit dem FediKey-Code bei Commit `faca7839fdbc21238d820092ca6c6ec52c6caecb` abgeglichen. **Der hier zusammengestellte Gesamtablauf wurde noch nicht erneut an einer Sharkey-Datenbank durchgespielt. Er ist ein Entwurf zur Erprobung, keine allgemeine Kompatibilitätszusage.**

Die SQL-Brücke deckt die Bearbeitungshistorie ab. Ob daneben weitere Schema-Anpassungen erforderlich sind, hängt vom tatsächlichen Ausgangsschema und Migrationsstand ab. Die früheren zusätzlichen Anpassungen außerhalb der Historienbrücke sind bislang nicht vollständig rekonstruiert. Deshalb ist der erfolgreiche Probelauf mit einer Kopie der eigenen Daten eine Voraussetzung für die Produktionsumstellung. Bei zusätzlichen Migrationsfehlern abbrechen; nicht Migrationen pauschal als erledigt markieren.

Für andere Sharkey-Versionen, veränderte Datenbankschemas, geteilte externe Dienste oder Installationen ohne Docker Compose muss der Ablauf angepasst und separat geprüft werden.

## 1. Bestehende Installation erfassen

Notiere Sharkey-Version und Image-ID, Compose-Projektname, alle verwendeten Compose-Dateien, Datenbankname und -benutzer, PostgreSQL-Hauptversion und Erweiterungen. Erfasse außerdem die Speicherorte von Dateien, Konfiguration, Redis und gegebenenfalls Meilisearch sowie externen Objektspeicher.

Behalte für diesen Wechsel die bisherige PostgreSQL-/PGroonga-Version, Redis- und Meilisearch-Version bei. **Kopiere nicht das FediKey-Compose-Beispiel für Neuinstallationen über deine bestehende Konfiguration.** Dieses Beispiel verwendet PostgreSQL 18; ein vorhandenes PostgreSQL-15-Datenverzeichnis darf damit nicht gestartet werden. Ein PostgreSQL-Upgrade ist ein eigener, separat zu testender Vorgang.

FediKey übernimmt ausgewählte Sharkey-Funktionen. Prüfe vorab, welche Sharkey-Funktionen deine Instanz nutzt und ob deren Verhalten unter FediKey verfügbar ist.

Die folgenden Beispiele verwenden Bash. Ersetze die Beispielwerte einmal durch deine tatsächlichen Werte. Verwende absolute Pfade. Speichere Backups außerhalb des FediKey-Quellverzeichnisses.

```bash
export INSTANCE_DIR=/srv/meine-instanz
export FEDIKEY_SRC=/srv/fedikey-source
export PROJECT=sharkey
export DB_NAME=misskey
export DB_USER=misskey
export FILES_DIR="$INSTANCE_DIR/files"
export CONFIG_DIR="$INSTANCE_DIR/.config"
export BACKUP_DIR="/srv/backups/sharkey-$(date +%Y%m%d-%H%M%S)"
export FEDIKEY_REF=ddc58f6988abb2d570e2fcea8d6d0e1831ffce36
export FEDIKEY_IMAGE="fedikey-local:$FEDIKEY_REF"
export FEDIKEY_OVERRIDE="$INSTANCE_DIR/compose.fedikey-migration.yml"

# Alle bisher verwendeten Compose-Dateien in ihrer bisherigen Reihenfolge:
BASE_FILES=(-f "$INSTANCE_DIR/compose.yml")
# Bei Bedarf weitere bestehende Overrides hier ergänzen.

old() {
  docker compose --project-directory "$INSTANCE_DIR" -p "$PROJECT" \
    "${BASE_FILES[@]}" "$@"
}
new() {
  docker compose --project-directory "$INSTANCE_DIR" -p "$PROJECT" \
    "${BASE_FILES[@]}" -f "$FEDIKEY_OVERRIDE" "$@"
}
```

`old` und `new` sind die oben definierten Bash-Funktionen für die bisherige beziehungsweise ergänzte Compose-Konfiguration. Führe die Variablenzuweisungen und Funktionsdefinitionen in derselben Bash-Sitzung wie die folgenden Befehle aus.

Die Beispiele setzen Dienste namens `web`, `db` und `redis` voraus. Passe die Namen an, wenn deine Installation andere verwendet. `DB_NAME` und `DB_USER` müssen zur bestehenden Anwendungskonfiguration passen. Übernimm die tatsächlichen Werte für `POSTGRES_USER` und `POSTGRES_DB` aus deiner bestehenden Konfiguration; `misskey` ist hier nur ein Beispiel. Der Dateiname kann etwa `docker-compose.yml` statt `compose.yml` lauten. Bei einem laufenden Web-Container zeigt `docker inspect CONTAINERNAME --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}'` die verwendeten Compose-Dateien. Trage diese in derselben Reihenfolge in `BASE_FILES` ein. Passwörter gehören nicht in diese Befehle oder die Anleitung. Bei erforderlicher PostgreSQL-Authentifizierung verwende die bestehende sichere Zugangskonfiguration.

Prüfe die laufenden Container und notiere das tatsächlich verwendete Sharkey-Image. Bewahre dieses Image für die Wiederherstellung lokal auf; verlasse dich nicht auf einen veränderlichen `latest`-Tag.

```bash
old ps
old images
old exec -T db psql -X -U "$DB_USER" -d "$DB_NAME" \
  -c 'SHOW server_version;' -c '\dx'
```

## 2. FediKey bauen und Konfiguration vorbereiten

Baue aus einem separaten, sauberen Checkout. So bleiben die Sharkey-Installation und ihr Quellstand verfügbar. Verwende im Probelauf und bei der Umstellung exakt denselben FediKey-Commit und dasselbe Image.

```bash
git clone https://github.com/Happyfeet01/FediKey.git "$FEDIKEY_SRC"
git -C "$FEDIKEY_SRC" checkout --detach "$FEDIKEY_REF"
docker build --pull -t "$FEDIKEY_IMAGE" "$FEDIKEY_SRC"
```

Die zu dieser Anleitung gehörende Datei [`migration-sharkey.sql`](../scripts/migration/migration-sharkey.sql) liegt nach dem Checkout unter `scripts/migration/`. Der oben festgelegte Commit enthält sie bereits; ein separater Download oder manuelles Anlegen ist nicht erforderlich. Die Datei enthält Umbau-Befehle für die vorhandene Bearbeitungshistorie, keine Datenbanksicherung. Prüfe vor dem Fortfahren mit `test -s "$FEDIKEY_SRC/scripts/migration/migration-sharkey.sql"`, dass sie vorhanden und nicht leer ist.

Lege unter dem in `FEDIKEY_OVERRIDE` angegebenen Pfad diese Datei an:

```yaml
services:
  web:
    image: ${FEDIKEY_IMAGE:?FEDIKEY_IMAGE setzen}
    working_dir: /misskey
    entrypoint: ["pnpm"]
    command: ["start"]
    environment:
      NODE_ENV: production
      MISSKEY_CONFIG_YML: default.yml
    volumes:
      - ${FILES_DIR:?FILES_DIR setzen}:/misskey/files
      - ${CONFIG_DIR:?CONFIG_DIR setzen}:/misskey/.config:ro
```

Dieses Override ändert nur den Web-Dienst. Die bestehenden Datenbank-, Redis-, Such-, Netzwerk- und Port-Einstellungen werden aus den Basisdateien übernommen. Alte Mounts nach `/sharkey` können wegen der Compose-Zusammenführung zusätzlich erhalten bleiben. Entscheidend sind die neuen Mounts nach `/misskey`; prüfe auch weitere geerbte Volumes, Benutzer-, Healthcheck- und Umgebungseinstellungen auf Sharkey-spezifische Pfade.

Die Konfiguration muss als `/misskey/.config/default.yml` lesbar sein. Das FediKey-Image verwendet standardmäßig UID/GID `991:991`; der Dateispeicher muss für diesen Benutzer beschreibbar sein. Passe nur bei Bedarf die Zugriffsrechte des Dateispeichers an, nicht pauschal die Datenbankverzeichnisse.

Übernimm die bestehende öffentliche URL und das ID-Verfahren unverändert. Prüfe anhand von `.config/docker_example.yml` im FediKey-Checkout insbesondere:

- Datenbankhost, Datenbankname, Benutzer und Passwort;
- alle Redis-Verbindungen, Datenbanknummern und Präfixe, einschließlich separater Queue-/Pubsub-Dienste;
- Web-Port, Reverse-Proxy und WebSocket-Unterstützung;
- `fulltextSearch.provider` und die Einstellungen des verwendeten Suchdienstes;
- lokale Dateien beziehungsweise Objektspeicher, Mailversand und weitere eingebundene Dienste.

Ersetze die bestehende Konfiguration nicht durch die Beispielkonfiguration. Notiere erforderliche Änderungen und sichere vorher die Originaldateien. Prüfe das zusammengeführte Compose-Ergebnis lokal:

```bash
new config --quiet
new config
```

`config` kann aufgelöste Zugangsdaten ausgeben. Veröffentliche diese Ausgabe nicht. Ein vorhandener `build:`-Abschnitt der Basisdatei wird in diesem Ablauf durch `--no-build` nicht verwendet.

Der explizite Start mit `pnpm start` führt **keine Datenbankmigrationen** aus. Die Datenbank wird in Schritt 5 kontrolliert vorbereitet. Auch spätere Updates müssen deshalb ihre Migrationen ausdrücklich ausführen.

## 3. Wiederherstellung und Migration zuerst isoliert erproben

Stelle ein Backup auf einem separaten Testsystem wieder her. Verwende dort ausschließlich Kopien der Datenbank, Dateien, Konfiguration, Redis-Daten und gegebenenfalls Suchdaten. Benutze für PostgreSQL dieselbe Hauptversion und die benötigten Erweiterungen wie in der Quelle.

Das Testsystem darf weder Produktionsdienste noch den produktiven Objektspeicher beschreiben. Sperre ausgehenden Verkehr zu Föderation, Mail, Webhooks und sonstigen externen Diensten auf Netzwerkebene; eingehender Zugriff bleibt auf den Test beschränkt. Ein anderer Compose-Projektname allein verhindert weder gemeinsam verwendete Bind-Mounts noch ausgehende Föderation.

Behalte die Instanz-URL in der kopierten Konfiguration bei und verwende für Browserprüfungen bei Bedarf eine nur lokal wirksame Namensauflösung zum Testsystem. Ändere die Produktions-Domain nicht zum Zweck der Migration. Teste echte Föderation gesondert mit frisch eingerichteten Testidentitäten oder nach dem produktiven Wechsel; die kopierte Produktionsidentität darf nicht parallel föderieren.

Führe die Schritte 4 bis 6 zunächst vollständig mit den Testpfaden und Testdiensten aus. Prüfe auch die Wiederherstellung aus Schritt 7. Erst wenn diese Abläufe funktionieren, wird die Produktionsumstellung angesetzt. Dokumentiere zusätzliche notwendige Schema-Anpassungen als überprüfte Skripte; sie dürfen nicht nur in einer Terminal-History verbleiben.

## 4. Schreibzugriffe anhalten und vollständiges Backup erstellen

Aktiviere das Wartungsfenster am Reverse-Proxy. Stoppe alle Sharkey-Web- und Worker-Prozesse sowie sonstige Dienste, die in diese Daten schreiben. Nur den öffentlichen Zugriff zu sperren reicht nicht: Hintergrundjobs können weiterarbeiten.

Die folgenden Befehle decken einen einzelnen Web-Dienst und einen PostgreSQL-Dienst ab. Weitere Worker müssen ebenfalls angehalten werden.

```bash
old stop web
umask 077
mkdir -p "$BACKUP_DIR"
old exec -T db pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc \
  > "$BACKUP_DIR/sharkey.dump"
```

Prüfe unmittelbar den Rückgabewert des Dumps und kontrolliere das Archiv mit `pg_restore --list`. Nur bei erfolgreichem Backup fortfahren. Sichere außerdem die PostgreSQL-Rollen und Berechtigungen mit dem dafür berechtigten Administrationskonto, insbesondere bei mehreren Datenbankrollen.

Sichere alle Basis-Compose-Dateien, Overrides, Umgebungsdateien und die originale Anwendungskonfiguration. Für die oben angegebenen Verzeichnisse beispielsweise:

```bash
tar -C "$CONFIG_DIR" -czf "$BACKUP_DIR/config.tar.gz" .
tar -C "$FILES_DIR" -czf "$BACKUP_DIR/files.tar.gz" .
```

Sichere Redis konsistent nach dem Anhalten aller Anwendungsprozesse: Bei einem dedizierten lokalen Redis-Dienst kannst du ihn sauber stoppen, das vollständige persistente Redis-Verzeichnis einschließlich AOF-Unterverzeichnissen sichern und ihn anschließend wieder starten. Nutze bei externem Redis das passende Snapshot-Verfahren. Sichere auch separate Redis-Instanzen, Suchdaten und externen Objektspeicher entsprechend der Installation. Bestehende Redis-Queues nicht leeren.

Eine erfolgreiche Archivauflistung ersetzt keinen Wiederherstellungstest. Für einen vollständigen Rückweg müssen Datenbank, Dateien, Konfiguration, Queue-Daten und das alte Sharkey-Image zusammenpassen. Halte die Anwendung während des Backups und der folgenden Migration angehalten.

## 5. Historie überführen und verbleibende Migrationen ausführen

### Voraussetzungen der SQL-Brücke

Die Brücke ist für die folgende vorhandene `public.note_edit`-Tabelle geschrieben:

`cw`, `fileIds`, `id`, `newText`, `noteId`, `oldDate`, `oldText`, `updatedAt`.

Sie prüft diese Spaltennamen, `note.updatedAt` als `timestamp with time zone`, verwaiste Historieneinträge und bestimmte Einträge in `public.migrations`. Sie prüft **nicht das gesamte Quellschema**. Vor dem Probelauf müssen insbesondere auch die Typen, Standardwerte und bestehenden Constraints zur Zielmigration passen:

```bash
old exec -T db psql -X -U "$DB_USER" -d "$DB_NAME" \
  -c '\d+ public.note_edit' -c '\d+ public.note' \
  -c 'SELECT "timestamp", name FROM public.migrations ORDER BY "timestamp";'
```

Für `note_edit` erwartet der Umbau insbesondere den Primärschlüssel `PK_736fc6e0d4e222ecc6f82058e08`. Der Index `IDX_702ad5ae993a672e4fbffbcd38` auf `noteId` und der Fremdschlüssel `FK_702ad5ae993a672e4fbffbcd38c` von `noteId` auf `note(id)` mit `ON DELETE CASCADE` werden aus der Quelle übernommen; die Brücke legt sie nicht neu an. Vergleiche Definitionen, nicht nur Namen, mit `packages/backend/migration/1791284200000-NoteEditing.js` im festgelegten FediKey-Checkout. `fileIds` muss zum Beispiel ein nicht-nullbares `varchar(32)[]` mit leerem Array als Standardwert sein; `updatedAt` in `note_edit` muss ein nicht-nullbarer Zeitstempel mit Zeitzone sein.

Bei Abweichungen endet der hier beschriebene Migrationspfad: erst auf der Testkopie klären und die Brücke gezielt anpassen. Vorhandene `fedikey_recovery`-Sicherungstabellen oder bereits registrierte Brücken-Migrationen sind ebenfalls ein Grund, den bisherigen Ablauf zu prüfen, statt das Skript erneut auszuführen.

### SQL-Brücke ausführen

Nur nach erfolgreichem Probelauf, mit frischem Backup und ohne laufende Anwendung:

```bash
old exec -T db psql -X -v ON_ERROR_STOP=1 \
  -v expected_db="$DB_NAME" -U "$DB_USER" -d "$DB_NAME" \
  < "$FEDIKEY_SRC/scripts/migration/migration-sharkey.sql"
```

Die Brücke verwendet eine Transaktion. `ON_ERROR_STOP=1` sorgt dafür, dass `psql` bei einem Fehler abbricht. Keine nachfolgenden Schritte ausführen, wenn der Befehl fehlschlägt. Die Variable `expected_db` ist erforderlich; sie wird mit der tatsächlichen Datenbank verglichen.

Die Brücke sichert Quellwerte im Schema `fedikey_recovery`, benennt `oldText` in `text` und die bisherige Spalte `cw` in `newCw` um und ergänzt die Zielspalten. Autor und Sichtbarkeit stammen aus der zugehörigen aktuellen Notiz. Sie erhält die vorhandenen `fileIds`, Texte und Bearbeitungszeitpunkte.

Nicht gespeicherte frühere Inhaltswarnungen, Antwort-/Zitatbezüge und Umfragezustände lassen sich nicht nachträglich rekonstruieren. `hasPoll = false` ist für importierte Zeilen ein technischer Standardwert, kein historischer Nachweis. Die Tabelle `fedikey_recovery.history_provenance` hält diese Einschränkungen fest. Auch die aus der aktuellen Notiz übernommene Sichtbarkeit ist kein unabhängiger historischer Beleg.

Die Brücke registriert ausschließlich diese drei ersetzten Übergänge:

- `NoteUpdatedAt1695901659683`
- `RevertNoteEdit1696388600237`
- `NoteEditing1791284200000`

So bleiben vorhandene Bearbeitungszeitpunkte und Historien erhalten. Andere Migrationen werden nicht übersprungen. Die Sicherungstabellen sind kein Ersatz für ein vollständiges Backup.

### Verbleibende FediKey-Migrationen ausführen

Stelle sicher, dass die bisherigen Datenbank-, Redis- und erforderlichen Suchdienste laufen. Starte den Web-Dienst noch nicht.

```bash
new run --rm --no-deps --entrypoint pnpm web --filter backend migrate
```

Der explizite Entrypoint ist wichtig: So wird trotz des Overrides der Migrationsbefehl ausgeführt. Bei einem Fehler bleibt die Anwendung gestoppt. Keine Spalten auf Verdacht löschen und keine weiteren Migrationsnamen ohne nachvollzogenen Schema-Abgleich eintragen. Ein Fehler nach erfolgreicher Historienbrücke kann bereits andere Änderungen hinterlassen haben; für einen neuen Probelauf die unveränderte Quellkopie wiederherstellen.

Prüfe anschließend die noch ausstehenden Migrationen:

```bash
new run --rm --no-deps --entrypoint sh web -c \
  'cd /misskey/packages/backend && pnpm compile-config && pnpm typeorm migration:show -d ormconfig.js'
```

Es dürfen keine ausstehenden FediKey-Migrationen (`[ ]`) übrig sein. Das allein beweist noch keine vollständige Schemakompatibilität; die Funktionsprüfungen bleiben erforderlich.

## 6. Starten und prüfen

```bash
new up -d --no-deps --no-build --pull never web
new ps
new logs --tail=200 web
```

Kontrolliere, dass das festgelegte FediKey-Image läuft und der Dienst gesund bleibt. Falls eine Ersteinrichtung statt der bestehenden Instanz erscheint, nicht fortfahren: zuerst Datenbank und Konfigurations-Mount prüfen.

Prüfe vor der allgemeinen Freigabe:

- Anmeldung mit bestehenden Sharkey-Passwörtern und Zwei-Faktor-Authentifizierung;
- bestehende Konten, Notizen, Antworten, Reaktionen, Follower und unveränderte Notiz-URLs;
- alte Dateien sowie neue Uploads;
- übernommene Bearbeitungshistorie und eine neue Notizbearbeitung;
- Inhaltswarnungen, Anhänge und Umfragen einschließlich bestehender Stimmen;
- Sichtbarkeit und Zugriffsschutz von Notizen und Historien;
- Suche, Live-Aktualisierungen und Hintergrundjobs.

Die Brücke prüft vor ihrem Commit die Anzahl und wesentliche Werte der Historienzeilen sowie die Bearbeitungszeitpunkte der Notizen. Behalte ihre Abschlussausgabe im lokalen Migrationsprotokoll und die Sicherungstabellen bis zum Abschluss der Prüfung.

Nach Freigabe der Produktionsinstanz prüfe außerdem ein- und ausgehende Föderation einschließlich einer Notizbearbeitung. Beobachte Fehlerprotokolle und Queue-Verarbeitung. Halte den früheren Installationsstand und die Backups vorerst verfügbar.

## 7. Wiederherstellung bei einem Fehler

**Starte Sharkey nicht einfach gegen die bereits von FediKey geänderte Datenbank.** Die Rückkehr erfolgt über die zusammengehörenden Sicherungen. `pnpm revert` ist hier kein geeigneter Rückweg: Die Brücke hat Migrationen registriert, deren reguläre Rückwärtsfunktionen historische Daten löschen können.

1. Wartungsmodus beibehalten beziehungsweise erneut aktivieren. Alle FediKey-Web- und Worker-Prozesse stoppen.
2. Falls bereits produktive Schreibzugriffe stattgefunden haben, zuerst den aktuellen Zustand separat sichern. Eine Rückkehr zum alten Backup verliert die seitdem hinzugekommenen Änderungen; bereits föderierte Aktivitäten lassen sich damit nicht zurücknehmen.
3. Mit der bisherigen PostgreSQL-Hauptversion und den benötigten Erweiterungen eine **neue, leere Datenbank** für die Wiederherstellung erstellen. Die teilweise migrierte Datenbank zur Untersuchung behalten.
4. Den Sharkey-Dump mit `pg_restore --exit-on-error` in diese neue Datenbank einspielen. Rollen, Eigentümer und Erweiterungsrechte müssen wie beim erfolgreich getesteten Restore vorhanden sein.
5. Dateien, Konfiguration, Redis-/Queue-Daten und gegebenenfalls Such-/Objektspeicherdaten auf den passenden Sicherungsstand zurücksetzen. Dienste für Dateisystem-Restores stoppen. Das wiederhergestellte `default.yml` auf die wiederhergestellte Datenbank verweisen lassen.
6. Die ursprünglichen Compose-Dateien und das gesicherte Sharkey-Image verwenden, ohne FediKey-Override. Erst nach erfolgreicher Prüfung den Zugriff wieder freigeben.

Beispiel für die Datenbank-Wiederherstellung auf derselben PostgreSQL-Instanz, mit dem dafür berechtigten Administrationskonto:

```bash
export RESTORE_DB="${DB_NAME}_restore_$(date +%Y%m%d%H%M%S)"
# DB_ADMIN auf das bestehende PostgreSQL-Administrationskonto setzen.
: "${DB_ADMIN:?DB_ADMIN setzen}"
old exec -T db createdb -U "$DB_ADMIN" -O "$DB_USER" -T template0 "$RESTORE_DB"
old exec -T db pg_restore --exit-on-error -U "$DB_ADMIN" \
  -d "$RESTORE_DB" < "$BACKUP_DIR/sharkey.dump"
```

Nur nach erfolgreichem Restore die Anwendungskonfiguration umstellen. Bestehende Umgebungsvariablen mit Datenbanknamen müssen dabei ebenfalls angepasst werden, falls sie die YAML-Konfiguration überschreiben. Das Beispiel ersetzt nicht die Wiederherstellung der übrigen Daten.

## Spätere FediKey-Updates

Nach der einmaligen Migration sind Updates ein eigener Ablauf: Quellstand aktualisieren, neues Image bauen, Backup erstellen, Anwendung anhalten, die regulären FediKey-Migrationen ausführen und das neue Image starten. Die Sharkey-Historienbrücke wird **nicht erneut ausgeführt**.

Mit dem oben verwendeten Override bleibt die bewusste Trennung von Migration und Start erhalten. Nur `git pull` und ein Image-Build genügen bei Schemaänderungen nicht. Prüfe die Hinweise des jeweiligen Zielstands und aktualisiere den festgelegten Image-Tag ausdrücklich.
