import { ReactNode } from 'react';
import AppSidebar from './AppSidebar';
import MobileShell from './MobileShell';

const AppLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <MobileShell />
      <main className="md:ml-20 lg:ml-64 min-h-screen pt-[calc(3.5rem+env(safe-area-inset-top))] pb-[calc(4rem+env(safe-area-inset-bottom))] md:pt-0 md:pb-0">
        {children}
      </main>
    </div>
  );
};

export default AppLayout;
