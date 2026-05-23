import fs from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import { createKnowledgeService } from "./knowledge/service.js";
import { createKnowledgeStore } from "./storage/index.js";
import { buildQaPrompt, generateWithGemini } from "./ai/gemini.js";

const uploadDir = path.resolve(".data/uploads");
const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 12,
  },
});

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function parseUrl(req) {
  return new URL(req.url, "http://localhost");
}

async function cleanupFiles(files = []) {
  await Promise.all(
    files.map((file) => fs.unlink(file.path).catch(() => undefined)),
  );
}

export function createApiMiddleware(env) {
  const store = createKnowledgeStore(env);
  const knowledge = createKnowledgeService(store, env);

  return async function apiMiddleware(req, res, next) {
    const url = parseUrl(req);

    if (!url.pathname.startsWith("/api/")) {
      next();
      return;
    }

    try {
      if (url.pathname === "/api/knowledge/files" && req.method === "GET") {
        const files = await knowledge.listFiles(url.searchParams.get("search") ?? "");
        sendJson(res, 200, { files, storageMode: store.mode });
        return;
      }

      if (url.pathname === "/api/knowledge/upload" && req.method === "POST") {
        await fs.mkdir(uploadDir, { recursive: true });

        upload.array("files")(req, res, async (error) => {
          if (error) {
            sendJson(res, 400, { error: error.message });
            return;
          }

          try {
            const files = req.files ?? [];
            const processed = [];

            for (const file of files) {
              processed.push(await knowledge.processUpload(file));
            }

            await cleanupFiles(files);
            sendJson(res, 200, { files: processed });
          } catch (uploadError) {
            await cleanupFiles(req.files ?? []);
            sendJson(res, uploadError.statusCode ?? 500, {
              error: uploadError.message ?? "Unable to process upload.",
            });
          }
        });
        return;
      }

      if (
        url.pathname.startsWith("/api/knowledge/files/") &&
        req.method === "DELETE"
      ) {
        const id = decodeURIComponent(url.pathname.split("/").pop());
        await knowledge.deleteFile(id);
        sendJson(res, 200, { ok: true });
        return;
      }

      if (url.pathname === "/api/knowledge/sharepoint" && req.method === "POST") {
        const rawBody = await readRequestBody(req);
        const { url: sharePointUrl } = JSON.parse(rawBody || "{}");

        if (!sharePointUrl) {
          sendJson(res, 400, { error: "SharePoint URL is required." });
          return;
        }

        const file = await knowledge.processSharePointUrl(sharePointUrl);
        sendJson(res, 200, { file });
        return;
      }

      if (url.pathname === "/api/knowledge/search" && req.method === "GET") {
        const query = url.searchParams.get("q") ?? "";
        const chunks = await knowledge.searchChunks(query, 8);
        sendJson(res, 200, { chunks });
        return;
      }

      if (url.pathname === "/api/generate-test-cases" && req.method === "POST") {
        if (!env.GEMINI_API_KEY) {
          sendJson(res, 500, { error: "Missing GEMINI_API_KEY in .env.local" });
          return;
        }

        const rawBody = await readRequestBody(req);
        const { requirement } = JSON.parse(rawBody || "{}");

        if (!requirement || requirement.trim().length < 10) {
          sendJson(res, 400, {
            error: "Requirement text must be at least 10 characters.",
          });
          return;
        }

        const chunks = await knowledge.searchChunks(requirement, 8);
        const result = await generateWithGemini({
          apiKey: env.GEMINI_API_KEY,
          prompt: buildQaPrompt(requirement, chunks),
        });

        sendJson(res, 200, {
          ...result,
          knowledgeContext: chunks.map((chunk) => ({
            fileName: chunk.file_name,
            chunkText: chunk.chunk_text,
            score: chunk.score,
          })),
        });
        return;
      }

      sendJson(res, 404, { error: "API route not found." });
    } catch (error) {
      sendJson(res, error.statusCode ?? 500, {
        error: error.message ?? "Unexpected API error.",
      });
    }
  };
}
