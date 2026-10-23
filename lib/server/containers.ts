import { checkContainerNumber } from "@/lib/records";
import { HttpError } from "./auth";
import { checkCustomer, checkDriver } from "./records";

export async function validateContainer(v: Record<string, unknown>, companyId: string) {
  if (v.container_number !== undefined) {
    const problem = checkContainerNumber(String(v.container_number ?? ""));
    if (problem) throw new HttpError(400, problem);
  }
  await checkCustomer(companyId, v.customer_id);
  await checkDriver(companyId, v.driver_id);
}
