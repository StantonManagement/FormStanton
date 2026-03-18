'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FileText,
  ClipboardList,
  Receipt,
  ScanLine,
  FolderOpen,
  DoorOpen,
  Car,
  LayoutGrid,
  FolderKanban,
  History,
  Users,
  LogOut,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
}

const iconMap: Record<string, LucideIcon> = {
  'Form Submissions': FileText,
  'Onboarding Submissions': ClipboardList,
  'Reimbursement Requests': Receipt,
  'Scan Import': ScanLine,
  'Forms Library': FolderOpen,
  'Lobby (Permit Distribution)': DoorOpen,
  'Phone Vehicle Entry': Car,
  'Compliance Dashboard': LayoutGrid,
  'Projects': FolderKanban,
  'Audit Log': History,
  'User Management': Users,
};

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'Forms & Submissions',
    items: [
      { label: 'Form Submissions', href: '/admin/form-submissions' },
      { label: 'Onboarding Submissions', href: '/admin/onboarding' },
      { label: 'Reimbursement Requests', href: '/admin/reimbursements' },
      { label: 'Scan Import', href: '/admin/scan-import' },
      { label: 'Forms Library', href: '/admin/forms-library' },
    ],
  },
  {
    title: 'Tenant Services',
    items: [
      { label: 'Lobby (Permit Distribution)', href: '/admin/lobby' },
      { label: 'Phone Vehicle Entry', href: '/admin/phone-entry' },
    ],
  },
  {
    title: 'Compliance & Reports',
    items: [
      { label: 'Compliance Dashboard', href: '/admin/compliance' },
      { label: 'Projects', href: '/admin/projects' },
    ],
  },
  {
    title: 'Administration',
    items: [
      { label: 'Audit Log', href: '/admin/audit-log' },
      { label: 'User Management', href: '/admin/users' },
    ],
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('adminSidebarCollapsed');
    if (stored !== null) {
      setIsCollapsed(stored === 'true');
    }
  }, []);

  const toggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('adminSidebarCollapsed', String(newState));
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/admin/auth', { method: 'DELETE' });
      router.push('/admin');
      router.refresh();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div
      className={`bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ease-out ${
        isCollapsed ? 'w-[48px]' : 'w-64'
      }`}
    >
      <div className={`p-4 border-b border-gray-200 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
        {!isCollapsed ? (
          <div className="flex items-center gap-2">
            <img
              src="/Stanton-logo.PNG"
              alt="Stanton Management"
              className="h-8 w-auto"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <h1 className="text-lg font-serif text-gray-900">Admin Portal</h1>
          </div>
        ) : (
          <img
            src="/Stanton-logo.PNG"
            alt="Stanton Management"
            className="h-6 w-auto"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        )}
        {!isCollapsed && (
          <button
            onClick={toggleCollapse}
            className="p-2 hover:bg-gray-100 rounded-none transition-colors duration-200 ease-out"
            title="Collapse sidebar"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
        )}
      </div>

      {isCollapsed && (
        <div className="flex justify-center py-2">
          <button
            onClick={toggleCollapse}
            className="p-2 hover:bg-gray-100 rounded-none transition-colors duration-200 ease-out"
            title="Expand sidebar"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto p-2">
        {navSections.map((section, sectionIdx) => (
          <div key={sectionIdx} className={isCollapsed ? 'mb-2' : 'mb-6'}>
            {isCollapsed ? (
              sectionIdx > 0 && <hr className="border-[var(--divider)] my-2 mx-1" />
            ) : (
              <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 px-2">
                {section.title}
              </h2>
            )}
            <ul className="space-y-1">
              {section.items.map((item) => {
                const isActive = pathname === item.href;
                const Icon = iconMap[item.label];
                return (
                  <li key={item.href} className={isCollapsed ? 'group relative' : ''}>
                    <Link
                      href={item.href}
                      className={`block rounded-none text-sm transition-colors duration-200 ease-out ${
                        isActive
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      } ${isCollapsed ? 'flex items-center justify-center py-2' : 'px-3 py-2'}`}
                    >
                      {isCollapsed && Icon ? (
                        <Icon size={20} />
                      ) : (
                        item.label
                      )}
                    </Link>
                    {isCollapsed && (
                      <span className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-[var(--ink)] text-[var(--paper)] text-xs whitespace-nowrap rounded-none opacity-0 group-hover:opacity-100 transition-opacity duration-100 delay-150 pointer-events-none z-50">
                        {item.label}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className={`border-t border-gray-200 ${isCollapsed ? 'p-2' : 'p-4'}`}>
        <div className={isCollapsed ? 'group relative' : ''}>
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className={`w-full py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-none transition-colors duration-200 ease-out disabled:opacity-50 ${
              isCollapsed ? 'flex items-center justify-center' : 'px-3'
            }`}
          >
            {isCollapsed ? (
              <LogOut size={20} />
            ) : (
              isLoggingOut ? 'Logging out...' : 'Logout'
            )}
          </button>
          {isCollapsed && (
            <span className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-[var(--ink)] text-[var(--paper)] text-xs whitespace-nowrap rounded-none opacity-0 group-hover:opacity-100 transition-opacity duration-100 delay-150 pointer-events-none z-50">
              {isLoggingOut ? 'Logging out...' : 'Logout'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
