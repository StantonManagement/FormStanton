import { motion } from 'framer-motion';

interface Tab {
  id: number;
  label: string;
  icon?: string;
}

interface TabNavigationProps {
  tabs: Tab[];
  activeTab: number;
  onTabClick: (tabId: number) => void;
  completedTabs?: number[];
}

export default function TabNavigation({ tabs, activeTab, onTabClick, completedTabs = [] }: TabNavigationProps) {
  return (
    <div className="border-b border-[var(--divider)] bg-[var(--bg-section)]">
      <div className="flex overflow-x-auto scrollbar-hide">
        {tabs.map((tab, index) => {
          const isActive = activeTab === tab.id;
          const isCompleted = completedTabs.includes(tab.id);

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabClick(tab.id)}
              className={`
                relative flex-1 min-w-[120px] px-4 py-4 text-sm font-medium transition-colors
                ${isActive
                  ? 'text-[var(--primary)]'
                  : isCompleted
                    ? 'text-[var(--accent)] hover:text-[var(--primary)]'
                    : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }
              `}
            >
              <div className="flex items-center justify-center space-x-2">
                {isCompleted && !isActive && (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
                <span className="whitespace-nowrap">{tab.label}</span>
              </div>

              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--primary)]"
                  initial={false}
                  transition={{
                    type: "spring",
                    stiffness: 500,
                    damping: 30
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
