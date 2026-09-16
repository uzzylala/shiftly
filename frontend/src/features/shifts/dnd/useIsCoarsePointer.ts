import { useEffect, useState } from "react";

// Touch drag-and-drop on a dense weekly grid has a structural problem no
// amount of tuning fixes: the finger occludes the exact cell it's trying to
// judge as a drop target. Rather than fight that, coarse-pointer devices
// skip dnd-kit entirely and go straight to the command palette — the same
// code path already built for keyboard users, not a separate mobile mode.
export function useIsCoarsePointer(): boolean {
  const [isCoarse, setIsCoarse] = useState(() => {
    try {
      return window.matchMedia("(pointer: coarse)").matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let mql: MediaQueryList;
    try {
      mql = window.matchMedia("(pointer: coarse)");
    } catch {
      return;
    }
    const handler = () => setIsCoarse(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return isCoarse;
}
