import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ROLE_VIEWS, type Role } from '../data/mockData';
import { api, adminToken, type ApiUser } from '../api/client';

interface RoleContextValue {
  currentUser: ApiUser | null;
  authLoading: boolean;
  authError: string;
  // Two-step, OTP-verified sign-in — replaces the old "type any provisioned
  // email, no verification" flow. sendOtp() emails a code; verifyOtp() checks
  // it against the backend and only then opens a session.
  authStep: 'email' | 'otp';
  pendingEmail: string;
  devCode: string;
  sendOtp: (email: string) => Promise<boolean>;
  verifyOtp: (otp: string) => Promise<boolean>;
  resetToEmailStep: () => void;
  signOut: () => void;
  role: Role | null;
  allowedViews: string[];
}

const RoleContext = createContext<RoleContextValue>({
  currentUser: null,
  authLoading: true,
  authError: '',
  authStep: 'email',
  pendingEmail: '',
  devCode: '',
  sendOtp: async () => false,
  verifyOtp: async () => false,
  resetToEmailStep: () => {},
  signOut: () => {},
  role: null,
  allowedViews: [],
});

export function useRole() {
  return useContext(RoleContext);
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<ApiUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [authStep, setAuthStep] = useState<'email' | 'otp'>('email');
  const [pendingEmail, setPendingEmail] = useState('');
  const [devCode, setDevCode] = useState('');

  // Real identity, OTP-verified: whoever the Super Admin has provisioned by
  // email, and who can prove it with a code sent to that email, is who's
  // signed in. Their role decides what modules they can see. The session
  // token (not the email) is what's remembered locally — the source of truth
  // is always the backend session + user record, so a Super Admin can revoke
  // or change someone's role/status at any time and it takes effect immediately.
  useEffect(() => {
    if (!adminToken.get()) { setAuthLoading(false); return; }
    api.getMe()
      .then(({ user }) => setCurrentUser(user))
      .catch(() => adminToken.clear())
      .finally(() => setAuthLoading(false));
  }, []);

  async function sendOtp(email: string): Promise<boolean> {
    const clean = email.trim().toLowerCase();
    setAuthError('');
    if (!clean) { setAuthError('Enter your work email address.'); return false; }
    try {
      const res = await api.sendAdminOtp(clean);
      setPendingEmail(clean);
      setDevCode(res.devCode || '');
      setAuthStep('otp');
      return true;
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Could not send a code. Try again.');
      return false;
    }
  }

  async function verifyOtp(otp: string): Promise<boolean> {
    setAuthError('');
    try {
      const user = await api.verifyAdminOtp(pendingEmail, otp);
      setCurrentUser(user);
      setAuthStep('email');
      setPendingEmail('');
      setDevCode('');
      return true;
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'That code didn’t match. Try again.');
      return false;
    }
  }

  function resetToEmailStep() {
    setAuthStep('email');
    setAuthError('');
    setDevCode('');
  }

  function signOut() {
    api.adminLogout();
    setCurrentUser(null);
    setAuthStep('email');
    setPendingEmail('');
  }

  const role = (currentUser?.role as Role) || null;
  const allowedViews = role ? ROLE_VIEWS[role] || [] : [];

  return (
    <RoleContext.Provider value={{
      currentUser, authLoading, authError, authStep, pendingEmail, devCode,
      sendOtp, verifyOtp, resetToEmailStep, signOut, role, allowedViews,
    }}>
      {children}
    </RoleContext.Provider>
  );
}
