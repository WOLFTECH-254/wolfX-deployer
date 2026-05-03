import { Router, type IRouter } from "express";
import healthRouter from "./health";
import githubRouter from "./github";
import platformRouter from "./platform";
import appsRouter from "./apps";
import serversRouter from "./servers";
import deploymentsRouter from "./deployments";

const router: IRouter = Router();

router.use(healthRouter);
router.use(githubRouter);
router.use(platformRouter);
router.use(appsRouter);
router.use(serversRouter);
router.use(deploymentsRouter);

export default router;
