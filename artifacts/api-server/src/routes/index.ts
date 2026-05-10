import { Router, type IRouter } from "express";
import healthRouter from "./health";
import anthropicRouter from "./anthropic";
import profileRouter from "./profile";
import chatRouter from "./chat";
import journalRouter from "./journal";
import assessmentsRouter from "./assessments";
import practicesRouter from "./practices";
import resourcesRouter from "./resources";
import dashboardRouter from "./dashboard";
import safetyRouter from "./safety";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/anthropic", anthropicRouter);
router.use(profileRouter);
router.use("/chat", chatRouter);
router.use("/journal", journalRouter);
router.use("/assessments", assessmentsRouter);
router.use("/practices", practicesRouter);
router.use("/resources", resourcesRouter);
router.use("/dashboard", dashboardRouter);
router.use("/safety", safetyRouter);

export default router;
