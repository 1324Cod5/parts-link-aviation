import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import listingsRouter from "./listings";
import sellerRouter from "./seller";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(listingsRouter);
router.use(sellerRouter);
router.use(adminRouter);

export default router;
