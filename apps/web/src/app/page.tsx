import { redirect } from "next/navigation";
import { listStores } from "@/lib/data";

export default async function Home() {
  const stores = await listStores();
  redirect(stores.length ? `/s/${stores[0].slug}` : "/lojas/nova");
}
