import type { FulfillmentMode } from "@/lib/video/types";

export function resolveStandaloneSubmissionPlan(params: {
  requestedFulfillmentMode: FulfillmentMode;
  provider: string;
  count: number;
  scheduled: boolean;
}): { fulfillmentMode: FulfillmentMode; submitInline: boolean } {
  if (!params.scheduled && params.provider === "grok2api" && params.count > 1) {
    return { fulfillmentMode: "backfill_until_target", submitInline: false };
  }

  return {
    fulfillmentMode: params.requestedFulfillmentMode,
    submitInline: true,
  };
}
