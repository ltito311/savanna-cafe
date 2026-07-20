"use client";

import { Canvas, useFrame, type ThreeElements } from "@react-three/fiber";
import { Html, MapControls, useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  Box3,
  LinearMipmapLinearFilter,
  MeshStandardMaterial,
  Vector3,
  type Group,
  type Mesh,
  type Object3D,
  type Texture,
} from "three";
import { SkeletonUtils } from "three-stdlib";
import type { DeptId, DeptRuntime } from "@/lib/departments";

const MODELS = "/assets/models";

// --- Store layout ---
const ENTRANCE: [number, number, number] = [5, 0, 5];
const SPAWN_POINT: [number, number, number] = [6.8, 0, 6.8];
const CHECKOUT: [number, number, number] = [-4, 0, 3];
const CHECKOUT_FRONT: [number, number, number] = [-4, 0, 4.4];

// --- Customer pacing ---
const SHOP_PAUSE = 1.5; // seconds spent "shopping" at a fixture
const CHECKOUT_PAUSE = 0.9; // seconds paying at the counter
const MAX_CUSTOMERS = 24;

function spawnIntervalMs(level: number): number {
  return Math.max(1600, 3200 - (level - 1) * 150);
}

function walkSpeed(level: number): number {
  return 2.2 + (level - 1) * 0.08;
}

const SHOPPER_MODELS = [
  "character-female-a", "character-female-b", "character-female-c",
  "character-female-d", "character-female-e", "character-female-f",
  "character-male-a", "character-male-b", "character-male-c",
  "character-male-d", "character-male-e", "character-male-f",
].map((n) => `${MODELS}/characters/${n}.glb`);

// Preload everything the scene uses so it pops in quickly.
[
  ...SHOPPER_MODELS,
  `${MODELS}/minimarket/display-fruit.glb`,
  `${MODELS}/minimarket/shelf-boxes.glb`,
  `${MODELS}/minimarket/display-bread.glb`,
  `${MODELS}/minimarket/cash-register.glb`,
  `${MODELS}/minimarket/character-employee.glb`,
  `${MODELS}/minimarket/wall.glb`,
  `${MODELS}/minimarket/wall-corner.glb`,
].forEach((url) => useGLTF.preload(url));

/**
 * Loads a GLB, clones it (so many copies can coexist), scales it to the
 * requested footprint width OR height, sits it on the floor centered at
 * its group origin, and enables shadows. `gray` renders it as a ghost
 * (used for locked departments).
 */
function useFittedModel(
  url: string,
  fit: { width?: number; height?: number },
  gray = false,
): Object3D {
  const { scene } = useGLTF(url);
  return useMemo(() => {
    const clone = SkeletonUtils.clone(scene);
    const box = new Box3().setFromObject(clone);
    const size = box.getSize(new Vector3());
    const scale = fit.width
      ? fit.width / Math.max(size.x, size.z)
      : (fit.height ?? 1) / size.y;
    clone.scale.setScalar(scale);
    const scaledBox = new Box3().setFromObject(clone);
    const center = scaledBox.getCenter(new Vector3());
    clone.position.set(-center.x, -scaledBox.min.y, -center.z);
    const ghost = gray
      ? new MeshStandardMaterial({ color: "#9ca3af", transparent: true, opacity: 0.5 })
      : null;
    clone.traverse((obj) => {
      const mesh = obj as Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (ghost) {
          mesh.material = ghost;
        } else {
          // Kenney textures ship with "nearest" filtering, which shimmers
          // badly at a distance — switch to smooth mipmapped filtering.
          const materials = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];
          for (const mat of materials) {
            const map = (mat as MeshStandardMaterial).map as Texture | null;
            if (map) {
              map.minFilter = LinearMipmapLinearFilter;
              map.anisotropy = 8;
              map.needsUpdate = true;
            }
          }
        }
      }
    });
    return clone;
  }, [scene, fit.width, fit.height, gray]);
}

/** A positioned, auto-scaled model instance. */
function Model({
  url,
  fit,
  gray = false,
  ...groupProps
}: {
  url: string;
  fit: { width?: number; height?: number };
  gray?: boolean;
} & ThreeElements["group"]) {
  const object = useFittedModel(url, fit, gray);
  return (
    <group {...groupProps}>
      <primitive object={object} />
    </group>
  );
}

type Waypoint = {
  pos: [number, number, number];
  pause?: number;
  pay?: boolean;
};

