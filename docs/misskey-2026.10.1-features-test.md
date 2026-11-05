# Neue Misskey-Funktionen in FediKey testen

Nur in der isolierten Testinstanz testen. Dieser Branch baut auf PR #11 auf.

```bash
git fetch origin
git switch feat/misskey-2026.10.1-user-features
docker compose up -d --build web
docker compose logs -f web
```

Der Webstart führt die neue Migration automatisch aus. Sie ergänzt zwei nullable Integer-Spalten in `user_profile`; vorhandene Konten erhalten dadurch zunächst keinen zusätzlichen Follow-Schutz. Vor dem Test eine Sicherung der Testdatenbank anlegen, wenn deren Daten erhalten bleiben sollen.

## Follow-Schutz

Unter Einstellungen → Datenschutz im Bereich für Follow-Anfragen lokale und entfernte Konten getrennt konfigurieren. Ein Zeitraum bis zu 30 Tagen ist möglich. Mit einem frisch angelegten zweiten Konto folgen: Innerhalb der Grenze muss eine Anfrage entstehen. Mit deaktivierter Grenze folgt das Testkonto unmittelbar, sofern keine anderen Follow-Regeln greifen. Bei gesperrtem Konto bleiben ohnehin alle Follows anfragepflichtig.

Prüfen, dass die Einstellung nach Neuladen erhalten bleibt und das Entsperren des Profils Anfragen junger Konten nicht unbeabsichtigt freigibt. Die Einstellung zur automatischen Annahme bereits selbst gefolgter Konten bleibt relevant.

## Clip-Spalte

Zur Deck-Oberfläche wechseln und eine Spalte vom Typ Clip hinzufügen. Eigenen oder favorisierten Clip auswählen. Notiz zum Clip hinzufügen/entfernen: Die Spalte muss aktualisieren. Andere Clips favorisieren bzw. aus Favoriten entfernen und den Picker erneut öffnen: Die Auswahl muss aktuell sein. Ein privater Clip darf für fremde Konten nicht abonnierbar sein.

## Avatar und Banner

Unter Einstellungen → Profil auf Avatar/Banner klicken. Bei vorhandenem Bild steht im Auswahlmenü Entfernen zur Verfügung. Anschließend Seite neu laden und Profil in einem zweiten Browser öffnen: Avatar fällt auf Identicon zurück, Banner verschwindet.

Ein normales Bild setzen und danach im Drive ein anderes Bild als sensibel markieren. Dieses darf nicht als Profilbild auswählbar sein; auch die API muss Avatar- und Banner-Zuweisung ablehnen. Das bisherige Profilbild bleibt erhalten.

## FediKey-Regressionen

Anmeldung, Beitrag erstellen/bearbeiten, Bearbeitungshistorie, Live-Timeline und Neustart prüfen. Die angezeigte Version bleibt erwartungsgemäß 2026.9.1.

Neue Texte folgen den Repository-Locale-Regeln: neue Quelltexte nur in ja-JP; noch fehlende Übersetzungen fallen auf diese Quelle zurück.
