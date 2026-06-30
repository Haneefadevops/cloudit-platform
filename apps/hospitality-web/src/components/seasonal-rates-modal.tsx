"use client";

import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Input,
  Modal,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@cloudit/ui";
import { api } from "@/lib/api";
import { formatDate, formatLkr } from "@/lib/format";
import type { RoomType, SeasonalRate } from "@/lib/types";

interface SeasonalRatesModalProps {
  open: boolean;
  onClose: () => void;
  roomType: RoomType | null;
  onChange: () => void;
}

function toDateInputValue(iso?: string) {
  if (!iso) return "";
  return iso.split("T")[0];
}

export function SeasonalRatesModal({
  open,
  onClose,
  roomType,
  onChange,
}: SeasonalRatesModalProps) {
  const [rates, setRates] = useState<SeasonalRate[]>([]);
  const [formData, setFormData] = useState<Partial<SeasonalRate>>({
    name: "",
    price: 0,
    minimumStay: 1,
    isActive: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && roomType) {
      loadRates();
      setFormData({
        name: "",
        startDate: "",
        endDate: "",
        price: roomType.basePrice,
        minimumStay: 1,
        isActive: true,
      });
      setError("");
    }
  }, [open, roomType]);

  async function loadRates() {
    if (!roomType) return;
    try {
      setIsLoading(true);
      const data = await api.get<SeasonalRate[]>(`/room-types/${roomType.id}/seasonal-rates`);
      setRates(data);
    } catch (loadError) {
      console.error(loadError);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreate() {
    if (!roomType) return;
    if (!formData.name?.trim() || !formData.startDate || !formData.endDate) {
      setError("Name, start date, and end date are required");
      return;
    }
    if ((formData.price ?? 0) < 0) {
      setError("Price cannot be negative");
      return;
    }

    try {
      setError("");
      await api.post(`/room-types/${roomType.id}/seasonal-rates`, {
        name: formData.name,
        startDate: formData.startDate,
        endDate: formData.endDate,
        price: Number(formData.price ?? 0),
        minimumStay: Number(formData.minimumStay ?? 1),
        isActive: formData.isActive ?? true,
      });
      setFormData({
        name: "",
        startDate: "",
        endDate: "",
        price: roomType.basePrice,
        minimumStay: 1,
        isActive: true,
      });
      await loadRates();
      onChange();
    } catch (createError: any) {
      setError(createError?.message || "Unable to create seasonal rate");
    }
  }

  async function handleToggle(rate: SeasonalRate) {
    if (!roomType) return;
    try {
      await api.patch(`/room-types/${roomType.id}/seasonal-rates/${rate.id}`, {
        isActive: !rate.isActive,
      });
      await loadRates();
      onChange();
    } catch (toggleError) {
      console.error(toggleError);
    }
  }

  async function handleDelete(rate: SeasonalRate) {
    if (!roomType || !confirm(`Delete seasonal rate "${rate.name}"?`)) return;
    try {
      await api.delete(`/room-types/${roomType.id}/seasonal-rates/${rate.id}`);
      await loadRates();
      onChange();
    } catch (deleteError) {
      console.error(deleteError);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={roomType ? `Seasonal Rates - ${roomType.name}` : "Seasonal Rates"}
      className="max-w-3xl"
      footer={<Button variant="outline" onClick={onClose}>Close</Button>}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 rounded-md border p-3 md:grid-cols-6">
          <Input
            placeholder="Name"
            value={formData.name || ""}
            onChange={(event) => setFormData({ ...formData, name: event.target.value })}
            className="md:col-span-2"
          />
          <Input
            type="date"
            value={toDateInputValue(formData.startDate)}
            onChange={(event) => setFormData({ ...formData, startDate: event.target.value })}
          />
          <Input
            type="date"
            value={toDateInputValue(formData.endDate)}
            onChange={(event) => setFormData({ ...formData, endDate: event.target.value })}
          />
          <Input
            type="number"
            min={0}
            step="0.01"
            value={formData.price ?? 0}
            onChange={(event) => setFormData({ ...formData, price: Number(event.target.value) })}
          />
          <div className="flex gap-2">
            <Input
              type="number"
              min={1}
              value={formData.minimumStay ?? 1}
              onChange={(event) =>
                setFormData({ ...formData, minimumStay: Number(event.target.value) })
              }
            />
            <Button onClick={handleCreate}>Add</Button>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Min Stay</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">Loading...</TableCell>
                </TableRow>
              ) : rates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No seasonal rates yet
                  </TableCell>
                </TableRow>
              ) : (
                rates.map((rate) => (
                  <TableRow key={rate.id}>
                    <TableCell className="font-medium">{rate.name}</TableCell>
                    <TableCell>
                      {formatDate(rate.startDate)} - {formatDate(rate.endDate)}
                    </TableCell>
                    <TableCell>{formatLkr(rate.price)}</TableCell>
                    <TableCell>{rate.minimumStay} night(s)</TableCell>
                    <TableCell>
                      <Badge variant={rate.isActive ? "default" : "outline"}>
                        {rate.isActive ? "active" : "inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleToggle(rate)}>
                          {rate.isActive ? "Disable" : "Enable"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => handleDelete(rate)}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </Modal>
  );
}