type CustomerData = {
  id: number;
  modelUrl: string;
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
  const ref = useRef<Group>(null);
  const walk = useRef({ i: 0, wait: 0, arrived: false, done: false });

  useFrame((state, delta) => {
    const group = ref.current;
    const w = walk.current;
    if (!group || w.done) return;

    const target = data.path[w.i];

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

    const dx = target.pos[0] - group.position.x;
    const dz = target.pos[2] - group.position.z;
    const dist = Math.hypot(dx, dz);

    if (dist < 0.08) {
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

    // Walk toward the waypoint, face the walking direction, bob a little.
    const step = Math.min(dist, data.speed * delta);
    group.position.x += (dx / dist) * step;
    group.position.z += (dz / dist) * step;
    group.rotation.y = Math.atan2(dx, dz);
    group.position.y =
      Math.abs(Math.sin(state.clock.elapsedTime * 9 + data.id)) * 0.06;
  });

  return (
    <group ref={ref} position={[SPAWN_POINT[0], 0, SPAWN_POINT[2]]}>
      <Model url={data.modelUrl} fit={{ height: 1.15 }} />
    </group>
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
                modelUrl: SHOPPER_MODELS[id % SHOPPER_MODELS.length],
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

function DepartmentStation({
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
      <group
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
        <Model
          url={`${MODELS}/minimarket/${dept.model}`}
          fit={{ width: 2.6 }}
          gray={locked}
        />
      </group>

      {/* Floating label — also tappable, same action as the fixture */}
      <Html position={[0, 2.3, 0]} center zIndexRange={[5, 0]}>
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

      {selected && (
        <mesh position={[0, 0.02, 0]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[1.8, 2.05, 48]} />
          <meshBasicMaterial color="#16a34a" />
        </mesh>
      )}
    </group>
  );
}

function StoreShell() {
  // Walls along the two far edges of the store, with a corner piece.
  const wallXs = [-7, -5, -3, -1, 1, 3, 5, 7];
  const wallZs = [-7, -5, -3, -1, 1, 3, 5, 7];
  const wallUrl = `${MODELS}/minimarket/wall.glb`;
  return (
    <>
      {wallXs.map((x) => (
        <Model
          key={`back-${x}`}
          url={wallUrl}
          fit={{ width: 2 }}
          position={[x, 0, -8]}
          rotation={[0, Math.PI, 0]}
        />
      ))}
      {wallZs.map((z) => (
        <Model
          key={`left-${z}`}
          url={wallUrl}
          fit={{ width: 2 }}
          position={[-8, 0, z]}
          rotation={[0, -Math.PI / 2, 0]}
        />
      ))}
      <Model
        url={`${MODELS}/minimarket/wall-corner.glb`}
        fit={{ width: 2 }}
        position={[-8, 0, -8]}
        rotation={[0, Math.PI / 2, 0]}
      />
    </>
  );
}

function CheckoutCounter() {
  return (
    <group position={CHECKOUT}>
      {/* Counter */}
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[2.2, 0.9, 1.1]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>
      {/* Register on the counter */}
      <Model
        url={`${MODELS}/minimarket/cash-register.glb`}
        fit={{ width: 0.8 }}
        position={[0.5, 0.9, 0]}
      />
      {/* Employee behind the counter, facing the shoppers */}
      <Model
        url={`${MODELS}/minimarket/character-employee.glb`}
        fit={{ height: 1.2 }}
        position={[0, 0, -1]}
      />
      <Html position={[0, 2, 0]} center zIndexRange={[5, 0]}>
        <span className="pointer-events-none whitespace-nowrap rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-bold text-slate-700 shadow">
          💳 Checkout
        </span>
      </Html>
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
  const anyUnlocked = useMemo(() => depts.some((d) => d.unlocked), [depts]);

  return (
    <Canvas
      shadows
      orthographic
      // Isometric-style camera. The angle stays fixed; MapControls below
      // adds drag-to-pan and pinch/scroll zoom.
      camera={{ position: [10, 10, 10], zoom: 40, near: 0.1, far: 100 }}
      className="touch-none"
    >
      <color attach="background" args={["#fdf0d5"]} />
      <ambientLight intensity={0.9} />
      <directionalLight
        position={[6, 12, 5]}
        intensity={1.8}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0002}
        shadow-normalBias={0.04}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
      />

      {/* One-finger drag / mouse drag pans, pinch or scroll zooms.
          Rotation stays off so the isometric angle never changes. */}
      <MapControls
        makeDefault
        enableRotate={false}
        minZoom={22}
        maxZoom={140}
        zoomSpeed={1.2}
        panSpeed={1}
      />

      <mesh rotation-x={-Math.PI / 2} receiveShadow onClick={onClearSelection}>
        <planeGeometry args={[26, 26]} />
        <meshStandardMaterial color="#ecd9ae" />
      </mesh>

      {/* Entrance doormat */}
      <mesh position={[ENTRANCE[0], 0.01, ENTRANCE[2]]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[2, 2.6]} />
        <meshStandardMaterial color="#8b5e3c" />
      </mesh>

      <Suspense fallback={null}>
        <StoreShell />
        <CheckoutCounter />
        {depts.map((d) => (
          <DepartmentStation
            key={d.id}
            dept={d}
            selected={selectedDepartment === d.id}
            affordable={!d.unlocked && money >= d.unlockCost}
            onTap={() => onTapDepartment(d.id)}
          />
        ))}
        {anyUnlocked && <Customers depts={depts} onEarn={onEarn} />}
      </Suspense>
    </Canvas>
  );
}
