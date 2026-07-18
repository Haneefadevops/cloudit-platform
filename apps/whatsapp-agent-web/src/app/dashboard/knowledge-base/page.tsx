'use client';

import { useEffect, useState } from 'react';

interface Client {
  id: string;
  name: string;
}

interface Document {
  id: string;
  title: string;
  contentType: string;
  chunkIndex: number;
  createdAt: string;
}

const inputStyle: React.CSSProperties = {
  padding: 8,
  borderRadius: 4,
  border: '1px solid #d1d5db',
  fontSize: 14,
  width: '100%',
};

const buttonStyle = (color: string): React.CSSProperties => ({
  padding: '6px 12px',
  background: color,
  color: 'white',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 13,
});

export default function KnowledgeBasePage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const token =
    (typeof window !== 'undefined' && localStorage.getItem('token')) || '';

  const showInfo = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 4000);
  };

  const fetchClients = async () => {
    if (!token) return;
    const res = await fetch('/api/clients', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setClients(Array.isArray(data) ? data : []);
  };

  const fetchDocuments = async (clientId: string) => {
    if (!clientId) return;
    const res = await fetch(`/api/knowledge-base/${clientId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setDocuments(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    if (!token) {
      window.location.href = '/login';
      return;
    }
    fetchClients();
  }, []);

  useEffect(() => {
    fetchDocuments(selectedId);
  }, [selectedId]);

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !title || !content) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/knowledge-base/${selectedId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title, content, contentType: 'text' }),
      });
      if (res.ok) {
        showInfo('Document added');
        setTitle('');
        setContent('');
        await fetchDocuments(selectedId);
      } else {
        showInfo('Failed to add document');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !files || files.length === 0) return;
    setLoading(true);
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }
      const res = await fetch(`/api/knowledge-base/${selectedId}/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        showInfo('Files uploaded');
        setFiles(null);
        await fetchDocuments(selectedId);
      } else {
        showInfo('Failed to upload files');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    const res = await fetch(
      `/api/knowledge-base/${selectedId}/${documentId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (res.ok) {
      showInfo('Document deleted');
      await fetchDocuments(selectedId);
    } else {
      showInfo('Failed to delete document');
    }
  };

  return (
    <div>
      <h1>Knowledge Base</h1>
      <p style={{ color: '#6b7280', fontSize: 14 }}>
        Upload text or files per client. The AI uses this content to answer
        WhatsApp messages.
      </p>

      {message && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: 6,
            color: '#1e40af',
          }}
        >
          {message}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>Client</label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          style={{ ...inputStyle, marginTop: 4 }}
        >
          <option value="">Select a client</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {selectedId && (
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <form
            onSubmit={handleTextSubmit}
            style={{
              background: 'white',
              padding: 16,
              borderRadius: 8,
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            <h3 style={{ marginTop: 0, fontSize: 16 }}>Add Text Entry</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                placeholder="Title (e.g. Return Policy)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                style={inputStyle}
              />
              <textarea
                placeholder="Paste business content, FAQs, policies..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                required
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
              />
              <button
                type="submit"
                disabled={loading}
                style={buttonStyle('#16a34a')}
              >
                {loading ? 'Saving...' : 'Add Text'}
              </button>
            </div>
          </form>

          <form
            onSubmit={handleFileUpload}
            style={{
              background: 'white',
              padding: 16,
              borderRadius: 8,
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            <h3 style={{ marginTop: 0, fontSize: 16 }}>Upload Files</h3>
            <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 8px' }}>
              Supported: .txt, .pdf, .docx
            </p>
            <input
              type="file"
              multiple
              accept=".txt,.pdf,.docx"
              onChange={(e) => setFiles(e.target.files)}
              style={{ marginBottom: 8 }}
            />
            <button
              type="submit"
              disabled={loading || !files || files.length === 0}
              style={buttonStyle('#2563eb')}
            >
              {loading ? 'Uploading...' : 'Upload Files'}
            </button>
          </form>

          <div
            style={{
              background: 'white',
              padding: 16,
              borderRadius: 8,
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            <h3 style={{ marginTop: 0, fontSize: 16 }}>Documents ({documents.length})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {documents.length === 0 && (
                <p style={{ color: '#6b7280', fontSize: 14 }}>
                  No documents yet for this client.
                </p>
              )}
              {documents.map((d) => (
                <div
                  key={d.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 10,
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                  }}
                >
                  <div>
                    <strong style={{ fontSize: 14 }}>{d.title}</strong>
                    <div style={{ color: '#6b7280', fontSize: 12 }}>
                      {d.contentType} • chunk {d.chunkIndex} •{' '}
                      {new Date(d.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(d.id)}
                    style={buttonStyle('#ef4444')}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
