# Blind-Menü-Match

Mobile-first **deutsche PWA** für blindes Abstimmen über glutenfreie Wochenmenüs (Bern).  
Zwei Partner wählen je 8 Menüs — **niemand sieht die Auswahl des anderen**. Am Ende erscheint nur die **Schnittmenge**, aufgelöst auf **genau 5 Abendessen**, plus Einkaufsliste (volle Packpreise, shareKey-Dedupe, kurze Cluster-Route).

Pfad: `/workspace/blind-menue-match/` (dieser Ordner ist deployfertig).

---

## Demo-Modus (ohne Server, sofort)

1. Beliebigen lokalen Static-Server starten, z. B.:

```bash
cd /workspace/blind-menue-match
python3 -m http.server 8765
```

2. Im Browser: `http://localhost:8765/`
3. **Raum erstellen** → zwei Links (`?room=…&p=a&key=…` / `p=b`)
4. **Auf einem iPhone/Gerät:** beide Links nacheinander öffnen (gleicher Safari/localStorage) — Demo funktioniert so ohne Sync-Code.
5. Je Partner genau 8 Menüs tippen → **Festlegen**. Wenn beide locked: nur Matches werden gezeigt.
6. **Zwei getrennte Geräte ohne Supabase:** nach dem Festlegen **Sync-Code exportieren**, auf dem anderen Gerät importieren (Home oder Warte-Screen). Echter Live-Sync braucht Supabase (unten).

`config.js` ist standardmässig ohne Keys → Badge zeigt **Demo (localStorage + Sync-Code)**.

---

## Supabase Live-Sync (kostenlos, zwei iPhones)

1. Konto auf [supabase.com](https://supabase.com) → **New project** (Free).
2. **SQL Editor** → Inhalt von `supabase/schema.sql` einfügen → **Run**.
3. **Project Settings → API**: `Project URL` und `anon public` Key kopieren.
4. `config.example.js` nach `config.js` kopieren (falls nötig) und eintragen:

```js
window.BMM_CONFIG = {
  supabaseUrl: "https://XXXX.supabase.co",
  supabaseAnonKey: "eyJhbGciOi…",
  appName: "Blind-Menü-Match",
  pollIntervalMs: 3000
};
```

5. App neu laden — Badge zeigt **Supabase Live-Sync**. Beide Partner-Links auf zwei iPhones öffnen; Status pollt alle paar Sekunden. RPC `get_matches` liefert **nur** die Schnittmenge, wenn beide locked.

### Wichtige RPCs

| RPC | Zweck |
|-----|--------|
| `create_room` | Raum + Keys anlegen |
| `submit_picks` | Eigene Wahl speichern / locken |
| `get_room_status` | Locked-Flags ohne Picks |
| `get_matches` | **Nur Intersection**, wenn beide locked |
| `start_fill_round` | Nachwahl wenn &lt; 5 Matches |
| `finalize_dinners` | 5 Abendessen speichern |

---

## Hosting (gratis)

- **Netlify Drop** / GitHub Pages / Cloudflare Pages: diesen Ordner als Static Site deployen.
- HTTPS nötig für PWA / Service Worker auf dem iPhone.
- iPhone Safari: Seite öffnen → Teilen → **Zum Home-Bildschirm**.

---

## Ablauf (Blind Match)

1. Raum erstellen → private URLs A/B  
2. Jeder wählt **genau 8** Menüs → Festlegen (andere Liste bleibt geheim)  
3. Beide locked → Intersection  
4. Auflösung auf **5 Dinner**:
   - `== 5` → verwenden  
   - `> 5` → deterministische Auswahl (SHA-256 über `room+ids`)  
   - `< 5` → **Nachwahl-Runde** über Restmenüs, bis 5 erreicht  
5. Einkaufsliste: volle Packungen, Dedupe, Bern-Cluster-Route — **keine Bestellung**

---

## Dateien

```
index.html
config.js / config.example.js
css/styles.css
js/app.js, data.js, shopping.js, sync.js
supabase/schema.sql
manifest.webmanifest, sw.js, icons/
README.md
```

Preise/Packungen sind Aktions-/Theke-Annahmen — im Laden prüfen.

---

## Technik-Check

```bash
cd /workspace/blind-menue-match
node scripts/check-syntax.mjs
```

Der Syntaxcheck prüft ES-Module explizit und läuft auch in GitHub Actions.
Nach Änderungen an gecachten Assets die Cache-Version in `sw.js` erhöhen.
Browser-Smoke-Test: Raum erstellen → Raum-ID und beide Links sichtbar → beide Kopieren-Buttons prüfen → beide Links öffnen und jeweils 20 Menüs / 0 von 8 Auswahlen sehen.
