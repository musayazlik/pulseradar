"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { SearchConfig } from "@/core/config/schema";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <CardTitle className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </CardTitle>
  );
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["settings"], queryFn: api.settings });
  const [config, setConfig] = useState<SearchConfig | null>(null);
  const [keywordsText, setKeywordsText] = useState("");
  const [hashtagsText, setHashtagsText] = useState("");

  useEffect(() => {
    if (query.data && !config) {
      setConfig(query.data);
      setKeywordsText(query.data.keywords.join("\n"));
      setHashtagsText(query.data.hashtags.join("\n"));
    }
  }, [query.data, config]);

  const save = async () => {
    if (!config) return;
    try {
      const next: SearchConfig = {
        ...config,
        keywords: keywordsText.split("\n").map((s) => s.trim()).filter(Boolean),
        hashtags: hashtagsText.split(/[\s,]+/).map((s) => s.trim().replace(/^#/, "")).filter(Boolean),
      };
      const saved = await api.saveSettings(next);
      setConfig(saved);
      setKeywordsText(saved.keywords.join("\n"));
      setHashtagsText(saved.hashtags.join("\n"));
      toast.success("Settings saved.");
      await queryClient.invalidateQueries({ queryKey: ["settings"] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  if (query.isLoading || !config) {
    return <p className="font-mono text-sm text-muted-foreground">loading…</p>;
  }

  const update = (patch: Partial<SearchConfig>) =>
    setConfig((current) => (current ? { ...current, ...patch } : current));
  const updateFilters = (patch: Partial<SearchConfig["filters"]>) =>
    setConfig((current) => (current ? { ...current, filters: { ...current.filters, ...patch } } : current));
  const updateLimits = (patch: Partial<SearchConfig["limits"]>) =>
    setConfig((current) => (current ? { ...current, limits: { ...current.limits, ...patch } } : current));

  return (
    <div className="space-y-6">
      <div className="reveal">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-primary">configuration</p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Queries, delays and limits — written atomically to the single{" "}
          <code className="font-mono text-xs">search.json</code> source.
        </p>
      </div>

      <Card className="reveal-2">
        <CardHeader>
          <SectionTitle>queries</SectionTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="set-keywords" className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              keywords · one per line
            </Label>
            <Textarea
              id="set-keywords"
              rows={10}
              className="font-mono text-xs"
              value={keywordsText}
              onChange={(e) => setKeywordsText(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="set-hashtags" className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              hashtags · without #
            </Label>
            <Textarea
              id="set-hashtags"
              rows={10}
              className="font-mono text-xs"
              value={hashtagsText}
              onChange={(e) => setHashtagsText(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="reveal-2">
        <CardHeader>
          <SectionTitle>filters</SectionTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="set-city" className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              default city
            </Label>
            <Input
              id="set-city"
              value={config.filters.city ?? ""}
              placeholder="empty = all"
              onChange={(e) => updateFilters({ city: e.target.value || null })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="set-days" className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              last x days
            </Label>
            <Input
              id="set-days"
              type="number"
              min={1}
              max={365}
              className="font-mono tabular-nums"
              value={config.filters.lastDays}
              onChange={(e) => updateFilters({ lastDays: Number(e.target.value) || 30 })}
            />
          </div>
          <div className="flex items-end gap-2 pb-1.5">
            <Switch
              id="set-online"
              checked={config.filters.includeOnline}
              onCheckedChange={(checked) => updateFilters({ includeOnline: checked })}
            />
            <Label htmlFor="set-online" className="text-sm">
              Include online events
            </Label>
          </div>
        </CardContent>
      </Card>

      <Card className="reveal-2">
        <CardHeader>
          <SectionTitle>image reading (ocr)</SectionTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="flex items-end gap-2 pb-1.5 sm:col-span-1">
            <Switch
              id="set-ocr"
              checked={config.ocr.enabled}
              onCheckedChange={(checked) =>
                setConfig((current) =>
                  current ? { ...current, ocr: { ...current.ocr, enabled: checked } } : current,
                )
              }
            />
            <Label htmlFor="set-ocr" className="text-sm">
              Read poster images with local OCR
            </Label>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="set-ocr-max" className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              posts / image
            </Label>
            <Input
              id="set-ocr-max"
              type="number"
              min={1}
              max={5}
              className="font-mono tabular-nums"
              value={config.ocr.maxImagesPerPost}
              onChange={(e) =>
                setConfig((current) =>
                  current
                    ? { ...current, ocr: { ...current.ocr, maxImagesPerPost: Number(e.target.value) || 1 } }
                    : current,
                )
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="set-ocr-min" className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              min image size (bytes)
            </Label>
            <Input
              id="set-ocr-min"
              type="number"
              min={0}
              step={1000}
              className="font-mono tabular-nums"
              value={config.ocr.minImageBytes}
              onChange={(e) =>
                setConfig((current) =>
                  current
                    ? { ...current, ocr: { ...current.ocr, minImageBytes: Number(e.target.value) || 0 } }
                    : current,
                )
              }
            />
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground sm:col-span-3">
            Fully local (tesseract.js, tur+eng); language data downloads to the
            data directory on first use. Recognized text is appended to the post
            text with the
            <code className="mx-1 font-mono">[image text]</code> tag and stays traceable in evidence.
          </p>
        </CardContent>
      </Card>

      <Card className="reveal-3">
        <CardHeader>
          <SectionTitle>limits</SectionTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4">
          {(
            [
              ["maxPostsPerQuery", "query / posts"],
              ["maxScrollsPerQuery", "query / scroll"],
              ["minDelayMs", "min delay ms"],
              ["maxDelayMs", "max delay ms"],
              ["maxRunMinutes", "task time cap min"],
            ] as Array<[keyof SearchConfig["limits"], string]>
          ).map(([key, label]) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={`set-${key}`} className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {label}
              </Label>
              <Input
                id={`set-${key}`}
                type="number"
                className="font-mono tabular-nums"
                value={config.limits[key]}
                onChange={(e) => updateLimits({ [key]: Number(e.target.value) })}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="reveal-3">
        <Button onClick={save}>Save</Button>
      </div>
    </div>
  );
}
