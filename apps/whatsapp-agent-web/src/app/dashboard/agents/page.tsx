'use client';

import { useEffect, useState } from 'react';

interface Agent {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const token =
    (typeof window !== 'undefined' && localStorage.getItem('token')) || '';

  useEffect(() => {
    fetch('/api/agents', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setAgents);
  }, []);

  return (
    <div>
      <h1>Agents</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
        {agents.map((a) => (
          <div
            key={a.id}
            style={{
              background: 'white',
              padding: 16,
              borderRadius: 8,
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            <strong>{a.name}</strong>
            <div style={{ color: '#6b7280', fontSize: 14 }}>
              {a.email} • {a.role} • {a.status}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
