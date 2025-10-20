import type { JSX } from 'react';
import type { TabId } from '../types';

interface TabOption {
  id: TabId;
  label: string;
}

interface TabNavigationProps {
  tabs: TabOption[];
  activeTab: TabId;
  onChange: (tab: TabId) => void;
}

const TabNavigation = ({ tabs, activeTab, onChange }: TabNavigationProps): JSX.Element => {
  return (
    <nav className="flex rounded-2xl bg-white/70 p-1 shadow-inner">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`flex-1 rounded-[22px] px-4 py-2 text-sm font-semibold transition ${
              isActive ? 'bg-white text-slate-900 shadow' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
};

export default TabNavigation;
