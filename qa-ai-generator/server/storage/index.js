import { createLocalKnowledgeStore } from "./localStore.js";
import { createSupabaseKnowledgeStore } from "./supabaseStore.js";

export function createKnowledgeStore(env) {
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    return createSupabaseKnowledgeStore({
      url: env.SUPABASE_URL,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    });
  }

  return createLocalKnowledgeStore();
}
