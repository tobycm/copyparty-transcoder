import { staticPlugin } from "@elysiajs/static";
import { Elysia, t } from "elysia";
import path from "path";
import { transcodeVideo } from "../transcode";

const allowedPasswords = process.env.ALLOWED_PASSWORDS ? process.env.ALLOWED_PASSWORDS.split(",").map((pw) => pw.trim()) : [];
if (!allowedPasswords.length) {
  throw new Error("Environment variable 'ALLOWED_PASSWORDS' is not set");
}

const nvidiaHardwareAcceleration = process.env.NVIDIA_HARDWARE_ACCELERATION === "true";

if (!process.env.COPYPARTY_DIR) {
  throw new Error("Environment variable 'COPYPARTY_DIR' is not set");
}
const copypartyDir = path.resolve(process.env.COPYPARTY_DIR);

const app = new Elysia()
  .use(
    staticPlugin({
      assets: "web/",
      prefix: "/",
    }),
  )

  .guard({
    beforeHandle({ headers, status }) {
      // Check password
      const password = headers["authorization"]?.split(" ")[1];
      if (!password || !allowedPasswords.includes(password)) {
        return status(401, "Unauthorized");
      }
    },
  })
  .post(
    "/transcode",
    ({ body }) => {
      const { filepath, reencode } = body;

      const realFilePath = path.join(copypartyDir, decodeURIComponent(filepath));

      transcodeVideo({
        inputPath: realFilePath,
        outputPath: realFilePath + ".transcoded.mp4",
        reencode,
        nvidiaHardwareAcceleration,
      });

      return { success: true };
    },
    {
      body: t.Object({
        filepath: t.String(),
        reencode: t.Boolean(),
      }),
    },
  )

  .listen(3464);

console.log(`🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`);
