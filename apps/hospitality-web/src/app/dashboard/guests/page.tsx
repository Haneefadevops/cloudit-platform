"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@cloudit/ui";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { GuestModal } from "@/components/guest-modal";
import { api } from "@/lib/api";
import type { Guest, PaginatedResponse } from "@/lib/types";

export default function GuestsPage() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);

  useEffect(() => {
    loadGuests();
  }, []);

  async function loadGuests() {
    try {
      setIsLoading(true);
      const res = await api.get<PaginatedResponse<Guest>>("/guests?limit=1000");
      setGuests(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  const filteredGuests = guests.filter((g) => {
    const fullName = `${g.firstName} ${g.lastName}`.toLowerCase();
    return (
      fullName.includes(search.toLowerCase()) ||
      g.email?.toLowerCase().includes(search.toLowerCase()) ||
      g.phone?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const handleSubmit = async (data: Partial<Guest>) => {
    try {
      if (editingGuest) {
        await api.patch(`/guests/${editingGuest.id}`, data);
      } else {
        await api.post("/guests", data);
      }
      setModalOpen(false);
      setEditingGuest(null);
      loadGuests();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (guest: Guest) => {
    if (!confirm(`Delete guest ${guest.firstName} ${guest.lastName}?`)) return;
    try {
      await api.delete(`/guests/${guest.id}`);
      loadGuests();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Guests" description="Guest directory and profiles">
        <Button onClick={() => { setEditingGuest(null); setModalOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Guest
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="p-4">
          <Input
            placeholder="Search guests..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Nationality</TableHead>
                  <TableHead>ID Number</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">Loading...</TableCell>
                  </TableRow>
                ) : filteredGuests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No guests found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredGuests.map((guest) => (
                    <TableRow key={guest.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          {guest.firstName} {guest.lastName}
                        </div>
                      </TableCell>
                      <TableCell>{guest.email || "-"}</TableCell>
                      <TableCell>{guest.phone || "-"}</TableCell>
                      <TableCell>{guest.nationality || "-"}</TableCell>
                      <TableCell>{guest.idNumber || "-"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { setEditingGuest(guest); setModalOpen(true); }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(guest)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <GuestModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingGuest(null); }}
        guest={editingGuest}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
