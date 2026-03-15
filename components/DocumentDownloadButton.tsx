'use client';

import { useState } from 'react';

interface DocumentDownloadButtonProps {
  documentPath: string | null | undefined;
  documentName: string;
  size?: 'sm' | 'md';
  variant?: 'icon' | 'text' | 'full';
}

export default function DocumentDownloadButton({ 
  documentPath, 
  documentName,
  size = 'sm',
  variant = 'full'
}: DocumentDownloadButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!documentPath) return;
    
    setIsDownloading(true);
    try {
      const url = `/api/admin/file?path=${encodeURIComponent(documentPath)}`;
      const response = await fetch(url);
      
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = documentName;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(link);
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download document');
    } finally {
      setIsDownloading(false);
    }
  };

  if (!documentPath) {
    return (
      <span className="text-xs text-[var(--muted)] italic">
        No document available
      </span>
    );
  }

  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-1' : 'text-sm px-3 py-2';
  
  if (variant === 'icon') {
    return (
      <button
        onClick={handleDownload}
        disabled={isDownloading}
        className="text-[var(--primary)] hover:text-[var(--primary-light)] transition-colors duration-200 disabled:opacity-50"
        title={`Download ${documentName}`}
      >
        {isDownloading ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )}
      </button>
    );
  }

  if (variant === 'text') {
    return (
      <button
        onClick={handleDownload}
        disabled={isDownloading}
        className="text-[var(--primary)] hover:text-[var(--primary-light)] underline text-xs transition-colors duration-200 disabled:opacity-50"
      >
        {isDownloading ? 'Downloading...' : 'Download'}
      </button>
    );
  }

  return (
    <button
      onClick={handleDownload}
      disabled={isDownloading}
      className={`
        inline-flex items-center gap-1.5
        bg-white text-[var(--primary)] border border-[var(--border)]
        rounded-none hover:bg-[var(--bg-section)]
        transition-colors duration-200 ease-out
        disabled:opacity-50 disabled:cursor-not-allowed
        ${sizeClasses}
      `}
    >
      {isDownloading ? (
        <>
          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Downloading...</span>
        </>
      ) : (
        <>
          <span>📄</span>
          <span>Download</span>
        </>
      )}
    </button>
  );
}
