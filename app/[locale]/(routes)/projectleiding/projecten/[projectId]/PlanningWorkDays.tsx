"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { setPlanningWorkDaysAction } from "@/actions/crm/sales/actions";
import { parseWorkDays } from "@/lib/sales/work-days";

function shown(value: number | null) {
  return value == null ? "" : String(value);
}

function wholeNumberDraft(value: string) {
  const trimmed = value.trim();
  if (trimmed === "" || /^\d+$/.test(trimmed)) return trimmed;
  return null;
}

export function PlanningWorkDays({
  projectId,
  chassis,
  glass,
}: {
  projectId: string;
  chassis: number | null;
  glass: number | null;
}) {
  const t = useTranslations("Sales");
  const p = useTranslations("Sales.projectScreen");
  const router = useRouter();
  const [chassisText, setChassisText] = useState(() => shown(chassis));
  const [glassText, setGlassText] = useState(() => shown(glass));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const latest = useRef({ chassis: shown(chassis), glass: shown(glass) });
  const saved = useRef({ chassis, glass });
  const queue = useRef(Promise.resolve());

  function commit() {
    const run = queue.current.then(() => persist());
    queue.current = run.then(
      () => undefined,
      () => undefined,
    );
  }

  async function persist() {
    const snapshot = latest.current;
    let chassisDays: number | null;
    let glassDays: number | null;
    try {
      chassisDays = parseWorkDays(snapshot.chassis);
      glassDays = parseWorkDays(snapshot.glass);
    } catch {
      setError(t("errors.workDaysInvalid"));
      return;
    }
    if (chassisDays === saved.current.chassis && glassDays === saved.current.glass) {
      latest.current = { chassis: shown(chassisDays), glass: shown(glassDays) };
      setChassisText(shown(chassisDays));
      setGlassText(shown(glassDays));
      setError(null);
      return;
    }
    setPending(true);
    const result = await setPlanningWorkDaysAction(projectId, { chassis: chassisDays, glass: glassDays });
    setPending(false);
    if ("error" in result && result.error) {
      setError(result.error);
      return;
    }
    saved.current = { chassis: chassisDays, glass: glassDays };
    latest.current = { chassis: shown(chassisDays), glass: shown(glassDays) };
    setChassisText(shown(chassisDays));
    setGlassText(shown(glassDays));
    setError(null);
    router.refresh();
  }

  function edit(which: "chassis" | "glass", value: string) {
    const next = wholeNumberDraft(value);
    if (next == null) {
      setError(t("errors.workDaysInvalid"));
      return;
    }
    setError(null);
    if (which === "chassis") {
      latest.current = { ...latest.current, chassis: next };
      setChassisText(next);
    } else {
      latest.current = { ...latest.current, glass: next };
      setGlassText(next);
    }
  }

  return (
    <section className="tilo-frame" data-testid="planning-work-days">
      <dl className="tilo-cells grid-cols-1 sm:grid-cols-2">
        <WorkDayField
          label={p("workDaysChassis")}
          field="work-days-chassis"
          testId="work-days-chassis"
          value={chassisText}
          disabled={pending}
          invalid={error != null}
          onChange={(value) => edit("chassis", value)}
          onCommit={commit}
        />
        <WorkDayField
          label={p("workDaysGlass")}
          field="work-days-glass"
          testId="work-days-glass"
          value={glassText}
          disabled={pending}
          invalid={error != null}
          onChange={(value) => edit("glass", value)}
          onCommit={commit}
        />
      </dl>
      {error && (
        <p className="px-3 pb-2 text-[12px] text-destructive" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function WorkDayField({
  label,
  field,
  testId,
  value,
  disabled,
  invalid,
  onChange,
  onCommit,
}: {
  label: string;
  field: string;
  testId: string;
  value: string;
  disabled: boolean;
  invalid: boolean;
  onChange: (value: string) => void;
  onCommit: () => void;
}) {
  return (
    <div className="min-w-0 px-3 py-2" data-field={field} data-empty={value === "" ? "true" : "false"}>
      <label className="block text-[11px] leading-tight text-muted-foreground" htmlFor={testId}>
        {label}
      </label>
      <input
        id={testId}
        data-testid={testId}
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        value={value}
        disabled={disabled}
        aria-invalid={invalid}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onCommit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        className="mt-1 h-7 w-full max-w-[8rem] rounded-md border border-[hsl(215_16%_76%)] bg-transparent px-2 text-[13px] tabular-nums outline-none focus:border-[hsl(var(--tilo))] disabled:opacity-60"
      />
    </div>
  );
}
