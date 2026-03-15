'use client';

import { useState, useEffect } from 'react';
import Head from 'next/head';
import ScanUploadInterface from '@/components/ScanUploadInterface';
import ScanReviewInterface from '@/components/ScanReviewInterface';

export default function ScanImportPage() {
  const [scanBatches, setScanBatches] = useState<any[]>([]);
  const [reviewingBatchId, setReviewingBatchId] = useState<string | null>(null);

  useEffect(() => {
    fetchScanBatches();
  }, []);

  const fetchScanBatches = async () => {
    try {
      const response = await fetch('/api/admin/scan-upload');
      const data = await response.json();
      if (data.success) setScanBatches(data.data);
    } catch (error) {
      console.error('Failed to fetch scan batches:', error);
    }
  };

  if (reviewingBatchId) {
    return (
      <ScanReviewInterface
        batchId={reviewingBatchId}
        onClose={() => setReviewingBatchId(null)}
        onImportComplete={() => {
          setReviewingBatchId(null);
          fetchScanBatches();
        }}
      />
    );
  }

  return (
    <>
      <Head>
        <title>Scan Import - Stanton Management</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="max-w-7xl mx-auto px-4 py-6">
        <ScanUploadInterface
          onBatchCreated={(batchId) => {
            fetchScanBatches();
          }}
          batches={scanBatches}
          onRefresh={fetchScanBatches}
          onReviewBatch={(batchId) => setReviewingBatchId(batchId)}
        />
      </div>
    </>
  );
}
