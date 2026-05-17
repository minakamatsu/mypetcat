import { incrDownloadCount } from "./lib/redis-rest.js";

export const config = { runtime: "edge" };

function installerTarget() {
  const fromEnv =
    process.env.WINDOWS_INSTALLER_URL || process.env.WINDOWS_INSTALLER_PATH;
  if (fromEnv) {
    if (fromEnv.startsWith("http://") || fromEnv.startsWith("https://")) {
      return fromEnv;
    }
    return fromEnv.startsWith("/") ? fromEnv : `/${fromEnv}`;
  }
  return "/downloads/Desktop%20Cat_0.1.0_x64-setup.exe";
}

/** @param {Request} request */
export default async function handler(request) {
  await incrDownloadCount();

  const pathOrUrl = installerTarget();
  const target =
    pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")
      ? pathOrUrl
      : new URL(pathOrUrl, request.url).toString();
  return Response.redirect(target, 302);
}
