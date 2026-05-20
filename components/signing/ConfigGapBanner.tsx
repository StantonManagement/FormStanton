'use client';

import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';

interface ConfigGap {
  property_not_configured: boolean;
  template_defaulted: boolean;
  year_built_unknown: boolean;
}

interface ConfigGapBannerProps {
  buildingAddress: string;
  configGaps: ConfigGap;
  propertyId?: string | null;
}

export default function ConfigGapBanner({
  buildingAddress,
  configGaps,
  propertyId,
}: ConfigGapBannerProps) {
  if (!configGaps.property_not_configured && !configGaps.year_built_unknown) {
    return null;
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-none p-4 mb-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h4 className="text-sm font-medium text-yellow-900">
            Property metadata not configured for {buildingAddress}
          </h4>
          <p className="text-sm text-yellow-800 mt-1">
            Defaults applied: lead paint required, no property-specific addenda.
          </p>
          {configGaps.year_built_unknown && (
            <p className="text-xs text-yellow-700 mt-1 italic">
              Year built is unknown — lead paint disclosure is included as a safe default.
            </p>
          )}
          <div className="mt-3">
            <Link
              href={propertyId ? `/admin/properties/${propertyId}/edit` : '/admin/properties'}
              className="text-sm text-yellow-900 underline hover:text-yellow-700 font-medium"
            >
              Configure property →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
