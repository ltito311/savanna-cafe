"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Mesh } from "three";
import type { DeptId, DeptRuntime } from "@/lib/departments";

// --- Store layout ---
const ENTRANCE: [number, number, number] = [5, 0, 5];
const SPAWN_POINT: [number, number, number] = [6.8, 0, 6.8];
const CHECKOUT: [number, number, number] = [-4, 0, 3];
const CHECKOUT_FRONT: [number, number, number] = [-4, 0, 4.4];

// --- Customer pacing ---
const SHOP_PAUSE = 1.5; // seconds spent "shopping" at a crate
const CHECKOUT_PAUSE = 0.9; // seconds paying at the counter
const MAX_CUSTOMERS = 24;

// Each department sends in a customer this often. Upgrading makes them
// come faster (down to a floor so it never gets silly).
function spawnIntervalMs(level: number): number {
  return Math.max(1600, 3200 - (level - 1) * 150);
}

// Customers pay for the seconds between visits, so a department's average
// income stays equal to its $/sec rate no matter how fast they arrive.
function walkSpeed(level: number): number {
  return 2.2 + (level - 1) * 0.08;
}

const CUSTOMER_COLORS = [
  "#ef4444",
  "#3b82f6",
  "#eab308",
  "#8b5cf6",
  "#14b8a6",
  "#f97316",
  "#64748b",
];

type Waypoint = {
  pos: [number, number, number];
  pause?: number;
  pay?: boolean;
};

type CustomerData = {
  id: number;
  color: string;
  speed: number;
  payment: number;
  path: Waypoint[];
};

function CustomerFigure({
  data,
  onEarn,
  onDone,
}: {
  data: CustomerData;
  onEarn: (amount: number) => void;
  onDone: (id: number) => void;
}) {
  const ref = useRef<Mesh>(null);
  const walk = useRef({ i: 0, wait: 0, arrived: false, done: false });

  useFrame((state, delta) => {
    const mesh = ref.current;
    const w = walk.current;
    if (!mesh || w.done) return;

    const target = data.path[w.i];

    // Standing still (shopping / paying): count the pause down.
    if (w.wait > 0) {
      w.wait -= delta;
      if (w.wait <= 0) {
        w.i += 1;
        w.arrived = false;
        if (w.i >= data.path.length) {
          w.done = true;
          onDone(data.id);
        }
      }
      return;
    }

    const dx = target.pos[0] - mesh.position.x;
    const dz = target.pos[2] - mesh.position.z;
    const dist = Math.hypot(dx, dz);

    if (dist < 0.08) {
      // Reached the waypoint.
      if (!w.arrived) {
        w.arrived = true;
        if (target.pay) onEarn(data.payment);
        if (target.pause) {
          w.wait = target.pause;
          return;
        }
      }
      w.i += 1;
      w.arrived = false;
      if (w.i >= data.path.length) {
        w.done = true;
        onDone(data.id);
      }
      return;
    }

    // Walk toward the waypoint with a tiny bob so it reads as walking.
    const step = Math.min(dist, data.speed * delta);
    mesh.position.x += (dx / dist) * step;
    mesh.position.z += (dz / dist) * step;
    mesh.position.y =
      0.62 + Math.sin(state.clock.elapsedTime * 10 + data.id) * 0.04;
  });

  return (
    <mesh
      ref={ref}
      position={[SPAWN_POINT[0], 0.62, SPAWN_POINT[2]]}
      castShadow
    >
      <capsuleGeometry args={[0.26, 0.62, 4, 12]} />
      <meshStandardMaterial color={data.color} />
    </mesh>
  );
}

