import type { ReactNode } from 'react';
import { useRole } from './RoleContext';
import SignIn from './SignIn';

export default function AuthGate({ children }: { children: ReactNode }) {
  const { currentUser, authLoading } = useRole();

  if (authLoading) {
    return <div className="signin-page"><div className="small-muted">Loading…</div></div>;
  }
  if (!currentUser) {
    return <SignIn />;
  }
  return <>{children}</>;
}
