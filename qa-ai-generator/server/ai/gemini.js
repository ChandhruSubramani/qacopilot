const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];

export function buildQaPrompt(requirement, contextChunks = []) {
  const context = contextChunks.length
    ? contextChunks
        .map(
          (chunk, index) =>
            `Context ${index + 1} from ${chunk.file_name}:\n${chunk.chunk_text}`,
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
Generate professional QA test cases in table-ready format.
Include all categories:
- Positive scenarios
- Negative scenarios
- Validation checks
- Edge cases
Create 2 test cases for each category, 8 total.
Use sequential TC_ID values from TC_001 to TC_008.
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
            temperature: 0.2,
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
