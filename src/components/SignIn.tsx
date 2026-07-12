import { useState, type FormEvent } from 'react';
import Icon from './Icon';
import Logo from './Logo';
import { useRole } from './RoleContext';

export default function SignIn() {
  const { authStep, pendingEmail, devCode, authError, sendOtp, verifyOtp, resetToEmailStep } = useRole();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSendOtp(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await sendOtp(email);
    setSubmitting(false);
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const ok = await verifyOtp(otp);
    setSubmitting(false);
    if (!ok) setOtp('');
  }

  return (
    <div className="signin-page">
      <div className="signin-card card">
        <div className="signin-brand">
          <div className="brand-mark"><Logo size={38} /></div>
          <div>
            <div className="brand-name-dark">Garm Admin</div>
            <div className="signin-sub">Operations Portal</div>
          </div>
        </div>

        {authStep === 'email' ? (
          <>
            <h1 className="signin-title">Sign in</h1>
            <p className="signin-desc">
              Use the work email your Super Admin added you with. We'll send a one-time
              code to verify it's really you before opening the portal.
            </p>

            <form onSubmit={handleSendOtp}>
              <div className="form-field full" style={{ marginBottom: 14 }}>
                <label>Email address</label>
                <input
                  type="email"
                  autoFocus
                  placeholder="you@garm.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {authError && (
                <div className="signin-error"><Icon name="xCircle" /> {authError}</div>
              )}

              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={submitting}>
                {submitting ? 'Sending code…' : 'Send verification code'}
              </button>
            </form>

            <div className="signin-footnote">
              New employee? Ask your Super Admin to add your email under <b>Settings → Users</b> with the right role first.
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={resetToEmailStep}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: 0, marginBottom: 14, color: 'var(--muted)', fontSize: 13 }}
            >
              <Icon name="chevLeft" /> {pendingEmail}
            </button>

            <h1 className="signin-title">Enter your code</h1>
            <p className="signin-desc">
              We sent a 6-digit verification code to <b>{pendingEmail}</b>. Enter it below to
              finish signing in.
            </p>

            {devCode && (
              <div className="signin-error" style={{ background: 'var(--accent-bg)', color: 'var(--accent-text)' }}>
                <Icon name="shield" /> Dev mode — no email gateway connected yet. Your code is <b>{devCode}</b>.
              </div>
            )}

            <form onSubmit={handleVerify}>
              <div className="form-field full" style={{ marginBottom: 14 }}>
                <label>Verification code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  maxLength={6}
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  style={{ letterSpacing: 4, fontWeight: 600 }}
                />
              </div>

              {authError && (
                <div className="signin-error"><Icon name="xCircle" /> {authError}</div>
              )}

              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={submitting || otp.length !== 6}>
                {submitting ? 'Verifying…' : 'Verify & sign in'}
              </button>
            </form>

            <div className="signin-footnote">
              Didn't get a code? Go back and resend it, or check with your Super Admin that your account is active.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
