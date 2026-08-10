'use client';

import { useEffect, useState } from 'react';
import { Badge, Button, Card, EmptyState, Select, Textarea, useToast } from '@/components/ui';
import { isPortalUser } from '../portal';
import { apiFetch } from '@/lib/api';

interface Client { id: string; name: string }
interface SocialComment {
  id: string;
  channel: 'facebook' | 'instagram';
  authorName?: string | null;
  text: string;
  status: 'pending' | 'replied' | 'dismissed' | 'hidden';
  aiDraft?: string | null;
  replyText?: string | null;
  createdAt: string;
}

const filterOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'replied', label: 'Replied' },
  { value: 'dismissed', label: 'Dismissed' },
  { value: 'hidden', label: 'Hidden' },
  { value: '', label: 'All' },
];

export default function SocialCommentsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [status, setStatus] = useState('pending');
  const [comments, setComments] = useState<SocialComment[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const toast = useToast();
  const token = (typeof window !== 'undefined' && localStorage.getItem('token')) || '';
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const fetchClients = async () => {
    const res = await apiFetch('/api/clients', { headers });
    const list = await res.json();
    const arr = Array.isArray(list) ? list : [];
    setClients(arr);
    if (!selectedId && arr.length > 0) setSelectedId(arr[0].id);
  };

  const fetchComments = async (clientId: string, commentStatus = status) => {
    if (!clientId) return;
    const query = commentStatus ? `?status=${encodeURIComponent(commentStatus)}` : '';
    const res = await apiFetch(`/api/social-comments/${clientId}${query}`, { headers });
    const list = await res.json();
    const rows = Array.isArray(list) ? list : [];
    setComments(rows);
    setDrafts(Object.fromEntries(rows.map((comment: SocialComment) => [comment.id, comment.aiDraft || ''])));
  };

  useEffect(() => {
    if (!token) { window.location.href = '/login'; return; }
    if (isPortalUser()) { window.location.href = '/dashboard/bookings'; return; }
    fetchClients();
  }, []);

  useEffect(() => {
    setStatus('pending');
    fetchComments(selectedId, 'pending');
  }, [selectedId]);

  useEffect(() => { fetchComments(selectedId, status); }, [status]);

  const sendReply = async (comment: SocialComment) => {
    const text = (drafts[comment.id] || '').trim();
    if (!text) return;
    const res = await apiFetch(`/api/social-comments/${selectedId}/${comment.id}/reply`, {
      method: 'POST', headers, body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (!res.ok) { toast(data.message || 'Failed to send reply', 'error'); return; }
    toast('Public reply sent', 'success');
    fetchComments(selectedId);
  };

  const moderate = async (comment: SocialComment, action: 'dismiss' | 'hide') => {
    const label = action === 'hide' ? 'hide' : 'dismiss';
    if (!confirm(`${label[0].toUpperCase()}${label.slice(1)} this comment?`)) return;
    const res = await apiFetch(`/api/social-comments/${selectedId}/${comment.id}/${action}`, {
      method: 'POST', headers,
    });
    const data = await res.json();
    if (!res.ok) { toast(data.message || `Failed to ${label} comment`, 'error'); return; }
    toast(action === 'hide' ? 'Comment hidden' : 'Comment dismissed', 'success');
    fetchComments(selectedId);
  };

  return <div className="flex flex-col gap-4">
    <Card className="max-w-sm">
      <Select label="Client" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
        <option value="">Select a client</option>
        {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
      </Select>
    </Card>

    {selectedId && <>
      <Card title="Comment moderation">
        <div className="max-w-xs">
          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {filterOptions.map((option) => <option key={option.label} value={option.value}>{option.label}</option>)}
          </Select>
        </div>
      </Card>

      {comments.length === 0 ? <Card><EmptyState title="No comments" hint="Comments matching this filter will appear here." /></Card> :
        comments.map((comment) => <Card key={comment.id}>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={comment.channel === 'facebook' ? 'blue' : 'indigo'}>{comment.channel === 'facebook' ? 'Facebook' : 'Instagram'}</Badge>
              <span className="text-sm font-medium">{comment.authorName || 'Unknown author'}</span>
              <Badge tone={comment.status === 'pending' ? 'amber' : comment.status === 'replied' ? 'teal' : 'gray'}>{comment.status}</Badge>
              <span className="text-xs text-muted">{new Date(comment.createdAt).toLocaleString()}</span>
            </div>
            <p className="m-0 whitespace-pre-wrap text-sm text-brand-navy">{comment.text}</p>

            {comment.status === 'pending' ? <>
              <Textarea
                value={drafts[comment.id] || ''}
                placeholder="Write a public reply…"
                rows={3}
                className="resize-y"
                onChange={(e) => setDrafts({ ...drafts, [comment.id]: e.target.value })}
              />
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => sendReply(comment)} disabled={!(drafts[comment.id] || '').trim()}>Send reply</Button>
                <Button variant="outline" onClick={() => moderate(comment, 'dismiss')}>Dismiss</Button>
                {comment.channel === 'facebook' && <Button variant="danger" onClick={() => moderate(comment, 'hide')}>Hide</Button>}
              </div>
            </> : comment.status === 'replied' && comment.replyText ?
              <div className="rounded-lg bg-page px-3 py-2 text-sm"><span className="font-medium">Reply: </span>{comment.replyText}</div> : null}
          </div>
        </Card>)}
    </>}
  </div>;
}
