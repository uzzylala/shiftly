import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateSwapRequestInput, SwapRequest } from "@shiftly/shared";
import { ApiError, apiFetch } from "../../lib/api-client";

const SWAPS_KEY = ["swap-requests"] as const;
const SHIFTS_KEY = ["shifts"] as const;

export function useSwapRequests(status?: string) {
  return useQuery({
    queryKey: [...SWAPS_KEY, status ?? "all"],
    queryFn: () =>
      apiFetch<SwapRequest[]>(
        `/swap-requests${status ? `?status=${encodeURIComponent(status)}` : ""}`,
      ),
  });
}

export function useCreateSwapRequest() {
  const queryClient = useQueryClient();
  return useMutation<SwapRequest, ApiError, CreateSwapRequestInput>({
    mutationFn: (input) =>
      apiFetch<SwapRequest>("/swap-requests", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SWAPS_KEY }),
    onError: () => queryClient.invalidateQueries({ queryKey: SWAPS_KEY }),
  });
}

function useSwapAction(action: "accept" | "decline" | "cancel" | "approve" | "reject") {
  const queryClient = useQueryClient();
  return useMutation<SwapRequest, ApiError, string>({
    mutationFn: (id) =>
      apiFetch<SwapRequest>(`/swap-requests/${id}/${action}`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SWAPS_KEY });
      // approve/finalize reassigns a shift — the calendar needs to catch up.
      queryClient.invalidateQueries({ queryKey: SHIFTS_KEY });
    },
    onError: () => queryClient.invalidateQueries({ queryKey: SWAPS_KEY }),
  });
}

export function useAcceptSwap() {
  return useSwapAction("accept");
}
export function useDeclineSwap() {
  return useSwapAction("decline");
}
export function useCancelSwap() {
  return useSwapAction("cancel");
}
export function useApproveSwap() {
  return useSwapAction("approve");
}
export function useRejectSwap() {
  return useSwapAction("reject");
}
