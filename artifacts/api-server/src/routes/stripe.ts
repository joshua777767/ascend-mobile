import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.get("/subscription", (_req, res): void => {
  res.json({ subscription: null, customerId: null });
});

router.post("/checkout", (_req, res): void => {
  res.status(503).json({ error: "Web checkout is not available. Subscribe via the iOS app." });
});

router.post("/portal", (_req, res): void => {
  res.status(503).json({ error: "Subscription portal is not available. Manage your subscription in the iOS app." });
});

export default router;
