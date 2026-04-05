import React from 'react';

interface SidebarLayoutProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}

export const SidebarLayout: React.FC<SidebarLayoutProps> = ({ sidebar, children }) => {
  return (
    <div className="flex h-full w-full overflow-hidden bg-background text-foreground">
      {/* Sidebar: fixed width */}
      <aside
        className="w-[160px] shrink-0 border-r border-border overflow-y-auto"
      >
        {sidebar}
      </aside>

      {/* Content area: takes remaining space, scrollable */}
      <main className="flex-1 overflow-y-auto p-6">
        {children}
      </main>
    </div>
  );
};
