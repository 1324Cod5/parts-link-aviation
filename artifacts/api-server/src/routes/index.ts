import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import authTestRouter from "./auth-test";
import listingsRouter from "./listings";
import uploadRouter from "./upload";
import documentsRouter from "./documents";
import sellerRouter from "./seller";
import adminRouter from "./admin";
import adminRfqsRouter from "./admin-rfqs";
import subscriptionRouter from "./subscription";
import rfqsRouter from "./rfqs";
import mroRouter from "./mro";
import debugRouter from "./debug";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(authTestRouter);
router.use(uploadRouter);
router.use(documentsRouter);
router.use(listingsRouter);
router.use(sellerRouter);
router.use(adminRouter);
router.use(adminRfqsRouter);
router.use(subscriptionRouter);
router.use(rfqsRouter);
router.use(mroRouter);
router.use(debugRouter);

export default router;
