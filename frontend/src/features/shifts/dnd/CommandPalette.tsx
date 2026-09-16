import { useEffect, useMemo, useRef, useState } from "react";
import {
  findShiftConflicts,
  hasBlockingConflict,
  type AvailabilityWindow,
  type ConflictReason,
  type Shift,
} from "@shiftly/shared";
import { DAY_COUNT, formatSlotLabel, slotToDate } from "./grid";

// Business-hours window for the candidate list — 6am to 10pm covers real
// shift starts without making the list 7 * 48 slots long.
const FIRST_SLOT = 12; // 6:00 = 12 * 30min
const LAST_SLOT = 44; // 22:00

interface Candidate {
  dayIndex: number;
  slotIndex: number;
  date: Date;
  label: string;
  conflicts: ConflictReason[];
}

/**
 * The second keyboard/touch-native path alongside dnd-kit's own keyboard
 * drag: a searchable list of candidate day/time slots, not a fallback form.
 * Reused verbatim for coarse-pointer (touch) devices — see
 * useIsCoarsePointer — so there's exactly one non-mouse placement
 * implementation to keep correct, not two.
 */
export function CommandPalette(props: {
  title: string;
  weekStart: Date;
  employeeId: string;
  durationMinutes: number;
  excludeShiftId?: string;
  existingShifts: Shift[];
  availability: AvailabilityWindow[];
  onConfirm: (candidate: { startTime: string; endTime: string }) => void;
  onClose: () => void;
}) {
  const {
    title,
    weekStart,
    employeeId,
    durationMinutes,
    excludeShiftId,
    existingShifts,
    availability,
    onConfirm,
    onClose,
  } = props;

  const [filter, setFilter] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const candidates = useMemo<Candidate[]>(() => {
    const all: Candidate[] = [];
    for (let dayIndex = 0; dayIndex < DAY_COUNT; dayIndex++) {
      for (let slotIndex = FIRST_SLOT; slotIndex <= LAST_SLOT; slotIndex++) {
        const start = slotToDate(weekStart, dayIndex, slotIndex);
        const end = new Date(start.getTime() + durationMinutes * 60_000);
        if (end.getDate() !== start.getDate()) continue; // no overnight spans
        const conflicts = findShiftConflicts(
          {
            employeeId,
            startTime: start.toISOString(),
            endTime: end.toISOString(),
            excludeShiftId,
          },
          { existingShifts, availability },
        );
        all.push({
          dayIndex,
          slotIndex,
          date: start,
          label: formatSlotLabel(start),
          conflicts,
        });
      }
    }
    return all;
  }, [weekStart, employeeId, durationMinutes, excludeShiftId, existingShifts, availability]);

  const filtered = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return candidates;
    return candidates.filter((c) => c.label.toLowerCase().includes(needle));
  }, [candidates, filter]);

  function confirm(candidate: Candidate | undefined) {
    if (!candidate || hasBlockingConflict(candidate.conflicts)) return;
    const end = new Date(candidate.date.getTime() + durationMinutes * 60_000);
    onConfirm({
      startTime: candidate.date.toISOString(),
      endTime: end.toISOString(),
    });
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((i) => Math.min(i + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      confirm(filtered[highlighted]);
    }
  }

  const activeCandidate = filtered[highlighted];
  const activeId = activeCandidate
    ? `palette-option-${activeCandidate.dayIndex}-${activeCandidate.slotIndex}`
    : undefined;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 p-4 pt-24"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-100 p-3">
          <p className="mb-2 text-sm font-semibold text-slate-900">{title}</p>
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-listbox"
            aria-activedescendant={activeId}
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setHighlighted(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Type a day or time, e.g. Tue 2:00 PM"
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>

        <ul
          id="palette-listbox"
          ref={listRef}
          role="listbox"
          aria-label="Candidate time slots"
          className="max-h-72 overflow-y-auto p-1"
        >
          {filtered.length === 0 && (
            <li className="px-3 py-4 text-center text-sm text-slate-500">
              No matching times.
            </li>
          )}
          {filtered.map((candidate, index) => {
            const blocked = hasBlockingConflict(candidate.conflicts);
            const noAvailabilityOnFile = candidate.conflicts.some(
              (c) => c.type === "no_availability_submitted",
            );
            const id = `palette-option-${candidate.dayIndex}-${candidate.slotIndex}`;
            return (
              <li
                key={id}
                id={id}
                role="option"
                aria-selected={index === highlighted}
                aria-disabled={blocked}
              >
                <button
                  type="button"
                  disabled={blocked}
                  onClick={() => confirm(candidate)}
                  onMouseEnter={() => setHighlighted(index)}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${
                    index === highlighted ? "bg-indigo-50" : ""
                  } ${blocked ? "cursor-not-allowed text-slate-400" : "text-slate-800 hover:bg-slate-50"}`}
                >
                  <span>{candidate.label}</span>
                  {blocked && (
                    <span className="text-xs text-red-600">Conflict</span>
                  )}
                  {!blocked && noAvailabilityOnFile && (
                    <span className="text-xs text-amber-600">No availability on file</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <div aria-live="polite" className="sr-only">
          {activeCandidate
            ? `${activeCandidate.label}${
                hasBlockingConflict(activeCandidate.conflicts)
                  ? ", conflict, unavailable"
                  : activeCandidate.conflicts.some((c) => c.type === "no_availability_submitted")
                    ? ", available, no availability submitted for this day yet"
                    : ", available"
              }`
            : "No matching times"}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 p-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
