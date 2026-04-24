import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'HACH Reviewer Portal',
};

export default function HachQueuePage() {
  return (
    <div
      style={{
        padding: '48px 32px',
        maxWidth: 640,
        margin: '0 auto',
        fontFamily: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <h1
        style={{
          fontSize: 22,
          fontWeight: 600,
          color: '#1c1917',
          marginBottom: 8,
        }}
      >
        Review Queue
      </h1>
      <p style={{ fontSize: 14, color: '#78716c', marginTop: 0 }}>
        HACH Reviewer Portal — queue view coming in next build.
      </p>
    </div>
  );
}
