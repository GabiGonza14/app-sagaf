'use client';
import { SessionProvider } from 'next-auth/react';
import { NavigationGuardProvider } from '@/lib/navigation-guard';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <NavigationGuardProvider>
        {children}
      </NavigationGuardProvider>
    </SessionProvider>
  );
}
