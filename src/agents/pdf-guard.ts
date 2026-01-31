/**
 * PDF Guard - Prevents infinite loop bug when reading large PDFs
 *
 * The Problem:
 * - When Claude reads a PDF with > 100 pages, API returns 400 error
 * - The PDF is already embedded in context, so every subsequent call fails
 * - Even /compact fails since it also makes an API call
 * - The only recovery is to kill the entire session
 *
 * Solution:
 * - Pre-check PDF files before reading
 * - Block PDFs > 25MB or > 100 pages
 * - Provide helpful error messages with recovery commands
 *
 * Based on upstream PR #20765 (pdf-guard plugin)
 */

import fs from "node:fs/promises";
import path from "node:path";

const MAX_PDF_SIZE_MB = 25;
const MAX_PDF_PAGES = 100;

export interface PdfValidationResult {
  valid: boolean;
  error?: string;
  pageCount?: number;
  fileSizeMb?: number;
}

/**
 * Check if a file is a PDF by extension
 */
export function isPdfFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ext === ".pdf";
}

/**
 * Count pages in a PDF without loading full content
 *
 * Uses PDF structure analysis to find page count:
 * 1. Look for /Count N in page tree (most reliable)
 * 2. Count /Type /Page occurrences as fallback
 *
 * This is a lightweight approach that works for most PDFs.
 */
async function countPdfPages(filePath: string): Promise<number | null> {
  const fd = await fs.open(filePath, "r");
  try {
    // Read chunks from the end of file where trailer usually is
    const stats = await fd.stat();
    const fileSize = stats.size;

    // Read last 4KB for trailer info
    const trailerSize = Math.min(4096, fileSize);
    const trailerBuffer = Buffer.alloc(trailerSize);
    await fd.read(trailerBuffer, 0, trailerSize, fileSize - trailerSize);
    const trailerText = trailerBuffer.toString("latin1");

    // Try to find /Count in page tree
    // Pattern: /Count N or /Count N/R (where N is the page count)
    const countMatch = trailerText.match(/\/Count\s+(\d+)/);
    if (countMatch) {
      return parseInt(countMatch[1], 10);
    }

    // If not found in trailer, read first 64KB and count page objects
    const headerSize = Math.min(65536, fileSize);
    const headerBuffer = Buffer.alloc(headerSize);
    await fd.read(headerBuffer, 0, headerSize, 0);
    const headerText = headerBuffer.toString("latin1");

    // Count /Type /Page occurrences
    const pageMatches = headerText.match(/\/Type\s*\/Page[^s]/g);
    if (pageMatches) {
      return pageMatches.length;
    }

    // If still not found, do a full scan (expensive but accurate)
    const fullBuffer = Buffer.alloc(fileSize);
    await fd.read(fullBuffer, 0, fileSize, 0);
    const fullText = fullBuffer.toString("latin1");

    // Look for /Count again in full text
    const fullCountMatch = fullText.match(/\/Count\s+(\d+)/g);
    if (fullCountMatch) {
      // Get the largest count (root page tree has the total)
      const counts = fullCountMatch.map((m) => parseInt(m.replace(/\/Count\s+/, ""), 10));
      return Math.max(...counts);
    }

    // Final fallback: count page objects
    const fullPageMatches = fullText.match(/\/Type\s*\/Page[^s]/g);
    if (fullPageMatches) {
      return fullPageMatches.length;
    }

    return null;
  } finally {
    await fd.close();
  }
}

/**
 * Validate a PDF file before reading
 *
 * Returns validation result with error message if invalid.
 */
export async function validatePdfFile(filePath: string): Promise<PdfValidationResult> {
  try {
    // Check if file exists
    const stats = await fs.stat(filePath);
    const fileSizeMb = stats.size / (1024 * 1024);

    // Check file size
    if (fileSizeMb > MAX_PDF_SIZE_MB) {
      return {
        valid: false,
        fileSizeMb,
        error:
          `PDF file is too large (${fileSizeMb.toFixed(1)}MB). ` +
          `Maximum allowed is ${MAX_PDF_SIZE_MB}MB.\n\n` +
          `To work with this file, consider:\n` +
          `- Split into smaller PDFs: pdftk ${path.basename(filePath)} burst\n` +
          `- Extract text: pdftotext ${path.basename(filePath)} output.txt\n` +
          `- Extract specific pages: pdftk ${path.basename(filePath)} cat 1-100 output smaller.pdf`,
      };
    }

    // Count pages
    const pageCount = await countPdfPages(filePath);

    if (pageCount !== null && pageCount > MAX_PDF_PAGES) {
      return {
        valid: false,
        pageCount,
        fileSizeMb,
        error:
          `PDF has ${pageCount} pages, which exceeds the ${MAX_PDF_PAGES} page limit.\n` +
          `Reading this file would cause an API error and corrupt the session context.\n\n` +
          `To work with this file, consider:\n` +
          `- Extract specific pages: pdftk ${path.basename(filePath)} cat 1-${MAX_PDF_PAGES} output smaller.pdf\n` +
          `- Extract text: pdftotext ${path.basename(filePath)} output.txt\n` +
          `- Split into chapters: pdftk ${path.basename(filePath)} burst`,
      };
    }

    return {
      valid: true,
      pageCount: pageCount ?? undefined,
      fileSizeMb,
    };
  } catch (err) {
    // If we can't validate (file doesn't exist, permission error, etc.),
    // let the actual Read tool handle the error
    return { valid: true };
  }
}

/**
 * Create an error result for blocked PDF files
 */
export function createPdfBlockedError(filePath: string, error: string): string {
  return `⚠️ PDF Guard: Cannot read "${path.basename(filePath)}"\n\n${error}`;
}
