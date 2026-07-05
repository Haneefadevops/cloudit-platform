"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Building2, Check, ChevronLeft, ChevronRight, Loader2, Mail, Package, Settings, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Stepper } from "@/components/onboarding/stepper";
import { handleApiError } from "@/lib/api-client";
import {
  onboardingApi,
  type CreateOnboardingInput,
  type ProductDefinition,
} from "@/lib/onboarding";

const steps = [
  { id: "product", label: "Product", description: "Choose product", icon: Package },
  { id: "organization", label: "Organization", description: "Org details", icon: Building2 },
  { id: "super-admin", label: "Super Admin", description: "Invite owner", icon: User },
  { id: "modules", label: "Modules", description: "Enable features", icon: Settings },
  { id: "review", label: "Review", description: "Confirm & send", icon: Check },
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const superAdminSchema = z.object({
  email: z.string().email("Enter a valid email"),
  firstName: z.string().min(1, "First name is required").max(120),
  lastName: z.string().min(1, "Last name is required").max(120),
});

const onboardingSchema = z.object({
  product: z.string().min(1, "Select a product"),
  organizationName: z.string().min(1, "Organization name is required").max(120),
  slug: z.string().min(1, "Slug is required").max(80),
  superAdmin: superAdminSchema,
  modules: z.record(z.boolean()),
});

type OnboardingFormValues = z.infer<typeof onboardingSchema>;

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = React.useState(0);
  const [registry, setRegistry] = React.useState<ProductDefinition[]>([]);
  const [registryLoading, setRegistryLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      product: "",
      organizationName: "",
      slug: "",
      superAdmin: { email: "", firstName: "", lastName: "" },
      modules: {},
    },
    mode: "onChange",
  });

  const selectedProduct = form.watch("product");
  const organizationName = form.watch("organizationName");
  const modules = form.watch("modules");

  React.useEffect(() => {
    onboardingApi
      .getRegistry()
      .then((data) => setRegistry(data.filter((p) => p.key !== "platform")))
      .catch(() => toast.error("Failed to load product registry"))
      .finally(() => setRegistryLoading(false));
  }, []);

  React.useEffect(() => {
    if (organizationName && !form.getValues("slug")) {
      form.setValue("slug", slugify(organizationName), { shouldValidate: true });
    }
  }, [organizationName, form]);

  React.useEffect(() => {
    if (selectedProduct) {
      const product = registry.find((p) => p.key === selectedProduct);
      const defaultModules: Record<string, boolean> = {};
      product?.modules.forEach((m) => {
        defaultModules[m.key] = true;
      });
      form.setValue("modules", defaultModules, { shouldValidate: true });
    }
  }, [selectedProduct, registry, form]);

  const selectedProductDef = registry.find((p) => p.key === selectedProduct);
  const selectedModules = selectedProductDef?.modules.filter((m) => modules[m.key]) ?? [];

  function validateStep(step: number) {
    if (step === 0) {
      return form.trigger("product");
    }
    if (step === 1) {
      return form.trigger(["organizationName", "slug"]);
    }
    if (step === 2) {
      return form.trigger("superAdmin");
    }
    return Promise.resolve(true);
  }

  async function handleNext() {
    const valid = await validateStep(currentStep);
    if (valid) {
      setCurrentStep((s) => Math.min(s + 1, steps.length - 1));
    }
  }

  function handleBack() {
    setCurrentStep((s) => Math.max(s - 1, 0));
  }

  async function onSubmit(values: OnboardingFormValues) {
    setIsSubmitting(true);
    try {
      const payload: CreateOnboardingInput = {
        organizationName: values.organizationName,
        slug: values.slug,
        product: values.product,
        superAdmin: values.superAdmin,
        modules: Object.entries(values.modules).map(([moduleKey, enabled]) => ({
          moduleKey,
          enabled,
        })),
      };
      await onboardingApi.create(payload);
      toast.success("Organization onboarded and invite sent");
      router.push("/dashboard/onboarding/list");
    } catch (error) {
      handleApiError(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (registryLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Client Onboarding</h1>
        <p className="text-muted-foreground">Provision a new organization and send the super admin invite.</p>
      </div>

      <Stepper steps={steps} currentStep={currentStep} />

      <Card>
        <CardHeader>
          <CardTitle>{steps[currentStep].label}</CardTitle>
          <CardDescription>
            {currentStep === 0 && "Select the product to provision."}
            {currentStep === 1 && "Enter the organization details."}
            {currentStep === 2 && "Enter the product super admin details."}
            {currentStep === 3 && "Choose which modules to enable for this organization."}
            {currentStep === 4 && "Review the details before sending the invite."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {currentStep === 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {registry.map((product) => (
                <button
                  key={product.key}
                  type="button"
                  onClick={() => form.setValue("product", product.key, { shouldValidate: true })}
                  className={`relative rounded-lg border p-4 text-left transition-all hover:border-primary ${
                    selectedProduct === product.key
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border bg-background"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Package className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold">{product.label}</p>
                      <p className="text-xs text-muted-foreground">{product.description}</p>
                    </div>
                  </div>
                  {selectedProduct === product.key && (
                    <div className="absolute right-3 top-3">
                      <Check className="h-5 w-5 text-primary" />
                    </div>
                  )}
                </button>
              ))}
              {form.formState.errors.product && (
                <p className="col-span-full text-sm text-destructive">{form.formState.errors.product.message}</p>
              )}
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-4">
              <Input
                label="Organization Name"
                error={form.formState.errors.organizationName?.message}
                {...form.register("organizationName")}
              />
              <Input
                label="Slug"
                error={form.formState.errors.slug?.message}
                {...form.register("slug")}
                onChange={(e) => form.setValue("slug", slugify(e.target.value), { shouldValidate: true })}
                value={form.watch("slug")}
              />
              <p className="text-xs text-muted-foreground">
                The slug is used in URLs and provisioning identifiers.
              </p>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="First Name"
                  error={form.formState.errors.superAdmin?.firstName?.message}
                  {...form.register("superAdmin.firstName")}
                />
                <Input
                  label="Last Name"
                  error={form.formState.errors.superAdmin?.lastName?.message}
                  {...form.register("superAdmin.lastName")}
                />
              </div>
              <Input
                label="Email"
                type="email"
                error={form.formState.errors.superAdmin?.email?.message}
                {...form.register("superAdmin.email")}
              />
              <p className="text-xs text-muted-foreground">
                This person will receive a secure link to set their password and become the product super admin.
              </p>
            </div>
          )}

          {currentStep === 3 && selectedProductDef && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Modules are enabled by default. Uncheck any module this client does not need.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {selectedProductDef.modules.map((module) => (
                  <label
                    key={module.key}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 hover:bg-muted/50"
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-primary text-primary focus:ring-primary"
                      checked={!!modules[module.key]}
                      onChange={(e) =>
                        form.setValue(`modules.${module.key}`, e.target.checked, { shouldValidate: true })
                      }
                    />
                    <div>
                      <p className="font-medium">{module.label}</p>
                      <p className="text-xs text-muted-foreground">{module.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-6">
              <ReviewSection title="Product" icon={Package}>
                <p className="font-medium">{selectedProductDef?.label}</p>
                <p className="text-sm text-muted-foreground">{selectedProductDef?.description}</p>
              </ReviewSection>
              <ReviewSection title="Organization" icon={Building2}>
                <p className="font-medium">{form.watch("organizationName")}</p>
                <p className="text-sm text-muted-foreground">Slug: {form.watch("slug")}</p>
              </ReviewSection>
              <ReviewSection title="Super Admin" icon={User}>
                <p className="font-medium">
                  {form.watch("superAdmin.firstName")} {form.watch("superAdmin.lastName")}
                </p>
                <p className="text-sm text-muted-foreground">{form.watch("superAdmin.email")}</p>
              </ReviewSection>
              <ReviewSection title="Enabled Modules" icon={Settings}>
                <div className="flex flex-wrap gap-2">
                  {selectedModules.map((m) => (
                    <Badge key={m.key} variant="secondary">
                      {m.label}
                    </Badge>
                  ))}
                  {selectedModules.length === 0 && (
                    <p className="text-sm text-muted-foreground">No modules enabled.</p>
                  )}
                </div>
              </ReviewSection>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 0 || isSubmitting}
              className="min-h-[44px]"
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            {currentStep < steps.length - 1 ? (
              <Button type="button" onClick={handleNext} className="min-h-[44px]">
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={form.handleSubmit(onSubmit)}
                disabled={isSubmitting}
                className="min-h-[44px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Onboarding…
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Send Invite
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ReviewSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4 rounded-lg border border-border p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-muted-foreground">{title}</p>
        <div className="mt-1">{children}</div>
      </div>
    </div>
  );
}
