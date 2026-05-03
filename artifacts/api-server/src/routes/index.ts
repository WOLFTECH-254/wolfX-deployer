import { Router, type IRouter } from "express";
import healthRouter from "./health";
import githubRouter from "./github";
import appsRouter from "./apps";
import serversRouter from "./servers";
import deploymentsRouter from "./deployments";

const router: IRouter = Router();

router.use(healthRouter);
router.use(githubRouter);
router.use(appsRouter);
router.use(serversRouter);
router.use(deploymentsRouter);

export default router;
