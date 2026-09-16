import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateShiftInput, Shift, UpdateShiftInput } from "@shiftly/shared";
import { ApiError, apiFetch } from "../../lib/api-client";

const SHIFTS_KEY = ["shifts"] as const;

export function useShifts(range: { start: string; end: string }) {
  return useQuery({
    queryKey: [...SHIFTS_KEY, range.start, range.end],
    queryFn: () =>
      apiFetch<Shift[]>(
        `/shifts?start=${encodeURIComponent(range.start)}&end=${encodeURIComponent(range.end)}`,
      ),
  });
}

export function useCreateShift() {
  const queryClient = useQueryClient();
  return useMutation<Shift, ApiError, CreateShiftInput>({
    mutationFn: (input) =>
      apiFetch<Shift>("/shifts", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SHIFTS_KEY });
    },
    // A 409/422 means the server saw something the client's cache didn't —
    // refetch so that stale view corrects itself immediately, rather than
    // leaving the manager staring at the same wrong data they just acted on.
    onError: () => {
      queryClient.invalidateQueries({ queryKey: SHIFTS_KEY });
    },
  });
}

export function useUpdateShift() {
  const queryClient = useQueryClient();
  return useMutation<
    Shift,
    ApiError,
    { id: string; input: UpdateShiftInput }
  >({
    mutationFn: ({ id, input }) =>
      apiFetch<Shift>(`/shifts/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SHIFTS_KEY });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: SHIFTS_KEY });
    },
  });
}

export function useDeleteShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/shifts/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SHIFTS_KEY });
    },
  });
}
