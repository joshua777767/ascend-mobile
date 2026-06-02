import { Router, type IRouter } from "express";
import healthRouter from "./health";
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

const router: IRouter = Router();

router.use(healthRouter);
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

export default router;
