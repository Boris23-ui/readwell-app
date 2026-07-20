import { Router, type IRouter } from "express";
import healthRouter from "./health";
import quizRouter from "./quiz";

const router: IRouter = Router();

router.use(healthRouter);
router.use(quizRouter);

export default router;
