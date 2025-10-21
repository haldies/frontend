import type { JSX } from 'react';
import type { TabId } from '../types';
import { CloudUpload, MessageCircle, User } from 'lucide-react';

interface TabOption {
  id: TabId;
  label: string;
}

interface TabNavigationProps {
  tabs: TabOption[];
  activeTab: TabId;
  onChange: (tab: TabId) => void;
}

const TAB_ICON_MAP: Record<TabId, JSX.Element> = {
  overview: <CloudUpload size={20} />,
  fields: <User size={20} />,
  chatbot: <MessageCircle size={20} />,
};

const TabNavigation = ({ tabs, activeTab, onChange }: TabNavigationProps): JSX.Element => {
  return (
    <nav className="flex flex-col gap-2 relative">
      <div className="flex flex-col gap-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <div key={tab.id} className="relative group">
              <button
                type="button"
                onClick={() => onChange(tab.id)}
                className={`flex items-center justify-center rounded-[20px] p-2 text-sm font-semibold transition-all
                  ${isActive
                    ? 'bg-slate-100 text-indigo-600 shadow-md'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-indigo-600'}
                `}
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-[16px] border text-base transition
                    ${isActive
                      ? 'border-indigo-300 bg-white text-indigo-600 shadow-sm'
                      : 'border-slate-200 bg-white text-slate-500 group-hover:border-indigo-300 group-hover:text-indigo-600'}
                  `}
                  aria-hidden="true"
                >
                  {TAB_ICON_MAP[tab.id]}
                </span>
              </button>

              {/* Tooltip di kiri tombol */}
              <span
                className="absolute right-full mr-2 top-1/2 -translate-y-1/2 rounded-md bg-slate-800 px-2 py-1 text-xs text-white opacity-0 pointer-events-none 
                  transition-opacity duration-200 group-hover:opacity-100 whitespace-nowrap shadow-lg"
              >
                {tab.label}
              </span>
            </div>
          );
        })}
      </div>
    </nav>
  );
};

export default TabNavigation;
