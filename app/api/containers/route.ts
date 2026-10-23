import { containerFields } from "@/lib/records";
import { validateContainer } from "@/lib/server/containers";
import { collection } from "@/lib/server/records";

export const { GET, POST } = collection("containers", containerFields, {
  validate: validateContainer,
  orderBy: "(status = 'returned'), held desc, coalesce(dehire_date, wharf_pickup_date, wharf_dropoff_date) nulls last, created_at desc",
});
