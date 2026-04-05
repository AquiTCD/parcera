import React from 'react';
import { Separator } from '../ui/separator';
import { cn } from '../../lib/utils';

export interface NavItem {
  id: string;
  label: string;
  advanced?: boolean;
}

interface SidebarNavProps {
  items: NavItem[];
  activeId: string;
  onSelect: (id: string) => void;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({ items, activeId, onSelect }) => {
  const normalItems = items.filter((item) => !item.advanced);
  const advancedItems = items.filter((item) => item.advanced);

  return (
    <nav role="navigation" className="flex flex-col gap-1 py-4 px-2">
      {normalItems.map((item) => (
        <button
          key={item.id}
          onClick={() => onSelect(item.id)}
          aria-current={activeId === item.id ? 'page' : undefined}
          className={cn(
            'w-full text-left rounded-md px-3 py-2 text-sm font-medium transition-colors',
            activeId === item.id
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}
        >
          {item.label}
        </button>
      ))}

      {advancedItems.length > 0 && (
        <>
          <div className="flex items-center gap-2 my-2 px-1">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground/60 shrink-0 select-none">高度な設定</span>
            <Separator className="flex-1" />
          </div>
          {advancedItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              aria-current={activeId === item.id ? 'page' : undefined}
              className={cn(
                'w-full text-left rounded-md px-3 py-2 text-sm font-medium transition-colors',
                activeId === item.id
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground/70 hover:bg-accent hover:text-accent-foreground'
              )}
            >
              {item.label}
            </button>
          ))}
        </>
      )}
    </nav>
  );
};
