'use client';

import { useEffect, useState } from 'react';

interface Analytics {
  totalConversations: number;
  activeConversations: number;
  resolvedConversations: number;
  humanHandoffs: number;
  totalMessages: number;
  handoffsToday: number;
  conversationsToday: number;
  topHandoffReasons: { reason: string; count: number }[];
  dailyVolume: { date: string; count: number }[];
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const token =
    (typeof window !== 'undefined' && localStorage.getItem('token')) || '';

  useEffect(() => {
    fetch('/api/analytics/overview', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) {
    return <div>Loading analytics...</div>;
  }

  const statCard = (label: string, value: number | string) => (
    <div
      key={label}
      style={{
        background: 'white',
        padding: 20,
        borderRadius: 8,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        minWidth: 160,
        flex: 1,
      }}
    >
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#111827' }}>{value}</div>
    </div>
  );

  return (
    <div>
      <h1>Analytics</h1>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          marginTop: 24,
        }}
      >
        {statCard('Total Conversations', data.totalConversations)}
        {statCard('Active', data.activeConversations)}
        {statCard('Resolved', data.resolvedConversations)}
        {statCard('Human Handoffs', data.humanHandoffs)}
        {statCard('Total Messages', data.totalMessages)}
        {statCard('Handoffs Today', data.handoffsToday)}
        {statCard('Conversations Today', data.conversationsToday)}
      </div>

      <div style={{ marginTop: 32 }}>
        <h2>Top Handoff Reasons</h2>
        <div
          style={{
            marginTop: 12,
            background: 'white',
            padding: 16,
            borderRadius: 8,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          {data.topHandoffReasons.length === 0 ? (
            <div style={{ color: '#6b7280' }}>No handoffs yet</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#6b7280', fontSize: 13 }}>
                  <th style={{ paddingBottom: 8 }}>Reason</th>
                  <th style={{ paddingBottom: 8 }}>Count</th>
                </tr>
              </thead>
              <tbody>
                {data.topHandoffReasons.map((r, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 0' }}>{r.reason}</td>
                    <td style={{ padding: '10px 0' }}>{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div style={{ marginTop: 32 }}>
        <h2>Daily Conversation Volume (Last 7 Days)</h2>
        <div
          style={{
            marginTop: 12,
            background: 'white',
            padding: 16,
            borderRadius: 8,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            display: 'flex',
            alignItems: 'flex-end',
            gap: 12,
            height: 200,
          }}
        >
          {data.dailyVolume.map((d) => (
            <div
              key={d.date}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <div
                style={{
                  width: '100%',
                  background: '#2563eb',
                  borderRadius: 4,
                  minHeight: 4,
                  height: `${Math.max(
                    4,
                    (d.count /
                      Math.max(
                        1,
                        ...data.dailyVolume.map((x) => x.count),
                      )) *
                      140,
                  )}px`,
                }}
              />
              <div style={{ fontSize: 11, color: '#6b7280' }}>
                {new Date(d.date).toLocaleDateString(undefined, {
                  weekday: 'short',
                })}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{d.count}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
