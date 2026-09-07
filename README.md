# Blind-Menü-Match / Menü-Finder

Private deutsche PWA für glutenfreie Wochenmenüs: zwei freigeschaltete Konten wählen je acht Menüs, sehen nur gemeinsame Matches und erhalten fünf Abendessen mit Einkaufsliste. Keine Bestellungen.

Live: https://menu-finder.ibibene.ch/

## Anmeldung

Die Webseite wird von GitHub Pages ausgeliefert. Supabase Auth übernimmt die Anmeldung mit E-Mail und Passwort. Ohne gültige Anmeldung und serverseitige Freischaltung gibt es keinen Zugriff auf Räume, Auswahlen oder Ergebnisse. Es gibt keinen Demo-Fallback und keinen offenen Registrierungsbutton.

Die beiden Konten haben feste Rollen A/B. Ein fremder Partner-Link berechtigt nicht dazu, dessen Auswahl zu lesen oder zu ändern. Vorhandene Räume bleiben erhalten und werden als gemeinsame Räume dieser beiden Konten behandelt.

## Einrichtung / Deployment

1. `supabase/schema.sql` im SQL Editor als Administrator ausführen. Das Skript ist transaktional und erneut ausführbar. Es ersetzt die bisherigen offenen Regeln, erhält die Daten und sperrt direkte Tabellenzugriffe sowie sämtliche anonymen RPC-Aufrufe.
2. Die zwei erlaubten E-Mail-Adressen **nur in Supabase**, nicht im öffentlichen Repository, in `private.approved_users` hinterlegen:
   ```sql
   insert into private.approved_users (email, partner)
   values ('person-a@example.com', 'a'), ('person-b@example.com', 'b');
   ```
3. In Supabase Auth öffentliche Neuregistrierungen deaktivieren. Als Site URL `https://menu-finder.ibibene.ch/` verwenden und dieselbe Adresse für Redirects erlauben. Konten über die Auth-Verwaltung einladen; die Benutzer setzen ihre Passwörter selbst über den Einladungslink. Einladungs- und Rücksetz-E-Mails benötigen eine funktionierende Mailkonfiguration. Der Supabase-Standardversand kann auf Organisationsmitglieder beschränkt sein; bei Bedarf eigenen SMTP-Versand einrichten.
4. `config.js` enthält ausschließlich Projekt-URL und öffentlichen Anon-Key. Niemals Admin-, Secret- oder `service_role`-Keys eintragen. Anfragen verwenden den persönlichen Auth-Token.
5. Frontend auf `main` veröffentlichen. GitHub Pages nutzt `main` / root. `CNAME` erhalten. HTTPS erzwingen.

Eine Einladung ist erst nutzbar, wenn Auth das Konto bestätigt hat. Die Freischaltung wird bei jeder Datenabfrage gegen `auth.users` und die private Liste geprüft. Änderungen an Benutzer-Metadaten erlauben keine Rollenänderung. Entfernen eines Eintrags sperrt auch bestehende Sitzungen für Planungsdaten.

## Entwicklung und Tests

```bash
npm ci
npm run build
npm test
```

Die offizielle Supabase-Bibliothek ist in `js/vendor/supabase.js` lokal gebündelt: kein CDN-Import zur Laufzeit. Das Bundle wird mit `npm run build` reproduzierbar erzeugt und mit ausgeliefert.

Die PostgreSQL-Tests laufen isoliert mit PGlite. Sie prüfen die Migration vom alten Schema, anonyme Zugriffe, nicht freigeschaltete und unbestätigte Konten, fremde Partner-Links, unveränderliche festgelegte Stimmen, acht gültige Menüs, Schnittmenge, Nachwahl, gefälschte Ergebnisse und deterministische Auswahl von fünf Abendessen. Die Worker-Tests verhindern das Cachen von Auth- oder Datenbankantworten.

Für Browser-Tests ohne Live-Konten:

```bash
node tests/browser-server.mjs
```

Test-URL: `http://127.0.0.1:8767/blind-menue-match/`. Die ausschließlich lokalen Testkonten heißen `a@example.test`, `b@example.test` und `outsider@example.test`; Passwort `Local-test-only-123!`. Der Testserver bindet nur an Loopback und verwendet Fake-Auth mit einer isolierten PostgreSQL-Datenbank.

Browser-Abnahme: abgemeldet nur Login → A anmelden → Raum erstellen und Links kopieren → B-Link für A gesperrt → A wählt acht und legt fest → abmelden → B anmelden und eigene acht wählen → nur gemeinsame Ergebnisse. Zusätzlich Einladungs-/Recovery-Link, falsches Passwort, Seiten-Neuladen und Abmelden in mehreren Tabs prüfen.

## Cache und Datenschutz

`sw.js` cached ausschließlich öffentliche App-Dateien derselben Origin. Partner-URLs, API-Antworten und Auth-Sitzungen werden nicht im Service-Worker-Cache gespeichert. Beim Abmelden wird die private Ansicht verworfen; bestehende Sitzungen anderer Geräte bleiben erhalten. Nach Änderungen an App-Dateien die Cache-Version erhöhen. Ein alter Client kann die neuen Datenbankregeln nicht umgehen.

Die öffentliche App-Hülle und der Quellcode bleiben öffentlich. Der Schutz gilt für Anmeldung und Datenzugriff. Preise und Packungsgrößen sind Planungsannahmen; Gluten-Hinweise und Produktetiketten beim Einkauf beachten.
