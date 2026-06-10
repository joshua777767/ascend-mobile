import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import plansRouter from "./plans";
import workoutsRouter from "./workouts";
import mealsRouter from "./meals";
import journalRouter from "./journal";
import reviewsRouter from "./reviews";
import weighinsRouter from "./weighins";
import scheduleRouter from "./schedule";
import chatRouter from "./chat";
import progressRouter from "./progress";
import waterRouter from "./water";
import streakRouter from "./streak";
import goalCheckinsRouter from "./goalCheckins";
import adminRouter from "./admin";
import exportRouter from "./export";
import stripeRouter from "./stripe";
import revenuecatRouter from "./revenuecat";
import { requireAuth } from "./../middlewares/auth";

const router: IRouter = Router();

// Public routes
router.use(healthRouter);
router.use(authRouter);

// RevenueCat webhook must be public (no auth)
router.use(revenuecatRouter);

// All data routes require an authenticated session
router.use(requireAuth);
router.use(usersRouter);
router.use(plansRouter);
router.use(workoutsRouter);
router.use(mealsRouter);
router.use(journalRouter);
router.use(reviewsRouter);
router.use(weighinsRouter);
router.use(scheduleRouter);
router.use(chatRouter);
router.use(progressRouter);
router.use(waterRouter);
router.use(streakRouter);
router.use(goalCheckinsRouter);
router.use(exportRouter);
router.use(stripeRouter);
router.use(adminRouter);

export default router;
