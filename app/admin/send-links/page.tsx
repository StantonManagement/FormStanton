'use client';

import { useState, useMemo } from 'react';
import Head from 'next/head';

const formLinks = [
  {
    name: 'Tenant Onboarding Form',
    description: 'Pet registration, insurance, vehicle/parking info',
    path: 'https://form-stanton.vercel.app/admin',
  },
  {
    name: 'Reimbursement Request',
    description: 'Tenant expense reimbursement with receipt upload',
    path: '/reimbursement',
  },
];

export default function SendLinksPage() {
  const [copiedLink, setCopiedLink] = useState('');
  const [formSearch, setFormSearch] = useState('');

  const filteredFormLinks = useMemo(() => {
    if (!formSearch.trim()) return formLinks;
    const q = formSearch.toLowerCase();
    return formLinks.filter(f =>
      f.name.toLowerCase().includes(q) || f.description.toLowerCase().includes(q)
    );
  }, [formSearch]);

  const copyFormLink = (path: string) => {
    const url = `${window.location.origin}${path}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(path);
    setTimeout(() => setCopiedLink(''), 2000);
  };

  return (
    <>
      <Head>
        <title>Send Form Links - Stanton Management</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="max-w-3xl">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-semibold text-gray-900">Send Form Links</h2>
              <span className="text-sm text-gray-400">{filteredFormLinks.length} form{filteredFormLinks.length !== 1 ? 's' : ''}</span>
            </div>
            <p className="text-sm text-gray-500 mb-4">Click a link to copy it to your clipboard, then paste it in a text or email to send to a tenant.</p>

            <div className="relative mb-6">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search forms..."
                value={formSearch}
                onChange={(e) => setFormSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            <div className="space-y-3">
              {filteredFormLinks.map((form) => (
                <button
                  key={form.path}
                  onClick={() => copyFormLink(form.path)}
                  className={`w-full flex items-center justify-between px-5 py-4 rounded-lg border text-left transition-colors ${
                    copiedLink === form.path
                      ? 'bg-green-50 border-green-300'
                      : 'bg-white border-gray-200 hover:bg-blue-50 hover:border-blue-300'
                  }`}
                >
                  <div>
                    <h3 className="font-semibold text-gray-900">{form.name}</h3>
                    <p className="text-sm text-gray-500">{form.description}</p>
                    <span className="text-xs text-gray-400 font-mono mt-1 block">{form.path}</span>
                  </div>
                  {copiedLink === form.path ? (
                    <span className="text-green-600 font-medium flex items-center gap-1 text-sm flex-shrink-0 ml-4">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                      Copied!
                    </span>
                  ) : (
                    <span className="text-gray-400 flex items-center gap-1 text-sm flex-shrink-0 ml-4">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                      Copy Link
                    </span>
                  )}
                </button>
              ))}

              {filteredFormLinks.length === 0 && (
                <div className="text-center py-8 text-gray-500">No forms match your search.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
