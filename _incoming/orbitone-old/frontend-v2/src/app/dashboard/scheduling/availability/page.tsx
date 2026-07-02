import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAvailability, useUpdateAvailability } from "@/hooks/useScheduling";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AvailabilityRuleInput } from "@/lib/contracts";

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const ruleSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM format"),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM format"),
  timezone: z.string().min(1),
  isActive: z.boolean(),
});

const availabilitySchema = z.object({
  rules: z.array(ruleSchema),
});

type AvailabilityFormValues = z.infer<typeof availabilitySchema>;

const defaultTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

function createDefaultRules(): AvailabilityRuleInput[] {
  return [1, 2, 3, 4, 5].map((dayOfWeek) => ({
    dayOfWeek,
    startTime: "09:00",
    endTime: "17:00",
    timezone: defaultTimezone,
    isActive: true,
  }));
}

export function AvailabilityPage() {
  const { data: availability, isLoading } = useAvailability();
  const update = useUpdateAvailability();

  const form = useForm<AvailabilityFormValues>({
    resolver: zodResolver(availabilitySchema),
    defaultValues: {
      rules: createDefaultRules(),
    },
  });

  useEffect(() => {
    if (availability) {
      const rules =
        availability.rules.length > 0
          ? availability.rules
          : createDefaultRules();
      form.reset({ rules });
    }
  }, [availability, form]);

  async function onSubmit(values: AvailabilityFormValues) {
    await update.mutateAsync({
      rules: values.rules,
      exceptions: [], // Exceptions UI can be added later
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Weekly availability</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {form.watch("rules").map((rule, index) => (
            <RuleRow
              key={`${rule.dayOfWeek}-${index}`}
              index={index}
              rule={rule}
              form={form}
            />
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const rules = form.getValues("rules");
              form.setValue("rules", [
                ...rules,
                {
                  dayOfWeek: 1,
                  startTime: "09:00",
                  endTime: "17:00",
                  timezone: defaultTimezone,
                  isActive: true,
                },
              ]);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add time range
          </Button>

          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Input
              id="timezone"
              value={form.watch("rules")[0]?.timezone ?? defaultTimezone}
              onChange={(e) => {
                const rules = form.getValues("rules").map((r) => ({
                  ...r,
                  timezone: e.target.value,
                }));
                form.setValue("rules", rules);
              }}
            />
            <p className="text-xs text-muted">
              All rules use this timezone (e.g. Asia/Colombo).
            </p>
          </div>
        </CardContent>
      </Card>

      {update.isError && (
        <p className="text-sm text-error">{update.error?.message ?? "Could not save availability."}</p>
      )}
      {update.isSuccess && <p className="text-sm text-success">Availability saved.</p>}

      <Button type="submit" isLoading={update.isPending}>
        Save availability
      </Button>
    </form>
  );
}

function RuleRow({
  index,
  rule,
  form,
}: {
  index: number;
  rule: AvailabilityRuleInput;
  form: ReturnType<typeof useForm<AvailabilityFormValues>>;
}) {
  const errors = form.formState.errors.rules?.[index];

  return (
    <div
      className={cn(
        "grid gap-3 rounded-lg border p-3 transition-opacity sm:grid-cols-[1fr_1fr_1fr_auto]",
        !rule.isActive && "opacity-60"
      )}
    >
      <div className="space-y-2">
        <Label className="text-xs">Day</Label>
        <select
          value={rule.dayOfWeek}
          onChange={(e) => {
            const rules = form.getValues("rules");
            rules[index].dayOfWeek = Number(e.target.value);
            form.setValue("rules", [...rules]);
          }}
          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
        >
          {dayNames.map((name, i) => (
            <option key={i} value={i}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Start</Label>
        <Input
          type="time"
          value={rule.startTime}
          onChange={(e) => {
            const rules = form.getValues("rules");
            rules[index].startTime = e.target.value;
            form.setValue("rules", [...rules]);
          }}
        />
        {errors?.startTime && <p className="text-xs text-error">{errors.startTime.message}</p>}
      </div>

      <div className="space-y-2">
        <Label className="text-xs">End</Label>
        <Input
          type="time"
          value={rule.endTime}
          onChange={(e) => {
            const rules = form.getValues("rules");
            rules[index].endTime = e.target.value;
            form.setValue("rules", [...rules]);
          }}
        />
        {errors?.endTime && <p className="text-xs text-error">{errors.endTime.message}</p>}
      </div>

      <div className="flex items-end gap-2">
        <Switch
          checked={rule.isActive}
          onChange={(e) => {
            const rules = form.getValues("rules");
            rules[index].isActive = e.target.checked;
            form.setValue("rules", [...rules]);
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            const rules = form.getValues("rules");
            rules.splice(index, 1);
            form.setValue("rules", [...rules]);
          }}
        >
          <Trash2 className="h-4 w-4 text-error" />
        </Button>
      </div>
    </div>
  );
}
