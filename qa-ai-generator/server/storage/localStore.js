import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const DATA_DIR = path.resolve(".data");
const DB_PATH = path.join(DATA_DIR, "knowledge-store.json");

const emptyState = {
  user_projects: [],
  knowledge_files: [],
  knowledge_chunks: [],
};

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(DB_PATH);
  } catch {
    await fs.writeFile(DB_PATH, JSON.stringify(emptyState, null, 2));
  }
}

async function readStore() {
  await ensureStore();
  const raw = await fs.readFile(DB_PATH, "utf8");
  return JSON.parse(raw);
}

async function writeStore(state) {
  await ensureStore();
  await fs.writeFile(DB_PATH, JSON.stringify(state, null, 2));
}

function createId() {
  return crypto.randomUUID();
}

export function createLocalKnowledgeStore() {
  return {
    mode: "local",

    async createFile(file) {
      const state = await readStore();
      const now = new Date().toISOString();
      const record = {
        id: createId(),
        user_id: file.user_id ?? "local-user",
        file_name: file.file_name,
        file_type: file.file_type,
        upload_date: now,
        source_type: file.source_type,
        status: file.status ?? "processing",
        chunk_count: 0,
        created_at: now,
      };

      state.knowledge_files.unshift(record);
      await writeStore(state);
      return record;
    },

    async updateFile(id, patch) {
      const state = await readStore();
      state.knowledge_files = state.knowledge_files.map((file) =>
        file.id === id ? { ...file, ...patch } : file,
      );
      await writeStore(state);
      return state.knowledge_files.find((file) => file.id === id);
    },

    async insertChunks(fileId, chunks) {
      const state = await readStore();
      const records = chunks.map((chunk) => ({
        id: createId(),
        file_id: fileId,
        chunk_text: chunk.chunk_text,
        embedding_placeholder: chunk.embedding_placeholder ?? null,
        page_number: chunk.page_number ?? null,
        created_at: new Date().toISOString(),
      }));

      state.knowledge_chunks.push(...records);
      state.knowledge_files = state.knowledge_files.map((file) =>
        file.id === fileId
          ? { ...file, chunk_count: records.length, status: "ready" }
          : file,
      );
      await writeStore(state);
      return records;
    },

    async listFiles(search = "") {
      const state = await readStore();
      const query = search.trim().toLowerCase();

      return state.knowledge_files.filter((file) => {
        if (!query) return true;

        return [file.file_name, file.file_type, file.source_type, file.status]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      });
    },

    async deleteFile(id) {
      const state = await readStore();
      state.knowledge_files = state.knowledge_files.filter((file) => file.id !== id);
      state.knowledge_chunks = state.knowledge_chunks.filter(
        (chunk) => chunk.file_id !== id,
      );
      await writeStore(state);
    },

    async searchChunks(query, limit = 8) {
      const state = await readStore();
      const terms = query
        .toLowerCase()
        .split(/\W+/)
        .filter((term) => term.length > 2);

      return state.knowledge_chunks
        .map((chunk) => {
          const text = chunk.chunk_text.toLowerCase();
          const score = terms.reduce(
            (total, term) => total + (text.includes(term) ? 1 : 0),
            0,
          );
          const file = state.knowledge_files.find(
            (item) => item.id === chunk.file_id,
          );

          return {
            ...chunk,
            score,
            file_name: file?.file_name ?? "Unknown file",
          };
        })
        .filter((chunk) => chunk.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    },
  };
}
