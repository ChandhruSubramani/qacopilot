import { createClient } from "@supabase/supabase-js";

export function createSupabaseKnowledgeStore({ url, serviceRoleKey }) {
  const supabase = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });

  return {
    mode: "supabase",

    async createFile(file) {
      const { data, error } = await supabase
        .from("knowledge_files")
        .insert({
          user_id: file.user_id ?? null,
          file_name: file.file_name,
          file_type: file.file_type,
          source_type: file.source_type,
          status: file.status ?? "processing",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async updateFile(id, patch) {
      const { data, error } = await supabase
        .from("knowledge_files")
        .update(patch)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async insertChunks(fileId, chunks) {
      const rows = chunks.map((chunk) => ({
        file_id: fileId,
        chunk_text: chunk.chunk_text,
        embedding_placeholder: chunk.embedding_placeholder ?? null,
        page_number: chunk.page_number ?? null,
      }));
      const { data, error } = await supabase
        .from("knowledge_chunks")
        .insert(rows)
        .select();

      if (error) throw error;

      await this.updateFile(fileId, {
        status: "ready",
        chunk_count: rows.length,
      });

      return data;
    },

    async listFiles(search = "") {
      let query = supabase
        .from("knowledge_files")
        .select("*")
        .order("upload_date", { ascending: false });

      if (search.trim()) {
        query = query.ilike("file_name", `%${search.trim()}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    },

    async deleteFile(id) {
      const chunks = await supabase
        .from("knowledge_chunks")
        .delete()
        .eq("file_id", id);

      if (chunks.error) throw chunks.error;

      const files = await supabase.from("knowledge_files").delete().eq("id", id);

      if (files.error) throw files.error;
    },

    async searchChunks(query, limit = 8) {
      const terms = query
        .toLowerCase()
        .split(/\W+/)
        .filter((term) => term.length > 2);
      const { data, error } = await supabase
        .from("knowledge_chunks")
        .select("*, knowledge_files(file_name)")
        .limit(100);

      if (error) throw error;

      return data
        .map((chunk) => {
          const text = chunk.chunk_text.toLowerCase();
          const score = terms.reduce(
            (total, term) => total + (text.includes(term) ? 1 : 0),
            0,
          );

          return {
            ...chunk,
            score,
            file_name: chunk.knowledge_files?.file_name ?? "Unknown file",
          };
        })
        .filter((chunk) => chunk.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    },
  };
}
