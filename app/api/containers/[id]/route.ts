import { containerFields } from "@/lib/records";
import { validateContainer } from "@/lib/server/containers";
import { member } from "@/lib/server/records";

export const { PATCH, DELETE } = member("containers", containerFields, { validate: validateContainer });
