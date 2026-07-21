import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pinoHttp from "pino-http";
import { pool } from "@workspace/db";
import router from "./routes";
import { logger } from "./lib/logger";

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET must be set for authentication");
}

const app: Express = express();
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

const allowedDomains: string[] = [
  process.env.REPLIT_INTERNAL_APP_DOMAIN,
  process.env.REPLIT_DEV_DOMAIN,
  ...(process.env.REPLIT_DOMAINS?.split(",").map((s) => s.trim()) ?? []),
].filter((d): d is string => !!d);

app.use(
  cors({
    origin: (origin, callback) => {
      // Native apps, curl, server-to-server requests have no Origin header
      if (!origin) return callback(null, true);
      const ok = allowedDomains.some((d) => origin.includes(d));
      callback(null, ok);
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true, limit: "12mb" }));
app.use(cookieParser());

const PgSession = connectPgSimple(session);
app.use(
  session({
    store: new PgSession({ pool, tableName: "session", createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    // Re-issue Set-Cookie on every response so the Expires date stays 30 days
    // from *now* instead of 30 days from the original login. This is the key
    // fix for session expiry: WKWebView on iOS receives a fresh cookie on every
    // API call, preventing the browser from pruning a "stale" persistent cookie.
    // connect-pg-simple implements touch() so the DB expire column is also kept
    // current without a full session re-write (resave:false is respected).
    rolling: true,
    cookie: {
      httpOnly: true,
      // Always secure — server runs behind the Replit HTTPS proxy in all envs.
      // trust proxy: 1 is set above so Express correctly sees the forwarded scheme.
      secure: true,
      // SameSite=None is required for iOS WKWebView: the native app shell does not
      // share an origin with ascendfit.fitness, so Lax/Strict cookies are silently
      // dropped, logging users out on every relaunch. None allows the cookie in all
      // first-party WebView contexts. It requires secure:true (set above).
      sameSite: "none",
      maxAge: 1000 * 60 * 60 * 24 * 30,
    },
  }),
);

app.use("/api", router);

export default app;
