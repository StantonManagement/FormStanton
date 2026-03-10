'use client';

import { useState } from 'react';
import { SubmissionGroup, getSimilarityConfidence, getDuplicateReasons, TenantSubmission } from '@/lib/duplicateDetection';

interface DuplicateSubmissionAccordionProps {
  group: SubmissionGroup;
  onMerge: (primaryId: string, duplicateIds: string[]) => Promise<void>;
  onMarkPrimary: (submissionId: string, groupId: string) => Promise<void>;
  onDismiss: (groupId: string, duplicateId: string) => Promise<void>;
  onViewSignature?: (path: string, type: string, date?: string) => void;
}

export default function DuplicateSubmissionAccordion({
  group,
  onMerge,
  onMarkPrimary,
  onDismiss,
  onViewSignature,
}: DuplicateSubmissionAccordionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [merging, setMerging] = useState(false);
  const [viewingDiff, setViewingDiff] = useState<string | null>(null);

  const handleMergeAll = async () => {
    if (!confirm(`Merge ${group.duplicates.length} duplicate submission(s) into the primary record?`)) {
      return;
    }

    setMerging(true);
    try {
      await onMerge(
        group.primarySubmission.id,
        group.duplicates.map(d => d.id)
      );
    } catch (error) {
      console.error('Failed to merge:', error);
      alert('Failed to merge submissions');
    } finally {
      setMerging(false);
    }
  };

  const handleMarkPrimary = async (submissionId: string) => {
    if (!confirm('Mark this submission as the primary record?')) {
      return;
    }

    try {
      await onMarkPrimary(submissionId, group.id);
    } catch (error) {
      console.error('Failed to mark as primary:', error);
      alert('Failed to mark as primary');
    }
  };

  const handleDismiss = async (duplicateId: string) => {
    if (!confirm('Mark this as not a duplicate? It will no longer appear in this group.')) {
      return;
    }

    try {
      await onDismiss(group.id, duplicateId);
    } catch (error) {
      console.error('Failed to dismiss:', error);
      alert('Failed to dismiss duplicate');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  const renderFieldDiff = (sub1: TenantSubmission, sub2: TenantSubmission) => {
    const fields = [
      { label: 'Name', key: 'full_name' },
      { label: 'Phone', key: 'phone', format: formatPhone },
      { label: 'Email', key: 'email' },
      { label: 'Unit', key: 'unit_number' },
      { label: 'Building', key: 'building_address' },
    ];

    return (
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div>
          <div className="font-semibold text-blue-700 mb-2">Primary Record</div>
          {fields.map(field => (
            <div key={field.key} className="mb-1">
              <span className="text-gray-600">{field.label}:</span>{' '}
              <span className="font-medium">
                {field.format 
                  ? field.format((sub1 as any)[field.key] || '')
                  : (sub1 as any)[field.key] || '-'}
              </span>
            </div>
          ))}
        </div>
        <div>
          <div className="font-semibold text-orange-700 mb-2">Duplicate Record</div>
          {fields.map(field => (
            <div key={field.key} className="mb-1">
              <span className="text-gray-600">{field.label}:</span>{' '}
              <span className={`font-medium ${
                (sub1 as any)[field.key] !== (sub2 as any)[field.key] 
                  ? 'text-orange-600 bg-orange-50 px-1 rounded' 
                  : ''
              }`}>
                {field.format 
                  ? field.format((sub2 as any)[field.key] || '')
                  : (sub2 as any)[field.key] || '-'}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="border-2 border-orange-300 rounded-lg bg-white shadow-md overflow-hidden">
      {/* Collapsed Header */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-orange-50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3 flex-1 text-left">
          <div className="text-2xl">🔄</div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">
                {group.primarySubmission.full_name}
              </span>
              <span className="text-sm text-gray-600">
                - Unit {group.primarySubmission.unit_number}
              </span>
              <span className="px-2 py-0.5 bg-orange-100 text-orange-800 text-xs font-semibold rounded-full">
                {group.duplicates.length} duplicate{group.duplicates.length !== 1 ? 's' : ''}
              </span>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                Grouped
              </span>
            </div>
            <div className="text-sm text-gray-600 mt-1">
              Primary: {formatDate(group.primarySubmission.created_at)} • {formatPhone(group.primarySubmission.phone)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!isExpanded && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleMergeAll();
              }}
              disabled={merging}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors disabled:bg-gray-400"
            >
              {merging ? 'Merging...' : 'Merge All'}
            </button>
          )}
          <svg
            className={`w-5 h-5 text-gray-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-orange-200 bg-orange-50/30">
          <div className="p-4 space-y-3">
            {/* Bulk Actions */}
            <div className="flex items-center gap-2 pb-3 border-b border-orange-200">
              <button
                onClick={handleMergeAll}
                disabled={merging}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors disabled:bg-gray-400"
              >
                {merging ? 'Merging...' : `Merge All ${group.duplicates.length} Duplicates`}
              </button>
              <span className="text-xs text-gray-500">
                This will combine all data into the primary record
              </span>
            </div>

            {/* Duplicate List */}
            {group.duplicates.map((duplicate, index) => {
              const similarity = group.similarityScores[duplicate.id] || 0;
              const confidence = getSimilarityConfidence(similarity);
              const reasons = getDuplicateReasons(group.primarySubmission, duplicate);
              const showingDiff = viewingDiff === duplicate.id;

              return (
                <div
                  key={duplicate.id}
                  className="bg-white rounded-lg border border-gray-200 p-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-gray-400 font-mono text-sm">├─</span>
                        <span className="font-semibold text-gray-900">{duplicate.full_name}</span>
                        <span className="text-sm text-gray-600">
                          ({formatDate(duplicate.created_at)})
                        </span>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                          confidence === 'high' 
                            ? 'bg-green-100 text-green-800'
                            : confidence === 'medium'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-orange-100 text-orange-800'
                        }`}>
                          {similarity}% match
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 ml-6 space-y-1">
                        <div>{formatPhone(duplicate.phone)} • {duplicate.email}</div>
                        <div className="flex items-center gap-2">
                          {reasons.map((reason, i) => (
                            <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded">
                              {reason}
                            </span>
                          ))}
                        </div>
                        {duplicate.has_vehicle && (
                          <div className="text-xs text-gray-500">
                            🚗 {duplicate.vehicle_year} {duplicate.vehicle_make} {duplicate.vehicle_model}
                            {duplicate.vehicle_plate && ` - ${duplicate.vehicle_plate}`}
                          </div>
                        )}
                      </div>

                      {/* Field Diff View */}
                      {showingDiff && (
                        <div className="mt-3 p-3 bg-gray-50 rounded border border-gray-200">
                          {renderFieldDiff(group.primarySubmission, duplicate)}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-2 ml-4">
                      <button
                        onClick={() => handleMarkPrimary(duplicate.id)}
                        className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded hover:bg-purple-200 transition-colors whitespace-nowrap"
                      >
                        Mark Primary
                      </button>
                      <button
                        onClick={() => setViewingDiff(showingDiff ? null : duplicate.id)}
                        className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded hover:bg-gray-200 transition-colors whitespace-nowrap"
                      >
                        {showingDiff ? 'Hide Diff' : 'View Diff'}
                      </button>
                      <button
                        onClick={() => handleDismiss(duplicate.id)}
                        className="px-3 py-1 bg-red-100 text-red-700 text-xs font-medium rounded hover:bg-red-200 transition-colors whitespace-nowrap"
                      >
                        Not Duplicate
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
