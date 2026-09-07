/** Supabase Auth is bundled locally so login never depends on a runtime CDN. */
import { createClient } from './vendor/supabase.js';

export const incomingPasswordSetup = /(?:^#|&)type=(invite|recovery)(?:&|$)/.test(location.hash);
const config = window.BMM_CONFIG || {};
export const configured = Boolean(config.supabaseUrl && config.supabaseAnonKey);
export const authClient = configured ? createClient(config.supabaseUrl, config.supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null;

export async function currentSession() {
  if (!authClient) throw new Error('Die Anmeldung ist noch nicht eingerichtet.');
  const { data, error } = await authClient.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function sessionHeaders() {
  const session = await currentSession();
  if (!session) throw new Error('Bitte melde dich an.');
  return { apikey: config.supabaseAnonKey, Authorization: `Bearer ${session.access_token}` };
}

export async function signIn(email, password) {
  const { error } = await authClient.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error('Anmeldung fehlgeschlagen. Prüfe E-Mail und Passwort.');
}

export async function requestPasswordReset(email) {
  const { error } = await authClient.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: new URL('.', location.href).href,
  });
  if (error) throw new Error('Die E-Mail konnte gerade nicht angefordert werden. Bitte versuche es später erneut.');
}

export async function updatePassword(password) {
  const { error } = await authClient.auth.updateUser({ password });
  if (error) throw new Error('Das Passwort konnte nicht gespeichert werden. Bitte öffne einen neuen Einrichtungslink und versuche es erneut.');
}

export async function signOut() {
  // Local logout always clears this browser; other devices keep their own session.
  const { error } = await authClient.auth.signOut({ scope: 'local' });
  if (error) throw error;
}
