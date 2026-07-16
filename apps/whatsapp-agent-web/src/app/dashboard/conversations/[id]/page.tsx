'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';

interface Message {
  id: string;
  senderType: string;
  content: string;
  createdAt: string;
}

interface Conversation {
  id: string;
  status: string;
  handoffReason: string | null;
  customer: { name: string | null; phoneNumber: string };
  client: { name: string };
  assignedTo: { name: string } | null;
  messages: Message[];
}

export default function ConversationDetailPage() {
  const { id } = useParams();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const token =
    (typeof window !== 'undefined' && localStorage.getItem('token')) || '';

  const fetchConversation = () => {
    fetch(`/api/conversations/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setConversation(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchConversation();
    const interval = setInterval(fetchConversation, 5000);
    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages]);

  const sendReply = async () => {
    if (!reply.trim()) return;

    await fetch(`/api/conversations/${id}/reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ content: reply }),
    });

    setReply('');
    fetchConversation();
  };

  const resolve = async () => {
    await fetch(`/api/conversations/${id}/resolve`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchConversation();
  };

  if (loading) return <p>Loading...</p>;
  if (!conversation) return <p>Conversation not found</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)' }}>
      <div
        style={{
          background: 'white',
          padding: 16,
          borderRadius: 8,
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>
            {conversation.customer.name || conversation.customer.phoneNumber}
          </h2>
          <div style={{ color: '#6b7280', fontSize: 14 }}>
            {conversation.client.name} • {conversation.customer.phoneNumber}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span
            style={{
              background:
                conversation.status === 'human'
                  ? '#ef4444'
                  : conversation.status === 'bot'
                  ? '#10b981'
                  : '#6b7280',
              color: 'white',
              padding: '4px 10px',
              borderRadius: 4,
              textTransform: 'uppercase',
              fontSize: 12,
            }}
          >
            {conversation.status}
          </span>
          <button onClick={resolve} style={{ padding: '8px 12px' }}>
            Resolve
          </button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          background: 'white',
          borderRadius: 8,
          padding: 16,
          marginBottom: 16,
        }}
      >
        {conversation.messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              justifyContent:
                msg.senderType === 'customer' ? 'flex-start' : 'flex-end',
              marginBottom: 12,
            }}
          >
            <div
              style={{
                maxWidth: '70%',
                padding: 12,
                borderRadius: 12,
                background:
                  msg.senderType === 'customer'
                    ? '#f3f4f6'
                    : msg.senderType === 'agent'
                    ? '#dbeafe'
                    : '#d1fae5',
                color: '#111827',
              }}
            >
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                {msg.senderType}
              </div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                {new Date(msg.createdAt).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {conversation.status === 'human' && (
        <div style={{ display: 'flex', gap: 8 }}>
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendReply()}
            placeholder="Type your reply..."
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 8,
              border: '1px solid #d1d5db',
              minHeight: 60,
              resize: 'none',
            }}
          />
          <button
            onClick={sendReply}
            style={{
              padding: '12px 24px',
              background: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
