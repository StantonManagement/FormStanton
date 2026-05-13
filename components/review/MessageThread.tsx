'use client';

import { useState, useRef, useEffect } from 'react';
import { formatRelativeTime } from './utils';

interface Message {
  id: string;
  author_display_name: string;
  body: string;
  created_at: string;
  edited_at?: string;
  author_user_id: string;
}

interface MessageThreadProps {
  messages: Message[];
  currentUserId: string;
  context: 'stanton' | 'hach';
  canEditWindowMinutes: number;
  onPost: (body: string) => Promise<void>;
  onEdit: (messageId: string, body: string) => Promise<void>;
  onMarkRead: () => Promise<void>;
  emptyHint: string;
}

export default function MessageThread({
  messages,
  currentUserId,
  context,
  canEditWindowMinutes,
  onPost,
  onEdit,
  onMarkRead,
  emptyHint,
}: MessageThreadProps) {
  const [newMessage, setNewMessage] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark as read when component mounts
  useEffect(() => {
    if (messages.length > 0) {
      onMarkRead();
    }
  }, [messages.length, onMarkRead]);

  const canEditMessage = (message: Message): boolean => {
    if (message.author_user_id !== currentUserId) return false;
    const editWindowMs = canEditWindowMinutes * 60 * 1000;
    const timeSinceCreation = Date.now() - new Date(message.created_at).getTime();
    return timeSinceCreation < editWindowMs;
  };

  const handlePost = async () => {
    if (!newMessage.trim() || submitting) return;
    
    setSubmitting(true);
    setError('');
    
    try {
      await onPost(newMessage.trim());
      setNewMessage('');
    } catch (e: any) {
      setError(e.message || 'Failed to post message');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (messageId: string) => {
    if (!editingBody.trim() || submitting) return;
    
    setSubmitting(true);
    setError('');
    
    try {
      await onEdit(messageId, editingBody.trim());
      setEditingMessageId(null);
      setEditingBody('');
    } catch (e: any) {
      setError(e.message || 'Failed to edit message');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (message: Message) => {
    setEditingMessageId(message.id);
    setEditingBody(message.body);
    setError('');
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditingBody('');
    setError('');
  };

  if (context === 'hach') {
    const COLORS = {
      bg: '#fafaf9',
      panel: '#ffffff',
      border: '#e7e5e4',
      text: '#1c1917',
      textMuted: '#78716c',
      textSubtle: '#a8a29e',
      accent: '#0f4c5c',
      error: '#dc2626',
      errorBg: '#fef2f2',
    };
    const FONT = "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif";

    return (
      <div style={{ fontFamily: FONT, height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {messages.length === 0 ? (
            <div style={{ fontSize: 13, color: COLORS.textMuted, fontStyle: 'italic', textAlign: 'center' as const, padding: '20px 0' }}>
              {emptyHint}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {messages.map((message) => {
                const isOwn = message.author_user_id === currentUserId;
                const canEdit = canEditMessage(message);
                const isEditing = editingMessageId === message.id;

                return (
                  <div key={message.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      backgroundColor: isOwn ? COLORS.accent : '#d1d5db',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 600, color: isOwn ? '#fff' : COLORS.text,
                      flexShrink: 0,
                    }}>
                      {message.author_display_name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.text }}>
                          {message.author_display_name}
                        </span>
                        <span style={{ fontSize: 11, color: COLORS.textSubtle }}>
                          {formatRelativeTime(message.created_at)}
                        </span>
                        {message.edited_at && (
                          <span style={{ fontSize: 10, color: COLORS.textSubtle, fontStyle: 'italic' }}>
                            (edited)
                          </span>
                        )}
                      </div>
                      
                      {isEditing ? (
                        <div style={{ marginTop: 4 }}>
                          <textarea
                            value={editingBody}
                            onChange={(e) => setEditingBody(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') cancelEdit();
                              if (e.key === 'Enter' && e.metaKey) handleEdit(message.id);
                            }}
                            style={{
                              width: '100%', padding: '6px 8px',
                              fontSize: 13, fontFamily: FONT,
                              border: `1px solid ${COLORS.border}`, borderRadius: 3,
                              resize: 'vertical', minHeight: 60,
                            }}
                            autoFocus
                          />
                          <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                            <button
                              onClick={() => handleEdit(message.id)}
                              disabled={submitting || !editingBody.trim()}
                              style={{
                                padding: '4px 10px', fontSize: 11, fontWeight: 600,
                                backgroundColor: COLORS.accent, color: '#fff', border: 'none',
                                borderRadius: 3, cursor: submitting || !editingBody.trim() ? 'not-allowed' : 'pointer',
                                opacity: submitting || !editingBody.trim() ? 0.5 : 1,
                              }}
                            >
                              {submitting ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={cancelEdit}
                              disabled={submitting}
                              style={{
                                padding: '4px 10px', fontSize: 11, fontWeight: 600,
                                backgroundColor: '#fff', color: COLORS.text, border: `1px solid ${COLORS.border}`,
                                borderRadius: 3, cursor: submitting ? 'not-allowed' : 'pointer',
                                opacity: submitting ? 0.5 : 1,
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                          {message.body}
                        </div>
                      )}
                      
                      {!isEditing && canEdit && (
                        <button
                          onClick={() => startEdit(message)}
                          style={{
                            marginTop: 4, fontSize: 10, color: COLORS.textMuted,
                            background: 'none', border: 'none', cursor: 'pointer',
                            textDecoration: 'underline',
                          }}
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={{ borderTop: `1px solid ${COLORS.border}`, padding: '12px 16px' }}>
          {error && (
            <div style={{
              marginBottom: 8, padding: '6px 8px',
              backgroundColor: COLORS.errorBg, border: `1px solid #fecaca`,
              fontSize: 11, color: COLORS.error,
            }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.metaKey) handlePost();
              }}
              placeholder="Type a message..."
              rows={2}
              style={{
                flex: 1, padding: '6px 8px',
                fontSize: 13, fontFamily: FONT,
                border: `1px solid ${COLORS.border}`, borderRadius: 3,
                resize: 'none', minHeight: 40,
              }}
            />
            <button
              onClick={handlePost}
              disabled={submitting || !newMessage.trim()}
              style={{
                padding: '6px 12px', fontSize: 12, fontWeight: 600,
                backgroundColor: COLORS.accent, color: '#fff', border: 'none',
                borderRadius: 3, cursor: submitting || !newMessage.trim() ? 'not-allowed' : 'pointer',
                opacity: submitting || !newMessage.trim() ? 0.5 : 1,
                alignSelf: 'flex-end',
              }}
            >
              {submitting ? '...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Stanton context - use Tailwind
  return (
    <div className="h-full flex flex-col font-sans">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="text-sm text-gray-500 italic text-center py-8">
            {emptyHint}
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => {
              const isOwn = message.author_user_id === currentUserId;
              const canEdit = canEditMessage(message);
              const isEditing = editingMessageId === message.id;

              return (
                <div key={message.id} className="flex gap-2 items-start">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${
                    isOwn ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-700'
                  }`}>
                    {message.author_display_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-gray-900">
                        {message.author_display_name}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatRelativeTime(message.created_at)}
                      </span>
                      {message.edited_at && (
                        <span className="text-xs text-gray-400 italic">(edited)</span>
                      )}
                    </div>
                    
                    {isEditing ? (
                      <div className="mt-1">
                        <textarea
                          value={editingBody}
                          onChange={(e) => setEditingBody(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') cancelEdit();
                            if (e.key === 'Enter' && e.metaKey) handleEdit(message.id);
                          }}
                          className="w-full p-2 text-sm border border-gray-300 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows={3}
                          autoFocus
                        />
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() => handleEdit(message.id)}
                            disabled={submitting || !editingBody.trim()}
                            className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {submitting ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={cancelEdit}
                            disabled={submitting}
                            className="px-3 py-1 text-xs font-medium bg-white text-gray-700 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
                        {message.body}
                      </div>
                    )}
                    
                    {!isEditing && canEdit && (
                      <button
                        onClick={() => startEdit(message)}
                        className="mt-1 text-xs text-gray-500 hover:text-gray-700 underline"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-3">
        {error && (
          <div className="mb-2 p-2 bg-red-50 border border-red-200 text-xs text-red-700">
            {error}
          </div>
        )}
        <div className="flex gap-2">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.metaKey) handlePost();
            }}
            placeholder="Type a message..."
            rows={2}
            className="flex-1 p-2 text-sm border border-gray-300 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handlePost}
            disabled={submitting || !newMessage.trim()}
            className={`px-3 py-2 text-sm font-medium rounded self-end ${
              submitting || !newMessage.trim()
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {submitting ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
