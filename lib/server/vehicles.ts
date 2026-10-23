import { HttpError } from "./auth";
import { query } from "./db";

export const VEHICLE_COLUMNS = `id, rego, description, vehicle_type as "vehicleType", capacity, notes, kind, active`;
export const DRIVER_COLUMNS = `id, name, phone, licence_number as "licenceNumber", vehicle_id as "vehicleId", trailer_id as "trailerId", active`;

/** Driver PINs are 6 digits. */
export const PIN_RULE = /^\d{6}$/;

export const clean = (v: unknown) => (v == null ? null : String(v).trim() || null);

export async function checkVehicle(companyId: string, vehicleId: unknown, kind: "truck" | "trailer" = "truck") {
  if (!vehicleId) return;
  const rows = await query("select 1 from vehicles where id = $1 and company_id = $2 and kind = $3", [String(vehicleId), companyId, kind]);
  if (!rows.length) throw new HttpError(400, kind === "trailer" ? "That trailer doesn't exist." : "That vehicle doesn't exist.");
}

export const readKind = (v: unknown) => {
  if (v !== "truck" && v !== "trailer") throw new HttpError(400, "Choose truck or trailer.");
  return v;
};
