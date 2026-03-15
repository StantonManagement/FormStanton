'use client';

import { useState, useEffect } from 'react';
import Head from 'next/head';
import PhoneVehicleEntryForm from '@/components/PhoneVehicleEntryForm';

export default function PhoneEntryPage() {
  const [submissions, setSubmissions] = useState<any[]>([]);

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    try {
      const response = await fetch('/api/admin/submissions');
      const data = await response.json();
      if (data.success) setSubmissions(data.data);
    } catch (error) {
      console.error('Failed to fetch submissions:', error);
    }
  };

  return (
    <>
      <Head>
        <title>Phone Vehicle Entry - Stanton Management</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="max-w-7xl mx-auto px-4 py-6">
        <PhoneVehicleEntryForm onSuccess={fetchSubmissions} />
      </div>
    </>
  );
}
