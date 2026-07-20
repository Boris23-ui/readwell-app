import { Router, type IRouter } from "express";
import healthRouter from "./health";
import quizRouter from "./quiz";
import extractRouter from "./extract";

const router: IRouter = Router();

router.use(healthRouter);
router.use(quizRouter);
router.use(extractRouter);

export default router;
