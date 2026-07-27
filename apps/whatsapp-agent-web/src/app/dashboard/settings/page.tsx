'use client';

import { useEffect, useState } from 'react';
import { getStoredUser, isPortalUser, StoredUser } from '../portal';
import { apiFetch } from '@/lib/api';
import {
  Button,
  Card,
  Input,
  PageLoading,
  Select,
  StatusBadge,
  Table,
  TD,
  TH,
  THead,
  TR,
  useToast,
} from '@/components/ui';

interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

interface AlertContact {
  id: string;
  name: string;
  phone: string;
  active: boolean;
  mode: 'always' | 'scheduled';
  daysOfWeek: string[];
  startTime: string | null;
  endTime: string | null;
}

const DAY_OPTIONS = [
  { code: 'mon', label: 'Mon' },
  { code: 'tue', label: 'Tue' },
  { code: 'wed', label: 'Wed' },
  { code: 'thu', label: 'Thu' },
  { code: 'fri', label: 'Fri' },
  { code: 'sat', label: 'Sat' },
  { code: 'sun', label: 'Sun' },
];

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const values = new Uint32Array(12);
  crypto.getRandomValues(values);
  return Array.from(values, (n) => chars[n % chars.length]).join('');
}

export default function SettingsPage() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const toast = useToast();

  // ---- My account (change password) ----
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changing, setChanging] = useState(false);

  // ---- Team accounts (staff admins/supervisors only) ----
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'supervisor'>('supervisor');
  const [tempPassword, setTempPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{
    email: string;
    password: string;
  } | null>(null);

  // ---- Alert notifications (staff admins/supervisors only) ----
  const [contacts, setContacts] = useState<AlertContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactMode, setContactMode] = useState<'always' | 'scheduled'>('scheduled');
  const [contactDays, setContactDays] = useState<string[]>([]);
  const [contactStart, setContactStart] = useState('09:00');
  const [contactEnd, setContactEnd] = useState('18:00');
  const [savingContact, setSavingContact] = useState(false);

  const portal = isPortalUser(user);
  const canManageTeam =
    !portal && (user?.role === 'admin' || user?.role === 'supervisor');

  const fetchStaff = async () => {
    setStaffLoading(true);
    try {
      const res = await apiFetch('/api/users/staff');
      const list = await res.json();
      setStaff(Array.isArray(list) ? list : []);
    } finally {
      setStaffLoading(false);
    }
  };

  const fetchContacts = async () => {
    setContactsLoading(true);
    try {
      const res = await apiFetch('/api/staff-alert-contacts');
      const list = await res.json();
      setContacts(Array.isArray(list) ? list : []);
    } finally {
      setContactsLoading(false);
    }
  };

  useEffect(() => {
    const token =
      (typeof window !== 'undefined' && localStorage.getItem('token')) || '';
    if (!token) {
      window.location.href = '/login';
      return;
    }
    const stored = getStoredUser();
    setUser(stored);
    if (
      stored &&
      !isPortalUser(stored) &&
      (stored.role === 'admin' || stored.role === 'supervisor')
    ) {
      fetchStaff();
      fetchContacts();
    }
    setTempPassword(generatePassword());
  }, []);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast('New passwords do not match', 'error');
      return;
    }
    if (newPassword.length < 8) {
      toast('New password must be at least 8 characters', 'error');
      return;
    }
    setChanging(true);
    try {
      const res = await apiFetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.ok) {
        toast('Password changed', 'success');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const data = await res.json().catch(() => null);
        toast(data?.message || 'Failed to change password', 'error');
      }
    } finally {
      setChanging(false);
    }
  };

  const createStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreatedCredentials(null);
    try {
      const res = await apiFetch('/api/users/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          email: newEmail,
          password: tempPassword,
          role: newRole,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        // Show the credentials once so they can be shared with the new hire
        setCreatedCredentials({ email: newEmail.trim(), password: tempPassword });
        setNewName('');
        setNewEmail('');
        setNewRole('supervisor');
        setTempPassword(generatePassword());
        toast('Staff account created', 'success');
        fetchStaff();
      } else {
        toast(data?.message || 'Failed to create account', 'error');
      }
    } finally {
      setCreating(false);
    }
  };

  const toggleStatus = async (member: StaffUser) => {
    const next = member.status === 'disabled' ? 'active' : 'disabled';
    if (
      next === 'disabled' &&
      !confirm(`Deactivate ${member.name}? They will no longer be able to log in.`)
    )
      return;
    const res = await apiFetch(`/api/users/staff/${member.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      toast(
        next === 'disabled' ? 'Account deactivated' : 'Account reactivated',
        'success',
      );
      fetchStaff();
    } else {
      toast(data?.message || 'Failed to update account', 'error');
    }
  };

  const resetContactForm = () => {
    setEditingContactId(null);
    setContactName('');
    setContactPhone('');
    setContactMode('scheduled');
    setContactDays([]);
    setContactStart('09:00');
    setContactEnd('18:00');
  };

  const editContact = (contact: AlertContact) => {
    setEditingContactId(contact.id);
    setContactName(contact.name);
    setContactPhone(contact.phone);
    setContactMode(contact.mode);
    setContactDays(Array.isArray(contact.daysOfWeek) ? contact.daysOfWeek : []);
    setContactStart(contact.startTime || '09:00');
    setContactEnd(contact.endTime || '18:00');
  };

  const toggleDay = (code: string) => {
    setContactDays((days) =>
      days.includes(code) ? days.filter((d) => d !== code) : [...days, code],
    );
  };

  const saveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (contactMode === 'scheduled' && contactDays.length === 0) {
      toast('Pick at least one day for a scheduled contact', 'error');
      return;
    }
    setSavingContact(true);
    try {
      const payload = {
        name: contactName,
        phone: contactPhone,
        mode: contactMode,
        daysOfWeek: contactMode === 'scheduled' ? contactDays : [],
        startTime: contactMode === 'scheduled' ? contactStart : null,
        endTime: contactMode === 'scheduled' ? contactEnd : null,
      };
      const res = await apiFetch(
        editingContactId
          ? `/api/staff-alert-contacts/${editingContactId}`
          : '/api/staff-alert-contacts',
        {
          method: editingContactId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json().catch(() => null);
      if (res.ok) {
        toast(editingContactId ? 'Contact updated' : 'Contact added', 'success');
        resetContactForm();
        fetchContacts();
      } else {
        toast(data?.message || 'Failed to save contact', 'error');
      }
    } finally {
      setSavingContact(false);
    }
  };

  const toggleContactActive = async (contact: AlertContact) => {
    const res = await apiFetch(`/api/staff-alert-contacts/${contact.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !contact.active }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      fetchContacts();
    } else {
      toast(data?.message || 'Failed to update contact', 'error');
    }
  };

  const deleteContact = async (contact: AlertContact) => {
    if (!confirm(`Delete ${contact.name} (${contact.phone}) from alert routing?`))
      return;
    const res = await apiFetch(`/api/staff-alert-contacts/${contact.id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      toast('Contact deleted', 'success');
      if (editingContactId === contact.id) resetContactForm();
      fetchContacts();
    } else {
      toast('Failed to delete contact', 'error');
    }
  };

  const scheduleSummary = (contact: AlertContact) => {
    if (contact.mode === 'always') return '—';
    const days = DAY_OPTIONS.filter((d) =>
      (contact.daysOfWeek || []).includes(d.code),
    )
      .map((d) => d.label)
      .join(', ');
    return `${days || '—'} · ${contact.startTime}–${contact.endTime}`;
  };

  if (!user) return <PageLoading />;

  return (
    <div className="flex flex-col gap-6">
      {/* My account — all users (staff and portal) */}
      <Card>
        <h2 className="mb-1 mt-0 text-base font-semibold">My account</h2>
        <p className="mb-4 mt-0 text-sm text-muted">
          Signed in as {user.name} ({user.email})
        </p>
        <form onSubmit={changePassword} className="flex max-w-sm flex-col gap-3">
          <Input
            label="Current password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <Input
            label="New password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
          <Input
            label="Confirm new password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
          {confirmPassword && newPassword !== confirmPassword && (
            <p className="m-0 text-xs text-red-600">
              New passwords do not match
            </p>
          )}
          <div>
            <Button type="submit" disabled={changing}>
              {changing ? 'Changing…' : 'Change password'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Team accounts — staff admins/supervisors only */}
      {canManageTeam && (
        <Card>
          <h2 className="mb-4 mt-0 text-base font-semibold">Team accounts</h2>

          <form
            onSubmit={createStaff}
            className="mb-6 grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-5"
          >
            <Input
              label="Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
            />
            <Input
              label="Email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
            />
            <Select
              label="Role"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as 'admin' | 'supervisor')}
            >
              <option value="supervisor">Supervisor</option>
              <option value="admin">Admin</option>
            </Select>
            <div className="flex items-end gap-1.5">
              <Input
                label="Temporary password"
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                required
                minLength={8}
                className="font-mono"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setTempPassword(generatePassword())}
                title="Generate a new random password"
              >
                ↻
              </Button>
            </div>
            <Button type="submit" disabled={creating}>
              {creating ? 'Creating…' : 'Create account'}
            </Button>
          </form>

          {createdCredentials && (
            <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
              <strong>Account created.</strong> Share these credentials now —
              the password is only shown here:{' '}
              <span className="font-mono">
                {createdCredentials.email} / {createdCredentials.password}
              </span>
            </div>
          )}

          {staffLoading ? (
            <PageLoading />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Email</TH>
                  <TH>Role</TH>
                  <TH>Status</TH>
                  <TH>Created</TH>
                  <TH />
                </TR>
              </THead>
              <tbody>
                {staff.map((member) => (
                  <TR key={member.id}>
                    <TD>{member.name}</TD>
                    <TD>{member.email}</TD>
                    <TD className="capitalize">{member.role}</TD>
                    <TD>
                      <StatusBadge
                        status={member.status === 'disabled' ? 'disabled' : 'active'}
                      />
                    </TD>
                    <TD>{new Date(member.createdAt).toLocaleDateString()}</TD>
                    <TD className="text-right">
                      <Button
                        size="sm"
                        variant={member.status === 'disabled' ? 'outline' : 'danger'}
                        onClick={() => toggleStatus(member)}
                        disabled={member.id === user.id}
                        title={
                          member.id === user.id
                            ? 'You cannot deactivate your own account'
                            : undefined
                        }
                      >
                        {member.status === 'disabled' ? 'Reactivate' : 'Deactivate'}
                      </Button>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {/* Alert notifications — staff admins/supervisors only */}
      {canManageTeam && (
        <Card>
          <h2 className="mb-1 mt-0 text-base font-semibold">
            Alert notifications
          </h2>
          <p className="mb-4 mt-0 text-sm text-muted">
            Who receives staff WhatsApp alerts (top-up requests, slips).
            Always = receives every alert (director). Scheduled = on-duty
            rotation, one person per alert.
          </p>

          <form onSubmit={saveContact} className="mb-6 flex flex-col gap-3">
            <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Input
                label="Name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                required
              />
              <Input
                label="Phone (WhatsApp)"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="9477XXXXXXX"
                required
              />
              <Select
                label="Mode"
                value={contactMode}
                onChange={(e) =>
                  setContactMode(e.target.value as 'always' | 'scheduled')
                }
              >
                <option value="scheduled">Scheduled (on-duty rotation)</option>
                <option value="always">Always (every alert)</option>
              </Select>
              <div className="flex gap-2">
                <Button type="submit" disabled={savingContact}>
                  {savingContact
                    ? 'Saving…'
                    : editingContactId
                      ? 'Save changes'
                      : 'Add contact'}
                </Button>
                {editingContactId && (
                  <Button type="button" variant="outline" onClick={resetContactForm}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
            {contactMode === 'scheduled' && (
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <span className="mb-1 block text-sm font-medium">Days</span>
                  <div className="flex flex-wrap gap-2">
                    {DAY_OPTIONS.map((day) => (
                      <label
                        key={day.code}
                        className="flex items-center gap-1.5 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={contactDays.includes(day.code)}
                          onChange={() => toggleDay(day.code)}
                        />
                        {day.label}
                      </label>
                    ))}
                  </div>
                </div>
                <Input
                  label="From"
                  type="time"
                  value={contactStart}
                  onChange={(e) => setContactStart(e.target.value)}
                  required
                />
                <Input
                  label="To"
                  type="time"
                  value={contactEnd}
                  onChange={(e) => setContactEnd(e.target.value)}
                  required
                />
              </div>
            )}
          </form>

          {contactsLoading ? (
            <PageLoading />
          ) : contacts.length === 0 ? (
            <p className="m-0 text-sm text-muted">
              No contacts yet — alerts fall back to the STAFF_ALERT_WHATSAPP
              environment number until you add one.
            </p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Phone</TH>
                  <TH>Mode</TH>
                  <TH>Schedule</TH>
                  <TH>Status</TH>
                  <TH />
                </TR>
              </THead>
              <tbody>
                {contacts.map((contact) => (
                  <TR key={contact.id}>
                    <TD>{contact.name}</TD>
                    <TD className="font-mono">{contact.phone}</TD>
                    <TD>
                      <StatusBadge
                        status={contact.mode === 'always' ? 'always' : 'scheduled'}
                      />
                    </TD>
                    <TD>{scheduleSummary(contact)}</TD>
                    <TD>
                      <StatusBadge status={contact.active ? 'active' : 'inactive'} />
                    </TD>
                    <TD className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => editContact(contact)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleContactActive(contact)}
                        >
                          {contact.active ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => deleteContact(contact)}
                        >
                          Delete
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}
    </div>
  );
}
