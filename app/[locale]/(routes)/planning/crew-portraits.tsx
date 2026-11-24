import { type CSSProperties, type ReactNode } from "react";
import { CHARLIE_PORTRAIT } from "./charlie-portrait";

type PortraitPerson = { id?: string; name?: string; kind: string };

const frame = (size: number): CSSProperties => ({
  width: size,
  height: size,
  minWidth: size,
  minHeight: size,
  display: "block",
  flexShrink: 0,
});

export function CrewPortrait({ person, size }: { person: PortraitPerson; size: number }) {
  if (person.id === "charlie-chaplin") {
    return (
      <span style={{ ...frame(size), borderRadius: "50%", overflow: "hidden", background: "#111" }}>
        <img
          src={CHARLIE_PORTRAIT}
          alt={person.name ?? "Charlie Chaplin"}
          width={size}
          height={size}
          draggable={false}
          style={{ width: size, height: size, objectFit: "cover", objectPosition: "center 30%", display: "block" }}
        />
      </span>
    );
  }
  if (person.kind === "truck") {
    return <TruckFace size={size} second={person.id === "vrachtwagen-2"} label={person.name ?? "Vrachtwagen"} />;
  }
  return <DrawnFace id={person.id ?? "person"} size={size} label={person.name ?? ""} />;
}

function TruckFace({ size, second, label }: { size: number; second: boolean; label: string }) {
  const body = second ? "#c45c26" : "#0f766e";
  const cargo = second ? "#f3d2b3" : "#d7f3f1";
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={label} style={frame(size)}>
      <rect width="64" height="64" rx="8" fill="#fff" stroke="#243038" strokeWidth="2" />
      <rect x="6" y="22" width="30" height="18" rx="2" fill={cargo} stroke={body} strokeWidth="2" />
      <path d="M36 28h10l8 8v4H36z" fill={body} />
      <rect x="42" y="31" width="6" height="5" fill="#fff" />
      <circle cx="18" cy="46" r="5" fill="#243038" />
      <circle cx="18" cy="46" r="2" fill="#fff" />
      <circle cx="46" cy="46" r="5" fill="#243038" />
      <circle cx="46" cy="46" r="2" fill="#fff" />
    </svg>
  );
}

function DrawnFace({ id, size, label }: { id: string; size: number; label: string }) {
  const face = FACES[id] ?? FACES["albert-einstein"];
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={label} style={frame(size)}>
      <circle cx="32" cy="32" r="31" fill="#f4efe6" stroke="#243038" strokeWidth="1.5" />
      {face}
    </svg>
  );
}

const skin = "#f0c7a4";
const skinDeep = "#c68642";
const skinDark = "#8d5524";

