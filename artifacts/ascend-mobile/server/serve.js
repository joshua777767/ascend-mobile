/**
 * Minimal production server for the mobile artifact landing page.
 * Zero file reads — everything is hardcoded to survive any deployment
 * environment where the filesystem layout may differ from dev.
 */

const http = require("http");

const basePath = (process.env.BASE_PATH || "/ascend-mobile/").replace(/\/+$/, "");
const appName = "Ascend: AI Fitness";

const LANDING_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${appName}</title>
<style>
*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;padding:48px 24px;text-align:center;background:#080D12;color:#F1F5F9;line-height:1.6;min-height:100dvh;display:flex;align-items:center;justify-content:center}.wrapper{max-width:420px;margin:0 auto}.logo{width:96px;height:96px;border-radius:24px;background:linear-gradient(135deg,#F59E0B,#D97706);margin:0 auto 24px;display:flex;align-items:center;justify-content:center;font-size:40px;font-weight:800;color:#080D12}h1{font-size:28px;font-weight:700;margin:0 0 12px}p{margin:0 0 32px;color:#94A3B8;font-size:16px}.cta{display:inline-block;padding:14px 32px;border-radius:12px;background:#F59E0B;color:#080D12;font-weight:700;text-decoration:none;font-size:16px}.footer{margin-top:48px;font-size:13px;color:#475569}
</style>
</head>
<body>
<div class="wrapper">
<div class="logo">A</div>
<h1>${appName}</h1>
<p>Your personal AI coach for body, energy, and focus.<br>Download the app on the App Store to get started.</p>
<a class="cta" href="https://apps.apple.com/us/app/ascend-ai-fitness/id6784409058" target="_blank" rel="noopener">Download on the App Store</a>
<div class="footer">&copy; 2026 Ascend Fit. All rights reserved.</div>
</div>
</body>
</html>`;

const MANIFEST = JSON.stringify({
  id: "com.ascendfit.app",
  createdAt: "2026-06-01T00:00:00Z",
  runtimeVersion: "1.0.0",
  launchAsset: { url: "/", contentType: "application/javascript" },
  assets: [],
  metadata: {},
});

const server = http.createServer((req, res) => {
  try {
    const host = req.headers.host || req.headers[":authority"] || "localhost";
    const url = new URL(req.url || "/", `http://${host}`);
    let pathname = url.pathname;

    if (basePath && pathname.startsWith(basePath)) {
      pathname = pathname.slice(basePath.length) || "/";
    }

    if (pathname === "/status" || pathname === "/healthz") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "ok", artifact: "ascend-mobile" }));
      return;
    }

    if (pathname === "/" || pathname === "/manifest") {
      const platform = req.headers["expo-platform"];
      if (platform === "ios" || platform === "android") {
        res.writeHead(200, {
          "content-type": "application/json",
          "expo-protocol-version": "1",
          "expo-sfv-version": "0",
        });
        res.end(MANIFEST);
        return;
      }

      if (pathname === "/") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(LANDING_HTML);
        return;
      }
    }

    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not Found");
  } catch (err) {
    res.writeHead(500, { "content-type": "text/plain" });
    res.end("Internal Server Error");
  }
});

const port = parseInt(process.env.PORT || "21494", 10);
server.listen(port, "0.0.0.0", () => {
  console.log(`[ascend-mobile] serving on port ${port}`);
});
