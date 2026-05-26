import { useState, useCallback } from "react";

const KEY = "pl_watchlist";

function getStored(): number[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); }
  catch { return []; }
}

export function useWatchlist() {
  const [ids, setIds] = useState<number[]>(getStored);

  const persist = (next: number[]) => {
    localStorage.setItem(KEY, JSON.stringify(next));
    setIds(next);
  };

  const add = useCallback((id: number) => {
    const current = getStored();
    if (!current.includes(id)) persist([...current, id]);
  }, []);

  const remove = useCallback((id: number) => {
    persist(getStored().filter(i => i !== id));
  }, []);

  const isWatched = useCallback((id: number) => ids.includes(id), [ids]);

  const toggle = useCallback((id: number) => {
    if (getStored().includes(id)) { persist(getStored().filter(i => i !== id)); }
    else { persist([...getStored(), id]); }
  }, []);

  return { ids, add, remove, isWatched, toggle };
}
