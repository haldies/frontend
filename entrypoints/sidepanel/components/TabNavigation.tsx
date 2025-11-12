import { useState } from 'react';
import type { JSX } from 'react';
import type { TabId } from '../types';
import { CloudUpload, MessageCircle, User, FileSearch, CirclePlus, ChevronUp, LogIn, Settings, HelpCircle } from 'lucide-react';

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
  fields: <CirclePlus size={20} />,
  chatbot: <MessageCircle size={20} />,
  scanForm: <FileSearch size={20} />,
  profile: <User size={20} />,
};

const TabNavigation = ({ tabs, activeTab, onChange }: TabNavigationProps): JSX.Element => {
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  // pisahkan tab "profile" agar ditaruh di bawah
  const mainTabs = tabs.filter((tab) => tab.id !== 'profile');
  const profileTab = tabs.find((tab) => tab.id === 'profile');

  const renderTabButton = (tab: TabOption) => {
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

        {/* Tooltip kiri */}
        <span
          className="absolute right-full mr-2 top-1/2 -translate-y-1/2 rounded-md bg-slate-800 px-2 py-1 text-xs text-white opacity-0 pointer-events-none
            transition-opacity duration-200 group-hover:opacity-100 whitespace-nowrap shadow-lg"
        >
          {tab.label}
        </span>
      </div>
    );
  };

  const renderProfileButton = () => {
    if (!profileTab) return null;

    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
          className={`flex items-center justify-center rounded-[20px] p-2 text-sm font-semibold transition-all
            ${profileDropdownOpen
              ? 'bg-slate-100 text-indigo-600 shadow-md'
              : 'text-slate-500 hover:bg-slate-100 hover:text-indigo-600'}
          `}
        >
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-[16px] border text-base transition
              ${profileDropdownOpen
                ? 'border-indigo-300 bg-white text-indigo-600 shadow-sm'
                : 'border-slate-200 bg-white text-slate-500 hover:border-indigo-300 hover:text-indigo-600'}
            `}
          >
            <User size={20} />
          </span>
        </button>

        {/* Tooltip kiri */}
        <span
          className="absolute right-full mr-2 top-1/2 -translate-y-1/2 rounded-md bg-slate-800 px-2 py-1 text-xs text-white opacity-0 pointer-events-none
            transition-opacity duration-200 group-hover:opacity-100 whitespace-nowrap shadow-lg"
        >
          {profileTab.label}
        </span>

        {profileDropdownOpen && (
          <>
            {/* Backdrop untuk menutup dropdown saat klik di luar */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setProfileDropdownOpen(false)}
            />

            {/* Dropdown Content */}
            <div className="absolute bottom-full right-0 mb-2 z-50 min-w-[200px] bg-white rounded-xl shadow-lg overflow-hidden border-2 border-slate-300 ">
              {/* Dropdown Arrow */}
              <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-white border-r border-b border-slate-200 transform rotate-45"></div>

              {/* Login Section */}
              <div className="p-4 border-b border-slate-100">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                    <User size={18} className="text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">Guest User</p>
                    <p className="text-xs text-slate-500">Not logged in</p>
                  </div>
                </div>

                <button
                  type="button"
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors"
                >
                  <LogIn size={16} />
                  Login
                </button>
              </div>

              {/* Menu Items */}
              <div className="py-2">
                <button
                  type="button"
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                >
                  <Settings size={16} className="text-slate-400" />
                  Settings
                </button>

                <button
                  type="button"
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                >
                  <HelpCircle size={16} className="text-slate-400" />
                  Help & Support
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <nav className="flex flex-col justify-between h-full relative ">
      {/* Bagian atas (tab utama) */}
      <div className="flex flex-col gap-1">
        {mainTabs.map(renderTabButton)}
      </div>

      {/* Bagian bawah (profile) */}
      <div className="pt-2 border-t border-slate-200">
        {renderProfileButton()}
      </div>
    </nav>
  );
};

export default TabNavigation;
