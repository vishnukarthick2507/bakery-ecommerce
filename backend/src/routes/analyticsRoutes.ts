import { Router } from "express";

import {
  getAnalytics,
  exportAnalytics,
  getSalesAnalytics,
  getProductAnalyticsController,
  getCustomerAnalyticsController,
  getFinancialAnalyticsController,
  getInventoryAnalyticsController,
  getSalesReportPdf,
  getProductReportPdf,
  getCustomerReportPdf,
  getFinancialReportPdf,
} from "../controllers/analyticsController.js";
import { authenticateAdmin } from "../middleware/auth.js";

const router: Router = Router();

// Get analytics data (admin only)
router.get("/analytics", authenticateAdmin, getAnalytics);

// Export analytics to Excel (admin only)
router.get("/analytics/export", authenticateAdmin, exportAnalytics);

// Sales analytics (admin only)
router.get("/analytics/sales", authenticateAdmin, getSalesAnalytics);

// Product performance analytics (admin only)
router.get("/analytics/products", authenticateAdmin, getProductAnalyticsController);

// Customer intelligence analytics (admin only)
router.get("/analytics/customers", authenticateAdmin, getCustomerAnalyticsController);

// Financial analytics (admin only)
router.get("/analytics/financial", authenticateAdmin, getFinancialAnalyticsController);

// Inventory analytics (admin only)
router.get("/analytics/inventory", authenticateAdmin, getInventoryAnalyticsController);

// Report downloads (admin only)
router.get("/analytics/reports/sales", authenticateAdmin, getSalesReportPdf);
router.get("/analytics/reports/products", authenticateAdmin, getProductReportPdf);
router.get("/analytics/reports/customers", authenticateAdmin, getCustomerReportPdf);
router.get("/analytics/reports/financial", authenticateAdmin, getFinancialReportPdf);

export default router;
