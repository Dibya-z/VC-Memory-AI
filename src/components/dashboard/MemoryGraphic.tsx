/**
 * Editorial line-art for the dashboard header: a constellation of connected
 * nodes — a knowledge graph standing in for the firm's connected memory (deals
 * linked by similarity). 1px hairline strokes, muted gray, a single accent hub.
 * Composed to spread to the edges of its frame so it fills the space.
 */

const NODES = [
  { x: 26, y: 74, kind: "muted" },
  { x: 102, y: 30, kind: "strong" },
  { x: 58, y: 156, kind: "muted" },
  { x: 152, y: 98, kind: "accent" }, // hub
  { x: 138, y: 206, kind: "muted" },
  { x: 224, y: 48, kind: "muted" },
  { x: 238, y: 150, kind: "strong" },
  { x: 206, y: 256, kind: "muted" },
  { x: 308, y: 96, kind: "muted" },
  { x: 318, y: 214, kind: "strong" },
  { x: 402, y: 56, kind: "muted" },
  { x: 420, y: 152, kind: "muted" },
  { x: 388, y: 258, kind: "muted" },
  { x: 112, y: 274, kind: "muted" },
] as const;

const EDGES: [number, number][] = [
  [0, 1],
  [0, 2],
  [1, 3],
  [2, 3],
  [2, 4],
  [3, 5],
  [3, 6],
  [4, 7],
  [5, 6],
  [5, 8],
  [6, 9],
  [6, 8],
  [8, 10],
  [8, 11],
  [9, 11],
  [9, 12],
  [11, 10],
  [7, 13],
  [4, 13],
  [7, 9],
];

export function MemoryGraphic() {
  return (
    <svg
      viewBox="0 0 446 304"
      fill="none"
      className="h-auto w-full"
      aria-hidden="true"
    >
      {/* faint ring around the hub */}
      <circle
        cx={NODES[3].x}
        cy={NODES[3].y}
        r={22}
        stroke="hsl(var(--accent))"
        strokeOpacity={0.22}
        strokeWidth={1}
      />

      {/* connections */}
      {EDGES.map(([a, b], i) => (
        <line
          key={i}
          x1={NODES[a].x}
          y1={NODES[a].y}
          x2={NODES[b].x}
          y2={NODES[b].y}
          stroke="#DCDCDC"
          strokeWidth={1}
        />
      ))}

      {/* nodes */}
      {NODES.map((n, i) => {
        if (n.kind === "accent") {
          return (
            <circle key={i} cx={n.x} cy={n.y} r={6} fill="hsl(var(--accent))" />
          );
        }
        if (n.kind === "strong") {
          return (
            <circle key={i} cx={n.x} cy={n.y} r={4} fill="hsl(var(--foreground))" />
          );
        }
        return (
          <circle
            key={i}
            cx={n.x}
            cy={n.y}
            r={3.5}
            fill="#FFFFFF"
            stroke="#C6C6C6"
            strokeWidth={1}
          />
        );
      })}
    </svg>
  );
}
