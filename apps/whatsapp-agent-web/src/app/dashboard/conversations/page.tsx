'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Conversation {
  id: string;
  status: string;
  handoffReason: string | null;
  updatedAt: string;
  customer: { name: string | null; phoneNumber: string };
  client: { name: string };
  assignedTo: { name: string } | null;
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/login';
      return;
    }
    fetch(`/api/conversations${status ? `?status=${status}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok || !Array.isArray(data)) {
          console.error('Conversations fetch failed:', data);
          setConversations([]);
        } else {
          setConversations(data);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setConversations([]);
        setLoading(false);
      });
  }, [status]);

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = {
      bot: '#10b981',
      human: '#ef4444',
      resolved: '#6b7280',
      archived: '#374151',
    };
    return (
      <span
        style={{
          background: colors[s] || '#6b7280',
          color: 'white',
          padding: '4px 8px',
          borderRadius: 4,
          fontSize: 12,
          textTransform: 'uppercase',
        }}
      >
        {s}
      </span>
    );
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <h1>Conversations</h1>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          style={{ padding: 8 }}
        >
          <option value="">All</option>
          <option value="bot">Bot</option>
          <option value="human">Human</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {conversations.map((c) => (
            <Link
              key={c.id}
              href={`/dashboard/conversations/${c.id}`}
              style={{
                background: 'white',
                padding: 16,
                borderRadius: 8,
                textDecoration: 'none',
                color: 'inherit',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <strong>{c.customer.name || c.customer.phoneNumber}</strong>
                  <div style={{ color: '#6b7280', fontSize: 14 }}>
                    {c.client.name} • {c.customer.phoneNumber}
                  </div>
                  {c.handoffReason && (
                    <div style={{ color: '#ef4444', fontSize: 13, marginTop: 4 }}>
                      {c.handoffReason}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  {statusBadge(c.status)}
                  <div style={{ color: '#6b7280', fontSize: 12, marginTop: 6 }}>
                    {c.assignedTo ? `Assigned: ${c.assignedTo.name}` : 'Unassigned'}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