const FACES: Record<string, ReactNode> = {
  "albert-einstein": (
    <>
      <path d="M10 30c2-16 12-24 22-24s20 8 22 24c4 2 6 8 4 14-6-6-10-4-14 2-6 4-18 4-24 0-4-6-8-8-14-2-2-6 0-12 4-14z" fill="#f7f7f7" stroke="#243038" strokeWidth="1.2" />
      <circle cx="32" cy="36" r="14" fill={skin} />
      <path d="M20 40c2 2 6 1 8-1M36 39c2 2 6 3 8 1" stroke="#d7d7d7" strokeWidth="2" fill="none" />
      <ellipse cx="26" cy="36" rx="2" ry="2.2" fill="#243038" />
      <ellipse cx="38" cy="36" rx="2" ry="2.2" fill="#243038" />
      <path d="M24 44h16" stroke="#243038" strokeWidth="1.4" />
      <path d="M22 46c4 3 16 3 20 0" fill="#eee" stroke="#243038" strokeWidth="1" />
    </>
  ),
  "marie-curie": (
    <>
      <circle cx="32" cy="34" r="13" fill={skin} />
      <path d="M18 30c0-14 8-20 14-20s14 6 14 20v6c-4 6-24 6-28 0z" fill="#2b241c" />
      <circle cx="32" cy="14" r="6" fill="#2b241c" />
      <ellipse cx="26" cy="34" rx="1.7" ry="2" fill="#243038" />
      <ellipse cx="38" cy="34" rx="1.7" ry="2" fill="#243038" />
      <path d="M28 40c2 2 6 2 8 0" stroke="#243038" strokeWidth="1.2" fill="none" />
      <path d="M20 48h24l-4 8H24z" fill="#1f4b6e" />
    </>
  ),
  "nelson-mandela": (
    <>
      <circle cx="32" cy="34" r="14" fill={skinDeep} />
      <path d="M18 30c1-12 8-18 14-18s13 6 14 18c-2 2-6 1-8-2-4-2-8-2-12 0-2 3-6 4-8 2z" fill="#9aa0a6" />
      <ellipse cx="26" cy="34" rx="1.8" ry="2" fill="#243038" />
      <ellipse cx="38" cy="34" rx="1.8" ry="2" fill="#243038" />
      <path d="M26 42c4 4 8 4 12 0" stroke="#243038" strokeWidth="1.4" fill="none" />
      <path d="M18 50h28v6H18z" fill="#2f6f4e" />
      <path d="M18 53h28" stroke="#f2d36b" strokeWidth="2" />
    </>
  ),
  "frida-kahlo": (
    <>
      <circle cx="32" cy="36" r="13" fill={skinDeep} />
      <path d="M16 34c2-16 10-22 16-22s14 6 16 22c-6 2-10-2-16-2s-10 4-16 2z" fill="#1a1a1a" />
      <circle cx="16" cy="28" r="4" fill="#d62828" />
      <circle cx="48" cy="30" r="3.5" fill="#f4d35e" />
      <path d="M24 32h16" stroke="#1a1a1a" strokeWidth="2" />
      <ellipse cx="26" cy="36" rx="1.6" ry="1.8" fill="#243038" />
      <ellipse cx="38" cy="36" rx="1.6" ry="1.8" fill="#243038" />
      <path d="M28 42c2 2 6 2 8 0" stroke="#d62828" strokeWidth="1.6" fill="none" />
    </>
  ),
  "leonardo-da-vinci": (
    <>
      <path d="M16 26c4-12 28-14 34-2 2 8-2 16-6 18-2 10-22 12-26 2-4-2-6-10-2-18z" fill="#f3efe4" />
      <circle cx="32" cy="30" r="11" fill={skin} />
      <path d="M20 22c6-8 18-8 24 0" fill="#7a4b2a" />
      <ellipse cx="27" cy="30" rx="1.5" ry="1.7" fill="#243038" />
      <ellipse cx="37" cy="30" rx="1.5" ry="1.7" fill="#243038" />
      <path d="M24 40c6 8 12 8 18 0" fill="#efe8dc" stroke="#243038" strokeWidth="1" />
      <path d="M22 48h20l2 8H20z" fill="#8c2f2f" />
    </>
  ),
  "amelia-earhart": (
    <>
      <path d="M14 32c2-16 10-22 18-22s16 6 18 22v8c-8 6-28 6-36 0z" fill="#5c4636" />
      <circle cx="32" cy="36" r="12" fill={skin} />
      <rect x="18" y="32" width="28" height="6" rx="3" fill="#243038" />
      <circle cx="24" cy="35" r="3" fill="#9bd7ff" stroke="#243038" />
      <circle cx="40" cy="35" r="3" fill="#9bd7ff" stroke="#243038" />
      <path d="M28 44c2 2 6 2 8 0" stroke="#243038" strokeWidth="1.2" fill="none" />
      <path d="M20 50h24v6H20z" fill="#c4a574" />
    </>
  ),
  "audrey-hepburn": (
    <>
      <path d="M18 28c2-14 10-20 14-20s12 6 14 20c2 2 2 8 0 10-6 4-22 4-28 0-2-2-2-8 0-10z" fill="#1a1a1a" />
      <path d="M24 14h16l-2 6H26z" fill="#f2d36b" />
      <circle cx="32" cy="36" r="11" fill={skin} />
      <ellipse cx="27" cy="36" rx="1.5" ry="2" fill="#243038" />
      <ellipse cx="37" cy="36" rx="1.5" ry="2" fill="#243038" />
      <path d="M28 42c2 1.5 6 1.5 8 0" stroke="#243038" strokeWidth="1.2" fill="none" />
      <path d="M22 50h20l4 8H18z" fill="#111" />
    </>
  ),
  "david-bowie": (
    <>
      <path d="M16 32c2-16 8-22 16-22s14 6 16 22c-4 4-8 2-10 6-6 2-12 2-16-2-2-4-4-6-6-4z" fill="#e85d04" />
      <circle cx="32" cy="36" r="13" fill="#f6d7bd" />
      <path d="M34 28l6 8-8 2z" fill="#f2d36b" stroke="#243038" strokeWidth="0.8" />
      <ellipse cx="26" cy="36" rx="1.8" ry="2" fill="#243038" />
      <ellipse cx="40" cy="36" rx="1.6" ry="1.6" fill="#243038" />
      <path d="M27 44c3 2 7 2 10 0" stroke="#243038" strokeWidth="1.2" fill="none" />
    </>
  ),
  "serena-williams": (
    <>
      <circle cx="32" cy="36" r="14" fill={skinDark} />
      <path d="M18 32c2-14 8-20 14-20s12 6 14 20c-4-4-24-4-28 0z" fill="#1a1a1a" />
      <path d="M18 30h28" stroke="#f2d36b" strokeWidth="3" />
      <ellipse cx="26" cy="36" rx="1.7" ry="2" fill="#243038" />
      <ellipse cx="38" cy="36" rx="1.7" ry="2" fill="#243038" />
      <path d="M26 44c4 3 8 3 12 0" stroke="#243038" strokeWidth="1.3" fill="none" />
      <path d="M16 48c6 8 26 8 32 0" fill="#1d4e89" />
    </>
  ),
  "bruce-lee": (
    <>
      <circle cx="32" cy="36" r="13" fill={skin} />
      <path d="M18 30c2-14 10-20 14-20s12 6 14 20c-8-2-20-2-28 0z" fill="#1a1a1a" />
      <path d="M22 32h8M34 32h8" stroke="#243038" strokeWidth="1.6" />
      <ellipse cx="26" cy="36" rx="1.6" ry="1.8" fill="#243038" />
      <ellipse cx="38" cy="36" rx="1.6" ry="1.8" fill="#243038" />
      <path d="M28 43h8" stroke="#243038" strokeWidth="1.3" />
      <path d="M20 50h24v7H20z" fill="#f2d36b" />
    </>
  ),
  "ada-lovelace": (
    <>
      <path d="M16 34c2-16 10-24 16-24s14 8 16 24v4c-8 8-24 8-32 0z" fill="#6b4c7a" />
      <circle cx="32" cy="36" r="12" fill={skin} />
      <path d="M22 24c2 6 6 8 10 8s8-2 10-8" fill="none" stroke="#6b3a2a" strokeWidth="2" />
      <ellipse cx="27" cy="36" rx="1.5" ry="1.8" fill="#243038" />
      <ellipse cx="37" cy="36" rx="1.5" ry="1.8" fill="#243038" />
      <path d="M28 42c2 2 6 2 8 0" stroke="#243038" strokeWidth="1.2" fill="none" />
      <path d="M18 50h28l-2 8H20z" fill="#6b4c7a" />
    </>
  ),
};
