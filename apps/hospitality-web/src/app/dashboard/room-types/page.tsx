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
  Badge,
} from "@cloudit/ui";
import { Plus, Pencil, Trash2, BedDouble } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { RoomTypeModal } from "@/components/room-type-modal";
import { api } from "@/lib/api";
import { formatLkr } from "@/lib/format";
import type { Property, RoomType, PaginatedResponse } from "@/lib/types";

export default function RoomTypesPage() {
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRoomType, setEditingRoomType] = useState<RoomType | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setIsLoading(true);
      const [rtRes, pRes] = await Promise.all([
        api.get<PaginatedResponse<RoomType>>("/room-types?limit=100"),
        api.get<PaginatedResponse<Property>>("/properties?limit=100"),
      ]);
      setRoomTypes(rtRes.data);
      setProperties(pRes.data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  const filteredRoomTypes = roomTypes.filter((rt) =>
    rt.name.toLowerCase().includes(search.toLowerCase())
  );

  const getPropertyName = (id: string) =>
    properties.find((p) => p.id === id)?.name || "-";

  const handleSubmit = async (data: Partial<RoomType>) => {
    try {
      if (editingRoomType) {
        await api.patch(`/room-types/${editingRoomType.id}`, data);
      } else {
        await api.post("/room-types", data);
      }
      setModalOpen(false);
      setEditingRoomType(null);
      loadData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (roomType: RoomType) => {
    if (!confirm(`Delete room type "${roomType.name}"?`)) return;
    try {
      await api.delete(`/room-types/${roomType.id}`);
      loadData();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Room Types" description="Manage room categories and pricing">
        <Button onClick={() => { setEditingRoomType(null); setModalOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Room Type
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="p-4">
          <Input
            placeholder="Search room types..."
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
                  <TableHead>Property</TableHead>
                  <TableHead>Base Price</TableHead>
                  <TableHead>Max Occupancy</TableHead>
                  <TableHead>Rooms</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">Loading...</TableCell>
                  </TableRow>
                ) : filteredRoomTypes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No room types found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRoomTypes.map((rt) => (
                    <TableRow key={rt.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <BedDouble className="h-4 w-4 text-muted-foreground" />
                          {rt.name}
                        </div>
                      </TableCell>
                      <TableCell>{getPropertyName(rt.propertyId)}</TableCell>
                      <TableCell>{formatLkr(rt.basePrice)}</TableCell>
                      <TableCell>{rt.maxOccupancy}</TableCell>
                      <TableCell>{rt._count?.rooms ?? 0}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { setEditingRoomType(rt); setModalOpen(true); }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(rt)}
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

      <RoomTypeModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingRoomType(null); }}
        roomType={editingRoomType}
        properties={properties.map((p) => ({ id: p.id, name: p.name }))}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
