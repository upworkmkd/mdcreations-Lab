'use client';
import { useEffect, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

type Mode = 'signin' | 'signup';

/** Sign in or sign up without leaving the page, so a design in progress is not lost. */
export function AuthDialog({ open, onClose, onSignedIn, next, reason }: { open: boolean; onClose(): void; onSignedIn(): void; next: string; reason?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<Mode>('signin');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) d.showModal(); else if (!open && d.open) d.close();
  }, [open]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get('email') || '').trim(), password = String(f.get('password') || ''), name = String(f.get('name') || '').trim();
    setBusy(true); setMsg(null);
    const sb = supabaseBrowser();
    try {
      if (mode === 'signin') {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onSignedIn();
      } else {
        const { data, error } = await sb.auth.signUp({
          email, password,
          options: { data: { full_name: name }, emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
        });
        if (error) throw error;
        if (data.session) onSignedIn();
        else setMsg({ ok: true, text: `We sent a link to ${email}. Open it (any tab is fine), then come back here and press the buy button again. Your design stays on this page.` });
      }
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message || 'That did not work. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog ref={ref} className="auth-dialog" onClose={onClose} aria-labelledby="auth-title">
      <form method="dialog" className="x"><button aria-label="Close">×</button></form>
      <p className="eyebrow">{mode === 'signin' ? 'Welcome back' : 'New here'}</p>
      <h2 id="auth-title">{mode === 'signin' ? 'Sign in' : 'Create your account'}</h2>
      {reason && <p className="muted" style={{ fontSize: 15 }}>{reason}</p>}
      <form className="form" onSubmit={submit}>
        {mode === 'signup' && <label>Your name<input type="text" name="name" autoComplete="name" required /></label>}
        <label>Email<input type="email" name="email" autoComplete="email" required /></label>
        <label>Password<input type="password" name="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={8} required /></label>
        {msg && <p className={`msg ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</p>}
        <button className="btn" disabled={busy}>{busy ? 'One moment…' : mode === 'signin' ? 'Sign in and continue' : 'Create account'}</button>
      </form>
      <p className="alt">
        {mode === 'signin'
          ? <>No account yet? <button type="button" className="linkish" onClick={() => { setMode('signup'); setMsg(null); }}>Create one</button> · <a href="/forgot" target="_blank" rel="noopener">Forgot password</a></>
          : <>Already have an account? <button type="button" className="linkish" onClick={() => { setMode('signin'); setMsg(null); }}>Sign in</button></>}
      </p>
    </dialog>
  );
}
