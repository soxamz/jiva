'use client';

import { useState, useEffect } from 'react';

export default function Page() {
  const [data, setData] = useState<{ message?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBackendMessage = async () => {
      try {
        // Fetching from /api/hello will be rewritten to http://127.0.0.1:5328/api/hello
        const res = await fetch('/api/hello');
        if (!res.ok) {
          throw new Error(`Request failed: ${res.status} ${res.statusText}`);
        }

        const contentType = res.headers.get('content-type') ?? '';
        const body = await res.text();

        if (contentType.includes('application/json')) {
          const payload = JSON.parse(body) as { message?: string };
          setData(payload);
          return;
        }

        setData({ message: body });
      } catch (err) {
        console.error('Error fetching from python backend:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchBackendMessage();
  }, []);

  if (loading) return <p>Loading...</p>;

  return (
    <main style={{ padding: '2rem' }}>
      <h1>Next.js Frontend</h1>
      <p>
        Response from Python API: <strong>{data?.message}</strong>
      </p>
    </main>
  );
}
