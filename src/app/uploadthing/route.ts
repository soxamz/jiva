import { createRouteHandler } from "uploadthing/next";
import { after } from "next/server";

import { uploadRouter } from "@/lib/uploadthing";

export const runtime = "nodejs";
export const maxDuration = 60;

export const { GET, POST } = createRouteHandler({
  router: uploadRouter,
  config: {
    // UploadThing simulates its signed completion webhook locally. Register the
    // background work with Next so the callback is not abandoned with the
    // route response before it can persist the document metadata in Neon.
    handleDaemonPromise: (promise) => {
      after(async () => {
        await promise;
      });
    },
  },
});
