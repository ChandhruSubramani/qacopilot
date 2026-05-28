const GEMINI_MODELS = ["gemini-2.0-flash", "gemini-2.5-flash"];
const MAX_CONTEXT_CHARS_PER_CHUNK = 700;

function trimChunkText(text) {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();

  if (normalized.length <= MAX_CONTEXT_CHARS_PER_CHUNK) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_CONTEXT_CHARS_PER_CHUNK)}...`;
}

export function buildQaPrompt(requirement, contextChunks = []) {
  const context = contextChunks.length
    ? contextChunks
        .map(
          (chunk, index) =>
            `Context ${index + 1} from ${chunk.file_name}:\n${trimChunkText(chunk.chunk_text)}`,
        )
        .join("\n\n---\n\n")
    : "No uploaded knowledge context matched this requirement.";

  return `
You are a senior QA engineer. Use the uploaded project knowledge context first, then the user requirement.

Uploaded project knowledge context:
${context}

Requirement:
${requirement.trim()}

Return only valid JSON with this exact shape:
{
  "summary": "short summary",
  "testCases": [
    {
      "tcId": "TC_001",
      "category": "Positive",
      "summary": "short test case summary",
      "testDescription": "clear professional test description",
      "testSteps": ["step 1", "step 2", "step 3"],
      "expected": "expected result"
    }
  ]
}
The predefined output table columns are fixed and must be populated for every test case:
- TC_ID
- Category
- Summary
- Test description
- Test Steps
- Expected
Generate professional QA test cases in table-ready format.
Include all categories:
- Positive scenarios
- Negative scenarios
- Validation checks
- Edge cases
Create only required test cases don't give too many
Use sequential TC_ID values from TC_001, TC_002 like this 
Prefer project-specific terminology, validations, workflows, and constraints found in the uploaded knowledge context.
`;
}

export async function generateWithGemini({ apiKey, prompt }) {
  let text = "";
  let lastError = "Gemini request failed.";
  let lastStatus = 502;

  for (const model of GEMINI_MODELS) {
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
            maxOutputTokens: 4096,
          },
        }),
      },
    );

    const data = await geminiResponse.json();

    if (geminiResponse.ok) {
      text =
        data.candidates?.[0]?.content?.parts
          ?.map((part) => part.text ?? "")
          .join("")
          .trim() ?? "";
      break;
    }

    lastError = data.error?.message ?? lastError;
    lastStatus = geminiResponse.status;
  }

  if (!text) {
    const error = new Error(lastError);
    error.statusCode = lastStatus;
    throw error;
  }

  return JSON.parse(text);
}
