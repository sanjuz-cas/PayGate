import { createWorker, PSM } from "tesseract.js";

import type { ServiceEnv } from "./env.js";

type OcrResult = {
  fromName: string;
  envelopeSummary: string;
  ocrText: string;
};

let workerPromise: ReturnType<typeof createWorker> | null = null;

function getWorker(env: ServiceEnv) {
  if (!workerPromise) {
    workerPromise = createWorker(env.OCR_LANGS, 1);
  }

  return workerPromise;
}

function normalizeLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function isLikelyAddressLine(line: string) {
  const lower = line.toLowerCase();
  return (
    /\d/.test(line) ||
    /\b\d{5}\b/.test(line) ||
    /(strasse|straße|street|road|weg|platz|allee|gasse|lane)\b/i.test(line) ||
    /\b(de|germany|deutschland)\b/i.test(lower)
  );
}

function isLikelyParagraphLine(line: string) {
  return line.length > 80 || /[.!?;:]$/.test(line);
}

function extractSenderBlock(lines: string[]) {
  const candidateLines: string[] = [];

  for (const line of lines.slice(0, 12)) {
    if (!line) {
      if (candidateLines.length > 0) break;
      continue;
    }

    if (candidateLines.length > 0 && isLikelyParagraphLine(line)) {
      break;
    }

    candidateLines.push(line);

    if (candidateLines.length >= 4 && !isLikelyAddressLine(line)) {
      break;
    }
  }

  return candidateLines;
}

function inferFromName(candidateLines: string[]) {
  const preferred = candidateLines.find((line) => !isLikelyAddressLine(line));
  return preferred ?? candidateLines[0] ?? "";
}

function inferEnvelopeSummary(candidateLines: string[], fromName: string) {
  const remaining = candidateLines.filter((line) => line !== fromName);
  const addressLines = remaining.filter(isLikelyAddressLine);
  const summaryLines = (addressLines.length > 0 ? addressLines : remaining).slice(0, 3);
  return summaryLines.join(", ");
}

function fillFallbacks(lines: string[], result: OcrResult): OcrResult {
  if (!result.fromName) {
    result.fromName = lines[0] ?? "Unknown sender";
  }

  if (!result.envelopeSummary) {
    const addressFallback = lines.filter(isLikelyAddressLine).slice(0, 3);
    result.envelopeSummary =
      addressFallback.join(", ") || "Review scan and enter sender address";
  }

  return result;
}

export async function extractInboundLetterFromScan(
  imagePath: string,
  env: ServiceEnv,
): Promise<OcrResult> {
  const worker = await getWorker(env);
  await worker.setParameters({
    preserve_interword_spaces: "1",
    tessedit_pageseg_mode: PSM.AUTO,
    user_defined_dpi: "300",
  });

  const {
    data: { text },
  } = await worker.recognize(imagePath);

  const ocrText = text.trim();
  const lines = ocrText
    .split("\n")
    .map(normalizeLine)
    .filter(Boolean);

  const candidateLines = extractSenderBlock(lines);
  const fromName = inferFromName(candidateLines);
  const envelopeSummary = inferEnvelopeSummary(candidateLines, fromName);

  return fillFallbacks(lines, {
    fromName,
    envelopeSummary,
    ocrText,
  });
}
