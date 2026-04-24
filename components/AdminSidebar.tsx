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
  ClipboardCheck,
  History,
  Users,
  ShieldCheck,
  Building2,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Inbox,
  AlertTriangle,
  Home,
  ListChecks,
  Search,
  type LucideIcon,
} from 'lucide-react';
import { useAdminAuth } from '@/lib/adminAuthContext';
import { NAV_PERMISSION_MAP } from '@/lib/permissions';
import { adminNavSections } from '@/lib/adminNav';

const iconMap: Record<string, LucideIcon> = {
  'Home': Home,
  'Form Submissions': FileText,
  'Onboarding Submissions': ClipboardList,
  'Reimbursement Requests': Receipt,
  'Scan Import': ScanLine,
  'Forms Library': FolderOpen,
  'Lobby (Permit Distribution)': DoorOpen,
  'Phone Vehicle Entry': Car,
  'All Buildings': LayoutGrid,
  'AppFolio Queue': Inbox,
  'Tow List': AlertTriangle,
  'Projects': FolderKanban,
  'PBV Pre-Apps': ClipboardCheck,
  'PBV Full Applications': ListChecks,
  'Audit Log': History,
  'User Management': Users,
  'Roles': ShieldCheck,
  'Departments': Building2,
};

const EXACT_MATCH_HREFS = new Set(['/admin', '/admin/home']);

function isRouteActive(pathname: string, href: string): boolean {
  if (EXACT_MATCH_HREFS.has(href)) return pathname === href;
  return pathname === href || pathname.startsWith(href + '/');
}

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, hasPermission, isLoading, isSuperAdmin, impersonator } = useAdminAuth();
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

  // Filter nav items by permission. While auth is loading, hide everything
  // to avoid a flash of links the user shouldn't see.
  // `/admin/home` is always visible to any authenticated user — everyone needs a landing page.
  const ALWAYS_VISIBLE = new Set(['/admin/home']);
  const visibleSections = isLoading
    ? []
    : adminNavSections
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => {
            if (ALWAYS_VISIBLE.has(item.href)) return true;
            const required = NAV_PERMISSION_MAP[item.href];
            if (!required) return true; // no restriction defined — show to all
            return hasPermission(required.resource, required.action);
          }),
        }))
        .filter((section) => section.items.length > 0);

  // Count destinations other than Home. If zero, the user has no real access.
  const accessibleDestinations = visibleSections.reduce(
    (acc, s) => acc + s.items.filter((i) => !ALWAYS_VISIBLE.has(i.href)).length,
    0
  );
  const showEmptyState = !isLoading && user !== null && accessibleDestinations === 0 && !isSuperAdmin && !impersonator;

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

      <div className={`px-2 pt-2 ${isCollapsed ? 'flex justify-center' : ''}`}>
        {isCollapsed ? (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('openCommandPalette'))}
            className="p-2 hover:bg-gray-100 rounded-none transition-colors duration-200 ease-out"
            title="Search (⌘K)"
          >
            <Search className="w-5 h-5 text-gray-400" />
          </button>
        ) : (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('openCommandPalette'))}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors duration-200 ease-out rounded-none"
          >
            <Search className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-left">Search...</span>
            <kbd className="text-[10px] font-mono bg-white border border-gray-200 px-1 py-0.5 text-gray-400">⌘K</kbd>
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        {showEmptyState && !isCollapsed && (
          <div className="mx-2 mt-2 mb-4 p-3 border border-amber-200 bg-amber-50 text-xs text-amber-900">
            <p className="font-medium mb-1">No pages assigned</p>
            <p className="text-amber-800 leading-snug">
              Your account has no roles. Contact an administrator to grant access.
            </p>
          </div>
        )}
        {visibleSections.map((section, sectionIdx) => (
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
                const isActive = isRouteActive(pathname, item.href);
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
                        <span className="flex items-center gap-2">
                          {item.label}
                          {item.beta && (
                            <span className={`text-[10px] font-medium px-1 py-px leading-none rounded-none ${
                              isActive ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'
                            }`}>BETA</span>
                          )}
                        </span>
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

      {!isLoading && user && !isCollapsed && (
        <div className="px-3 py-2 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="text-xs font-medium text-gray-700 truncate flex-1">{user.displayName}</p>
            {isSuperAdmin && (
              <span
                className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 bg-indigo-900 text-white leading-none shrink-0"
                title="Super admin — full access to everything"
              >
                SUPER
              </span>
            )}
          </div>
          {user.departmentCode && (
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">{user.departmentCode}</p>
          )}
        </div>
      )}

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
