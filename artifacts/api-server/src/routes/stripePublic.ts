import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.get("/stripe/products", (_req, res): void => {
  res.json({
    data: [],
    keyMode: "none",
    error: "Web checkout is not available. Subscribe via the iOS app.",
  });
});

export default router;
