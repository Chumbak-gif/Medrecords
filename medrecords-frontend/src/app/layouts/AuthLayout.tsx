/**
 * Authentication layout for login and public pages.
 *
 * Minimal layout without sidebar/header, centered content.
 *
 * Requirements: 7.1
 */

import { type ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div
      className="auth-layout"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '2rem',
      }}
    >
      <div className="auth-layout__container" style={{ width: '100%', maxWidth: '400px' }}>
        <div className="auth-layout__header" style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1>MEDRecords</h1>
        </div>
        <main role="main">
          {children}
        </main>
      </div>
    </div>
  );
}

export default AuthLayout;
