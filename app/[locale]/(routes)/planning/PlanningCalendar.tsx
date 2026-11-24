"use client";

import { createContext, useContext, useEffect, useRef, useState, useTransition, type MutableRefObject, type PointerEvent as ReactPointerEvent } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Link, useRouter } from "@/i18n/navigation";
import { CrewPortrait } from "./crew-portraits";
import { googleMapsSearchUrl } from "@/lib/sales/maps-link";
import {
  BOARD_TITLE,
  PLANNING_CREW,
  PLANNING_GRID_END,
  PLANNING_GRID_START,
  addDays,
  addMonths,
  firstMondayOfMonth,
  firstOfMonth,
  formatDayLong,
  formatDayParts,
  formatMonthTitle,
  formatOutlookDayTitle,
  formatPlanningClock,
  formatWeekTitle,
  formatWorkWeekTitle,
  layoutOverlapLanes,
  mondayOf,
  monthGridDays,
  planningBlockTitle,
  planningCrewById,
  planningDisplaySpan,
  planningPlace,
  weekdayIndex,
  workWeekDays,
  type PlanningBoardView,
  type PlanningJobView,
  type PlanningLinkHit,
  type PlanningView,
} from "@/lib/sales/planning";
import {
  assignPlanningCrewAction,
  createPlanningItemAction,
  deletePlanningItemAction,
  placePlanningJobAction,
  removePlanningCrewAction,
  searchPlanningLinksAction,
} from "@/actions/crm/planning/actions";
import { cn } from "@/lib/utils";
import { PlanningGoogleStatus } from "./PlanningGoogleStatus";

const SuppressClick = createContext<MutableRefObject<boolean>>({ current: false });

const HEADER_PX = 52;
const ALLDAY_PX = 32;
const CHROME_PX = HEADER_PX + ALLDAY_PX;
const GRID_MINUTES = PLANNING_GRID_END - PLANNING_GRID_START;

function minutesTopPercent(minutes: number): string {
  return `${((minutes - PLANNING_GRID_START) / GRID_MINUTES) * 100}%`;
}

const preferTarget: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  const type = args.active.data.current?.type;
  if (type === "crew") {
    return hits.filter((hit) => hit.data?.droppableContainer.data.current?.type === "slot");
  }
  if (type === "job") {
    return hits.filter((hit) => {
      const target = hit.data?.droppableContainer.data.current?.type;
      return target === "day" || target === "list";
    });
  }
  return hits;
};

function holdClick(event: ReactPointerEvent) {
  event.stopPropagation();
}