function Customers({
  depts,
  onEarn,
}: {
  depts: DeptRuntime[];
  onEarn: (amount: number) => void;
}) {
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const nextId = useRef(1);
  const deptsRef = useRef(depts);
  deptsRef.current = depts;

  // Only rebuild the spawn timers when a department unlocks or levels up —
  // not on every money tick.
  const spawnSignature = depts
    .map((d) => `${d.id}:${d.unlocked ? d.level : "x"}`)
    .join("|");

  useEffect(() => {
    const timers = deptsRef.current
      .filter((d) => d.unlocked)
      .map((dept) =>
        setInterval(() => {
          const live = deptsRef.current.find((d) => d.id === dept.id);
          if (!live || !live.unlocked) return;
          const intervalSec = spawnIntervalMs(live.level) / 1000;
          setCustomers((cs) => {
            if (cs.length >= MAX_CUSTOMERS) return cs;
            const id = nextId.current++;
            const deptFront: [number, number, number] = [
              live.position[0],
              0,
              live.position[2] + 2,
            ];
            return [
              ...cs,
              {
                id,
                color:
                  CUSTOMER_COLORS[id % CUSTOMER_COLORS.length],
                speed: walkSpeed(live.level),
                payment: live.rate * intervalSec,
                path: [
                  { pos: ENTRANCE },
                  { pos: deptFront, pause: SHOP_PAUSE },
                  { pos: CHECKOUT_FRONT, pause: CHECKOUT_PAUSE, pay: true },
                  { pos: ENTRANCE },
                  { pos: SPAWN_POINT },
                ],
              },
            ];
          });
        }, spawnIntervalMs(dept.level)),
      );
    return () => timers.forEach(clearInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spawnSignature]);

  const remove = (id: number) =>
    setCustomers((cs) => cs.filter((c) => c.id !== id));

  return (
    <>
      {customers.map((c) => (
        <CustomerFigure key={c.id} data={c} onEarn={onEarn} onDone={remove} />
      ))}
    </>
  );
}

function DepartmentCrate({
  dept,
  selected,
  affordable,
  onTap,
}: {
  dept: DeptRuntime;
  selected: boolean;
  affordable: boolean;
  onTap: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const locked = !dept.unlocked;

  return (
    <group position={dept.position}>
      <mesh
        position={[0, 0.75, 0]}
        castShadow
        scale={hovered || selected ? 1.06 : 1}
        onClick={(e) => {
          e.stopPropagation();
          onTap();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "auto";
        }}
      >
        <boxGeometry args={[2.2, 1.5, 2.2]} />
        <meshStandardMaterial
          color={locked ? "#9ca3af" : dept.color}
          transparent={locked}
          opacity={locked ? 0.55 : 1}
          emissive={selected ? "#14532d" : "#000000"}
          emissiveIntensity={selected ? 0.35 : 0}
        />
      </mesh>

      {/* Floating label — also tappable, same action as the crate */}
      <Html position={[0, 2.1, 0]} center zIndexRange={[5, 0]}>
        <button
          aria-label={`${dept.name} station`}
          onClick={onTap}
          className={`whitespace-nowrap rounded-full px-3 py-1 text-sm font-bold shadow-md ${
            locked
              ? affordable
                ? "bg-emerald-500 text-white"
                : "bg-gray-700/80 text-white"
              : "bg-white/90 text-amber-900"
          }`}
        >
          {locked
            ? `🔒 ${dept.emoji} $${dept.unlockCost.toLocaleString("en-US")}`
            : `${dept.emoji} Lv ${dept.level}`}
        </button>
      </Html>

      {/* Green ring on the floor marking the selected department */}
      {selected && (
        <mesh position={[0, 0.02, 0]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[1.8, 2.05, 48]} />
          <meshBasicMaterial color="#16a34a" />
        </mesh>
      )}
    </group>
  );
}

type Store3DProps = {
  depts: DeptRuntime[];
  selectedDepartment: DeptId | null;
  money: number;
  onTapDepartment: (id: DeptId) => void;
  onClearSelection: () => void;
  onEarn: (amount: number) => void;
};

export default function Store3D({
  depts,
  selectedDepartment,
  money,
  onTapDepartment,
  onClearSelection,
  onEarn,
}: Store3DProps) {
  const anyUnlockedCustomers = useMemo(
    () => depts.some((d) => d.unlocked),
    [depts],
  );

  return (
    <Canvas
      shadows
      orthographic
      // Fixed isometric-style camera: up and off to a corner, looking at the
      // store center. Tweak position/zoom to change the angle later.
      camera={{ position: [10, 10, 10], zoom: 40, near: 0.1, far: 100 }}
      className="touch-none"
    >
      {/* Warm sky backdrop */}
      <color attach="background" args={["#fdf0d5"]} />

      {/* Soft fill light so nothing is pure black */}
      <ambientLight intensity={0.9} />

      {/* Sun: one angled light that casts the gentle shadows */}
      <directionalLight
        position={[6, 12, 5]}
        intensity={1.8}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
      />

      {/* Store floor. Clicking empty floor closes the department panel. */}
      <mesh
        rotation-x={-Math.PI / 2}
        receiveShadow
        onClick={onClearSelection}
      >
        <planeGeometry args={[26, 26]} />
        <meshStandardMaterial color="#ecd9ae" />
      </mesh>

      {/* Entrance doormat */}
      <mesh
        position={[ENTRANCE[0], 0.01, ENTRANCE[2]]}
        rotation-x={-Math.PI / 2}
      >
        <planeGeometry args={[2, 2.6]} />
        <meshStandardMaterial color="#8b5e3c" />
      </mesh>

      {/* Checkout counter */}
      <group position={CHECKOUT}>
        <mesh position={[0, 0.45, 0]} castShadow>
          <boxGeometry args={[2.2, 0.9, 1.1]} />
          <meshStandardMaterial color="#94a3b8" />
        </mesh>
        <Html position={[0, 1.5, 0]} center zIndexRange={[5, 0]}>
          <span className="pointer-events-none whitespace-nowrap rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-bold text-slate-700 shadow">
            💳 Checkout
          </span>
        </Html>
      </group>

      {depts.map((d) => (
        <DepartmentCrate
          key={d.id}
          dept={d}
          selected={selectedDepartment === d.id}
          affordable={!d.unlocked && money >= d.unlockCost}
          onTap={() => onTapDepartment(d.id)}
        />
      ))}

      {anyUnlockedCustomers && <Customers depts={depts} onEarn={onEarn} />}
    </Canvas>
  );
}
