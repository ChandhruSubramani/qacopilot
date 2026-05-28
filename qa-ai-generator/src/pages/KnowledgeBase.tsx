import { useCallback, useEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { api, type KnowledgeFile } from "../lib/api";

const fileIcons: Record<string, string> = {
  pdf: "PDF",
  docx: "DOC",
  excel: "XLS",
  csv: "CSV",
  text: "TXT",
  image: "IMG",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export function KnowledgeBase() {
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [search, setSearch] = useState("");
  const [sharePointUrl, setSharePointUrl] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isChunking, setIsChunking] = useState(false);
  const [chunkRefreshNeeded, setChunkRefreshNeeded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  const readyCount = files.filter((file) => file.status === "ready").length;
  const needsChunkingCount = files.filter(
    (file) => file.status === "needs_chunking",
  ).length;
  const chunkCount = files.reduce((total, file) => total + (file.chunk_count ?? 0), 0);
  const canRefreshChunks =
    files.length > 0 && (chunkRefreshNeeded || needsChunkingCount > 0);

  const loadFiles = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await api.get("/api/knowledge/files", {
        params: { search },
      });
      setFiles(response.data.files);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load files.");
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadFiles();
    }, 200);

    return () => window.clearTimeout(timeout);
  }, [loadFiles]);

  const uploadFiles = useCallback(async (acceptedFiles: File[]) => {
    if (!acceptedFiles.length) return;

    const formData = new FormData();
    acceptedFiles.forEach((file) => formData.append("files", file));

    setIsUploading(true);
    setUploadProgress(4);
    setMessage("");

    try {
      await api.post("/api/knowledge/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (event) => {
          if (!event.total) return;
          setUploadProgress(Math.round((event.loaded / event.total) * 100));
        },
      });
      setChunkRefreshNeeded(true);
      setMessage(
        "Knowledge files parsed and saved. Click Create / Refresh chunks before generating test cases.",
      );
      await loadFiles();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to upload knowledge files.",
      );
    } finally {
      setIsUploading(false);
      window.setTimeout(() => setUploadProgress(0), 800);
    }
  }, [loadFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: uploadFiles,
    multiple: true,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "text/plain": [".txt", ".md"],
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "image/*": [".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"],
    },
  });

  async function addSharePointDocument() {
    if (!sharePointUrl.trim()) {
      setMessage("Paste a SharePoint document URL first.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(25);
    setMessage("");

    try {
      await api.post("/api/knowledge/sharepoint", { url: sharePointUrl.trim() });
      setSharePointUrl("");
      setChunkRefreshNeeded(true);
      setMessage(
        "SharePoint document parsed and saved. Click Create / Refresh chunks before generating test cases.",
      );
      await loadFiles();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to fetch SharePoint document.",
      );
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }

  async function deleteFile(id: string) {
    await api.delete(`/api/knowledge/files/${id}`);
    setChunkRefreshNeeded(true);
    await loadFiles();
  }

  async function refreshChunks() {
    setIsChunking(true);
    setMessage("");

    try {
      const response = await api.post("/api/knowledge/chunks/refresh");
      setChunkRefreshNeeded(false);
      setMessage(
        `Chunks refreshed for ${response.data.fileCount} file(s). Stored ${response.data.chunkCount} reusable chunk(s).`,
      );
      await loadFiles();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to create chunks.",
      );
    } finally {
      setIsChunking(false);
    }
  }

  const fileTypeBreakdown = useMemo(() => {
    return files.reduce<Record<string, number>>((counts, file) => {
      counts[file.file_type] = (counts[file.file_type] ?? 0) + 1;
      return counts;
    }, {});
  }, [files]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Knowledge files" value={files.length} />
        <MetricCard label="Ready for AI" value={readyCount} />
        <MetricCard label="Stored chunks" value={chunkCount} />
      </div>

      <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Reusable knowledge chunks</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Uploads only parse and save document text. Create or refresh
              chunks when documents change, then test generation reuses those
              saved chunks.
            </p>
          </div>
          <button
            className="rounded-lg bg-cyan-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            disabled={!canRefreshChunks || isChunking}
            onClick={refreshChunks}
            type="button"
          >
            {isChunking ? "Creating chunks..." : "Create / Refresh chunks"}
          </button>
        </div>
        {canRefreshChunks ? (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
            Documents changed. Refresh chunks before generating new test cases.
          </p>
        ) : (
          <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
            Knowledge chunks are ready to reuse during test generation.
          </p>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Upload knowledge</h2>
            <p className="mt-1 text-sm text-slate-500">
              Add PDFs, DOCX, TXT, CSV, Excel, and image files. Text is parsed
              first; reusable chunks are created only when you click refresh.
            </p>
          </div>

          <div
            {...getRootProps()}
            className={`rounded-xl border-2 border-dashed p-8 text-center transition ${
              isDragActive
                ? "border-cyan-500 bg-cyan-50"
                : "border-slate-200 bg-slate-50 hover:border-cyan-300"
            }`}
          >
            <input {...getInputProps()} />
            <p className="text-base font-semibold text-slate-900">
              Drop multiple files here, or click to browse
            </p>
            <p className="mt-2 text-sm text-slate-500">
              PDF, DOCX, TXT, CSV, XLSX, and images with OCR are supported.
            </p>
          </div>

          {uploadProgress > 0 ? (
            <div className="mt-4">
              <div className="mb-2 flex justify-between text-xs font-semibold text-slate-500">
                <span>{isUploading ? "Processing" : "Complete"}</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-cyan-600 transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          ) : null}

          {message ? (
            <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {message}
            </p>
          ) : null}
        </section>

        <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold">SharePoint import</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Public/readable links are fetched now. Private SharePoint files are
            ready for future auth through `SHAREPOINT_ACCESS_TOKEN`.
          </p>
          <div className="mt-5 flex flex-col gap-3">
            <input
              className="rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
              placeholder="Paste SharePoint document URL"
              value={sharePointUrl}
              onChange={(event) => setSharePointUrl(event.target.value)}
            />
            <button
              className="rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-400"
              disabled={isUploading}
              onClick={addSharePointDocument}
              type="button"
            >
              Fetch document
            </button>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            {Object.entries(fileTypeBreakdown).map(([type, count]) => (
              <div key={type} className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase text-slate-400">
                  {type}
                </p>
                <p className="mt-1 text-xl font-semibold">{count}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Knowledge files</h2>
            <p className="mt-1 text-sm text-slate-500">
              Search, review status, and remove uploaded knowledge sources.
            </p>
          </div>
          <input
            className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 sm:max-w-xs"
            placeholder="Search files"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="space-y-3 p-5">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-14 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : files.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">File</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Source</th>
                  <th className="px-5 py-3">Chunks</th>
                  <th className="px-5 py-3">Uploaded</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {files.map((file) => (
                  <tr key={file.id}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="rounded-lg bg-slate-950 px-2 py-1 text-xs font-semibold text-white">
                          {fileIcons[file.file_type] ?? "FILE"}
                        </span>
                        <span className="font-medium text-slate-900">
                          {file.file_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{file.file_type}</td>
                    <td className="px-5 py-4 text-slate-600">{file.source_type}</td>
                    <td className="px-5 py-4 text-slate-600">
                      {file.chunk_count ?? 0}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {formatDate(file.upload_date)}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          file.status === "ready"
                            ? "bg-emerald-50 text-emerald-700"
                            : file.status === "failed"
                              ? "bg-red-50 text-red-700"
                              : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {file.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                        onClick={() => void deleteFile(file.id)}
                        type="button"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-10 text-center">
            <p className="text-lg font-semibold text-slate-900">
              No knowledge files yet
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Upload project documents to make test case generation domain aware.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}
