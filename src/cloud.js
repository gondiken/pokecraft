// Online accounts and cloud saves (Supabase). The game keeps working offline if any of this fails.

// The project URL and publishable key are meant to be public: Row Level Security in the
// database makes sure each player can only read and write their own save.
const SUPABASE_URL = 'https://vsaawuqtjjhmclacbfxv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_7mIgaV5pG2fgDd2e6tjxaw_ZLkhpIj0';

// Loaded on first use, so a slow or blocked download never stops the game from starting.
let clientPromise = null;
function getClient() {
  clientPromise ??= import('@supabase/supabase-js')
    .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      realtime: { params: { eventsPerSecond: 20 } },
    }))
    .catch(() => null);
  return clientPromise;
}

// Turn Supabase's error messages into something a kid (or parent) can act on.
function friendly(error) {
  const msg = String(error?.message || error || '');
  if (/invalid login credentials/i.test(msg)) return 'Wrong email or password.';
  if (/email not confirmed/i.test(msg)) return 'Check your email and click the confirmation link first.';
  if (/already registered|already been registered/i.test(msg)) return 'That email already has an account. Try "Sign in" instead.';
  if (/password should be at least/i.test(msg)) return 'The password needs at least 6 characters.';
  if (/same as the old|different from the old/i.test(msg)) return 'Pick a password that is different from your old one.';
  if (/rate limit|too many/i.test(msg)) return 'Too many tries. Please wait a few minutes.';
  if (/fetch|network|failed to load/i.test(msg)) return "Can't reach the save server. Check the internet connection.";
  return msg || 'Something went wrong.';
}

export async function cloudAvailable() {
  return !!(await getClient());
}

export async function currentUser() {
  const client = await getClient();
  if (!client) return null;
  try {
    const { data } = await client.auth.getSession();
    return data.session?.user ?? null;
  } catch { return null; }
}

export async function signIn(email, password) {
  const client = await getClient();
  if (!client) return { error: "Can't reach the save server." };
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  return error ? { error: friendly(error) } : { user: data.user };
}

// Creates an account. Supabase emails a confirmation link before the account can sign in.
export async function signUp(email, password) {
  const client = await getClient();
  if (!client) return { error: "Can't reach the save server." };
  const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: backHere() } });
  if (error) return { error: friendly(error) };
  return { user: data.user, needsConfirm: !data.session };
}

// Where Supabase sends people back to after they click a link in an email.
const backHere = () => location.origin + location.pathname;

// Emails a link that brings the player back here to choose a new password.
export async function sendPasswordReset(email) {
  const client = await getClient();
  if (!client) return { error: "Can't reach the save server." };
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: backHere() });
  return error ? { error: friendly(error) } : {};
}

export async function setNewPassword(password) {
  const client = await getClient();
  if (!client) return { error: "Can't reach the save server." };
  const { data, error } = await client.auth.updateUser({ password });
  return error ? { error: friendly(error) } : { user: data.user };
}

// Calls fn(event, user) on sign-in changes, including 'PASSWORD_RECOVERY' after a reset link.
export async function onAuthChange(fn) {
  const client = await getClient();
  client?.auth.onAuthStateChange((event, session) => fn(event, session?.user ?? null));
}

export async function signOut() {
  const client = await getClient();
  if (client) await client.auth.signOut().catch(() => {});
}

// The player's cloud save, or null if they have none yet.
export async function loadCloud() {
  const user = await currentUser();
  if (!user) return null;
  const client = await getClient();
  const { data, error } = await client.from('saves').select('data').eq('user_id', user.id).maybeSingle();
  if (error) throw new Error(friendly(error));
  return data?.data ?? null;
}

export async function saveCloud(save) {
  const user = await currentUser();
  if (!user) return false;
  const client = await getClient();
  const { error } = await client.from('saves').upsert({ user_id: user.id, data: save });
  if (error) throw new Error(friendly(error));
  return true;
}

// A live channel for playing together. Returns { send, on, close } or null if it can't connect.
// Every event name must be listed up front, because Supabase needs them before subscribing.
export async function realtimeChannel(name, events) {
  const client = await getClient();
  if (!client) return null;
  const ch = client.channel(name, { config: { broadcast: { self: false } } });
  const handlers = {};
  for (const event of events) ch.on('broadcast', { event }, ({ payload }) => handlers[event]?.(payload));
  const status = await new Promise(resolve => {
    const timer = setTimeout(() => resolve('TIMED_OUT'), 10000);
    ch.subscribe(s => {
      if (s === 'SUBSCRIBED' || s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
        clearTimeout(timer);
        resolve(s);
      }
    });
  });
  if (status !== 'SUBSCRIBED') { client.removeChannel(ch); return null; }
  return {
    send: (event, payload) => ch.send({ type: 'broadcast', event, payload }),
    on: (event, fn) => { handlers[event] = fn; },
    close: () => client.removeChannel(ch),
  };
}
