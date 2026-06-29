"use client";

import * as React from "react";
import { api, handleApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface Organization {
  id: string;
  name: string;
}

interface ProductModule {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
}

interface Product {
  key: string;
  label: string;
  description: string;
  modules: ProductModule[];
}

export default function ModulesAdminPage() {
  const [organizations, setOrganizations] = React.useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = React.useState<string>("");
  const [products, setProducts] = React.useState<Product[]>([]);
  const [registry, setRegistry] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    async function load() {
      try {
        const [orgs, reg] = await Promise.all([
          api.get<Organization[]>("/organizations"),
          api.get<Product[]>("/modules/registry"),
        ]);
        setOrganizations(orgs);
        setRegistry(reg);
        if (orgs.length > 0) {
          setSelectedOrgId(orgs[0].id);
        }
      } catch (error) {
        handleApiError(error);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  React.useEffect(() => {
    if (!selectedOrgId) return;
    async function loadModules() {
      setLoading(true);
      try {
        const data = await api.get<Product[]>(`/modules/organizations/${selectedOrgId}`);
        setProducts(data);
      } catch (error) {
        handleApiError(error);
      } finally {
        setLoading(false);
      }
    }
    void loadModules();
  }, [selectedOrgId]);

  const toggleModule = (productKey: string, moduleKey: string) => {
    setProducts((prev) =>
      prev.map((product) => {
        if (product.key !== productKey) return product;
        return {
          ...product,
          modules: product.modules.map((module) =>
            module.key === moduleKey ? { ...module, enabled: !module.enabled } : module
          ),
        };
      })
    );
  };

  const handleSave = async () => {
    if (!selectedOrgId) return;
    const toggles = products.flatMap((product) =>
      product.modules.map((module) => ({
        product: product.key,
        moduleKey: module.key,
        enabled: module.enabled,
      }))
    );
    setSaving(true);
    try {
      const updated = await api.put<Product[]>(`/modules/organizations/${selectedOrgId}`, toggles);
      setProducts(updated);
      toast.success("Modules updated successfully");
    } catch (error) {
      handleApiError(error);
    } finally {
      setSaving(false);
    }
  };

  if (loading && organizations.length === 0) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Module Management</h1>
        <p className="text-muted-foreground">
          Control which products and modules each organization can access.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>Select the client organization to configure.</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedOrgId} onValueChange={setSelectedOrgId} disabled={loading}>
            <SelectTrigger className="w-full sm:w-80">
              <SelectValue placeholder="Select organization" />
            </SelectTrigger>
            <SelectContent>
              {organizations.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {products.map((product) => (
        <Card key={product.key}>
          <CardHeader>
            <CardTitle>{product.label}</CardTitle>
            <CardDescription>{product.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {product.modules.map((module) => (
                <div
                  key={`${product.key}-${module.key}`}
                  className="flex items-start justify-between rounded-lg border p-4"
                >
                  <div className="space-y-1 pr-4">
                    <Label htmlFor={`${product.key}-${module.key}`} className="font-medium">
                      {module.label}
                    </Label>
                    <p className="text-sm text-muted-foreground">{module.description}</p>
                  </div>
                  <input
                    id={`${product.key}-${module.key}`}
                    type="checkbox"
                    className="h-5 w-5 accent-primary shrink-0 cursor-pointer"
                    checked={module.enabled}
                    onChange={() => toggleModule(product.key, module.key)}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || !selectedOrgId}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
