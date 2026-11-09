/*
|--------------------------------------------------------------------------
| PDF REPORT GENERATION
|--------------------------------------------------------------------------
| Generates professional PDF reports for the Bluebell Bakehouse executive
| dashboard. Uses a minimal PDF writer built on Node.js built-in modules
| (no external dependencies required).
|
| PDF structure:
- %PDF-1.7 header
- Objects: catalog, pages, page, font, content stream
- Content stream with text operations
|--------------------------------------------------------------------------
*/

import { writeFileSync } from "node:fs";
import { createWriteStream } from "node:fs";
import { Writable } from "node:stream";

export interface ReportData {
  title: string;
  subtitle?: string;
  periodLabel: string;
  generatedAt: Date;
  kpis: Array<{ label: string; value: string; trend?: string }>;
  sections: Array<{
    title: string;
    columns: Array<{ header: string; key: string }>;
    rows: Array<Record<string, string | number>>;
  }>;
}

function escapePdfString(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`;
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-IN");
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN");
}

/*
|--------------------------------------------------------------------------
| BUILD PDF CONTENT STREAM
|--------------------------------------------------------------------------
*/

function buildPdfContent(report: ReportData): Buffer {
  const lines: string[] = [];

  // Helper to add text with positioning
  const text = (x: number, y: number, str: string, size: number = 12, bold: boolean = false) => {
    lines.push(`BT`);
    lines.push(`/${bold ? "Helvetica-Bold" : "Helvetica"} ${size} Tf`);
    lines.push(`${x} ${y} Td`);
    lines.push(`(${escapePdfString(str)}) Tj`);
    lines.push(`ET`);
  };

  // Helper for multi-line text block
  const textBlock = (x: number, y: number, linesToAdd: Array<{ text: string; size: number; bold?: boolean }>) => {
    let currentY = y;
    for (const line of linesToAdd) {
      lines.push(`BT`);
      lines.push(`/${line.bold ? "Helvetica-Bold" : "Helvetica"} ${line.size} Tf`);
      lines.push(`${x} ${currentY} Td`);
      lines.push(`(${escapePdfString(line.text)}) Tj`);
      lines.push(`ET`);
      currentY -= line.size + 4;
    }
    return currentY;
  };

  let y = 750;

  // Title
  text(50, y, report.title, 20, true);
  y -= 25;

  // Subtitle
  text(50, y, report.subtitle ?? "", 12, false);
  y -= 15;

  // Period
  text(50, y, `Reporting Period: ${report.periodLabel ?? ''}`, 10, false);
  y -= 15;

  // Generated at
  text(50, y, `Generated: ${formatDate(report.generatedAt)}`, 10, false);
  y -= 30;

  // KPI Section
  text(50, y, "Key Performance Indicators", 14, true);
  y -= 20;

  const kpiItemsPerRow = 3;
  const kpiColWidth = (540 - 100) / kpiItemsPerRow;
  let kpiX = 50;
  let kpiRowY = y;

  for (let i = 0; i < report.kpis.length; i++) {
    const kpi = report.kpis[i];
    if (!kpi) continue;
    const isLastInRow = (i + 1) % kpiItemsPerRow === 0 || i === report.kpis.length - 1;

    // KPI box
    lines.push(`BT`);
    lines.push(`/Helvetica-Bold 9 Tf`);
    lines.push(`${kpiX} ${kpiRowY - 8} Td`);
    lines.push(`(${escapePdfString(kpi.label)}) Tj`);
    lines.push(`ET`);

    text(kpiX, kpiRowY - 20, kpi.value, 11, true);

    if (kpi.trend) {
      text(kpiX, kpiRowY - 32, kpi.trend, 8, false);
    }

    if (isLastInRow) {
      kpiRowY -= 45;
      kpiX = 50;
    } else {
      kpiX += kpiColWidth;
    }
  }

  y = kpiRowY - 20;

  // Sections
  for (const section of report.sections) {
    text(50, y, section.title, 14, true);
    y -= 20;

    if (section.rows.length === 0) {
      text(50, y, "No data available.", 10, false);
      y -= 20;
      continue;
    }

    // Table header
    const colCount = section.columns.length;
    const colWidth = (540 - 100) / colCount;
    let colX = 50;

    // Header row
    lines.push(`BT`);
    lines.push(`/Helvetica-Bold 9 Tf`);
    for (const col of section.columns) {
      lines.push(`${colX} ${y} Td`);
      lines.push(`(${escapePdfString(col.header)}) Tj`);
      colX += colWidth;
    }
    lines.push(`ET`);
    y -= 15;

    // Data rows
    lines.push(`BT`);
    lines.push(`/Helvetica 8 Tf`);
    for (const row of section.rows) {
      colX = 50;
      for (const col of section.columns) {
        const val = row[col.key];
        const valStr = typeof val === "number" ? formatCurrency(val) : String(val);
        lines.push(`${colX} ${y} Td`);
        lines.push(`(${escapePdfString(valStr)}) Tj`);
        colX += colWidth;
      }
      lines.push(`ET`);
      y -= 12;

      if (y < 60) {
        // New page
        lines.push(`showpage`);
        lines.push(`BT`);
        lines.push(`/Helvetica 8 Tf`);
        y = 750;
        // Redraw header
        colX = 50;
        for (const col of section.columns) {
          lines.push(`${colX} ${y} Td`);
          lines.push(`(${escapePdfString(col.header)}) Tj`);
          colX += colWidth;
        }
        lines.push(`ET`);
        y -= 15;
        lines.push(`BT`);
        lines.push(`/Helvetica 8 Tf`);
      }
    }
    y -= 20;
  }

  return Buffer.from(lines.join("\n"));
}

/*
|--------------------------------------------------------------------------
| BUILD PDF DOCUMENT
|--------------------------------------------------------------------------
*/

function buildPdfDocument(contentBuffer: Buffer): Buffer {
  const contentLength = contentBuffer.length;

  // Object 1: Catalog
  const obj1 = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;

  // Object 2: Pages
  const obj2 = `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`;

  // Object 3: Page
  const obj3 = `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n`;

  // Object 4: Font Helvetica
  const obj4 = `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`;

  // Object 5: Font Helvetica-Bold
  const obj5 = `5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`;

  // Object 6: Content stream
  const obj6Length = contentBuffer.length;
  const obj6 = `6 0 obj\n<< /Length ${obj6Length} >>\nstream\n${contentBuffer.toString("latin1")}\nendstream\nendobj\n`;

  // Cross-reference table
  const xrefOffsets: number[] = [];
  let currentOffset = 0;

  const obj1Str = obj1;
  xrefOffsets.push(currentOffset);
  currentOffset += obj1Str.length;

  const obj2Str = obj2;
  xrefOffsets.push(currentOffset);
  currentOffset += obj2Str.length;

  const obj3Str = obj3;
  xrefOffsets.push(currentOffset);
  currentOffset += obj3Str.length;

  const obj4Str = obj4;
  xrefOffsets.push(currentOffset);
  currentOffset += obj4Str.length;

  const obj5Str = obj5;
  xrefOffsets.push(currentOffset);
  currentOffset += obj5Str.length;

  const obj6Str = obj6;
  xrefOffsets.push(currentOffset);
  currentOffset += obj6Str.length;

  const xref = `xref\n0 7\n0000000000 65535 f \n${xrefOffsets.map((o) => o.toString().padStart(10, "0") + " 00000 n \n").join("")}`;

  const trailer = `trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${currentOffset}\n%%EOF\n`;

  const parts = [obj1Str, obj2Str, obj3Str, obj4Str, obj5Str, obj6Str, xref, trailer];
  return Buffer.from(parts.join(""));
}

/*
|--------------------------------------------------------------------------
| GENERATE PDF REPORT
|--------------------------------------------------------------------------
*/

export function generatePdfReport(report: ReportData): Buffer {
  const contentBuffer = buildPdfContent(report);
  return buildPdfDocument(contentBuffer);
}

/*
|--------------------------------------------------------------------------
| BUILD SALES REPORT
|--------------------------------------------------------------------------
*/

export function buildSalesReport(data: {
  title: string;
  periodLabel: string;
  generatedAt: Date;
  kpis: Array<{ label: string; value: string; trend?: string }>;
  salesData: Array<{
    date: string;
    orders: number;
    revenue: number;
    collected: number;
    pendingCod: number;
  }>;
  paymentBreakdown: Array<{
    method: string;
    label: string;
    count: number;
    amount: number;
    collected: number;
    pendingCod: number;
  }>;
  subtitle?: string;
}): ReportData {
  return {
    title: data.title || "Sales Report",
    subtitle: data.subtitle || "Bluebell Bakehouse - Sales Analytics",
    periodLabel: data.periodLabel,
    generatedAt: data.generatedAt,
    kpis: data.kpis,
    sections: [
      {
        title: "Daily Sales Summary",
        columns: [
          { header: "Date", key: "date" },
          { header: "Orders", key: "orders" },
          { header: "Revenue", key: "revenue" },
          { header: "Collected", key: "collected" },
          { header: "Pending COD", key: "pendingCod" },
        ],
        rows: data.salesData.map((d) => ({
          date: d.date,
          orders: d.orders,
          revenue: formatCurrency(d.revenue),
          collected: formatCurrency(d.collected),
          pendingCod: formatCurrency(d.pendingCod),
        })),
      },
      {
        title: "Payment Method Breakdown",
        columns: [
          { header: "Method", key: "method" },
          { header: "Orders", key: "count" },
          { header: "Total Sales", key: "amount" },
          { header: "Collected", key: "collected" },
          { header: "Pending COD", key: "pendingCod" },
        ],
        rows: data.paymentBreakdown.map((p) => ({
          method: p.label,
          count: p.count,
          amount: formatCurrency(p.amount),
          collected: formatCurrency(p.collected),
          pendingCod: formatCurrency(p.pendingCod),
        })),
      },
    ],
  };
}

/*
|--------------------------------------------------------------------------
| BUILD PRODUCT PERFORMANCE REPORT
|--------------------------------------------------------------------------
*/

export function buildProductReport(data: {
  title: string;
  periodLabel: string;
  generatedAt: Date;
  kpis: Array<{ label: string; value: string; trend?: string }>;
  products: Array<{
    productName: string;
    category: string;
    unitsSold: number;
    revenue: number;
    cogs: number | null;
    grossProfit: number | null;
    grossProfitMargin: number | null;
  }>;
  subtitle?: string;
}): ReportData {
  return {
    title: data.title || "Product Performance Report",
    subtitle: data.subtitle || "Bluebell Bakehouse - Product Analytics",
    periodLabel: data.periodLabel,
    generatedAt: data.generatedAt,
    kpis: data.kpis,
    sections: [
      {
        title: "Product Performance Details",
        columns: [
          { header: "Product", key: "productName" },
          { header: "Category", key: "category" },
          { header: "Units Sold", key: "unitsSold" },
          { header: "Revenue", key: "revenue" },
          { header: "COGS", key: "cogs" },
          { header: "Gross Profit", key: "grossProfit" },
          { header: "Margin %", key: "grossProfitMargin" },
        ],
        rows: data.products.map((p) => ({
          productName: p.productName,
          category: p.category,
          unitsSold: p.unitsSold,
          revenue: formatCurrency(p.revenue),
          cogs: p.cogs !== null ? formatCurrency(p.cogs) : "N/A",
          grossProfit: p.grossProfit !== null ? formatCurrency(p.grossProfit) : "N/A",
          grossProfitMargin: p.grossProfitMargin !== null ? `${p.grossProfitMargin.toFixed(1)}%` : "N/A",
        })),
      },
    ],
  };
}

/*
|--------------------------------------------------------------------------
| BUILD CUSTOMER REPORT
|--------------------------------------------------------------------------
*/

export function buildCustomerReport(data: {
  title: string;
  periodLabel: string;
  generatedAt: Date;
  kpis: Array<{ label: string; value: string; trend?: string }>;
  customers: Array<{
    name: string;
    phone: string;
    email: string | null;
    orderCount: number;
    totalSpent: number;
    averageOrderValue: number;
    firstOrderAt: Date | null;
    lastOrderAt: Date | null;
    isGuest: boolean;
  }>;
  subtitle?: string;
}): ReportData {
  return {
    title: data.title || "Customer Intelligence Report",
    subtitle: data.subtitle || "Bluebell Bakehouse - Customer Analytics",
    periodLabel: data.periodLabel,
    generatedAt: data.generatedAt,
    kpis: data.kpis,
    sections: [
      {
        title: "Customer Details",
        columns: [
          { header: "Customer", key: "name" },
          { header: "Phone", key: "phone" },
          { header: "Email", key: "email" },
          { header: "Orders", key: "orderCount" },
          { header: "Total Spent", key: "totalSpent" },
          { header: "Avg Order Value", key: "averageOrderValue" },
          { header: "Type", key: "customerType" },
        ],
        rows: data.customers.map((c) => ({
          name: c.name,
          phone: c.phone,
          email: c.email ?? "N/A",
          orderCount: c.orderCount,
          totalSpent: formatCurrency(c.totalSpent),
          averageOrderValue: formatCurrency(c.averageOrderValue),
          customerType: c.isGuest ? "Guest" : "Registered",
        })),
      },
    ],
  };
}

/*
|--------------------------------------------------------------------------
| BUILD FINANCIAL REPORT
|--------------------------------------------------------------------------
*/

export function buildFinancialReport(data: {
  title: string;
  periodLabel: string;
  generatedAt: Date;
  kpis: Array<{ label: string; value: string; trend?: string }>;
  subtitle?: string;
}): ReportData {
  return {
    title: data.title || "Financial Report",
    subtitle: data.subtitle || "Bluebell Bakehouse - Financial Analytics",
    periodLabel: data.periodLabel,
    generatedAt: data.generatedAt,
    kpis: data.kpis,
    sections: [
      {
        title: "Financial Summary",
        columns: [
          { header: "Metric", key: "label" },
          { header: "Value", key: "value" },
        ],
        rows: data.kpis.map((kpi) => ({
          label: kpi.label,
          value: kpi.value,
        })),
      },
    ],
  };
}
