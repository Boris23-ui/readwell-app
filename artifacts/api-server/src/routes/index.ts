import { Router, type IRouter } from "express";
import healthRouter from "./health";
import quizRouter from "./quiz";
import extractRouter from "./extract";
import pdfRouter from "./pdf";
import storageRouter from "./storage";
import simplifyRouter from "./simplify";

const router: IRouter = Router();

router.use(healthRouter);
router.use(quizRouter);
router.use(extractRouter);
router.use(pdfRouter);
router.use(storageRouter);
router.use(simplifyRouter);

export default router;
