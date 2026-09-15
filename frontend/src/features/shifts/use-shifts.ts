import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateShiftInput, Shift, UpdateShiftInput } from "@shiftly/shared";
import { apiFetch } from "../../lib/api-client";

const SHIFTS_KEY = ["shifts"] as const;

export function useShifts() {
  return useQuery({
    queryKey: SHIFTS_KEY,
    queryFn: () => apiFetch<Shift[]>("/shifts"),
  });
}

export function useCreateShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateShiftInput) =>
      apiFetch<Shift>("/shifts", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SHIFTS_KEY });
    },
  });
}

export function useUpdateShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateShiftInput }) =>
      apiFetch<Shift>(`/shifts/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
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
