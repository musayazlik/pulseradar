"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";

const formSchema = z.object({
  platforms: z.array(z.string()).min(1, "Select at least one platform"),
  city: z.string().trim().optional(),
  keywords: z.string().optional(),
  hashtags: z.string().optional(),
  lastDays: z.number().int().min(1).max(365),
  includeOnline: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

export function NewScanForm({ defaultLastDays }: { defaultLastDays: number }) {
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      platforms: ["linkedin", "x"],
      city: "",
      keywords: "",
      hashtags: "",
      lastDays: defaultLastDays,
      includeOnline: true,
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const split = (text: string | undefined) =>
        (text ?? "")
          .split(/[\n,]/)
          .map((s) => s.trim())
          .filter(Boolean);
      return api.createScan({
        platforms: values.platforms,
        city: values.city?.trim() ? values.city.trim() : null,
        keywords: split(values.keywords).length > 0 ? split(values.keywords) : undefined,
        hashtags: split(values.hashtags).length > 0 ? split(values.hashtags) : undefined,
        lastDays: values.lastDays,
        includeOnline: values.includeOnline,
      });
    },
    onSuccess: (result) => {
      toast.success("Scan queued.");
      router.push(`/scans/${result.runId}`);
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const platforms = ["linkedin", "x", "instagram", "tiktok"];
  const selected = form.watch("platforms");

  const togglePlatform = (platform: string, enabled: boolean) => {
    const current = form.getValues("platforms");
    form.setValue(
      "platforms",
      enabled ? [...current, platform] : current.filter((p) => p !== platform),
      { shouldValidate: true },
    );
  };

  return (
    <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="space-y-4">
      <div className="space-y-2">
        <Label>Platforms</Label>
        <div className="flex flex-wrap gap-4">
          {platforms.map((platform) => {
            const disabled = platform === "instagram" || platform === "tiktok";
            return (
              <label key={platform} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selected.includes(platform)}
                  onCheckedChange={(checked) => togglePlatform(platform, checked === true)}
                  disabled={disabled}
                />
                {platform === "x" ? "X" : platform}
                {disabled && <span className="text-xs text-muted-foreground">(soon)</span>}
              </label>
            );
          })}
        </div>
        {form.formState.errors.platforms && (
          <p className="text-xs text-destructive">{form.formState.errors.platforms.message}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="scan-city">City (empty = all)</Label>
          <Input id="scan-city" placeholder="e.g. istanbul" {...form.register("city")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="scan-days">Last X days (post date)</Label>
          <Input
            id="scan-days"
            type="number"
            min={1}
            max={365}
            {...form.register("lastDays", { valueAsNumber: true })}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="scan-keywords">Custom keywords (one per line)</Label>
          <Textarea
            id="scan-keywords"
            placeholder="leave empty to use the list from Settings"
            rows={3}
            {...form.register("keywords")}
          />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            <span className="text-primary">All</span> of your keywords are scanned; if left
            empty, the entire list from Settings is scanned. No queries get skipped.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="scan-hashtags">Custom hashtags (without #)</Label>
          <Textarea
            id="scan-hashtags"
            placeholder="leave empty to use the list from Settings"
            rows={3}
            {...form.register("hashtags")}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Switch
          checked={form.watch("includeOnline")}
          onCheckedChange={(checked) => form.setValue("includeOnline", checked)}
        />
        Also show online events
      </label>

      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "queuing…" : "Start scan"}
      </Button>
      <p className="text-xs text-muted-foreground">
        The scan runs in the worker and continues even if the panel closes. Limits come from Settings.
      </p>
    </form>
  );
}
