"use client";

import { createContext, useContext, useEffect, useRef, useState, useTransition, type MutableRefObject } from "react";
import Image from "next/image";
import {
  DndContext,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Link, useRouter } from "@/i18n/navigation";
import { googleMapsSearchUrl } from "@/lib/sales/maps-link";
import {
  BOARD_TITLE,
  PLANNING_CREW,
  addDays,
  formatDayParts,
  formatWeekTitle,
  mondayOf,
  planningCrewById,
  weekdayIndex,
  type PlanningBoardView,
  type PlanningJobView,
  type PlanningLinkHit,
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

const SuppressClick = createContext<MutableRefObject<boolean>>({ current: false });

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

export function PlanningCalendar({ data }: { data: PlanningBoardView }) {
  const router = useRouter();
  const suppressClick = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const title = BOARD_TITLE[data.board];
  const unscheduled = data.jobs.filter((job) => job.days.length === 0);

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
          router.push(`/planning/${data.board}?week=${week}`);
          return;
        }
      }
      router.refresh();
    });
  }

  function onDragEnd(event: DragEndEvent) {
    const activeType = event.active.data.current?.type;
    const over = event.over?.data.current;
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

  return (
    <DndContext
      id={`planning-${data.board}`}
      sensors={sensors}
      collisionDetection={preferTarget}
      onDragStart={() => {
        suppressClick.current = true;
      }}
      onDragCancel={() => {
        suppressClick.current = false;
      }}
      onDragEnd={onDragEnd}
    >
      <SuppressClick.Provider value={suppressClick}>
        <div className="flex flex-col gap-3" data-testid="planning-board" data-board={data.board} aria-busy={pending}>
          <header className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <span aria-hidden className="h-4 w-[3px] rounded-full bg-[#008080]" />
              {title}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <WeekLink board={data.board} week={addDays(data.weekStart, -7)}>Vorige</WeekLink>
              <span className="min-w-36 text-center font-medium tabular-nums" data-testid="planning-week">
                {formatWeekTitle(data.weekStart)}
              </span>
              <WeekLink board={data.board} week={addDays(data.weekStart, 7)}>Volgende</WeekLink>
              <WeekLink board={data.board} week={mondayOf(data.today)}>Deze week</WeekLink>
            </div>
          </header>
          {error && (
            <p className="rounded-md border border-destructive/40 bg-white px-3 py-2 text-[13px] text-destructive" role="alert">
              {error}
            </p>
          )}
          <div className="flex min-h-[32rem] flex-col gap-3 lg:flex-row">
            <UnscheduledList board={data.board} jobs={unscheduled} onDelete={(jobId) => run(() => deletePlanningItemAction(jobId))} />
            <section className="tilo-frame min-w-0 flex-1 overflow-x-auto" aria-label={title}>
              <div className="grid min-w-[760px] grid-cols-7">
                {data.days.map((day) => (
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
            </section>
          </div>
          {data.board === "buitendienst" && <CrewStrip />}
        </div>
      </SuppressClick.Provider>
    </DndContext>
  );
}

function WeekLink({ board, week, children }: { board: PlanningBoardView["board"]; week: string; children: string }) {
  return (
    <Link
      href={`/planning/${board}?week=${week}`}
      className="rounded-md border border-[hsl(215_16%_76%)] bg-white px-2.5 py-1 hover:border-[#008080]"
    >
      {children}
    </Link>
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
      className={cn("tilo-frame flex w-full shrink-0 flex-col lg:w-80", isOver && "outline outline-2 outline-[#008080]")}
      data-testid="planning-unscheduled"
    >
      <h2 className="border-b border-[hsl(215_14%_84%)] px-3 py-2 text-[13px] font-semibold">Nog te plannen</h2>
      {board === "binnendienst" && <HandItemForm />}
      <div className="flex flex-1 flex-col gap-2 p-2">
        {jobs.length === 0 && <p className="px-1 py-6 text-center text-[13px] text-muted-foreground">Niets te plannen.</p>}
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} onDelete={onDelete} />
        ))}
      </div>
    </aside>
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
      className="space-y-2 border-b border-[hsl(215_14%_84%)] px-3 py-2"
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
        className="h-8 w-full rounded-md border border-[hsl(215_16%_76%)] bg-white px-2 text-[13px] outline-none focus:border-[#008080]"
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
          className="h-8 w-full rounded-md border border-[hsl(215_16%_76%)] bg-white px-2 text-[13px] outline-none focus:border-[#008080]"
        />
        {open && hits.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-52 w-full overflow-auto rounded-md border border-[hsl(215_16%_76%)] bg-white py-1 shadow-sm">
            {hits.map((hit) => (
              <li key={`${hit.kind}:${hit.id}`}>
                <button
                  type="button"
                  className="block w-full px-2 py-1 text-left text-[12px] hover:bg-[hsl(183_42%_96%)]"
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
  const parts = formatDayParts(day);
  const weekend = weekdayIndex(day) === 0 || weekdayIndex(day) === 6;
  const isToday = day === today;
  return (
    <div
      ref={setNodeRef}
      data-testid={`planning-day-${day}`}
      className={cn(
        "flex min-h-[28rem] flex-col border-r border-[hsl(215_14%_84%)] last:border-r-0",
        weekend && "bg-[hsl(210_20%_98%)]",
        isOver && "bg-[hsl(183_42%_96%)]",
      )}
    >
      <div className={cn("border-b border-[hsl(215_14%_84%)] px-1 py-2 text-center", isToday && "bg-[hsl(183_42%_96%)]")}>
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{parts.weekday}</div>
        <div
          className={cn(
            "mx-auto mt-0.5 flex size-7 items-center justify-center rounded-full text-[13px] font-semibold",
            isToday ? "bg-[#008080] text-white" : "text-foreground",
          )}
        >
          {parts.day}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-1">
        {jobs.map((job) => (
          <JobCard
            key={`${job.id}:${day}`}
            job={job}
            day={day}
            assignments={assignments.filter((item) => item.jobId === job.id && item.day === day)}
            onRemoveCrew={onRemoveCrew}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}

function JobCard({
  job,
  day,
  assignments = [],
  onRemoveCrew,
  onDelete,
}: {
  job: PlanningJobView;
  day?: string;
  assignments?: PlanningBoardView["assignments"];
  onRemoveCrew?: (id: string) => void;
  onDelete?: (jobId: string) => void;
}) {
  const drag = useDraggable({
    id: day ? `drag:${job.id}:${day}` : `drag:${job.id}`,
    data: { type: "job", jobId: job.id },
  });
  const drop = useDroppable({
    id: day ? `slot:${job.id}:${day}` : `slot:${job.id}:list`,
    disabled: !day,
    data: { type: "slot", jobId: job.id, day },
  });
  const crewOver = Boolean(day && drop.isOver);
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
      className={cn("rounded-md border px-2 py-1.5 text-[12px] leading-snug shadow-none", drag.isDragging && "opacity-40", crewOver && "ring-2 ring-[#008080]")}
      style={{ background: job.color.background, borderColor: job.color.border, color: job.color.color }}
    >
      <JobBody job={job} />
      {job.kind === "manual" && onDelete && (
        <button
          type="button"
          className="mt-1 underline"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onDelete(job.id)}
        >
          Verwijder
        </button>
      )}
      {assignments.length > 0 && (
        <ul className="mt-1 flex flex-col gap-1">
          {assignments.map((item) => {
            const person = planningCrewById(item.resource);
            if (!person) return null;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  data-testid={`planning-assignment-${item.id}`}
                  className="inline-flex max-w-full items-center gap-1 rounded-full bg-white/80 px-1 py-0.5 text-left text-[10px] text-[#243038]"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => onRemoveCrew?.(item.id)}
                  aria-label={`Haal ${person.name} van deze dag`}
                >
                  <Image
                    src={person.image}
                    alt=""
                    width={16}
                    height={16}
                    draggable={false}
                    unoptimized={person.kind === "truck"}
                    className={cn("size-4 shrink-0", person.kind === "truck" ? "rounded-sm object-contain" : "rounded-full object-cover")}
                  />
                  <span className="truncate">{person.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}

function JobBody({ job }: { job: PlanningJobView }) {
  const suppressClick = useContext(SuppressClick);
  return (
    <div className="min-w-0">
      {job.projectId && job.projectNumber && (
        <Link
          href={`/projectleiding/projecten/${job.projectId}`}
          data-testid={`planning-project-${job.id}`}
          draggable={false}
          className="font-semibold underline decoration-[#008080] underline-offset-2"
          onClick={(event) => {
            if (suppressClick.current) event.preventDefault();
          }}
        >
          {job.projectNumber}
        </Link>
      )}
      {job.kind === "chassis" && <div>Chassis · {job.workDays} werkdagen</div>}
      {job.kind === "glass" && <div>Glas · {job.workDays} werkdagen</div>}
      {job.text && <div className="break-words">{job.text}</div>}
      {job.customer && <div className="truncate">{job.customer}</div>}
      {job.address && <MapsAddress address={job.address} testId={`planning-address-${job.id}`} />}
    </div>
  );
}

function MapsAddress({ address, testId }: { address: string; testId: string }) {
  const href = googleMapsSearchUrl(address);
  const suppressClick = useContext(SuppressClick);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      draggable={false}
      data-testid={testId}
      className="mt-0.5 block break-words underline decoration-[#008080] underline-offset-2"
      onClick={(event) => {
        if (suppressClick.current) event.preventDefault();
      }}
    >
      {address}
    </a>
  );
}

function CrewStrip() {
  return (
    <section className="tilo-frame p-3" data-testid="planning-crew">
      <h2 className="text-[13px] font-semibold">Ploeg</h2>
      <p className="mb-3 text-[12px] text-muted-foreground">
        Tijdelijke gezichten tot de echte plaatsers er zijn. Sleep iemand of een vrachtwagen op een job voor die dag.
      </p>
      <div className="flex gap-3 overflow-x-auto pb-1">
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
      className={cn("w-[4.75rem] shrink-0 cursor-grab text-center", isDragging && "opacity-40")}
    >
      <Image
        src={person.image}
        alt=""
        width={64}
        height={64}
        draggable={false}
        unoptimized={person.kind === "truck"}
        className={cn(
          "mx-auto size-16 bg-[#f6f3ea] ring-1 ring-black/10",
          person.kind === "truck" ? "rounded-lg object-contain" : "rounded-full object-cover",
        )}
      />
      <div className="mt-1 text-[11px] leading-tight">{person.name}</div>
    </div>
  );
}
