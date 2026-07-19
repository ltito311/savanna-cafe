"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// The 3D scene needs a real browser (WebGL), so it's loaded client-side only.
const Store3D = dynamic(() => import("@/components/Store3D"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-amber-50 text-amber-700">
      Loading store…
    </div>
  ),
});

// --- Game balance knobs (tweak these to change difficulty) ---
const STARTING_RATE = 1; // $/sec the Produce Section earns at the start
const UPGRADE_BASE_COST = 10; // first upgrade price
const UPGRADE_COST_GROWTH = 1.15; // each upgrade costs ~15% more
const UPGRADE_RATE_BONUS = 1; // each upgrade adds this many $/sec
const MANAGER_UNLOCK_AT = 100; // manager becomes visible/buyable at this much money
const MANAGER_COST = 100;

function formatMoney(n: number): string {
  return `$${Math.floor(n).toLocaleString("en-US")}`;
}

export default function Home() {
  const [money, setMoney] = useState(0);
  const [rate, setRate] = useState(STARTING_RATE);
  const [upgradeCost, setUpgradeCost] = useState(UPGRADE_BASE_COST);
  const [upgradeLevel, setUpgradeLevel] = useState(1);
  const [managerUnlocked, setManagerUnlocked] = useState(false);
  const [hasManager, setHasManager] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(
    null,
  );

  // Total money earned per second: passive income, doubled once the
  // manager is auto-selling every tick.
  const perSecond = hasManager ? rate * 2 : rate;

  // The heartbeat of the game: once a second, add the income.
  useEffect(() => {
    const tick = setInterval(() => {
      setMoney((m) => m + perSecond);
    }, 1000);
    return () => clearInterval(tick);
  }, [perSecond]);

  // The manager option unlocks permanently the first time money reaches the threshold.
  useEffect(() => {
    if (!managerUnlocked && money >= MANAGER_UNLOCK_AT) {
      setManagerUnlocked(true);
    }
  }, [money, managerUnlocked]);

  const sell = () => {
    setMoney((m) => m + rate);
  };

  const buyUpgrade = () => {
    if (money < upgradeCost) return;
    setMoney((m) => m - upgradeCost);
    setRate((r) => r + UPGRADE_RATE_BONUS);
    setUpgradeCost((c) => Math.ceil(c * UPGRADE_COST_GROWTH));
    setUpgradeLevel((l) => l + 1);
  };

  const hireManager = () => {
    if (hasManager || money < MANAGER_COST) return;
    setMoney((m) => m - MANAGER_COST);
    setHasManager(true);
  };

  const canAffordUpgrade = money >= upgradeCost;
  const canAffordManager = money >= MANAGER_COST;
  const panelOpen = selectedDepartment === "produce";

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      {/* 3D store view fills the screen */}
      <div className="absolute inset-0">
        <Store3D
          selectedDepartment={selectedDepartment}
          onSelectDepartment={setSelectedDepartment}
        />
      </div>

      {/* Money counter, floating on top of the 3D view */}
      <header className="pointer-events-none absolute inset-x-0 top-0 pt-4 text-center">
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
          {formatMoney(perSecond)} / sec
        </p>
      </header>

      {/* Hint shown until the player opens the department panel */}
      {!panelOpen && (
        <p className="pointer-events-none absolute inset-x-0 bottom-8 animate-bounce text-center text-base font-semibold text-amber-900/70">
          👇 Tap the green crate to manage your Produce Section
        </p>
      )}

      {/* Department panel: slides over the bottom when the crate is tapped */}
      {panelOpen && (
        <section className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md rounded-t-2xl border-2 border-b-0 border-amber-200 bg-white/95 p-5 shadow-[0_-8px_30px_rgba(0,0,0,0.15)] backdrop-blur">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-amber-900">
                🥕 Produce Section
              </h2>
              <p className="text-sm font-medium text-amber-700">
                Level {upgradeLevel}
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="text-right">
                <p className="text-xl font-extrabold tabular-nums text-emerald-600">
                  {formatMoney(perSecond)}
                </p>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  per second
                </p>
              </div>
              <button
                onClick={() => setSelectedDepartment(null)}
                aria-label="Close panel"
                className="rounded-full bg-gray-100 px-2.5 py-1 text-sm font-bold text-gray-500 hover:bg-gray-200"
              >
                ✕
              </button>
            </div>
          </div>

          {hasManager && (
            <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
              🧑‍💼 Manager hired — selling automatically! (+{formatMoney(rate)}
              /sec)
            </p>
          )}

          <div className="mt-4 flex flex-col gap-2.5 pb-2">
            {/* Sell button */}
            <button
              onClick={sell}
              disabled={hasManager}
              className="w-full rounded-xl bg-emerald-500 px-6 py-3.5 text-lg font-bold text-white shadow-md transition active:scale-95 enabled:hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
            >
              {hasManager
                ? "Selling on autopilot 🤖"
                : `Sell (+${formatMoney(rate)})`}
            </button>

            {/* Upgrade button */}
            <button
              onClick={buyUpgrade}
              disabled={!canAffordUpgrade}
              className="w-full rounded-xl bg-amber-500 px-6 py-3.5 text-lg font-bold text-white shadow-md transition active:scale-95 enabled:hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
            >
              Upgrade (+{formatMoney(UPGRADE_RATE_BONUS)}/sec) —{" "}
              {formatMoney(upgradeCost)}
            </button>

            {/* Hire Manager button: hidden until first reaching the unlock amount */}
            {managerUnlocked && !hasManager && (
              <button
                onClick={hireManager}
                disabled={!canAffordManager}
                className="w-full rounded-xl bg-sky-500 px-6 py-3.5 text-lg font-bold text-white shadow-md transition active:scale-95 enabled:hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
              >
                Hire Manager — {formatMoney(MANAGER_COST)}
              </button>
            )}
            {!managerUnlocked && (
              <p className="text-center text-sm font-medium text-gray-400">
                🔒 Reach {formatMoney(MANAGER_UNLOCK_AT)} to unlock the Manager
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
