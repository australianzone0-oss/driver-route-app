import { customerFields } from "@/lib/records";
import { collection } from "@/lib/server/records";

export const { GET, POST } = collection("customers", customerFields, { orderBy: "active desc, name" });
