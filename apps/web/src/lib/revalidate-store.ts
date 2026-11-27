"use server";

import { revalidatePath, updateTag } from "next/cache";

export async function revalidateStorefrontCache(params?: {
  tags?: string[];
  paths?: string[];
}): Promise<void> {
  const tags = params?.tags ?? [];
  for (const tag of tags) {
    if (tag) updateTag(tag);
  }
  const paths = params?.paths ?? ["/"];
  for (const path of paths) {
    if (!path) continue;
    revalidatePath(path, path === "/" ? "layout" : "page");
  }
}
