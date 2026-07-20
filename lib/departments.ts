// One place that describes every department: what it's called, where its
// crate sits on the floor, what it costs, and how its economy scales.

export type DeptId = "produce" | "canned" | "bakery";

export type DeptConfig = {
  id: DeptId;
  name: string;
  emoji: string;
  color: string;
  model: string; // GLB file in public/assets/models/minimarket
  position: [number, number, number];
  unlockCost: number; // 0 = available from the start
  startRate: number; // $/sec when first unlocked
  upgradeBaseCost: number;
  upgradeRateBonus: number; // $/sec added per upgrade
  managerCost: number;
};

export const UPGRADE_COST_GROWTH = 1.15; // each upgrade costs ~15% more

export const DEPARTMENTS: DeptConfig[] = [
  {
    id: "produce",
    name: "Produce Section",
    emoji: "🥕",
    color: "#4ade80",
    model: "display-fruit.glb",
    position: [-4, 0, -3],
    unlockCost: 0,
    startRate: 1,
    upgradeBaseCost: 10,
    upgradeRateBonus: 1,
    managerCost: 100,
  },
  {
    id: "canned",
    name: "Canned Food",
    emoji: "🥫",
    color: "#fbbf24",
    model: "shelf-boxes.glb",
    position: [0, 0, -4.5],
    unlockCost: 250,
    startRate: 2,
    upgradeBaseCost: 40,
    upgradeRateBonus: 2,
    managerCost: 400,
  },
  {
    id: "bakery",
    name: "Bakery",
    emoji: "🥐",
    color: "#f472b6",
    model: "display-bread.glb",
    position: [4, 0, -3],
    unlockCost: 1000,
    startRate: 5,
    upgradeBaseCost: 150,
    upgradeRateBonus: 5,
    managerCost: 1500,
  },
];

// Live, changing numbers for one department while you play.
export type DeptState = {
  unlocked: boolean;
  rate: number;
  level: number;
  upgradeCost: number;
  hasManager: boolean;
};

export function initialDeptStates(): Record<DeptId, DeptState> {
  const out = {} as Record<DeptId, DeptState>;
  for (const d of DEPARTMENTS) {
    out[d.id] = {
      unlocked: d.unlockCost === 0,
      rate: d.startRate,
      level: 1,
      upgradeCost: d.upgradeBaseCost,
      hasManager: false,
    };
  }
  return out;
}

// Everything the 3D scene needs to know about a department in one bundle.
export type DeptRuntime = DeptConfig & DeptState;
