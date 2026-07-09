import { createContext, useContext, useState, type ReactNode } from 'react';
import { ROLE_VIEWS, type Role } from '../data/mockData';

interface RoleContextValue {
  role: Role;
  setRole: (r: Role) => void;
  allowedViews: string[];
}

const RoleContext = createContext<RoleContextValue>({
  role: 'Super Admin',
  setRole: () => {},
  allowedViews: ROLE_VIEWS['Super Admin'],
});

export function useRole() {
  return useContext(RoleContext);
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>('Super Admin');
  return (
    <RoleContext.Provider value={{ role, setRole, allowedViews: ROLE_VIEWS[role] }}>
      {children}
    </RoleContext.Provider>
  );
}
