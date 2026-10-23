import { customerFields } from "@/lib/records";
import { member } from "@/lib/server/records";

export const { PATCH, DELETE } = member("customers", customerFields, {
  inUse: "select 1 from invoices where customer_id = $1 limit 1",
});
