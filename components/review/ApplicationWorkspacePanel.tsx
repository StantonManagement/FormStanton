'use client';

import { useState } from 'react';
import MessageThread from './MessageThread';

interface Tab {
  key: string;
  label: string;
  channel: string;
  unread: number;
  messages: Array<{
    id: string;
    author_display_name: string;
    body: string;
    created_at: string;
    edited_at?: string;
    author_user_id: string;
  }>;
  onPost: (body: string) => Promise<void>;
  onEdit: (messageId: string, body: string) => Promise<void>;
  onMarkRead: () => Promise<void>;
}

interface ApplicationWorkspacePanelProps {
  tabs: Tab[];
  context: 'stanton' | 'hach';
  currentUserId: string;
}

export default function ApplicationWorkspacePanel({ 
  tabs, 
  context, 
  currentUserId 
}: ApplicationWorkspacePanelProps) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.key || '');

  const activeTabData = tabs.find(tab => tab.key === activeTab);

  if (context === 'hach') {
    const COLORS = {
      panel: '#ffffff',
      border: '#e7e5e4',
      borderStrong: '#d6d3d1',
      text: '#1c1917',
      textMuted: '#78716c',
      accent: '#0f4c5c',
      accentLight: '#e6f0f3',
    };
    const FONT = "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif";

    return (
      <div style={{ fontFamily: FONT, height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${COLORS.border}`,
          fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase' as const, color: COLORS.textMuted,
        }}>
          Workspace
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', borderBottom: `1px solid ${COLORS.border}`,
          backgroundColor: '#fafaf9',
        }}>
          {tabs.map((tab) => {
            const isActive = tab.key === activeTab;
            const hasUnread = tab.unread > 0;
            
            return (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  // Mark as read when switching to tab
                  if (hasUnread) {
                    tab.onMarkRead();
                  }
                }}
                style={{
                  flex: 1, padding: '10px 16px',
                  backgroundColor: isActive ? COLORS.panel : 'transparent',
                  borderBottom: isActive ? `2px solid ${COLORS.accent}` : '2px solid transparent',
                  fontSize: 12, fontWeight: isActive ? 600 : 500,
                  color: isActive ? COLORS.text : COLORS.textMuted,
                  cursor: 'pointer', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.label}
                {hasUnread && (
                  <span style={{
                    backgroundColor: '#dc2626', color: '#fff',
                    fontSize: 10, fontWeight: 600,
                    padding: '1px 5px', borderRadius: 10,
                    minWidth: 16, textAlign: 'center' as const,
                  }}>
                    {tab.unread}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {activeTabData && (
            <MessageThread
              messages={activeTabData.messages}
              currentUserId={currentUserId}
              context="hach"
              canEditWindowMinutes={5}
              onPost={activeTabData.onPost}
              onEdit={activeTabData.onEdit}
              onMarkRead={activeTabData.onMarkRead}
              emptyHint={`No notes yet — start the thread to coordinate with the ${activeTabData.channel === 'hach' ? 'HACH team' : 'Stanton team'}`}
            />
          )}
        </div>
      </div>
    );
  }

  // Stanton context - use Tailwind
  return (
    <div className="h-full flex flex-col font-sans">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Workspace</h3>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;
          const hasUnread = tab.unread > 0;
          
          return (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                // Mark as read when switching to tab
                if (hasUnread) {
                  tab.onMarkRead();
                }
              }}
              className={`flex-1 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                isActive 
                  ? 'text-blue-600 border-blue-500 bg-white' 
                  : 'text-gray-600 border-transparent hover:text-gray-800'
              } flex items-center justify-center gap-2`}
            >
              {tab.label}
              {hasUnread && (
                <span className="px-1.5 py-0.5 text-xs font-semibold bg-red-500 text-white rounded-full min-w-[1.25rem] text-center">
                  {tab.unread}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTabData && (
          <MessageThread
            messages={activeTabData.messages}
            currentUserId={currentUserId}
            context="stanton"
            canEditWindowMinutes={5}
            onPost={activeTabData.onPost}
            onEdit={activeTabData.onEdit}
            onMarkRead={activeTabData.onMarkRead}
            emptyHint={`No notes yet — start the thread to coordinate with the ${activeTabData.channel === 'stanton' ? 'Stanton team' : 'HACH team'}`}
          />
        )}
      </div>
    </div>
  );
}
