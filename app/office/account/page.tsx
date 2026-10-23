import { redirect } from "next/navigation";

/** Account moved into Settings. */
export default function Account() {
  redirect("/office/settings");
}
