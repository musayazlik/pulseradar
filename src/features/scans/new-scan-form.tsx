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
  platforms: z.array(z.string()).min(1, "En az bir platform seçin"),
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
      toast.success("Tarama kuyruğa alındı.");
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
        <Label>Platformlar</Label>
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
                {disabled && <span className="text-xs text-muted-foreground">(yakında)</span>}
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
          <Label htmlFor="scan-city">Şehir (boşsa hepsi)</Label>
          <Input id="scan-city" placeholder="örn. istanbul" {...form.register("city")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="scan-days">Son X gün (paylaşım tarihi)</Label>
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
          <Label htmlFor="scan-keywords">Özel anahtar kelimeler (satır başına bir)</Label>
          <Textarea
            id="scan-keywords"
            placeholder="boş bırakılırsa Ayarlar'daki liste kullanılır"
            rows={3}
            {...form.register("keywords")}
          />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Yazdığın kelimeler her zaman <span className="text-primary">önce</span> kullanılır;
            kalan sorgu hakkı Ayarlar'daki listeyle doldurulur.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="scan-hashtags">Özel hashtag'ler (# olmadan)</Label>
          <Textarea
            id="scan-hashtags"
            placeholder="boş bırakılırsa Ayarlar'daki liste kullanılır"
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
        Online etkinlikleri de göster
      </label>

      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "kuyruğa alınıyor…" : "Taramayı başlat"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Tarama worker tarafından yürütülür; panel kapansa da sürer. Limitler Ayarlar'dan gelir.
      </p>
    </form>
  );
}
