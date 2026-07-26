'use client';

import { useEffect, useState } from 'react';
import { isPortalUser } from '../portal';
import { apiFetch } from '@/lib/api';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Select,
  Table,
  TD,
  TH,
  THead,
  TR,
  Textarea,
  statusTone,
  useToast,
} from '@/components/ui';

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

export default function KnowledgeBasePage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [crawlUrl, setCrawlUrl] = useState('');
  const [files, setFiles] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const token =
    (typeof window !== 'undefined' && localStorage.getItem('token')) || '';

  const fetchClients = async () => {
    if (!token) return;
    const res = await apiFetch('/api/clients', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setClients(Array.isArray(data) ? data : []);
  };

  const fetchDocuments = async (clientId: string) => {
    if (!clientId) return;
    const res = await apiFetch(`/api/knowledge-base/${clientId}`, {
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
    if (isPortalUser()) {
      window.location.href = '/dashboard/bookings';
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
      const res = await apiFetch(`/api/knowledge-base/${selectedId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title, content, contentType: 'text' }),
      });
      if (res.ok) {
        toast('Document added', 'success');
        setTitle('');
        setContent('');
        await fetchDocuments(selectedId);
      } else {
        toast('Failed to add document', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCrawl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !crawlUrl.trim()) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/knowledge-base/${selectedId}/crawl`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: crawlUrl.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        toast(
          `Crawled ${data.characters?.toLocaleString() || 0} characters into ${data.chunks || 0} chunks`,
          'success',
        );
        setCrawlUrl('');
        await fetchDocuments(selectedId);
      } else {
        toast(data.error || data.message || 'Failed to crawl website', 'error');
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
      const res = await apiFetch(`/api/knowledge-base/${selectedId}/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        toast('Files uploaded', 'success');
        setFiles(null);
        await fetchDocuments(selectedId);
      } else {
        toast('Failed to upload files', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    const res = await apiFetch(
      `/api/knowledge-base/${selectedId}/${documentId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (res.ok) {
      toast('Document deleted', 'success');
      await fetchDocuments(selectedId);
    } else {
      toast('Failed to delete document', 'error');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-sm text-muted">
        Upload text or files per client. The AI uses this content to answer
        WhatsApp messages.
      </p>

      <Card title="Client">
        <Select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          <option value="">Select a client</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Card>

      {selectedId && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card title="Add Text Entry">
              <form
                onSubmit={handleTextSubmit}
                className="flex flex-col gap-3"
              >
                <Input
                  placeholder="Title (e.g. Return Policy)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
                <Textarea
                  placeholder="Paste business content, FAQs, policies..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={6}
                  required
                  className="resize-y"
                />
                <Button type="submit" disabled={loading}>
                  {loading ? 'Saving...' : 'Add Text'}
                </Button>
              </form>
            </Card>

            <Card title="Upload Files">
              <form
                onSubmit={handleFileUpload}
                className="flex flex-col gap-3"
              >
                <p className="m-0 text-xs text-muted">
                  Supported: .txt, .pdf, .docx
                </p>
                <input
                  type="file"
                  multiple
                  accept=".txt,.pdf,.docx"
                  onChange={(e) => setFiles(e.target.files)}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-brand-navy file:mr-3 file:rounded-md file:border-0 file:bg-page file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-brand-navy"
                />
                <Button
                  type="submit"
                  variant="outline"
                  disabled={loading || !files || files.length === 0}
                >
                  {loading ? 'Uploading...' : 'Upload Files'}
                </Button>
              </form>
            </Card>

            <Card title="Crawl Website">
              <form
                onSubmit={handleCrawl}
                className="flex flex-col gap-3"
              >
                <p className="m-0 text-xs text-muted">
                  Extract content from a public website URL.
                </p>
                <Input
                  type="url"
                  placeholder="https://example.com/faq"
                  value={crawlUrl}
                  onChange={(e) => setCrawlUrl(e.target.value)}
                  required
                />
                <Button
                  type="submit"
                  variant="outline"
                  disabled={loading || !crawlUrl.trim()}
                >
                  {loading ? 'Crawling...' : 'Crawl'}
                </Button>
              </form>
            </Card>
          </div>

          <Card title={`Documents (${documents.length})`}>
            {documents.length === 0 ? (
              <EmptyState
                title="No documents yet"
                hint="No documents yet for this client."
              />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Title</TH>
                    <TH>Type</TH>
                    <TH>Chunk</TH>
                    <TH>Added</TH>
                    <TH />
                  </TR>
                </THead>
                <tbody>
                  {documents.map((d) => (
                    <TR key={d.id}>
                      <TD className="font-medium">{d.title}</TD>
                      <TD>
                        <Badge tone={statusTone(d.contentType)}>
                          {d.contentType}
                        </Badge>
                      </TD>
                      <TD>{d.chunkIndex}</TD>
                      <TD>{new Date(d.createdAt).toLocaleDateString()}</TD>
                      <TD className="text-right">
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDelete(d.id)}
                        >
                          Delete
                        </Button>
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
