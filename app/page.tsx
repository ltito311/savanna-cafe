"use client";

import { useEffect, useState } from "react";

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

  return (
    <div className="flex flex-1 flex-col items-center bg-amber-50 px-4 py-8">
      {/* Header / money counter */}
      <header className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-amber-900">
          🦒 Savanna Cafe Tycoon
        </h1>
        <p
          className="mt-4 text-6xl font-extrabold tabular-nums text-emerald-600"
          aria-live="polite"
        >
          {formatMoney(money)}
        </p>
        <p className="mt-1 text-lg font-semibold text-emerald-700">
          {formatMoney(perSecond)} / sec
        </p>
      </header>

      {/* Department card */}
      <section className="w-full max-w-md rounded-2xl border-2 border-amber-200 bg-white p-6 shadow-lg">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-amber-900">
              🥕 Produce Section
            </h2>
            <p className="text-sm font-medium text-amber-700">
              Level {upgradeLevel}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-extrabold tabular-nums text-emerald-600">
              {formatMoney(perSecond)}
            </p>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              per second
            </p>
          </div>
        </div>

        {hasManager && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
            🧑‍💼 Manager hired — selling automatically! (+{formatMoney(rate)}
            /sec)
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3">
          {/* Sell button */}
          <button
            onClick={sell}
            disabled={hasManager}
            className="w-full rounded-xl bg-emerald-500 px-6 py-4 text-xl font-bold text-white shadow-md transition active:scale-95 enabled:hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
          >
            {hasManager
              ? "Selling on autopilot 🤖"
              : `Sell (+${formatMoney(rate)})`}
          </button>

          {/* Upgrade button */}
          <button
            onClick={buyUpgrade}
            disabled={!canAffordUpgrade}
            className="w-full rounded-xl bg-amber-500 px-6 py-4 text-xl font-bold text-white shadow-md transition active:scale-95 enabled:hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
          >
            Upgrade (+{formatMoney(UPGRADE_RATE_BONUS)}/sec) —{" "}
            {formatMoney(upgradeCost)}
          </button>

          {/* Hire Manager button: hidden until first reaching the unlock amount */}
          {managerUnlocked && !hasManager && (
            <button
              onClick={hireManager}
              disabled={!canAffordManager}
              className="w-full rounded-xl bg-sky-500 px-6 py-4 text-xl font-bold text-white shadow-md transition active:scale-95 enabled:hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
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

      <p className="mt-8 text-sm text-amber-700/70">
        More departments, managers, and 3D graphics coming soon…
      </p>
    </div>
  );
}
