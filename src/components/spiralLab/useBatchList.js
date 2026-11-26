"use client";
// The batch list, shared by the Simple, Detailed and Batch views and kept in
// localStorage so it survives a reload. Items: { id, label, presetId, settings, copies }.
import { useEffect, useRef, useState } from "react";
import { PRESET_GROUPS, matchesPreset } from "@/lib/spiralLab";
import { MAX_BATCH, MAX_COPIES, countSpirals } from "@/lib/spiralBatch";

const STORAGE_KEY = "spiralLab.batch.v1";

const newId = () => Math.random().toString(36).slice(2, 10);

function presetFor(settings) {
  for (const group of PRESET_GROUPS) {
    for (const p of group.presets) if (matchesPreset(settings, p.id)) return p;
  }
  return null;
}

export function useBatchList() {
  const [items, setItems] = useState([]);
  const [varyCopies, setVaryCopies] = useState(true);
  const restored = useRef(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (Array.isArray(saved?.items)) setItems(saved.items);
      if (typeof saved?.varyCopies === "boolean") setVaryCopies(saved.varyCopies);
    } catch {
      // A corrupt saved list just starts empty.
    }
    restored.current = true;
  }, []);
  useEffect(() => {
    if (restored.current) localStorage.setItem(STORAGE_KEY, JSON.stringify({ items, varyCopies }));
  }, [items, varyCopies]);

  // Adds `copies` of a spiral. The same spiral added again just gets more copies.
  // Returns how many were actually added (the batch has a size cap).
  const add = (settings, copies, label) => {
    const take = Math.max(0, Math.min(copies, MAX_BATCH - countSpirals(items)));
    if (take < 1) return 0;
    setItems((prev) => {
      const key = JSON.stringify(settings);
      const same = prev.find((i) => JSON.stringify(i.settings) === key);
      if (same) return prev.map((i) => (i === same ? { ...i, copies: Math.min(MAX_COPIES, i.copies + take) } : i));
      const preset = presetFor(settings);
      const name = label || preset?.label || `Your spiral ${prev.filter((i) => !i.presetId).length + 1}`;
      return [...prev, { id: newId(), label: name, presetId: preset?.id ?? null, settings, copies: Math.min(MAX_COPIES, take) }];
    });
    return take;
  };

  const update = (id, patch) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const remove = (id) => setItems((prev) => prev.filter((i) => i.id !== id));
  const clear = () => setItems([]);

  return { items, total: countSpirals(items), varyCopies, setVaryCopies, add, update, remove, clear };
}
