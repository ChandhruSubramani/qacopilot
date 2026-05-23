const MIN_CHUNK_LENGTH = 120;

export function chunkText(text, metadata = {}) {
  const normalized = String(text ?? "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!normalized) {
    return [];
  }

  const words = normalized.split(/\s+/);
  const chunks = [];
  const targetWords = 220;
  const overlapWords = 40;

  for (let start = 0; start < words.length; start += targetWords - overlapWords) {
    const chunkWords = words.slice(start, start + targetWords);
    const chunkText = chunkWords.join(" ").trim();

    if (chunkText.length >= MIN_CHUNK_LENGTH || words.length <= targetWords) {
      chunks.push({
        chunk_text: chunkText,
        embedding_placeholder: null,
        page_number: metadata.pageNumber ?? null,
      });
    }
  }

  return chunks;
}
