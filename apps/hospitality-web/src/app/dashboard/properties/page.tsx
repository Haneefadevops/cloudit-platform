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
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PropertyModal } from "@/components/property-modal";
import { api } from "@/lib/api";
import type { Property, PaginatedResponse } from "@/lib/types";

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);

  useEffect(() => {
    loadProperties();
  }, []);

  async function loadProperties() {
    try {
      setIsLoading(true);
      const res = await api.get<PaginatedResponse<Property>>("/properties?limit=100");
      setProperties(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  const filteredProperties = properties.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.address?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = async (data: Partial<Property>) => {
    try {
      if (editingProperty) {
        await api.patch(`/properties/${editingProperty.id}`, data);
      } else {
        await api.post("/properties", data);
      }
      setModalOpen(false);
      setEditingProperty(null);
      loadProperties();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (property: Property) => {
    if (!confirm(`Delete property "${property.name}"?`)) return;
    try {
      await api.delete(`/properties/${property.id}`);
      loadProperties();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Properties" description="Manage your hotels and guesthouses">
        <Button onClick={() => { setEditingProperty(null); setModalOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Property
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="p-4">
          <Input
            placeholder="Search properties..."
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
                  <TableHead>Address</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>SLTDA</TableHead>
                  <TableHead>Rooms</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">Loading...</TableCell>
                  </TableRow>
                ) : filteredProperties.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No properties found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProperties.map((property) => (
                    <TableRow key={property.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {property.name}
                        </div>
                      </TableCell>
                      <TableCell>{property.address || "-"}</TableCell>
                      <TableCell>{property.phone || "-"}</TableCell>
                      <TableCell>{property.sltdaNumber || "-"}</TableCell>
                      <TableCell>{property._count?.rooms ?? 0}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { setEditingProperty(property); setModalOpen(true); }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(property)}
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

      <PropertyModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingProperty(null); }}
        property={editingProperty}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
