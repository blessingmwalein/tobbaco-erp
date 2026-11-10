"use client";

import { useState } from "react";
import { FlaskConical, RotateCcw } from "lucide-react";
import {
  Button,
  Callout,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Switch,
  toast,
} from "@tobacco/ui";
import type { ScenarioId } from "@tobacco/shared";
import { SCENARIOS, applyScenario } from "@/mock/scenarios";
import { getDb, resetDb, setDb } from "@/mock/store";
import { useDb } from "@/mock/hooks";
import { useUi } from "@/lib/ui-store";

/** Demo-only tooling: jump to any stage of the sale day, reset data, tune latency. Not part of the product. */
export function DemoControlsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const current = useDb((db) => db.meta.scenario);
  const latency = useDb((db) => db.settings.latencyMs);
  const sound = useUi((s) => s.sound);
  const setSound = useUi((s) => s.setSound);
  const [selected, setSelected] = useState<ScenarioId>(current);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="size-4 text-primary" aria-hidden /> Demo controls
          </DialogTitle>
          <DialogDescription>
            Phase 1 runs on local mock data. Jump to any stage of the documented 17 September 2026 sale day, or reset.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-5">
          <Callout tone="info" title="Simulated">
            Nothing here talks to a server, bank, scale, scanner or printer. Stage presets are built from the documented
            data; values the manuals don't give are marked DEMO.
          </Callout>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-xs font-medium text-muted-foreground">Sale-day stage</legend>
            {SCENARIOS.map((s) => (
              <label
                key={s.id}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary-soft/50"
              >
                <input
                  type="radio"
                  name="scenario"
                  value={s.id}
                  checked={selected === s.id}
                  onChange={() => setSelected(s.id)}
                  className="mt-1 accent-[var(--primary)]"
                />
                <span>
                  <span className="block text-sm font-medium">
                    {s.label}
                    {current === s.id ? <span className="ml-2 text-xs font-normal text-muted-foreground">(current)</span> : null}
                  </span>
                  <span className="block text-xs text-muted-foreground">{s.description}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Simulated latency (ms)" htmlFor="latency" hint="0 = instant. Shows loading states when higher.">
              <Input
                id="latency"
                type="number"
                min={0}
                max={2000}
                value={latency}
                onChange={(e) => {
                  const db = getDb();
                  setDb({ ...db, settings: { ...db.settings, latencyMs: Math.max(0, Number(e.target.value) || 0) } });
                }}
              />
            </Field>
            <Field label="Scan sounds" htmlFor="sound" hint="Short beep on accepted / rejected scans">
              <div className="flex h-10 items-center">
                <Switch id="sound" checked={sound} onCheckedChange={setSound} aria-label="Scan sounds" />
              </div>
            </Field>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => {
              resetDb();
              toast.success("Demo data reset to the morning of 17 Sep 2026");
              onOpenChange(false);
            }}
          >
            <RotateCcw /> Reset demo data
          </Button>
          <Button
            onClick={() => {
              applyScenario(selected);
              toast.success(`Jumped to: ${SCENARIOS.find((s) => s.id === selected)?.label}`);
              onOpenChange(false);
            }}
          >
            Apply stage
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
