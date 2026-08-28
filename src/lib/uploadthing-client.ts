"use client";

import { generateReactHelpers } from "@uploadthing/react";

import type { UploadRouter } from "@/lib/uploadthing";

export const { useUploadThing } = generateReactHelpers<UploadRouter>({
  url: "/uploadthing",
});
