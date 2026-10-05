import { Router } from "express";

import { createCustomCakeRequest } from "../controllers/customCakeController.js";

const router = Router();

router.post("/", createCustomCakeRequest);

export default router;
