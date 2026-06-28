"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, handleApiError } from "@/lib/api-client";
import { Send } from "lucide-react";

const integrationSchema = z.object({
  n8nWebhookUrl: z.string().optional(),
  n8nWebhookSecret: z.string().optional(),
  aiProvider: z.enum(["openai", "anthropic", "local", "none"]),
  aiApiKey: z.string().optional(),
  whatsappApiKey: z.string().optional(),
  whatsappPhoneNumberId: z.string().optional(),
});

type IntegrationForm = z.infer<typeof integrationSchema>;

export default function IntegrationsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<IntegrationForm>({
    resolver: zodResolver(integrationSchema),
    defaultValues: {
      n8nWebhookUrl: "",
      n8nWebhookSecret: "",
      aiProvider: "none",
      aiApiKey: "",
      whatsappApiKey: "",
      whatsappPhoneNumberId: "",
    },
  });

  const aiProvider = watch("aiProvider");

  useEffect(() => {
    setIsLoading(true);
    api
      .get("/admin/integrations/settings")
      .then((res: any) => {
        reset({
          n8nWebhookUrl: res.n8nWebhookUrl || "",
          n8nWebhookSecret: res.n8nWebhookSecret || "",
          aiProvider: res.aiProvider || "none",
          aiApiKey: res.aiApiKey || "",
          whatsappApiKey: res.whatsappApiKey || "",
          whatsappPhoneNumberId: res.whatsappPhoneNumberId || "",
        });
      })
      .catch(handleApiError)
      .finally(() => setIsLoading(false));
  }, [reset]);

  const onSubmit = async (data: IntegrationForm) => {
    setIsSaving(true);
    try {
      await api.patch("/admin/integrations/settings", data);
      toast.success("Integration settings saved");
    } catch (error) {
      handleApiError(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestWebhook = async () => {
    setTesting(true);
    try {
      const res: any = await api.post("/admin/integrations/test-webhook", {});
      toast.success(res.message || "Test event sent");
    } catch (error) {
      handleApiError(error);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
          <p className="text-muted-foreground">
            Configure n8n, AI provider, and WhatsApp placeholders
          </p>
        </div>
        <Button onClick={handleTestWebhook} disabled={testing} size="sm">
          <Send className="mr-2 h-4 w-4" />
          {testing ? "Sending..." : "Test Webhook"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Integration Settings</CardTitle>
          <CardDescription>
            These settings are stored in the platform database.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading settings...</p>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">n8n Webhook</h3>
                <Input
                  label="Webhook URL"
                  placeholder="https://n8n.cloudit.lk/webhook/cloudit-events"
                  error={errors.n8nWebhookUrl?.message}
                  {...register("n8nWebhookUrl")}
                />
                <Input
                  label="Webhook Secret"
                  type="password"
                  placeholder="your-secure-secret"
                  error={errors.n8nWebhookSecret?.message}
                  {...register("n8nWebhookSecret")}
                />
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">AI Provider</h3>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Provider</label>
                  <Select
                    value={aiProvider}
                    onValueChange={(value) =>
                      setValue("aiProvider", value as IntegrationForm["aiProvider"])
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="anthropic">Anthropic</SelectItem>
                      <SelectItem value="local">Local</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  label="API Key"
                  type="password"
                  placeholder="sk-..."
                  error={errors.aiApiKey?.message}
                  {...register("aiApiKey")}
                />
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">WhatsApp Business API</h3>
                <Input
                  label="API Key"
                  type="password"
                  placeholder="your-whatsapp-api-key"
                  error={errors.whatsappApiKey?.message}
                  {...register("whatsappApiKey")}
                />
                <Input
                  label="Phone Number ID"
                  placeholder="your-phone-number-id"
                  error={errors.whatsappPhoneNumberId?.message}
                  {...register("whatsappPhoneNumberId")}
                />
              </div>

              <Button type="submit" disabled={isSaving} className="min-h-[44px]">
                {isSaving ? "Saving..." : "Save Settings"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
