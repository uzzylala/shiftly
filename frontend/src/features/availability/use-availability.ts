import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AvailabilityWindow,
  CreateAvailabilityWindowInput,
} from "@shiftly/shared";
import { apiFetch } from "../../lib/api-client";

const AVAILABILITY_KEY = ["availability"] as const;

export function useAvailability(
  employeeId?: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: [...AVAILABILITY_KEY, employeeId ?? "self"],
    queryFn: () =>
      apiFetch<AvailabilityWindow[]>(
        employeeId
          ? `/availability?employeeId=${encodeURIComponent(employeeId)}`
          : "/availability",
      ),
    enabled: options?.enabled ?? true,
  });
}

export function useCreateAvailabilityWindow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<CreateAvailabilityWindowInput, "employeeId">) =>
      apiFetch<AvailabilityWindow>("/availability", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AVAILABILITY_KEY });
    },
  });
}

export function useDeleteAvailabilityWindow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/availability/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AVAILABILITY_KEY });
    },
  });
}
