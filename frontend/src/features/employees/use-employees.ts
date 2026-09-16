import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateEmployeeInput, Employee } from "@shiftly/shared";
import { apiFetch } from "../../lib/api-client";

const EMPLOYEES_KEY = ["employees"] as const;

export function useEmployees(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: EMPLOYEES_KEY,
    queryFn: () => apiFetch<Employee[]>("/employees"),
    enabled: options?.enabled ?? true,
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEmployeeInput) =>
      apiFetch<Employee>("/employees", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EMPLOYEES_KEY });
    },
  });
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/employees/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EMPLOYEES_KEY });
    },
  });
}
