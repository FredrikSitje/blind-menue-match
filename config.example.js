/**
 * Blind-Menü-Match — Konfiguration
 * 1. Diese Datei nach config.js kopieren
 * 2. Für Live-Sync: Supabase-Projekt anlegen, SQL ausführen, Werte eintragen
 * 3. Ohne Config bleibt der Zugang gesperrt.
 */
window.BMM_CONFIG = {
  // Supabase Free Project → Settings → API
  supabaseUrl: "",       // z.B. "https://xxxx.supabase.co"
  supabaseAnonKey: "",   // anon / public key

  // Optional: App-Name (PWA)
  appName: "Blind-Menü-Match",

  // Poll-Intervall im Wartezustand (ms)
  pollIntervalMs: 3000
};
