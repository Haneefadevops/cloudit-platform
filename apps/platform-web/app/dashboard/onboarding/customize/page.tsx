"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CustomFieldBuilder } from "@/components/onboarding/custom-field-builder";
import { FeatureFlagPanel } from "@/components/onboarding/feature-flag-panel";
import { onboardingApi, type OnboardingOrganization, type ProductDefinition } from "@/lib/onboarding";
import { handleApiError } from "@/lib/api-client";

const ENTITIES = ["employee", "customer", "profile", "card"];

export default function CustomizeOnboardingPage() {
  const searchParams = useSearchParams();
  const orgId = searchParams?.get("orgId") ?? "";

  const [org, setOrg] = React.useState<OnboardingOrganization | null>(null);
  const [products, setProducts] = React.useState<ProductDefinition[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedProduct, setSelectedProduct] = React.useState<string>("");

  React.useEffect(() => {
    async function load() {
      if (!orgId) {
        setLoading(false);
        return;
      }
      try {
        const [orgData, registry] = await Promise.all([
          onboardingApi.get(orgId),
          onboardingApi.getRegistry(),
        ]);
        setOrg(orgData);
        const provisionedProducts = new Set(orgData.provisioning?.map((p) => p.product) ?? []);
        const availableProducts = registry.filter(
          (p) => p.key !== "platform" && provisionedProducts.has(p.key)
        );
        setProducts(availableProducts);
        setSelectedProduct(availableProducts[0]?.key ?? "");
      } catch (error) {
        handleApiError(error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [orgId]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!orgId) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-destructive">No organization selected.</p>
        </CardContent>
      </Card>
    );
  }

  if (!org) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-destructive">Organization not found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Customize {org.name}</h1>
        <p className="text-muted-foreground">
          Configure custom fields and feature flags for provisioned products.
        </p>
      </div>

      {products.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">
              No products have been provisioned for this organization yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Product</CardTitle>
              <CardDescription>Select a product to customize.</CardDescription>
            </CardHeader>
            <CardContent>
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm sm:max-w-xs"
              >
                {products.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </CardContent>
          </Card>

          {selectedProduct && (
            <Tabs defaultValue="fields" className="space-y-4">
              <TabsList>
                <TabsTrigger value="fields">Custom Fields</TabsTrigger>
                <TabsTrigger value="flags">Feature Flags</TabsTrigger>
              </TabsList>
              <TabsContent value="fields" className="space-y-4">
                {ENTITIES.map((entity) => (
                  <CustomFieldBuilder
                    key={entity}
                    orgId={orgId}
                    product={selectedProduct}
                    entity={entity}
                    title={`${entity.charAt(0).toUpperCase() + entity.slice(1)} Fields`}
                    description={`Extra fields for ${entity} forms in ${selectedProduct}.`}
                  />
                ))}
              </TabsContent>
              <TabsContent value="flags">
                <FeatureFlagPanel orgId={orgId} product={selectedProduct} />
              </TabsContent>
            </Tabs>
          )}
        </>
      )}
    </div>
  );
}
