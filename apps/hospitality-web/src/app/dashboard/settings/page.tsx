"use client";

import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@cloudit/ui";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/api";
import type { TaxRate, TaxRateType } from "@/lib/types";

const typeOptions = [
  { value: "percentage", label: "Percentage" },
  { value: "fixed", label: "Fixed Amount" },
];

export default function SettingsPage() {
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    rate: 0,
    type: "percentage" as TaxRateType,
    isActive: true,
  });

  useEffect(() => {
    loadTaxes();
  }, []);

  async function loadTaxes() {
    try {
      setIsLoading(true);
      const data = await api.get<TaxRate[]>("/taxes");
      setTaxRates(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  async function applyPresets() {
    try {
      const data = await api.post<TaxRate[]>("/taxes/presets/sri-lanka", {});
      setTaxRates(data);
    } catch (error) {
      console.error(error);
    }
  }

  async function createTaxRate() {
    if (!formData.name.trim()) return;
    try {
      await api.post("/taxes", formData);
      setFormData({ name: "", rate: 0, type: "percentage", isActive: true });
      loadTaxes();
    } catch (error) {
      console.error(error);
    }
  }

  async function updateTaxRate(id: string, data: Partial<TaxRate>) {
    try {
      await api.patch(`/taxes/${id}`, data);
      loadTaxes();
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Taxes, currency, and property defaults">
        <Button onClick={applyPresets}>Apply Sri Lanka Presets</Button>
      </PageHeader>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_140px_160px_110px]">
            <Input
              placeholder="Tax name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <Input
              type="number"
              min={0}
              step="0.0001"
              value={formData.rate}
              onChange={(e) => setFormData({ ...formData, rate: Number(e.target.value) })}
            />
            <Select
              options={typeOptions}
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as TaxRateType })}
            />
            <Button onClick={createTaxRate}>Add Tax</Button>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">Loading...</TableCell>
                  </TableRow>
                ) : taxRates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No tax rates configured
                    </TableCell>
                  </TableRow>
                ) : (
                  taxRates.map((tax) => (
                    <TableRow key={tax.id}>
                      <TableCell className="font-medium">
                        {tax.name}
                        {tax.isDefault && <Badge className="ml-2" variant="secondary">Preset</Badge>}
                      </TableCell>
                      <TableCell>
                        {tax.type === "percentage" ? `${Number(tax.rate)}%` : `Rs. ${Number(tax.rate)}`}
                      </TableCell>
                      <TableCell>{tax.type}</TableCell>
                      <TableCell>
                        <Badge variant={tax.isActive ? "default" : "outline"}>
                          {tax.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateTaxRate(tax.id, { isActive: !tax.isActive })}
                        >
                          {tax.isActive ? "Disable" : "Enable"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
