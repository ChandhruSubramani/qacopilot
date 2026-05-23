import { type FormEvent, useState } from "react";
import { KnowledgeBase } from "./pages/KnowledgeBase";
import {
  api,
  type KnowledgeChunk,
  type QaResponse,
  type TestCase,
  type TestCaseCategory,
} from "./lib/api";

const categoryStyles: Record<TestCaseCategory, string> = {
  Positive: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  Negative: "bg-red-50 text-red-700 ring-red-100",
  Validation: "bg-cyan-50 text-cyan-700 ring-cyan-100",
  "Validation checks": "bg-cyan-50 text-cyan-700 ring-cyan-100",
  Edge: "bg-amber-50 text-amber-700 ring-amber-100",
  "Edge cases": "bg-amber-50 text-amber-700 ring-amber-100",
};

const exportColumns = [
  "TC_ID",
  "Category",
  "Summary",
  "Test description",
  "Test Steps",
  "Expected",
] as const;

function formatSteps(steps: string[]) {
  return steps.map((step, index) => `${index + 1}. ${step}`).join("\n");
}

function buildExportRows(testCases: TestCase[]) {
  return testCases.map((testCase) => ({
    TC_ID: testCase.tcId,
    Category: testCase.category,
    Summary: testCase.summary,
    "Test description": testCase.testDescription,
    "Test Steps": formatSteps(testCase.testSteps),
    Expected: testCase.expected,
  }));
}

function getExportFileName(extension: "xlsx" | "pdf") {
  const date = new Date().toISOString().slice(0, 10);
  return `qacopilot-test-cases-${date}.${extension}`;
}

export default function App() {
  const [activePage, setActivePage] = useState<"generator" | "knowledge">(
    "generator",
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-950 lg:flex">
      <aside className="border-b border-slate-200 bg-white lg:min-h-screen lg:w-72 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3 px-5 py-5">
          <span className="flex size-10 items-center justify-center rounded-lg bg-slate-950 text-white">
            QA
          </span>
          <div>
            <p className="font-semibold">QACopilot</p>
            <p className="text-xs text-slate-500">AI QA workspace</p>
          </div>
        </div>
        <nav className="flex gap-2 px-5 pb-5 lg:flex-col">
          <NavButton
            active={activePage === "generator"}
            label="Generator"
            onClick={() => setActivePage("generator")}
          />
          <NavButton
            active={activePage === "knowledge"}
            label="Knowledge Base"
            onClick={() => setActivePage("knowledge")}
          />
        </nav>
      </aside>

      <main className="flex-1">
        <header className="border-b border-slate-200 bg-white px-5 py-5 sm:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-700">
            {activePage === "generator" ? "Test generation" : "Project memory"}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            {activePage === "generator"
              ? "Generate domain-aware QA test cases"
              : "Knowledge Base"}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            {activePage === "generator"
              ? "QACopilot searches uploaded project knowledge first, then sends matched context to Gemini for better test cases."
              : "Upload, parse, chunk, search, and manage project documents used by AI generation."}
          </p>
        </header>

        <div className="px-5 py-8 sm:px-8">
          {activePage === "generator" ? <GeneratorPage /> : <KnowledgeBase />}
        </div>
      </main>
    </div>
  );
}

function NavButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`rounded-lg px-4 py-2 text-left text-sm font-semibold ${
        active
          ? "bg-slate-950 text-white"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function GeneratorPage() {
  const [requirement, setRequirement] = useState("");
  const [qaResult, setQaResult] = useState<QaResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setQaResult(null);

    if (requirement.trim().length < 10) {
      setError("Please enter at least 10 characters of requirement text.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.post<QaResponse>("/api/generate-test-cases", {
        requirement,
      });
      setQaResult(response.data);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to generate test cases.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-8 xl:grid-cols-[0.85fr_1.15fr]">
        <form
          className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
          onSubmit={handleGenerate}
        >
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Requirement input</h2>
              <p className="text-sm text-slate-500">
                Add a user story, feature brief, or validation rule.
              </p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              RAG enabled
            </span>
          </div>
          <textarea
            className="min-h-64 w-full resize-y rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-800 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
            placeholder="Example: Gender Dropdown validation"
            value={requirement}
            onChange={(event) => setRequirement(event.target.value)}
          />
          {error ? (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </p>
          ) : null}
          <button
            className="mt-4 w-full rounded-lg bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-950/10 hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            disabled={isLoading}
          >
            {isLoading ? "Searching knowledge and generating..." : "Generate Test Cases"}
          </button>
        </form>

        <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold">AI flow</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {["Search knowledge chunks", "Attach matched context", "Generate QA table"].map(
              (step, index) => (
                <div key={step} className="rounded-lg bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase text-cyan-700">
                    Step {index + 1}
                  </p>
                  <p className="mt-2 text-sm font-semibold">{step}</p>
                </div>
              ),
            )}
          </div>
          <p className="mt-5 text-sm leading-6 text-slate-600">
            Upload PRDs, regression sheets, user guides, and screenshots in the
            Knowledge Base first. The generator searches those chunks before
            asking Gemini to create test cases.
          </p>
        </section>
      </section>

      {qaResult ? (
        <section className="space-y-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-700">
              Generated table
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              {qaResult.summary}
            </h2>
          </div>
          <KnowledgeContext chunks={qaResult.knowledgeContext ?? []} />
          <TestCaseTable testCases={qaResult.testCases} />
        </section>
      ) : (
        <section className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-lg font-semibold text-slate-900">
            Generated test cases will appear here
          </p>
          <p className="mt-2 text-sm text-slate-500">
            No mock data is shown. Generate from a real requirement after adding
            knowledge files.
          </p>
        </section>
      )}
    </div>
  );
}

function KnowledgeContext({ chunks }: { chunks: KnowledgeChunk[] }) {
  if (!chunks.length) {
    return (
      <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-100">
        No matching knowledge chunks were found. The result was generated from
        the requirement only.
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h3 className="text-lg font-semibold">Knowledge used</h3>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {chunks.map((chunk, index) => (
          <div key={`${chunk.fileName}-${index}`} className="rounded-lg bg-slate-50 p-4">
            <p className="text-sm font-semibold">{chunk.fileName}</p>
            <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
              {chunk.chunkText}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TestCaseTable({ testCases }: { testCases: TestCase[] }) {
  async function exportExcel() {
    const XLSX = await import("xlsx");
    const worksheet = XLSX.utils.json_to_sheet(buildExportRows(testCases), {
      header: [...exportColumns],
    });
    worksheet["!cols"] = [
      { wch: 12 },
      { wch: 18 },
      { wch: 34 },
      { wch: 48 },
      { wch: 64 },
      { wch: 48 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "QACopilot");
    XLSX.writeFile(workbook, getExportFileName("xlsx"));
  }

  async function exportPdf() {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "pt",
      format: "a4",
    });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 32;
    const usableWidth = pageWidth - margin * 2;
    const columnWidths = [58, 76, 124, 168, 210, 168];
    let y = 44;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("QACopilot Test Cases", margin, y);
    y += 24;

    doc.setFontSize(8);
    doc.setFillColor(15, 23, 42);
    doc.setTextColor(255, 255, 255);
    doc.rect(margin, y, usableWidth, 22, "F");

    let x = margin;
    exportColumns.forEach((column, index) => {
      doc.text(column, x + 4, y + 14, {
        maxWidth: columnWidths[index] - 8,
      });
      x += columnWidths[index];
    });
    y += 22;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 41, 59);

    testCases.forEach((testCase, rowIndex) => {
      const rowValues = [
        testCase.tcId,
        testCase.category,
        testCase.summary,
        testCase.testDescription,
        formatSteps(testCase.testSteps),
        testCase.expected,
      ];
      const splitCells = rowValues.map((value, index) =>
        doc.splitTextToSize(value, columnWidths[index] - 8),
      );
      const rowHeight = Math.max(
        34,
        ...splitCells.map((cell) => cell.length * 10 + 12),
      );

      if (y + rowHeight > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        y = margin;
      }

      if (rowIndex % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, usableWidth, rowHeight, "F");
      }

      x = margin;
      splitCells.forEach((cell, index) => {
        doc.text(cell, x + 4, y + 12, {
          maxWidth: columnWidths[index] - 8,
        });
        x += columnWidths[index];
      });

      y += rowHeight;
    });

    doc.save(getExportFileName("pdf"));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
          onClick={exportExcel}
          type="button"
        >
          Export Excel
        </button>
        <button
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
          onClick={exportPdf}
          type="button"
        >
          Export PDF
        </button>
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] border-collapse text-left text-sm">
            <thead className="bg-slate-950 text-white">
              <tr>
                <th className="w-24 px-4 py-3 font-semibold">TC_ID</th>
                <th className="w-32 px-4 py-3 font-semibold">Category</th>
                <th className="w-56 px-4 py-3 font-semibold">Summary</th>
                <th className="w-72 px-4 py-3 font-semibold">
                  Test description
                </th>
                <th className="w-80 px-4 py-3 font-semibold">Test Steps</th>
                <th className="w-72 px-4 py-3 font-semibold">Expected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {testCases.map((testCase) => (
                <tr key={testCase.tcId} className="align-top">
                  <td className="px-4 py-4 font-semibold text-slate-950">
                    {testCase.tcId}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${categoryStyles[testCase.category]}`}
                    >
                      {testCase.category}
                    </span>
                  </td>
                  <td className="px-4 py-4 font-medium text-slate-800">
                    {testCase.summary}
                  </td>
                  <td className="px-4 py-4 leading-6 text-slate-600">
                    {testCase.testDescription}
                  </td>
                  <td className="px-4 py-4">
                    <ol className="list-decimal space-y-1 pl-5 leading-6 text-slate-600">
                      {testCase.testSteps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  </td>
                  <td className="px-4 py-4 leading-6 text-slate-700">
                    {testCase.expected}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
