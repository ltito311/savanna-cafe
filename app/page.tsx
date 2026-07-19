"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEPARTMENTS,
  UPGRADE_COST_GROWTH,
  initialDeptStates,
  type DeptId,
  type DeptRuntime,
} from "@/lib/departments";

// The 3D scene needs a real browser (WebGL), so it's loaded client-side only.
const Store3D = dynamic(() => import("@/components/Store3D"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-amber-50 text-amber-700">
      Loading store…
    </div>
  ),
});

function formatMoney(n: number): string {
  return `$${Math.floor(n).toLocaleString("en-US")}`;
}

export default function Home() {
  const [money, setMoney] = useState(0);
  const [peakMoney, setPeakMoney] = useState(0);
  const [depts, setDepts] = useState(initialDeptStates);
  const [selectedDepartment, setSelectedDepartment] = useState<DeptId | null>(
    null,
  );

  // Customers hand over money when they finish checkout.
  const earn = useCallback((amount: number) => {
    setMoney((m) => m + amount);
  }, []);

  // Managers keep auto-selling once a second in every department that has one.
  const managedRate = useMemo(
    () =>
      DEPARTMENTS.reduce(
        (sum, d) =>
          sum + (depts[d.id].unlocked && depts[d.id].hasManager
            ? depts[d.id].rate
            : 0),
        0,
      ),
    [depts],
  );
  useEffect(() => {
    if (managedRate <= 0) return;
    const tick = setInterval(() => setMoney((m) => m + managedRate), 1000);
    return () => clearInterval(tick);
  }, [managedRate]);

  // Remember the most money ever held — manager offers unlock permanently.
  useEffect(() => {
    setPeakMoney((p) => Math.max(p, money));
  }, [money]);

  // Average income: each department's customers pay its rate per second on
  // average, and a manager adds the same again.
  const perSecond = useMemo(
    () =>
      DEPARTMENTS.reduce((sum, d) => {
        const s = depts[d.id];
        return sum + (s.unlocked ? s.rate * (s.hasManager ? 2 : 1) : 0);
      }, 0),
    [depts],
  );

  // Tapping a crate: unlock it if it's locked and affordable, otherwise
  // open its panel.
  const tapDepartment = (id: DeptId) => {
    const config = DEPARTMENTS.find((d) => d.id === id)!;
    const state = depts[id];
    if (!state.unlocked && money >= config.unlockCost) {
      setMoney((m) => m - config.unlockCost);
      setDepts((ds) => ({ ...ds, [id]: { ...ds[id], unlocked: true } }));
    }
    setSelectedDepartment(id);
  };

  const sell = (id: DeptId) => {
    setMoney((m) => m + depts[id].rate);
  };

  const buyUpgrade = (id: DeptId) => {
    const s = depts[id];
    if (money < s.upgradeCost) return;
    const config = DEPARTMENTS.find((d) => d.id === id)!;
    setMoney((m) => m - s.upgradeCost);
    setDepts((ds) => ({
      ...ds,
      [id]: {
        ...ds[id],
        rate: ds[id].rate + config.upgradeRateBonus,
        level: ds[id].level + 1,
        upgradeCost: Math.ceil(ds[id].upgradeCost * UPGRADE_COST_GROWTH),
      },
    }));
  };

  const hireManager = (id: DeptId) => {
    const config = DEPARTMENTS.find((d) => d.id === id)!;
    if (depts[id].hasManager || money < config.managerCost) return;
    setMoney((m) => m - config.managerCost);
    setDepts((ds) => ({ ...ds, [id]: { ...ds[id], hasManager: true } }));
  };

  // Bundle config + live state for the 3D scene.
  const deptRuntimes: DeptRuntime[] = useMemo(
    () => DEPARTMENTS.map((d) => ({ ...d, ...depts[d.id] })),
    [depts],
  );

  const selectedConfig = selectedDepartment
    ? DEPARTMENTS.find((d) => d.id === selectedDepartment)!
    : null;
  const selectedState = selectedDepartment ? depts[selectedDepartment] : null;

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      {/* 3D store view fills the screen */}
      <div className="absolute inset-0">
        <Store3D
          depts={deptRuntimes}
          selectedDepartment={selectedDepartment}
          money={money}
          onTapDepartment={tapDepartment}
          onClearSelection={() => setSelectedDepartment(null)}
          onEarn={earn}
        />
      </div>

      {/* Money counter, floating on top of the 3D view */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 pt-4 text-center">
        <h1 className="text-lg font-bold tracking-tight text-amber-900/80">
          🦒 Savanna Cafe Tycoon
        </h1>
        <p
          className="mt-1 text-5xl font-extrabold tabular-nums text-emerald-600 drop-shadow-sm"
          aria-live="polite"
        >
          {formatMoney(money)}
        </p>
        <p className="mt-0.5 text-base font-semibold text-emerald-700">
          ≈ {formatMoney(perSecond)} / sec
        </p>
      </header>

      {/* Hint shown until the player opens a department panel */}
      {!selectedDepartment && (
        <p className="pointer-events-none absolute inset-x-0 bottom-8 z-10 animate-bounce text-center text-base font-semibold text-amber-900/70">
          👇 Tap a crate to manage that department
        </p>
      )}

      {/* Department panel: slides over the bottom when a crate is tapped */}
      {selectedConfig && selectedState && (
        <section className="absolute inset-x-0 bottom-0 z-10 mx-auto w-full max-w-md rounded-t-2xl border-2 border-b-0 border-amber-200 bg-white/95 p-5 shadow-[0_-8px_30px_rgba(0,0,0,0.15)] backdrop-blur">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-amber-900">
                {selectedConfig.emoji} {selectedConfig.name}
              </h2>
              <p className="text-sm font-medium text-amber-700">
                {selectedState.unlocked
                  ? `Level ${selectedState.level}`
                  : "Locked"}
              </p>
            </div>
            <div className="flex items-start gap-3">
              {selectedState.unlocked && (
                <div className="text-right">
                  <p className="text-xl font-extrabold tabular-nums text-emerald-600">
                    {formatMoney(
                      selectedState.rate * (selectedState.hasManager ? 2 : 1),
                    )}
                  </p>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    per second
                  </p>
                </div>
              )}
              <button
                onClick={() => setSelectedDepartment(null)}
                aria-label="Close panel"
                className="rounded-full bg-gray-100 px-2.5 py-1 text-sm font-bold text-gray-500 hover:bg-gray-200"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Locked department: just the unlock offer */}
          {!selectedState.unlocked ? (
            <div className="mt-4 pb-2">
              <p className="mb-3 text-sm text-gray-600">
                Unlock this department to start a new stream of customers and
                income ({formatMoney(selectedConfig.startRate)}/sec to start).
              </p>
              <button
                onClick={() => tapDepartment(selectedConfig.id)}
                disabled={money < selectedConfig.unlockCost}
                className="w-full rounded-xl bg-emerald-500 px-6 py-3.5 text-lg font-bold text-white shadow-md transition active:scale-95 enabled:hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
              >
                Unlock — {formatMoney(selectedConfig.unlockCost)}
              </button>
            </div>
          ) : (
            <>
              {selectedState.hasManager && (
                <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                  🧑‍💼 Manager hired — selling automatically! (+
                  {formatMoney(selectedState.rate)}/sec)
                </p>
              )}

              <div className="mt-4 flex flex-col gap-2.5 pb-2">
                {/* Sell button */}
                <button
                  onClick={() => sell(selectedConfig.id)}
                  disabled={selectedState.hasManager}
                  className="w-full rounded-xl bg-emerald-500 px-6 py-3.5 text-lg font-bold text-white shadow-md transition active:scale-95 enabled:hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
                >
                  {selectedState.hasManager
                    ? "Selling on autopilot 🤖"
                    : `Sell (+${formatMoney(selectedState.rate)})`}
                </button>

                {/* Upgrade button */}
                <button
                  onClick={() => buyUpgrade(selectedConfig.id)}
                  disabled={money < selectedState.upgradeCost}
                  className="w-full rounded-xl bg-amber-500 px-6 py-3.5 text-lg font-bold text-white shadow-md transition active:scale-95 enabled:hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
                >
                  Upgrade (+{formatMoney(selectedConfig.upgradeRateBonus)}
                  /sec) — {formatMoney(selectedState.upgradeCost)}
                </button>

                {/* Hire Manager: appears once money has ever reached the cost */}
                {!selectedState.hasManager &&
                  (peakMoney >= selectedConfig.managerCost ? (
                    <button
                      onClick={() => hireManager(selectedConfig.id)}
                      disabled={money < selectedConfig.managerCost}
                      className="w-full rounded-xl bg-sky-500 px-6 py-3.5 text-lg font-bold text-white shadow-md transition active:scale-95 enabled:hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
                    >
                      Hire Manager — {formatMoney(selectedConfig.managerCost)}
                    </button>
                  ) : (
                    <p className="text-center text-sm font-medium text-gray-400">
                      🔒 Reach {formatMoney(selectedConfig.managerCost)} to
                      unlock the Manager
                    </p>
                  ))}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
