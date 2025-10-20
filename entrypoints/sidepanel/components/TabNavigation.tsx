import type { JSX } from 'react';
import type { TabId } from '../types';
import { MessageCircle } from 'lucide-react';

interface IconContainerProps {
  children: JSX.Element | JSX.Element[];
}

const IconContainer = ({ children }: IconContainerProps): JSX.Element => {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
};

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
  overview: (
    <IconContainer>
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="5" rx="2" />
      <rect x="13" y="10" width="8" height="8" rx="2" />
      <rect x="3" y="13" width="8" height="5" rx="2" />
    </IconContainer>
  ),
  fields: (
    <IconContainer>
      <path d="M4 5h16" />
      <path d="M4 12h16" />
      <path d="M10 19h10" />
      <path d="M6 18l-3 3" />
      <path d="M6 18l3 3" />
    </IconContainer>
  ),
  chatbot: (
    <MessageCircle size={24}/>
  ),
};

const TabNavigation = ({ tabs, activeTab, onChange }: TabNavigationProps): JSX.Element => {
  return (
    <nav className="flex flex-col gap-2 ">
      <div className="flex flex-col gap-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`group flex items-center gap-3 rounded-[20px]  text-left text-sm font-semibold transition ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-400 text-white shadow-md shadow-indigo-200/70'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-[16px] border text-base transition ${
                  isActive
                    ? 'border-white/30 bg-white/20 text-white'
                    : 'border-slate-200 bg-white text-slate-500 group-hover:border-indigo-200 group-hover:text-indigo-500'
                }`}
                aria-hidden="true"
              >
                {TAB_ICON_MAP[tab.id]}
              </span>
            
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default TabNavigation;
