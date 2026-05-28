import { chunkText } from "./chunker.js";
import {
  extractTextFromBuffer,
  extractTextFromFile,
  getFileType,
} from "./parsers.js";

export function createKnowledgeService(store, env = {}) {
  function withoutExtractedText(file) {
    const { extracted_text, ...publicFile } = file;
    return publicFile;
  }

  async function saveExtractedKnowledge({
    fileName,
    fileType,
    sourceType,
    text,
    pageCount,
  }) {
    if (!text.trim()) {
      throw new Error(`No readable text found in ${fileName}`);
    }

    const file = await store.createFile({
      user_id: env.DEFAULT_USER_ID ?? "local-user",
      file_name: fileName,
      file_type: fileType,
      source_type: sourceType,
      status: "needs_chunking",
      extracted_text: text,
      page_count: pageCount,
    });

    return withoutExtractedText({
      ...file,
      status: "needs_chunking",
      chunk_count: 0,
    });
  }

  return {
    async processUpload(file) {
      const parsed = await extractTextFromFile(file);

      return saveExtractedKnowledge({
        fileName: file.originalname,
        fileType: parsed.fileType,
        sourceType: "upload",
        text: parsed.text,
        pageCount: parsed.pageCount,
      });
    },

    async processSharePointUrl(url) {
      const headers = {};

      if (env.SHAREPOINT_ACCESS_TOKEN) {
        headers.Authorization = `Bearer ${env.SHAREPOINT_ACCESS_TOKEN}`;
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error(
          `Unable to fetch SharePoint document (${response.status}). Authentication placeholder: configure SHAREPOINT_ACCESS_TOKEN for private files.`,
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const fileName = decodeURIComponent(url.split("/").pop()?.split("?")[0] || "sharepoint-document");
      const fileType = getFileType(fileName, response.headers.get("content-type") ?? "");
      const parsed = await extractTextFromBuffer(buffer, {
        fileName,
        fileType,
        mimeType: response.headers.get("content-type") ?? "",
      });

      return saveExtractedKnowledge({
        fileName,
        fileType,
        sourceType: "sharepoint",
        text: parsed.text,
        pageCount: parsed.pageCount,
      });
    },

    listFiles(search) {
      return store.listFiles(search);
    },

    deleteFile(id) {
      return store.deleteFile(id);
    },

    async refreshChunks() {
      const files = await store.listChunkableFiles();
      let chunkCount = 0;

      for (const file of files) {
        const chunks = chunkText(file.extracted_text, {
          pageNumber: file.page_count ? 1 : null,
        });

        if (!chunks.length) {
          await store.updateFile(file.id, {
            status: "failed",
            chunk_count: 0,
          });
          continue;
        }

        await store.replaceChunks(file.id, chunks);
        chunkCount += chunks.length;
      }

      return {
        fileCount: files.length,
        chunkCount,
      };
    },

    searchChunks(query, limit) {
      return store.searchChunks(query, limit);
    },
  };
}
