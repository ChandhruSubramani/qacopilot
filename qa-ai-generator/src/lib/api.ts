import axios from "axios";

export const api = axios.create({
  baseURL: "",
});

export type KnowledgeFile = {
  id: string;
  file_name: string;
  file_type: string;
  upload_date: string;
  source_type: "upload" | "sharepoint";
  status: "processing" | "needs_chunking" | "ready" | "failed";
  chunk_count?: number;
};

export type KnowledgeChunk = {
  fileName: string;
  chunkText: string;
  score: number;
};

export type TestCaseCategory =
  | "Positive"
  | "Negative"
  | "Validation"
  | "Validation checks"
  | "Edge"
  | "Edge cases";

export type TestCase = {
  tcId: string;
  category: TestCaseCategory;
  summary: string;
  testDescription: string;
  testSteps: string[];
  expected: string;
};

export type QaResponse = {
  summary: string;
  testCases: TestCase[];
  knowledgeContext?: KnowledgeChunk[];
};
