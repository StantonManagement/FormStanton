'use client';

import { useState, useEffect, useCallback } from 'react';
import PageHeader from '@/components/admin/PageHeader';
import { useAdminAuth } from '@/lib/adminAuthContext';

interface RejectionTemplate {
  code: string;
  label: string;
  template_en: string;
  template_es: string;
  template_pt: string;
  sort_order: number;
  is_active: boolean;
}

interface EditingState {
  code: string;
  template_en: string;
  template_es: string;
  template_pt: string;
  is_active: boolean;
}

const PREVIEW_VARS = {
  tenant: 'Maria',
  doc: 'Paystubs (4 weekly)',
  doc_short: 'paystubs',
  custom: 'Please include all 4 weeks',
};

export default function RejectionTemplatesPage() {
  const { hasPermission, isSuperAdmin } = useAdminAuth();
  const [templates, setTemplates] = useState<RejectionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');
  const [previewLang, setPreviewLang] = useState<'en' | 'es' | 'pt'>('en');

  const canManage = isSuperAdmin || hasPermission('role-management', 'admin');

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const res = await fetch('/api/admin/rejection-templates');
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to load templates');
      }
      setTemplates(json.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (template: RejectionTemplate) => {
    setEditing({
      code: template.code,
      template_en: template.template_en,
      template_es: template.template_es,
      template_pt: template.template_pt,
      is_active: template.is_active,
    });
    setSaveError('');
    setSaveSuccess('');
  };

  const handleCancel = () => {
    setEditing(null);
    setSaveError('');
    setSaveSuccess('');
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    setSaveError('');
    setSaveSuccess('');

    try {
      const res = await fetch('/api/admin/rejection-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to save template');
      }

      // Update local state
      setTemplates((prev) =>
        prev.map((t) =>
          t.code === editing.code
            ? { ...t, ...editing }
            : t
        )
      );
      setSaveSuccess('Template saved successfully');
      setTimeout(() => setEditing(null), 500);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const interpolate = (template: string, vars: typeof PREVIEW_VARS): string => {
    return template
      .replace(/\{tenant\}/g, vars.tenant)
      .replace(/\{doc\}/g, vars.doc)
      .replace(/\{doc_short\}/g, vars.doc_short)
      .replace(/\{custom\}/g, vars.custom)
      .replace(/\{[^}]+\}/g, '');
  };

  const langDisplayName = (lang: string): string => {
    switch (lang) {
      case 'es': return 'Spanish';
      case 'pt': return 'Portuguese';
      default: return 'English';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--paper)]">
        <PageHeader title="Rejection Templates" subtitle="Manage SMS templates sent to tenants when documents are rejected" breadcrumbs={[{ label: 'Settings' }, { label: 'Rejection Templates' }]} />
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="text-sm text-[var(--muted)]">Loading templates...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--paper)]">
        <PageHeader title="Rejection Templates" subtitle="Manage SMS templates sent to tenants when documents are rejected" breadcrumbs={[{ label: 'Settings' }, { label: 'Rejection Templates' }]} />
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <PageHeader
        title="Rejection Templates"
        subtitle="Manage SMS templates sent to tenants when documents are rejected"
        breadcrumbs={[{ label: 'Settings' }, { label: 'Rejection Templates' }]}
      />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {!canManage && (
          <div className="border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            You need super admin or role management permissions to edit templates. View-only mode.
          </div>
        )}

        {saveSuccess && (
          <div className="border border-green-200 bg-green-50 p-4 text-sm text-green-700">{saveSuccess}</div>
        )}

        {saveError && (
          <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">{saveError}</div>
        )}

        {/* Template list */}
        <div className="space-y-4">
          {templates.map((template) => (
            <div
              key={template.code}
              className="bg-white border border-[var(--border)] overflow-hidden"
            >
              {/* Header */}
              <div className="px-5 py-3 border-b border-[var(--divider)] bg-[var(--bg-section)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-serif text-lg text-[var(--primary)]">{template.label}</span>
                  <span className="text-xs px-2 py-1 bg-[var(--border)] text-[var(--muted)]">
                    {template.code}
                  </span>
                  {!template.is_active && (
                    <span className="text-xs px-2 py-1 bg-red-100 text-red-700">Inactive</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {editing?.code === template.code ? (
                    <>
                      <button
                        onClick={handleCancel}
                        disabled={saving}
                        className="px-3 py-1.5 text-sm text-[var(--ink)] hover:bg-[var(--bg-section)] transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-3 py-1.5 text-sm bg-[var(--primary)] text-white hover:bg-[var(--primary-light)] transition-colors disabled:bg-gray-300"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                    </>
                  ) : (
                    canManage && (
                      <button
                        onClick={() => handleEdit(template)}
                        className="px-3 py-1.5 text-sm text-[var(--primary)] hover:bg-[var(--bg-section)] transition-colors"
                      >
                        Edit
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="p-5">
                {editing?.code === template.code ? (
                  // Edit mode
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={editing.is_active}
                          onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                          className="rounded-none"
                        />
                        Active
                      </label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-[var(--muted)] uppercase tracking-wide mb-2">
                          English
                        </label>
                        <textarea
                          value={editing.template_en}
                          onChange={(e) => setEditing({ ...editing, template_en: e.target.value })}
                          rows={3}
                          className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-none focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--muted)] uppercase tracking-wide mb-2">
                          Spanish
                        </label>
                        <textarea
                          value={editing.template_es}
                          onChange={(e) => setEditing({ ...editing, template_es: e.target.value })}
                          rows={3}
                          className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-none focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--muted)] uppercase tracking-wide mb-2">
                          Portuguese
                        </label>
                        <textarea
                          value={editing.template_pt}
                          onChange={(e) => setEditing({ ...editing, template_pt: e.target.value })}
                          rows={3}
                          className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-none focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  // View mode
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <div className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide mb-2">
                        English
                      </div>
                      <div className="text-sm text-[var(--ink)] p-3 bg-[var(--bg-section)] border border-[var(--border)]">
                        {template.template_en}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide mb-2">
                        Spanish
                      </div>
                      <div className="text-sm text-[var(--ink)] p-3 bg-[var(--bg-section)] border border-[var(--border)]">
                        {template.template_es}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide mb-2">
                        Portuguese
                      </div>
                      <div className="text-sm text-[var(--ink)] p-3 bg-[var(--bg-section)] border border-[var(--border)]">
                        {template.template_pt}
                      </div>
                    </div>
                  </div>
                )}

                {/* Preview section */}
                <div className="mt-4 pt-4 border-t border-[var(--divider)]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">
                      Preview with sample data
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[var(--muted)]">Language:</span>
                      <select
                        value={previewLang}
                        onChange={(e) => setPreviewLang(e.target.value as 'en' | 'es' | 'pt')}
                        className="text-sm border border-[var(--border)] rounded-none px-2 py-1 bg-white"
                      >
                        <option value="en">English</option>
                        <option value="es">Spanish</option>
                        <option value="pt">Portuguese</option>
                      </select>
                    </div>
                  </div>
                  <div className="p-3 bg-[var(--bg-section)] border border-[var(--border)] text-sm text-[var(--ink)]">
                    {interpolate(
                      previewLang === 'es'
                        ? template.template_es
                        : previewLang === 'pt'
                        ? template.template_pt
                        : template.template_en,
                      PREVIEW_VARS
                    )}
                  </div>
                  <div className="mt-1 text-xs text-[var(--muted)]">
                    Variables: {'{tenant}'} = &quot;{PREVIEW_VARS.tenant}&quot;, {'{doc}'} = &quot;{PREVIEW_VARS.doc}&quot;, {'{doc_short}'} = &quot;{PREVIEW_VARS.doc_short}&quot;, {'{custom}'} = &quot;{PREVIEW_VARS.custom}&quot;
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
