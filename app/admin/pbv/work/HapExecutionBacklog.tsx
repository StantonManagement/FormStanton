'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle, Clock, ExternalLink } from 'lucide-react';

interface BacklogItem {
  id: string;
  head_of_household_name: string;
  building_address: string;
  unit_number: string;
  days_since_approval: number;
}

export default function HapExecutionBacklog() {
  const [backlog, setBacklog] = useState<BacklogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBacklog();
  }, []);

  const fetchBacklog = async () => {
    try {
      const response = await fetch('/api/admin/pbv/rollup/hap-backlog');
      if (!response.ok) {
        throw new Error('Failed to fetch backlog');
      }
      const data = await response.json();
      if (data.success) {
        setBacklog(data.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white shadow-sm border border-gray-200 rounded-md p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-gray-200 rounded w-48"></div>
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white shadow-sm border border-gray-200 rounded-md p-6">
        <div className="text-red-600 text-sm flex items-center">
          <AlertCircle className="h-4 w-4 mr-2" />
          {error}
        </div>
      </div>
    );
  }

  if (backlog.length === 0) {
    return (
      <div className="bg-white shadow-sm border border-gray-200 rounded-md p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-2">HAP Execution Backlog</h3>
        <p className="text-sm text-gray-600">
          No applications waiting more than 7 days for HAP execution. Great job!
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-sm border border-gray-200 rounded-md">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">HAP Execution Backlog</h3>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
            {backlog.length} pending
          </span>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Applications approved by HACH more than 7 days ago but not yet executed
        </p>
      </div>

      <div className="divide-y divide-gray-200">
        {backlog.map((item) => (
          <div key={item.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
            <div>
              <p className="font-medium text-gray-900">{item.head_of_household_name}</p>
              <p className="text-sm text-gray-600">
                {item.building_address} {item.unit_number}
              </p>
              <p className="text-sm text-amber-600 mt-1 flex items-center">
                <Clock className="h-3 w-3 mr-1" />
                {item.days_since_approval} days since HACH approval
              </p>
            </div>
            <Link
              href={`/admin/pbv/full-applications/${item.id}/signing`}
              className="text-sm text-indigo-600 hover:text-indigo-900 flex items-center"
            >
              Execute HAP
              <ExternalLink className="h-4 w-4 ml-1" />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
