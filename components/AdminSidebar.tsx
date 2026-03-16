'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';

interface NavItem {
  label: string;
  href: string;
  icon?: string;
}

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
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        {!isCollapsed && (
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
        )}
        <button
          onClick={toggleCollapse}
          className="p-2 hover:bg-gray-100 rounded-none transition-colors duration-200 ease-out"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg
            className="w-5 h-5 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {isCollapsed ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 5l7 7-7 7M5 5l7 7-7 7"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
              />
            )}
          </svg>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-4">
        {navSections.map((section, sectionIdx) => (
          <div key={sectionIdx} className="mb-6">
            {!isCollapsed && (
              <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 px-2">
                {section.title}
              </h2>
            )}
            <ul className="space-y-1">
              {section.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`block px-3 py-2 rounded-none text-sm transition-colors duration-200 ease-out ${
                        isActive
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      } ${isCollapsed ? 'text-center' : ''}`}
                      title={isCollapsed ? item.label : undefined}
                    >
                      {isCollapsed ? item.label.charAt(0) : item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className={`w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-none transition-colors duration-200 ease-out ${
            isCollapsed ? 'text-center' : ''
          } disabled:opacity-50`}
          title={isCollapsed ? 'Logout' : undefined}
        >
          {isCollapsed ? '⎋' : isLoggingOut ? 'Logging out...' : 'Logout'}
        </button>
      </div>
    </div>
  );
}
