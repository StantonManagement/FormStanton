'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '@/lib/adminAuthContext';

interface Template {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  slot_minutes: number;
  buffer_minutes: number;
  is_active: boolean;
}

interface Override {
  id: string;
  override_date: string;
  start_time: string | null;
  end_time: string | null;
  slot_minutes: number | null;
  buffer_minutes: number | null;
  reason: string;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DEFAULT_TIMES = ['09:00', '17:00'];

export default function AvailabilityConfigPage() {
  const { user, isSuperAdmin, hasPermission } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [message, setMessage] = useState('');
  const [staffId, setStaffId] = useState<string>('');
  const [allStaff, setAllStaff] = useState<Array<{ id: string; display_name: string }>>([]);
  const [showAddOverride, setShowAddOverride] = useState(false);
  const [newOverride, setNewOverride] = useState<Partial<Override>>({
    override_date: '',
    start_time: '09:00',
    end_time: '17:00',
    slot_minutes: 30,
    buffer_minutes: 0,
    reason: '',
  });
  const [newOverrideClosed, setNewOverrideClosed] = useState(false);

  const isAdmin = isSuperAdmin || hasPermission('scheduling', 'admin');

  // Initialize staff ID
  useEffect(() => {
    if (user?.username) {
      // username is the user ID in admin_users table
      setStaffId(user.username);
    }
  }, [user]);

  // Load all staff if admin
  useEffect(() => {
    if (isAdmin) {
      fetch('/api/admin/users')
        .then(r => r.json())
        .then(data => {
          if (data.success) {
            setAllStaff(data.data.filter((u: { user_type: string; is_active: boolean; id: string; display_name: string }) => u.user_type === 'stanton_staff' && u.is_active));
          }
        })
        .catch(console.error);
    }
  }, [isAdmin]);

  const fetchTemplates = useCallback(async () => {
    if (!staffId) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/scheduling/availability/templates?staffId=${staffId}`);
      const data = await res.json();
      if (data.success) {
        setTemplates(data.data);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setLoading(false);
    }
  }, [staffId]);

  const fetchOverrides = useCallback(async () => {
    if (!staffId) return;
    
    try {
      const res = await fetch(`/api/admin/scheduling/availability/overrides?staffId=${staffId}`);
      const data = await res.json();
      if (data.success) {
        setOverrides(data.data);
      }
    } catch (error) {
      console.error('Failed to load overrides:', error);
    }
  }, [staffId]);

  useEffect(() => {
    fetchTemplates();
    fetchOverrides();
  }, [fetchTemplates, fetchOverrides]);

  const updateTemplate = async (weekday: number, updates: Partial<Template>) => {
    setSaving(weekday);
    try {
      const existing = templates.find(t => t.weekday === weekday);
      
      const res = await fetch('/api/admin/scheduling/availability/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId,
          weekday,
          startTime: updates.start_time ?? existing?.start_time ?? DEFAULT_TIMES[0],
          endTime: updates.end_time ?? existing?.end_time ?? DEFAULT_TIMES[1],
          slotMinutes: updates.slot_minutes ?? existing?.slot_minutes ?? 30,
          bufferMinutes: updates.buffer_minutes ?? existing?.buffer_minutes ?? 0,
          isActive: updates.is_active ?? existing?.is_active ?? true,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setTemplates(prev => {
          const filtered = prev.filter(t => t.weekday !== weekday);
          return [...filtered, data.data];
        });
        showMessage('Saved successfully');
      } else {
        showMessage(data.message || 'Save failed');
      }
    } catch (error) {
      showMessage('Save failed');
    } finally {
      setSaving(null);
    }
  };

  const addOverride = async () => {
    if (!newOverride.override_date) {
      showMessage('Date is required');
      return;
    }

    try {
      const res = await fetch('/api/admin/scheduling/availability/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId,
          date: newOverride.override_date,
          startTime: newOverrideClosed ? null : newOverride.start_time,
          endTime: newOverrideClosed ? null : newOverride.end_time,
          slotMinutes: newOverrideClosed ? null : newOverride.slot_minutes,
          bufferMinutes: newOverrideClosed ? null : newOverride.buffer_minutes,
          reason: newOverride.reason || (newOverrideClosed ? 'Closed' : 'Modified hours'),
          isClosed: newOverrideClosed,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setOverrides(prev => [...prev, data.data].sort((a, b) => 
          a.override_date.localeCompare(b.override_date)
        ));
        setShowAddOverride(false);
        setNewOverride({
          override_date: '',
          start_time: '09:00',
          end_time: '17:00',
          slot_minutes: 30,
          buffer_minutes: 0,
          reason: '',
        });
        setNewOverrideClosed(false);
        showMessage('Override added');
      } else {
        showMessage(data.message || 'Failed to add override');
      }
    } catch (error) {
      showMessage('Failed to add override');
    }
  };

  const deleteOverride = async (overrideId: string) => {
    if (!confirm('Delete this override?')) return;

    try {
      const res = await fetch(`/api/admin/scheduling/availability/overrides?id=${overrideId}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (data.success) {
        setOverrides(prev => prev.filter(o => o.id !== overrideId));
        showMessage('Override deleted');
      } else {
        showMessage(data.message || 'Delete failed');
      }
    } catch (error) {
      showMessage('Delete failed');
    }
  };

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const formatTime = (time: string | null) => {
    if (!time) return '—';
    const [h, m] = time.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${m} ${ampm}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-serif text-[var(--primary)]">
            Scheduling Availability
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Configure your weekly schedule and date-specific overrides
          </p>
        </div>
        {message && (
          <span className={`text-sm ${message.includes('fail') || message.includes('Failed') ? 'text-red-600' : 'text-green-600'}`}>
            {message}
          </span>
        )}
      </div>

      {/* Staff selector (admin only) */}
      {isAdmin && (
        <div className="bg-white border border-[var(--border)] p-4">
          <label className="block text-sm font-medium text-[var(--ink)] mb-2">
            Configuring availability for:
          </label>
          <select
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            className="w-full max-w-md px-3 py-2 border border-[var(--border)] rounded-none text-sm bg-white"
          >
            <option value={user?.username}>Myself ({user?.displayName})</option>
            {allStaff.map((s: { id: string; display_name: string }) => (
              <option key={s.id} value={s.id}>{s.display_name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Weekly Templates */}
      <section className="bg-white border border-[var(--border)]">
        <div className="px-5 py-3 border-b border-[var(--divider)]">
          <h2 className="text-sm font-semibold text-[var(--primary)] uppercase tracking-wide">
            Weekly Schedule
          </h2>
          <p className="text-xs text-[var(--muted)] mt-1">
            Set your recurring availability for each day of the week
          </p>
        </div>

        <div className="divide-y divide-[var(--divider)]">
          {WEEKDAYS.map((dayName, weekday) => {
            const template = templates.find(t => t.weekday === weekday);
            const isActive = template?.is_active ?? true;
            const startTime = template?.start_time ?? DEFAULT_TIMES[0];
            const endTime = template?.end_time ?? DEFAULT_TIMES[1];
            const slotMinutes = template?.slot_minutes ?? 30;
            const bufferMinutes = template?.buffer_minutes ?? 0;

            return (
              <div key={weekday} className="p-4 flex items-center gap-4 flex-wrap">
                <div className="w-28 font-medium text-[var(--ink)]">{dayName}</div>
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => updateTemplate(weekday, { is_active: e.target.checked })}
                    className="rounded-none"
                  />
                  <span className="text-sm text-[var(--muted)]">Available</span>
                </label>

                {isActive && (
                  <>
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => updateTemplate(weekday, { start_time: e.target.value })}
                        className="px-2 py-1 border border-[var(--border)] rounded-none text-sm w-28"
                      />
                      <span className="text-[var(--muted)]">to</span>
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => updateTemplate(weekday, { end_time: e.target.value })}
                        className="px-2 py-1 border border-[var(--border)] rounded-none text-sm w-28"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={slotMinutes}
                        onChange={(e) => updateTemplate(weekday, { slot_minutes: parseInt(e.target.value) })}
                        className="px-2 py-1 border border-[var(--border)] rounded-none text-sm"
                      >
                        <option value={15}>15 min slots</option>
                        <option value={30}>30 min slots</option>
                        <option value={60}>60 min slots</option>
                      </select>
                    </div>

                    <button
                      onClick={() => updateTemplate(weekday, {})}
                      disabled={saving === weekday}
                      className="px-3 py-1 bg-[var(--primary)] text-white text-sm hover:opacity-90 disabled:opacity-50"
                    >
                      {saving === weekday ? 'Saving...' : 'Save'}
                    </button>
                  </>
                )}

                {!isActive && (
                  <span className="text-sm text-[var(--muted)] italic">Not available</span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Date Overrides */}
      <section className="bg-white border border-[var(--border)]">
        <div className="px-5 py-3 border-b border-[var(--divider)] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[var(--primary)] uppercase tracking-wide">
              Date Overrides
            </h2>
            <p className="text-xs text-[var(--muted)] mt-1">
              Mark specific dates as closed or with different hours
            </p>
          </div>
          <button
            onClick={() => setShowAddOverride(true)}
            className="px-3 py-1.5 bg-[var(--primary)] text-white text-sm hover:opacity-90"
          >
            + Add Override
          </button>
        </div>

        <div className="p-4">
          {overrides.length === 0 ? (
            <p className="text-sm text-[var(--muted)] text-center py-8">
              No overrides set. Use overrides for holidays, PTO, or special hours.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--divider)]">
                  <th className="text-left py-2 px-3 font-medium text-[var(--muted)]">Date</th>
                  <th className="text-left py-2 px-3 font-medium text-[var(--muted)]">Hours</th>
                  <th className="text-left py-2 px-3 font-medium text-[var(--muted)]">Reason</th>
                  <th className="text-right py-2 px-3 font-medium text-[var(--muted)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {overrides.map(override => (
                  <tr key={override.id} className="border-b border-[var(--divider)] last:border-0">
                    <td className="py-3 px-3">{formatDate(override.override_date)}</td>
                    <td className="py-3 px-3">
                      {override.start_time ? (
                        <span>{formatTime(override.start_time)} – {formatTime(override.end_time)}</span>
                      ) : (
                        <span className="text-red-600 font-medium">Closed</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-[var(--muted)]">{override.reason || '—'}</td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => deleteOverride(override.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Add Override Modal */}
        {showAddOverride && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white w-full max-w-md p-6">
              <h3 className="text-lg font-semibold text-[var(--primary)] mb-4">Add Date Override</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--ink)] mb-1">Date</label>
                  <input
                    type="date"
                    value={newOverride.override_date}
                    onChange={(e) => setNewOverride(prev => ({ ...prev, override_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-none"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newOverrideClosed}
                    onChange={(e) => setNewOverrideClosed(e.target.checked)}
                    className="rounded-none"
                  />
                  <span className="text-sm">Mark as fully closed</span>
                </label>

                {!newOverrideClosed && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-[var(--ink)] mb-1">Start</label>
                      <input
                        type="time"
                        value={newOverride.start_time || ''}
                        onChange={(e) => setNewOverride(prev => ({ ...prev, start_time: e.target.value }))}
                        className="w-full px-3 py-2 border border-[var(--border)] rounded-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--ink)] mb-1">End</label>
                      <input
                        type="time"
                        value={newOverride.end_time || ''}
                        onChange={(e) => setNewOverride(prev => ({ ...prev, end_time: e.target.value }))}
                        className="w-full px-3 py-2 border border-[var(--border)] rounded-none"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-[var(--ink)] mb-1">Reason</label>
                  <input
                    type="text"
                    value={newOverride.reason}
                    onChange={(e) => setNewOverride(prev => ({ ...prev, reason: e.target.value }))}
                    placeholder={newOverrideClosed ? 'e.g., Holiday' : 'e.g., Modified hours'}
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={addOverride}
                  className="flex-1 px-4 py-2 bg-[var(--primary)] text-white hover:opacity-90"
                >
                  Add Override
                </button>
                <button
                  onClick={() => setShowAddOverride(false)}
                  className="flex-1 px-4 py-2 border border-[var(--border)] hover:bg-[var(--bg-section)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
