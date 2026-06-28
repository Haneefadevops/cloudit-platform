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
import { RoomModal } from "@/components/room-modal";
import { api } from "@/lib/api";
import type { Property, Room, RoomType, PaginatedResponse } from "@/lib/types";

const statusColors: Record<string, string> = {
  available: "bg-green-500",
  occupied: "bg-red-500",
  maintenance: "bg-yellow-500",
  cleaning: "bg-blue-500",
};

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setIsLoading(true);
      const [rRes, pRes, rtRes] = await Promise.all([
        api.get<PaginatedResponse<Room>>("/rooms?limit=1000"),
        api.get<PaginatedResponse<Property>>("/properties?limit=100"),
        api.get<PaginatedResponse<RoomType>>("/room-types?limit=100"),
      ]);
      setRooms(rRes.data);
      setProperties(pRes.data);
      setRoomTypes(rtRes.data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  const filteredRooms = rooms.filter((room) => {
    const matchesSearch =
      room.roomNumber.toLowerCase().includes(search.toLowerCase()) ||
      room.roomType?.name.toLowerCase().includes(search.toLowerCase());
    const matchesProperty = propertyFilter
      ? room.propertyId === propertyFilter
      : true;
    return matchesSearch && matchesProperty;
  });

  const getPropertyName = (id: string) =>
    properties.find((p) => p.id === id)?.name || "-";
  const getRoomTypeName = (id: string) =>
    roomTypes.find((rt) => rt.id === id)?.name || "-";

  const handleSubmit = async (data: Partial<Room>) => {
    try {
      if (editingRoom) {
        await api.patch(`/rooms/${editingRoom.id}`, data);
      } else {
        await api.post("/rooms", data);
      }
      setModalOpen(false);
      setEditingRoom(null);
      loadData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (room: Room) => {
    if (!confirm(`Delete room ${room.roomNumber}?`)) return;
    try {
      await api.delete(`/rooms/${room.id}`);
      loadData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleStatusChange = async (room: Room, status: string) => {
    try {
      await api.patch(`/rooms/${room.id}`, { status });
      loadData();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Rooms" description="Manage rooms and availability">
        <Button onClick={() => { setEditingRoom(null); setModalOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Room
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            <Input
              placeholder="Search rooms..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <select
              className="flex h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={propertyFilter}
              onChange={(e) => setPropertyFilter(e.target.value)}
            >
              <option value="">All Properties</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Room #</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Floor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">Loading...</TableCell>
                  </TableRow>
                ) : filteredRooms.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No rooms found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRooms.map((room) => (
                    <TableRow key={room.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <BedDouble className="h-4 w-4 text-muted-foreground" />
                          {room.roomNumber}
                        </div>
                      </TableCell>
                      <TableCell>{getRoomTypeName(room.roomTypeId)}</TableCell>
                      <TableCell>{getPropertyName(room.propertyId)}</TableCell>
                      <TableCell>{room.floor || "-"}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[room.status]}>
                          {room.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <select
                            className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                            value={room.status}
                            onChange={(e) => handleStatusChange(room, e.target.value)}
                          >
                            <option value="available">Available</option>
                            <option value="occupied">Occupied</option>
                            <option value="maintenance">Maintenance</option>
                            <option value="cleaning">Cleaning</option>
                          </select>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { setEditingRoom(room); setModalOpen(true); }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(room)}
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

      <RoomModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingRoom(null); }}
        room={editingRoom}
        properties={properties.map((p) => ({ id: p.id, name: p.name }))}
        roomTypes={roomTypes.map((rt) => ({ id: rt.id, name: rt.name }))}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
