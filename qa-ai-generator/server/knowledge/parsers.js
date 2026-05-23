import fs from "node:fs/promises";
import path from "node:path";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { createWorker } from "tesseract.js";

const TEXT_EXTENSIONS = new Set([".txt", ".md", ".csv"]);
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"]);

export function getFileType(fileName = "", mimeType = "") {
  const extension = path.extname(fileName).toLowerCase();

  if (extension === ".pdf" || mimeType.includes("pdf")) return "pdf";
  if (extension === ".docx") return "docx";
  if (extension === ".xlsx" || extension === ".xls") return "excel";
  if (extension === ".csv") return "csv";
  if (TEXT_EXTENSIONS.has(extension) || mimeType.startsWith("text/")) return "text";
  if (IMAGE_EXTENSIONS.has(extension) || mimeType.startsWith("image/")) return "image";

  return "unknown";
}

export async function extractTextFromFile(file) {
  const buffer = await fs.readFile(file.path);
  const fileType = getFileType(file.originalname, file.mimetype);
  const result = await extractTextFromBuffer(buffer, {
    fileName: file.originalname,
    fileType,
    mimeType: file.mimetype,
  });

  return {
    ...result,
    fileType,
  };
}

export async function extractTextFromBuffer(buffer, metadata) {
  switch (metadata.fileType) {
    case "pdf":
      return parsePdf(buffer);
    case "docx":
      return parseDocx(buffer);
    case "excel":
      return parseExcel(buffer);
    case "csv":
    case "text":
      return parseText(buffer);
    case "image":
      return parseImage(buffer);
    default:
      throw new Error(`Unsupported file type for ${metadata.fileName}`);
  }
}

async function parsePdf(buffer) {
  const pdfParse = (await import("pdf-parse")).default;
  const parsed = await pdfParse(buffer);

  return {
    text: parsed.text,
    pageCount: parsed.numpages,
  };
}

async function parseDocx(buffer) {
  const parsed = await mammoth.extractRawText({ buffer });

  return {
    text: parsed.value,
    pageCount: null,
  };
}

function parseExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetTexts = workbook.SheetNames.map((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      blankrows: false,
    });

    return [
      `Sheet: ${sheetName}`,
      ...rows.map((row) => row.map((cell) => String(cell ?? "")).join(" | ")),
    ].join("\n");
  });

  return {
    text: sheetTexts.join("\n\n"),
    pageCount: workbook.SheetNames.length,
  };
}

function parseText(buffer) {
  return {
    text: buffer.toString("utf8"),
    pageCount: null,
  };
}

async function parseImage(buffer) {
  const worker = await createWorker("eng");

  try {
    const result = await worker.recognize(buffer);

    return {
      text: result.data.text,
      pageCount: 1,
    };
  } finally {
    await worker.terminate();
  }
}