export function PlanningCalendar({ data }: { data: PlanningBoardView }) {
  const router = useRouter();
  const suppressClick = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [dragCrewId, setDragCrewId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const view = data.view;
  const [focusDay, setFocusDay] = useState(() => (data.days.includes(data.today) ? data.today : data.weekStart));
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const title = BOARD_TITLE[data.board];
  const unscheduled = data.jobs.filter((job) => job.days.length === 0);
  const shownDay = data.days.includes(focusDay) ? focusDay : data.days.includes(data.today) ? data.today : data.weekStart;
  const shownDays = view === "day" ? [shownDay] : view === "workweek" ? workWeekDays(data.weekStart) : data.days;
  const range = view === "day"
    ? formatOutlookDayTitle(shownDay)
    : view === "workweek"
      ? formatWorkWeekTitle(data.weekStart)
      : view === "month"
        ? formatMonthTitle(data.weekStart)
        : formatWeekTitle(data.weekStart);

  function href(week: string, nextView: PlanningView = view) {
    const params = new URLSearchParams();
    params.set("week", week);
    if (nextView !== "week") params.set("view", nextView);
    return `/planning/${data.board}?${params.toString()}`;
  }

  function showView(next: PlanningView) {
    if (next === view) return;
    router.push(href(data.weekStart, next));
  }

  function run(work: () => Promise<{ error?: string; start?: string | null } | { error: string } | { ok: true } | void>) {
    startTransition(async () => {
      const result = await work();
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      const start = result && "start" in result ? result.start : null;
      if (start) {
        const week = mondayOf(start);
        if (week !== data.weekStart) {
          router.push(href(week, view));
          return;
        }
      }
      router.refresh();
    });
  }

  function onDragStart(event: DragStartEvent) {
    suppressClick.current = true;
    const current = event.active.data.current;
    setDragCrewId(current?.type === "crew" && typeof current.resource === "string" ? current.resource : null);
  }

  function onDragEnd(event: DragEndEvent) {
    const activeType = event.active.data.current?.type;
    const over = event.over?.data.current;
    setDragCrewId(null);
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 0);
    if (!over) return;
    if (activeType === "job" && typeof event.active.data.current?.jobId === "string") {
      const jobId = event.active.data.current.jobId;
      if (over.type === "list") run(() => placePlanningJobAction(jobId, null));
      if (over.type === "day" && typeof over.day === "string") run(() => placePlanningJobAction(jobId, over.day));
    }
    if (activeType === "crew" && over.type === "slot" && typeof over.day === "string" && typeof over.jobId === "string") {
      const resource = event.active.data.current?.resource;
      if (typeof resource === "string") {
        run(() => assignPlanningCrewAction({ resource, jobId: over.jobId, day: over.day }));
      }
    }
  }

  function goToday() {
    setFocusDay(data.today);
    const week = mondayOf(data.today);
    if (week !== data.weekStart) router.push(href(week, view));
  }

  function shift(direction: -1 | 1) {
    if (view === "month") {
      const next = addMonths(firstOfMonth(data.weekStart), direction);
      router.push(href(firstMondayOfMonth(next), "month"));
      return;
    }
    if (view === "day") {
      const next = addDays(shownDay, direction);
      setFocusDay(next);
      const week = mondayOf(next);
      if (week !== data.weekStart) router.push(href(week, "day"));
      return;
    }
    router.push(href(addDays(data.weekStart, direction * 7), view));
  }

  return (
    <DndContext
      id={`planning-${data.board}`}
      sensors={sensors}
      collisionDetection={preferTarget}
      onDragStart={onDragStart}
      onDragCancel={() => {
        suppressClick.current = false;
        setDragCrewId(null);
      }}
      onDragEnd={onDragEnd}
    >
      <SuppressClick.Provider value={suppressClick}>
        <div
          className="flex h-[calc(100dvh-10rem)] max-h-[calc(100dvh-10rem)] min-h-0 flex-col gap-2"
          data-testid="planning-board"
          data-board={data.board}
          data-view={view}
          aria-busy={pending}
        >
          <header className="flex shrink-0 flex-col gap-2">
            <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <span aria-hidden className="h-4 w-[3px] rounded-full bg-[#008080]" />
              {title}
            </h1>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={goToday}
                className="h-8 rounded border border-[hsl(214_16%_76%)] bg-white px-3 text-[13px] hover:bg-[hsl(210_16%_96%)] dark:border-[hsl(210_8%_30%)] dark:bg-[hsl(210_8%_14%)] dark:hover:bg-[hsl(210_8%_18%)]"
              >
                Vandaag
              </button>
              <button
                type="button"
                aria-label="Vorige"
                onClick={() => shift(-1)}
                className="grid size-8 place-items-center rounded border border-[hsl(214_16%_76%)] bg-white hover:bg-[hsl(210_16%_96%)] dark:border-[hsl(210_8%_30%)] dark:bg-[hsl(210_8%_14%)] dark:hover:bg-[hsl(210_8%_18%)]"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Volgende"
                onClick={() => shift(1)}
                className="grid size-8 place-items-center rounded border border-[hsl(214_16%_76%)] bg-white hover:bg-[hsl(210_16%_96%)] dark:border-[hsl(210_8%_30%)] dark:bg-[hsl(210_8%_14%)] dark:hover:bg-[hsl(210_8%_18%)]"
              >
                <ChevronRight className="size-4" />
              </button>
              <span className="px-2 text-[18px] font-semibold tracking-tight" data-testid="planning-week">
                {range}
              </span>
              <div className="ml-auto flex items-center overflow-hidden rounded border border-[hsl(214_16%_76%)] bg-white text-[13px] dark:border-[hsl(210_8%_30%)] dark:bg-[hsl(210_8%_14%)]">
                <CalendarDays className="ml-2 size-4 text-muted-foreground" aria-hidden />
                <ViewButton current={view} id="day" label="Dag" onShow={showView} />
                <ViewButton current={view} id="workweek" label="Werkweek" onShow={showView} testId="planning-view-workweek" />
                <ViewButton current={view} id="week" label="Week" onShow={showView} testId="planning-view-week" />
                <ViewButton current={view} id="month" label="Maand" onShow={showView} testId="planning-view-month" />
              </div>
            </div>
          </header>
          {error && (
            <p className="shrink-0 rounded-md border border-destructive/40 bg-background px-3 py-2 text-[13px] text-destructive" role="alert">
              {error}
            </p>
          )}
          {data.google.ready ? <PlanningGoogleStatus google={data.google} /> : null}
          <div className="flex min-h-0 flex-1 flex-col gap-2 md:flex-row">
            <div className="flex max-h-[38%] min-h-0 w-full shrink-0 flex-col gap-2 md:max-h-none md:w-64">
              <UnscheduledList board={data.board} jobs={unscheduled} onDelete={(jobId) => run(() => deletePlanningItemAction(jobId))} />
              {data.board === "buitendienst" && <CrewStrip />}
            </div>
            <section
              className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-sm border border-[hsl(214_16%_78%)] bg-white text-foreground dark:border-[hsl(210_8%_28%)] dark:bg-[hsl(210_8%_11%)]"
              aria-label={title}
            >
              {view === "month" ? (
                <MonthGrid
                  anchor={data.weekStart}
                  today={data.today}
                  jobs={data.jobs}
                  assignments={data.assignments}
                  onDelete={(jobId) => run(() => deletePlanningItemAction(jobId))}
                />
              ) : (
                <div className="min-h-0 flex-1 overflow-hidden" data-testid="planning-scroll">
                  <div
                    className="grid h-full w-full"
                    style={{
                      gridTemplateColumns: `3.25rem ${shownDays.map(() => "minmax(0, 1fr)").join(" ")}`,
                    }}
                  >
                    <TimeGutter />
                    {shownDays.map((day) => (
                      <DayColumn
                        key={day}
                        day={day}
                        today={data.today}
                        jobs={data.jobs.filter((job) => job.days.includes(day))}
                        assignments={data.assignments}
                        onRemoveCrew={(id) => run(() => removePlanningCrewAction(id))}
                        onDelete={(jobId) => run(() => deletePlanningItemAction(jobId))}
                      />
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
        <DragOverlay dropAnimation={null}>
          {dragCrewId && planningCrewById(dragCrewId) ? (
            <CrewDragPreview person={planningCrewById(dragCrewId)!} />
          ) : null}
        </DragOverlay>
      </SuppressClick.Provider>
    </DndContext>
  );
}

function ViewButton({
  current,
  id,
  label,
  onShow,
  testId,
}: {
  current: PlanningView;
  id: PlanningView;
  label: string;
  onShow: (view: PlanningView) => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={current === id}
      data-testid={testId}
      onClick={() => onShow(id)}
      className={cn(
        "border-l border-[hsl(214_16%_76%)] px-2.5 py-1.5 first:border-l-0 dark:border-[hsl(210_8%_30%)]",
        current === id && "bg-[hsl(210_16%_93%)] font-semibold dark:bg-white/10",
      )}
    >
      {label}
    </button>
  );
}

function MonthGrid({
  anchor,
  today,
  jobs,
  assignments,
  onDelete,
}: {
  anchor: string;
  today: string;
  jobs: PlanningJobView[];
  assignments: PlanningBoardView["assignments"];
  onDelete: (jobId: string) => void;
}) {
  const days = monthGridDays(anchor);
  const month = anchor.slice(0, 7);
  const weeks = days.length / 7;
  const headers = weekHeader(days);
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col" data-testid="planning-month">
      <div className="grid shrink-0 grid-cols-7 border-b border-[hsl(214_18%_84%)] dark:border-[hsl(210_8%_28%)]">
        {headers.map((label) => (
          <div key={label} className="px-1 py-1 text-[12px] text-muted-foreground">
            {label}
          </div>
        ))}
      </div>
      <div
        className="grid min-h-0 flex-1 grid-cols-7"
        style={{ gridTemplateRows: `repeat(${weeks}, minmax(0, 1fr))` }}
      >
        {days.map((day) => (
          <MonthCell
            key={day}
            day={day}
            today={today}
            outside={day.slice(0, 7) !== month}
            jobs={jobs.filter((job) => job.days.includes(day))}
            assignments={assignments}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}

function weekHeader(days: string[]): string[] {
  return days.slice(0, 7).map((day) => formatDayParts(day).weekday);
}

function MonthCell({
  day,
  today,
  outside,
  jobs,
  assignments,
  onDelete,
}: {
  day: string;
  today: string;
  outside: boolean;
  jobs: PlanningJobView[];
  assignments: PlanningBoardView["assignments"];
  onDelete: (jobId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${day}`, data: { type: "day", day } });
  const weekend = weekdayIndex(day) === 0 || weekdayIndex(day) === 6;
  const isToday = day === today;
  return (
    <div
      ref={setNodeRef}
      data-testid={`planning-day-${day}`}
      data-today={isToday ? "true" : "false"}
      data-outside={outside ? "true" : "false"}
      className={cn(
        "flex min-h-0 flex-col gap-0.5 overflow-hidden border-b border-l border-[hsl(214_18%_84%)] p-0.5 dark:border-[hsl(210_8%_28%)]",
        weekend || outside ? "bg-[hsl(210_16%_94%)] dark:bg-[hsl(210_8%_15%)]" : "bg-white dark:bg-[hsl(210_8%_11%)]",
        isOver && "bg-[hsl(183_42%_96%)] dark:bg-[hsl(183_20%_16%)]",
      )}
    >
      <div
        className={cn(
          "flex size-5 shrink-0 items-center justify-center text-[11px] leading-none",
          isToday && "rounded-full bg-[#107c10] font-semibold text-white",
          !isToday && outside && "text-muted-foreground",
        )}
      >
        {formatDayLong(day).day}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {jobs.map((job) => (
          <MonthChip
            key={job.id}
            job={job}
            day={day}
            assignments={assignments.filter((item) => item.jobId === job.id && item.day === day)}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}

function MonthChip({
  job,
  day,
  assignments,
  onDelete,
}: {
  job: PlanningJobView;
  day: string;
  assignments: PlanningBoardView["assignments"];
  onDelete: (jobId: string) => void;
}) {
  const drag = useDraggable({
    id: `drag:${job.id}:${day}`,
    data: { type: "job", jobId: job.id },
  });
  const drop = useDroppable({
    id: `slot:${job.id}:${day}`,
    data: { type: "slot", jobId: job.id, day },
  });
  const suppressClick = useContext(SuppressClick);
  const label = job.projectNumber ?? planningBlockTitle(job.kind, job.workDays, job.text);
  const names = assignments.flatMap((item) => {
    const person = planningCrewById(item.resource);
    return person ? [person.name] : [];
  });
  const caption = [planningBlockTitle(job.kind, job.workDays, job.text), ...names].filter(Boolean).join(" · ");
  return (
    <article
      ref={(node) => {
        drag.setNodeRef(node);
        drop.setNodeRef(node);
      }}
      {...drag.listeners}
      {...drag.attributes}
      title={caption}
      data-testid={`planning-job-${job.id}`}
      data-kind={job.kind}
      data-color={job.color.id}
      className={cn(
        "truncate rounded-[2px] border border-l-[3px] px-1 text-[10px] leading-4",
        drag.isDragging && "opacity-40",
        drop.isOver && "ring-2 ring-[#008080]",
      )}
      style={{ background: job.color.background, borderColor: job.color.border, color: job.color.color }}
    >
      {job.projectId && job.projectNumber ? (
        <Link
          href={`/projectleiding/projecten/${job.projectId}`}
          draggable={false}
          className="font-semibold underline decoration-current underline-offset-2"
          onPointerDown={holdClick}
          onClick={(event) => {
            if (suppressClick.current) event.preventDefault();
          }}
        >
          {label}
        </Link>
      ) : (
        <span>{label}</span>
      )}
      {job.kind === "manual" && (
        <button type="button" className="ml-1 underline" onPointerDown={holdClick} onClick={() => onDelete(job.id)}>
          Verwijder
        </button>
      )}
    </article>
  );
}

function TimeGutter() {
  const hours: number[] = [];
  for (let hour = PLANNING_GRID_START / 60; hour <= PLANNING_GRID_END / 60; hour += 1) hours.push(hour);
  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="planning-time">
      <div
        className="shrink-0 border-b border-[hsl(214_18%_84%)] bg-white dark:border-[hsl(210_8%_28%)] dark:bg-[hsl(210_8%_11%)]"
        style={{ height: CHROME_PX }}
      />
      <div className="relative min-h-0 flex-1 border-b border-[hsl(214_18%_84%)] dark:border-[hsl(210_8%_28%)]">
        {hours.map((hour) => {
          const atEnd = hour === PLANNING_GRID_END / 60;
          return (
            <div
              key={hour}
              className="absolute right-1 text-[11px] leading-none text-muted-foreground"
              style={{
                top: minutesTopPercent(hour * 60),
                transform: atEnd ? "translateY(-100%)" : "translateY(-50%)",
              }}
            >
              {formatPlanningClock(hour * 60)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayColumn({
  day,
  today,
  jobs,
  assignments,
  onRemoveCrew,
  onDelete,
}: {
  day: string;
  today: string;
  jobs: PlanningJobView[];
  assignments: PlanningBoardView["assignments"];
  onRemoveCrew: (id: string) => void;
  onDelete: (jobId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${day}`, data: { type: "day", day } });
  const parts = formatDayLong(day);
  const weekend = weekdayIndex(day) === 0 || weekdayIndex(day) === 6;
  const isToday = day === today;
  const allDay = jobs.filter((job) => planningDisplaySpan(job).allDay);
  const timed = jobs.filter((job) => !planningDisplaySpan(job).allDay);
  const lanes = new Map(
    layoutOverlapLanes(
      timed.map((job) => {
        const span = planningDisplaySpan(job);
        return { id: job.id, start: span.start, end: span.end };
      }),
    ).map((lane) => [lane.id, lane]),
  );
  const paper = weekend
    ? "bg-[hsl(210_16%_94%)] dark:bg-[hsl(210_8%_15%)]"
    : "bg-white dark:bg-[hsl(210_8%_11%)]";

  return (
    <div
      ref={setNodeRef}
      data-testid={`planning-day-${day}`}
      data-today={isToday ? "true" : "false"}
      className={cn(
        "relative flex h-full min-h-0 flex-col border-l border-[hsl(214_18%_84%)] dark:border-[hsl(210_8%_28%)]",
        paper,
        isOver && "bg-[hsl(183_42%_96%)] dark:bg-[hsl(183_20%_16%)]",
      )}
    >
      {isToday && <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 z-30 w-[3px] bg-[#107c10]" />}
      <div className={cn("shrink-0 border-b border-[hsl(214_18%_84%)] dark:border-[hsl(210_8%_28%)]", paper)}>
        <div className="flex flex-col justify-center px-2" style={{ height: HEADER_PX }}>
          <div className={cn("text-[12px] leading-none", isToday ? "font-semibold text-[#107c10]" : "text-muted-foreground")}>
            {parts.weekday}
          </div>
          <div
            className={cn(
              "mt-1 flex size-7 items-center justify-center self-start text-[18px] leading-none",
              isToday ? "rounded-full bg-[#107c10] font-semibold text-white" : "font-medium",
            )}
          >
            {parts.day}
          </div>
        </div>
        <div
          className="flex items-center gap-1 overflow-hidden border-t border-[hsl(214_18%_90%)] px-1 dark:border-[hsl(210_8%_22%)]"
          style={{ height: ALLDAY_PX }}
          data-testid={`planning-allday-${day}`}
        >
          {allDay.map((job) => (
            <span
              key={job.id}
              className="max-w-full truncate rounded-[2px] border px-1 text-[11px] leading-5"
              style={{ background: job.color.background, borderColor: job.color.border, color: job.color.color }}
            >
              {planningBlockTitle(job.kind, job.workDays, job.text)}
            </span>
          ))}
        </div>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden border-b border-[hsl(214_18%_84%)] dark:border-[hsl(210_8%_28%)]">
        <HourLines />
        {timed.map((job) => (
          <TimeBlock
            key={job.id}
            job={job}
            day={day}
            lane={lanes.get(job.id) ?? { column: 0, columns: 1 }}
            assignments={assignments.filter((item) => item.jobId === job.id && item.day === day)}
            onRemoveCrew={onRemoveCrew}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}

function HourLines() {
  const lines = [];
  const first = PLANNING_GRID_START / 60;
  const last = PLANNING_GRID_END / 60;
  for (let hour = first; hour < last; hour += 1) {
    const hourTop = minutesTopPercent(hour * 60);
    if (hour > first) {
      lines.push(
        <div
          key={`h-${hour}`}
          className="pointer-events-none absolute inset-x-0 border-t border-[hsl(214_18%_84%)] dark:border-[hsl(210_8%_28%)]"
          style={{ top: hourTop }}
        />,
      );
    }
    lines.push(
      <div
        key={`m-${hour}`}
        className="pointer-events-none absolute inset-x-0 border-t border-[hsl(214_20%_92%)] dark:border-[hsl(210_8%_18%)]"
        style={{ top: minutesTopPercent(hour * 60 + 30) }}
      />,
    );
  }
  return <>{lines}</>;
}

function TimeBlock({
  job,
  day,
  lane,
  assignments,
  onRemoveCrew,
  onDelete,
}: {
  job: PlanningJobView;
  day: string;
  lane: { column: number; columns: number };
  assignments: PlanningBoardView["assignments"];
  onRemoveCrew: (id: string) => void;
  onDelete: (jobId: string) => void;
}) {
  const span = planningDisplaySpan(job);
  const drag = useDraggable({
    id: `drag:${job.id}:${day}`,
    data: { type: "job", jobId: job.id },
  });
  const drop = useDroppable({
    id: `slot:${job.id}:${day}`,
    data: { type: "slot", jobId: job.id, day },
  });
  const spanMinutes = PLANNING_GRID_END - PLANNING_GRID_START;
  const top = ((span.start - PLANNING_GRID_START) / spanMinutes) * 100;
  const height = ((span.end - span.start) / spanMinutes) * 100;
  return (
    <article
      ref={(node) => {
        drag.setNodeRef(node);
        drop.setNodeRef(node);
      }}
      {...drag.listeners}
      {...drag.attributes}
      role="group"
      data-testid={`planning-job-${job.id}`}
      data-kind={job.kind}
      data-color={job.color.id}
      data-lane={lane.column}
      data-lanes={lane.columns}
      className={cn(
        "absolute z-10 flex cursor-grab flex-col overflow-visible rounded-[2px] border border-l-[3px] px-1 py-0.5 text-[11px] leading-[1.2]",
        drag.isDragging && "opacity-40",
        drop.isOver && "ring-2 ring-[#008080]",
      )}
      style={{
        top: `${top}%`,
        height: `${height}%`,
        left: `calc(${(lane.column / lane.columns) * 100}% + 1px)`,
        width: `calc(${100 / lane.columns}% - 3px)`,
        background: job.color.background,
        borderColor: job.color.border,
        color: job.color.color,
      }}
    >
      <BlockText job={job} wrap onDelete={onDelete} />
      <CrewInBlock assignments={assignments} onRemoveCrew={onRemoveCrew} />
    </article>
  );
}

function BlockText({
  job,
  wrap = false,
  onDelete,
}: {
  job: PlanningJobView;
  wrap?: boolean;
  onDelete?: (jobId: string) => void;
}) {
  const place = planningPlace(job.place, job.address);
  const maps = googleMapsSearchUrl(job.address || place);
  const title = planningBlockTitle(job.kind, job.workDays, job.text);
  const suppressClick = useContext(SuppressClick);
  const clip = wrap ? "whitespace-normal break-normal" : "truncate";
  return (
    <div className="min-w-0">
      {job.projectId && job.projectNumber && (
        <Link
          href={`/projectleiding/projecten/${job.projectId}`}
          data-testid={`planning-project-${job.id}`}
          draggable={false}
          className={cn("block font-semibold underline decoration-current underline-offset-2", clip)}
          onPointerDown={holdClick}
          onClick={(event) => {
            if (suppressClick.current) event.preventDefault();
          }}
        >
          {job.projectNumber}
        </Link>
      )}
      {job.customer && <div className={clip}>{job.customer}</div>}
      {place && (maps ? (
        <MapsAnchor href={maps} testId={`planning-address-${job.id}`} className={cn("block", clip)}>
          {place}
        </MapsAnchor>
      ) : (
        <div className={clip}>{place}</div>
      ))}
      <div className={clip}>{title}</div>
      {job.kind === "manual" && onDelete && (
        <button
          type="button"
          className="mt-0.5 underline"
          onPointerDown={holdClick}
          onClick={() => onDelete(job.id)}
        >
          Verwijder
        </button>
      )}
    </div>
  );
}

function MapsAnchor({
  href,
  testId,
  className,
  children,
}: {
  href: string;
  testId: string;
  className?: string;
  children: string;
}) {
  const suppressClick = useContext(SuppressClick);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      draggable={false}
      data-testid={testId}
      className={cn("underline decoration-current underline-offset-2", className)}
      onPointerDown={holdClick}
      onClick={(event) => {
        if (suppressClick.current) event.preventDefault();
      }}
    >
      {children}
    </a>
  );
}

function UnscheduledList({
  board,
  jobs,
  onDelete,
}: {
  board: PlanningBoardView["board"];
  jobs: PlanningJobView[];
  onDelete: (jobId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "unscheduled", data: { type: "list" } });
  return (
    <aside
      ref={setNodeRef}
      className={cn(
        "tilo-frame flex min-h-0 w-full flex-1 basis-0 flex-col overflow-hidden",
        isOver && "outline outline-2 outline-[#008080]",
      )}
      data-testid="planning-unscheduled"
    >
      <h2 className="border-b border-[hsl(215_14%_84%)] px-3 py-2 text-[13px] font-semibold dark:border-[hsl(210_8%_26%)]">Nog te plannen</h2>
      {board === "binnendienst" && <HandItemForm />}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
        {jobs.length === 0 && <p className="px-1 py-2 text-[13px] text-muted-foreground">Niets te plannen.</p>}
        {jobs.map((job) => (
          <ListJob key={job.id} job={job} onDelete={onDelete} />
        ))}
      </div>
    </aside>
  );
}

function ListJob({ job, onDelete }: { job: PlanningJobView; onDelete: (jobId: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `drag:${job.id}`,
    data: { type: "job", jobId: job.id },
  });
  return (
    <article
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      role="group"
      data-testid={`planning-job-${job.id}`}
      data-kind={job.kind}
      data-color={job.color.id}
      className={cn("w-full cursor-grab rounded-[2px] border border-l-[3px] px-2 py-1.5 text-[12px] leading-snug", isDragging && "opacity-40")}
      style={{ background: job.color.background, borderColor: job.color.border, color: job.color.color }}
    >
      <BlockText job={job} />
      {job.kind === "manual" && (
        <button type="button" className="mt-1 underline" onPointerDown={holdClick} onClick={() => onDelete(job.id)}>
          Verwijder
        </button>
      )}
    </article>
  );
}

function HandItemForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PlanningLinkHit[]>([]);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<PlanningLinkHit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    let cancel = false;
    const timer = window.setTimeout(() => {
      searchPlanningLinksAction(query).then((next) => {
        if (!cancel) setHits(next);
      }).catch(() => {
        if (!cancel) setHits([]);
      });
    }, 200);
    return () => {
      cancel = true;
      window.clearTimeout(timer);
    };
  }, [open, query]);

  function add() {
    startTransition(async () => {
      const result = await createPlanningItemAction({
        text,
        projectId: picked?.kind === "project" ? picked.id : null,
        quoteId: picked?.kind === "quote" ? picked.id : null,
      });
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setText("");
      setPicked(null);
      setQuery("");
      setHits([]);
      router.refresh();
    });
  }

  return (
    <form
      className="space-y-2 border-b border-[hsl(215_14%_84%)] px-3 py-2 dark:border-[hsl(210_8%_26%)]"
      data-testid="planning-add"
      onSubmit={(event) => {
        event.preventDefault();
        add();
      }}
    >
      <label className="block text-[11px] text-muted-foreground" htmlFor="planning-hand-text">
        Zelf toevoegen
      </label>
      <input
        id="planning-hand-text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Vrije tekst"
        className="h-8 w-full rounded-md border border-[hsl(215_16%_76%)] bg-background px-2 text-[13px] outline-none focus:border-[#008080] dark:border-[hsl(210_8%_30%)]"
      />
      <div className="relative">
        <input
          value={query}
          placeholder="Offerte of project"
          aria-label="Offerte of project"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          className="h-8 w-full rounded-md border border-[hsl(215_16%_76%)] bg-background px-2 text-[13px] outline-none focus:border-[#008080] dark:border-[hsl(210_8%_30%)]"
        />
        {open && hits.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-52 w-full overflow-auto rounded-md border border-[hsl(215_16%_76%)] bg-popover py-1 text-popover-foreground shadow-sm">
            {hits.map((hit) => (
              <li key={`${hit.kind}:${hit.id}`}>
                <button
                  type="button"
                  className="block w-full px-2 py-1 text-left text-[12px] hover:bg-[hsl(183_42%_96%)] dark:hover:bg-white/10"
                  onClick={() => {
                    setPicked(hit);
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  <span className="font-medium">{hit.title}</span>
                  {hit.subtitle && <span className="mt-0.5 block text-muted-foreground">{hit.subtitle}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {picked && (
        <p className="flex items-center justify-between gap-2 text-[12px]">
          <span>{picked.kind === "project" ? "Project" : "Offerte"} {picked.title}</span>
          <button type="button" className="text-muted-foreground underline" onClick={() => setPicked(null)}>
            Weg
          </button>
        </p>
      )}
      {error && <p className="text-[12px] text-destructive" role="alert">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="h-8 rounded-md bg-[#008080] px-3 text-[13px] font-medium text-white disabled:opacity-60"
      >
        Toevoegen
      </button>
    </form>
  );
}

function CrewInBlock({
  assignments,
  onRemoveCrew,
}: {
  assignments: PlanningBoardView["assignments"];
  onRemoveCrew: (id: string) => void;
}) {
  const people = assignments.flatMap((item) => {
    const person = planningCrewById(item.resource);
    return person ? [{ item, person }] : [];
  });
  if (people.length === 0) return null;
  return (
    <div className="mt-0.5 flex shrink-0 flex-wrap gap-1" data-testid="planning-heads">
      {people.map(({ item, person }) => (
        <button
          key={item.id}
          type="button"
          data-testid={`planning-assignment-${item.id}`}
          title={person.name}
          aria-label={`Haal ${person.name} van deze dag`}
          className="flex w-full items-center gap-1 text-left"
          onPointerDown={holdClick}
          onClick={() => onRemoveCrew(item.id)}
        >
          <CrewPortrait person={person} size={40} />
          <span className="min-w-0 flex-1 text-[12px] font-semibold leading-tight">{person.name}</span>
        </button>
      ))}
    </div>
  );
}

function CrewStrip() {
  return (
    <section className="tilo-frame flex min-h-0 flex-1 basis-0 flex-col gap-1.5 overflow-hidden px-2 py-2" data-testid="planning-crew">
      <p className="shrink-0 text-[11px] leading-snug text-muted-foreground">
        Ploeg. Sleep iemand of een vrachtwagen op een job voor die dag.
      </p>
      <div className="grid min-h-0 flex-1 grid-cols-3 content-start gap-1 overflow-y-auto">
        {PLANNING_CREW.map((person) => (
          <CrewToken key={person.id} person={person} />
        ))}
      </div>
    </section>
  );
}

function CrewToken({ person }: { person: (typeof PLANNING_CREW)[number] }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `crew:${person.id}`,
    data: { type: "crew", resource: person.id },
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      role="group"
      data-testid={`planning-crew-${person.id}`}
      className={cn("flex min-w-0 cursor-grab flex-col items-center gap-1 text-center", isDragging && "opacity-40")}
    >
      <CrewPortrait person={person} size={40} />
      <div className="line-clamp-2 w-full text-[10px] leading-tight">{person.name}</div>
    </div>
  );
}

function CrewDragPreview({ person }: { person: (typeof PLANNING_CREW)[number] }) {
  return (
    <div className="flex w-[4.5rem] cursor-grabbing flex-col items-center gap-1 text-center">
      <CrewPortrait person={person} size={72} />
      <div className="line-clamp-2 w-full rounded bg-white/95 px-0.5 text-[10px] leading-tight text-foreground">{person.name}</div>
    </div>
  );
}

