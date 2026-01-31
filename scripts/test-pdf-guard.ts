/**
 * Test script for PDF Guard
 * Run with: npx tsx scripts/test-pdf-guard.ts
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { isPdfFile, validatePdfFile, createPdfBlockedError } from "../src/agents/pdf-guard.js";

const COLORS = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};

function log(msg: string, color = COLORS.reset) {
  console.log(`${color}${msg}${COLORS.reset}`);
}

function logTest(name: string) {
  log(`\n▶ ${name}`, COLORS.cyan);
}

function logPass(msg: string) {
  log(`  ✓ ${msg}`, COLORS.green);
}

function logFail(msg: string) {
  log(`  ✗ ${msg}`, COLORS.red);
}

function logInfo(msg: string) {
  log(`  ℹ ${msg}`, COLORS.dim);
}

// Create a minimal PDF for testing
async function createTestPdf(pageCount: number): Promise<string> {
  const tempDir = path.join(os.tmpdir(), "pdf-guard-test");
  await fs.mkdir(tempDir, { recursive: true });
  const pdfPath = path.join(tempDir, `test-${pageCount}-pages.pdf`);

  // Create a minimal PDF structure
  // This is a simplified PDF - just enough to have page count detection work
  const pages = [];
  let offset = 0;
  const offsets: number[] = [];

  // Header
  let content = "%PDF-1.4\n";
  offset = content.length;

  // Catalog (object 1)
  offsets.push(offset);
  const catalogObj = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
  content += catalogObj;
  offset += catalogObj.length;

  // Pages object (object 2) - contains page count
  offsets.push(offset);
  const pageRefs = Array.from({ length: pageCount }, (_, i) => `${i + 3} 0 R`).join(" ");
  const pagesObj = `2 0 obj\n<< /Type /Pages /Kids [${pageRefs}] /Count ${pageCount} >>\nendobj\n`;
  content += pagesObj;
  offset += pagesObj.length;

  // Individual page objects
  for (let i = 0; i < pageCount; i++) {
    offsets.push(offset);
    const pageObj = `${i + 3} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n`;
    content += pageObj;
    offset += pageObj.length;
  }

  // Cross-reference table
  const xrefOffset = offset;
  content += "xref\n";
  content += `0 ${pageCount + 3}\n`;
  content += "0000000000 65535 f \n";
  for (const off of offsets) {
    content += `${off.toString().padStart(10, "0")} 00000 n \n`;
  }

  // Trailer
  content += `trailer\n<< /Size ${pageCount + 3} /Root 1 0 R >>\n`;
  content += `startxref\n${xrefOffset}\n%%EOF\n`;

  await fs.writeFile(pdfPath, content);
  return pdfPath;
}

async function testIsPdfFile() {
  logTest("isPdfFile detection");

  const tests = [
    { path: "document.pdf", expected: true },
    { path: "Document.PDF", expected: true },
    { path: "file.Pdf", expected: true },
    { path: "file.txt", expected: false },
    { path: "file.docx", expected: false },
    { path: "/path/to/doc.pdf", expected: true },
    { path: "C:\\Users\\doc.PDF", expected: true },
  ];

  let passed = 0;
  for (const { path, expected } of tests) {
    const result = isPdfFile(path);
    if (result === expected) {
      logPass(`${path} → ${result}`);
      passed++;
    } else {
      logFail(`${path} → expected ${expected}, got ${result}`);
    }
  }

  return passed === tests.length;
}

async function testSmallPdf() {
  logTest("Small PDF validation (< 100 pages)");

  const pdfPath = await createTestPdf(10);
  logInfo(`Created test PDF: ${pdfPath}`);

  const result = await validatePdfFile(pdfPath);
  logInfo(`Validation result: valid=${result.valid}, pages=${result.pageCount}`);

  // Cleanup
  await fs.unlink(pdfPath);

  if (result.valid && result.pageCount === 10) {
    logPass("Small PDF passed validation");
    return true;
  } else {
    logFail(`Expected valid=true, pages=10, got valid=${result.valid}, pages=${result.pageCount}`);
    return false;
  }
}

async function testLargePdf() {
  logTest("Large PDF validation (> 100 pages)");

  const pdfPath = await createTestPdf(150);
  logInfo(`Created test PDF: ${pdfPath}`);

  const result = await validatePdfFile(pdfPath);
  logInfo(`Validation result: valid=${result.valid}, pages=${result.pageCount}`);

  // Cleanup
  await fs.unlink(pdfPath);

  if (!result.valid && result.pageCount === 150 && result.error) {
    logPass("Large PDF correctly blocked");
    logInfo(`Error message starts with: "${result.error.slice(0, 50)}..."`);
    return true;
  } else {
    logFail(`Expected valid=false, pages=150, got valid=${result.valid}, pages=${result.pageCount}`);
    return false;
  }
}

async function testNonexistentFile() {
  logTest("Nonexistent file handling");

  const result = await validatePdfFile("/nonexistent/file.pdf");
  logInfo(`Validation result: valid=${result.valid}`);

  if (result.valid) {
    logPass("Nonexistent file passes through (let Read handle error)");
    return true;
  } else {
    logFail("Expected valid=true for nonexistent files");
    return false;
  }
}

async function testErrorMessage() {
  logTest("Error message formatting");

  const error = createPdfBlockedError("/path/to/large.pdf", "Test error message");
  logInfo(`Error message:\n${error.split("\n").map((l) => `    ${l}`).join("\n")}`);

  if (error.includes("PDF Guard") && error.includes("large.pdf") && error.includes("Test error message")) {
    logPass("Error message formatted correctly");
    return true;
  } else {
    logFail("Error message missing expected content");
    return false;
  }
}

async function runAllTests() {
  log("\n════════════════════════════════════════", COLORS.cyan);
  log("   PDF Guard Test Suite", COLORS.cyan);
  log("════════════════════════════════════════\n", COLORS.cyan);

  const results: { name: string; passed: boolean }[] = [];

  results.push({
    name: "isPdfFile detection",
    passed: await testIsPdfFile(),
  });

  results.push({
    name: "Small PDF validation",
    passed: await testSmallPdf(),
  });

  results.push({
    name: "Large PDF validation",
    passed: await testLargePdf(),
  });

  results.push({
    name: "Nonexistent file handling",
    passed: await testNonexistentFile(),
  });

  results.push({
    name: "Error message formatting",
    passed: await testErrorMessage(),
  });

  // Summary
  log("\n════════════════════════════════════════", COLORS.cyan);
  log("   Test Results Summary", COLORS.cyan);
  log("════════════════════════════════════════\n", COLORS.cyan);

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  for (const result of results) {
    const icon = result.passed ? "✓" : "✗";
    const color = result.passed ? COLORS.green : COLORS.red;
    log(`  ${icon} ${result.name}`, color);
  }

  log(`\n  Total: ${passed}/${total} tests passed\n`, passed === total ? COLORS.green : COLORS.yellow);

  // Cleanup temp directory
  const tempDir = path.join(os.tmpdir(), "pdf-guard-test");
  try {
    await fs.rm(tempDir, { recursive: true });
  } catch {
    // Ignore cleanup errors
  }

  process.exit(passed === total ? 0 : 1);
}

// Run tests
runAllTests().catch((err) => {
  log(`\n❌ Test suite failed: ${err}`, COLORS.red);
  process.exit(1);
});
