"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, ImageIcon, Globe, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { handleApiError } from "@/lib/api-client";
import {
  whiteLabelApi,
  parseWhiteLabelSettings,
  type WhiteLabelSettings,
} from "@/lib/white-label";

const whiteLabelSchema = z.object({
  logoUrl: z.string().url("Enter a valid URL").optional().or(z.literal("")),
  primaryColor: z
    .string()
    .regex(/^#([0-9A-Fa-f]{3}){1,2}$/, "Enter a valid hex color")
    .optional()
    .or(z.literal("")),
  faviconUrl: z.string().url("Enter a valid URL").optional().or(z.literal("")),
  dateFormat: z.string().optional().or(z.literal("")),
  currency: z.string().optional().or(z.literal("")),
  supportEmail: z.string().email("Enter a valid email").optional().or(z.literal("")),
});

type WhiteLabelFormValues = z.infer<typeof whiteLabelSchema>;

interface WhiteLabelFormProps {
  orgId: string;
}

export function WhiteLabelForm({ orgId }: WhiteLabelFormProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  const form = useForm<WhiteLabelFormValues>({
    resolver: zodResolver(whiteLabelSchema),
    defaultValues: {
      logoUrl: "",
      primaryColor: "",
      faviconUrl: "",
      dateFormat: "DD/MM/YYYY",
      currency: "LKR",
      supportEmail: "",
    },
  });

  React.useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const settings = await whiteLabelApi.get(orgId);
        const parsed = parseWhiteLabelSettings(settings);
        form.reset(parsed);
      } catch (error) {
        handleApiError(error);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [orgId, form]);

  async function onSubmit(values: WhiteLabelFormValues) {
    setIsSaving(true);
    try {
      await whiteLabelApi.update(orgId, values);
      toast.success("White-label settings saved");
    } catch (error) {
      handleApiError(error);
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const primaryColor = form.watch("primaryColor");

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Branding
          </CardTitle>
          <CardDescription>Logo, colors, and favicon for this organization.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Logo URL"
            placeholder="https://cdn.example.com/logo.png"
            error={form.formState.errors.logoUrl?.message}
            {...form.register("logoUrl")}
          />
          <Input
            label="Favicon URL"
            placeholder="https://cdn.example.com/favicon.ico"
            error={form.formState.errors.faviconUrl?.message}
            {...form.register("faviconUrl")}
          />
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Primary Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={primaryColor || "#000000"}
                onChange={(e) => form.setValue("primaryColor", e.target.value, { shouldValidate: true })}
                className="h-10 w-10 rounded-md border border-input bg-transparent p-1"
              />
              <Input
                placeholder="#534AB7"
                error={form.formState.errors.primaryColor?.message}
                {...form.register("primaryColor")}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Localization
          </CardTitle>
          <CardDescription>Date format and currency defaults.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Date Format</label>
              <select
                {...form.register("dateFormat")}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </div>
            <Input
              label="Currency"
              placeholder="LKR"
              error={form.formState.errors.currency?.message}
              {...form.register("currency")}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Contact
          </CardTitle>
          <CardDescription>Support email shown in product UIs.</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            label="Support Email"
            type="email"
            placeholder="support@example.com"
            error={form.formState.errors.supportEmail?.message}
            {...form.register("supportEmail")}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSaving} className="min-h-[44px]">
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save White-Label Settings"
          )}
        </Button>
      </div>
    </form>
  );
}
