"use client";

import { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { useSession } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/card";
import { ArticleTable } from "@/components/workspace/article-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FolderOpen,
  Plus,
  ArrowRight,
  X
} from "lucide-react";

type Project = { id: string; name: string };

type PreviewRow = {
  pmid: string;
  title: string;
  authors: string;
  journalBook: string;
  publicationYear: string;
  doi: string;
  isValid: boolean;
  errors: string[];
};

export default function DashboardPage() {
  const { data: session } = useSession();
  
  // --- Project State ---
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  
  // --- Upload & Staging Preview State ---
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProjects = async () => {
    const res = await fetch("/api/projects");
    if (res.ok) {
      const data = await res.json();
      if (data.projects) {
        setProjects(data.projects);
        if (!activeProjectId && data.projects.length > 0) {
          setActiveProjectId(data.projects[0].id);
        }
      }
    }
  };

  useEffect(() => {
    fetchProjects();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    setIsCreatingProject(true);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newProjectName }),
      });
      const data = await res.json();
      
      if (data.success) {
        setNewProjectName("");
        await fetchProjects();
        setActiveProjectId(data.project.id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreatingProject(false);
    }
  };

  // 1. Intercept file and generate the client-side validation preview
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setSuccess(false);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rawJson = XLSX.utils.sheet_to_json(worksheet) as any[];

      const seenKeys = new Set<string>();
      
      const validatedRows: PreviewRow[] = rawJson.map((row: any) => {
        const errors: string[] = [];
        const pmid = row["PMID"]?.toString() || "";
        const title = row["Title"]?.toString() || "";
        const authors = row["Authors"]?.toString() || "";
        const journalBook = row["Journal/Book"]?.toString() || "";
        const publicationYear = row["Publication Year"]?.toString() || "";
        const doi = row["DOI"]?.toString() || "";

        if (!title) errors.push("Missing Title");
        if (!pmid) errors.push("Missing PMID");
        
        // Validate publication year format
        if (publicationYear && isNaN(Number(publicationYear))) {
          errors.push("Invalid Year Format");
        }

        // File-level duplicate tracking
        const uniqueKey = `${title.toLowerCase().trim()}-${doi.toLowerCase().trim()}`;
        if (title && seenKeys.has(uniqueKey)) {
          errors.push("Duplicate Row in File");
        } else if (title) {
          seenKeys.add(uniqueKey);
        }

        return {
          pmid,
          title,
          authors,
          journalBook,
          publicationYear,
          doi,
          isValid: errors.length === 0,
          errors
        };
      });

      setPreviewRows(validatedRows);
    } catch (err) {
      console.error(err);
      setError("Failed to interpret the Excel template format.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // 2. Commit only the validated/selected rows to PostgreSQL database
  const handleCommitUpload = async () => {
    const validArticlesToUpload = previewRows
      .filter(row => row.isValid)
      .map(({ isValid, errors, ...cleanData }) => ({
        "PMID": cleanData.pmid,
        "Title": cleanData.title,
        "Authors": cleanData.authors,
        "Journal/Book": cleanData.journalBook,
        "Publication Year": cleanData.publicationYear,
        "DOI": cleanData.doi
      }));

    if (validArticlesToUpload.length === 0) {
      setError("No valid articles to upload.");
      return;
    }

    setIsUploading(true);
    try {
      if (!activeProjectId) throw new Error("No active project selected.");

      const response = await fetch("/api/articles/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: activeProjectId, articles: validArticlesToUpload }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Upload pipeline execution failed");

      setSuccess(true);
      setPreviewRows([]);
      setRefreshTrigger(prev => prev + 1); 
    } catch (err: any) {
      setError(err.message || "Pipeline sync error.");
    } finally {
      setIsUploading(false);
    }
  };

  const clearPreview = () => {
    setPreviewRows([]);
    setError("");
  };

  const activeProjectName = projects.find(p => p.id === activeProjectId)?.name || "Workspace";
  const validCount = previewRows.filter(r => r.isValid).length;
  const errorCount = previewRows.filter(r => !r.isValid).length;

 return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* ================= HEADER ROW ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{activeProjectName}</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-2">
            Import and review articles for this specific project.
          </p>
        </div>
        
        <div className="flex items-center gap-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-5 py-3 rounded-xl shadow-sm">
          <div className="p-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
            <FileText className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
          </div>
          <div className="pr-2">
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Total Projects</p>
            <p className="text-2xl font-bold leading-none text-zinc-900 dark:text-white">{projects.length}</p>
          </div>
        </div>
      </div>

      {/* ================= MIDDLE ROW: SIDEBAR & UPLOAD ================= */}
      <div className="flex flex-col md:flex-row gap-8">
        
        {/* Left Sidebar (Fixed Width) */}
        <div className="w-full md:w-64 shrink-0 space-y-6">
          <div>
            <h2 className="text-lg font-semibold tracking-tight mb-4">Your Projects</h2>
            <div className="space-y-1">
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => {
                    setActiveProjectId(project.id);
                    setSuccess(false);
                    setPreviewRows([]);
                    setError("");
                  }}
                  disabled={previewRows.length > 0}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors text-left ${
                    previewRows.length > 0 ? "opacity-50 cursor-not-allowed" : ""
                  } ${
                    activeProjectId === project.id 
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-medium" 
                      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  }`}
                >
                  <FolderOpen className="h-4 w-4" />
                  <span className="truncate">{project.name}</span>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleCreateProject} className="space-y-2 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">New Project</p>
            <div className="flex gap-2">
              <Input 
                placeholder="Project Name..." 
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                className="h-9 text-sm"
                disabled={previewRows.length > 0}
              />
              <Button type="submit" size="sm" className="h-9 px-3" disabled={isCreatingProject || !newProjectName || previewRows.length > 0}>
                {isCreatingProject ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>
          </form>
        </div>

        {/* Right Upload Area (Fills remaining space) */}
        <div className="flex-1 min-w-0">
          {activeProjectId && previewRows.length > 0 ? (
            /* Staging Preview View */
            <Card className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm rounded-xl overflow-hidden animate-in fade-in duration-300">
              <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">Staged Import Validation</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Reviewing file contents. <span className="text-green-600 font-medium">{validCount} clean rows</span> ready, <span className="text-red-500 font-medium">{errorCount} errors flagged</span>.
                  </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button variant="ghost" size="sm" onClick={clearPreview} className="text-zinc-500">
                    <X className="h-4 w-4 mr-1" /> Clear
                  </Button>
                  <Button size="sm" onClick={handleCommitUpload} disabled={isUploading || validCount === 0} className="w-full sm:w-auto">
                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Import {validCount} Articles <ArrowRight className="h-4 w-4 ml-1.5" /></>}
                  </Button>
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <Table className="table-fixed w-full min-w-[700px]">
                  {/* ... Keep your existing preview table code here ... */}
                  <TableHeader className="sticky top-0 bg-zinc-50 dark:bg-zinc-900 shadow-sm z-10">
                    <TableRow>
                      <TableHead className="w-[45%]">Title</TableHead>
                      <TableHead className="w-[20%]">PMID</TableHead>
                      <TableHead className="w-[15%]">Year</TableHead>
                      <TableHead className="w-[20%]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row, index) => (
                      <TableRow key={index} className={row.isValid ? "" : "bg-red-50/30 dark:bg-red-950/10"}>
                        <TableCell className="font-medium truncate" title={row.title}>{row.title || <span className="text-red-400 italic">Empty Title</span>}</TableCell>
                        <TableCell className="text-zinc-500 truncate">{row.pmid || "N/A"}</TableCell>
                        <TableCell className="text-zinc-500">{row.publicationYear || "N/A"}</TableCell>
                        <TableCell>{row.isValid ? <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded text-xs">Ready</span> : <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded text-xs">{row.errors[0]}</span>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          ) : activeProjectId ? (
            /* Standard Dropzone & Premium Success State */
            <Card className={`border-dashed border-2 bg-transparent shadow-none transition-colors
              ${error ? "border-red-500/50 bg-red-50/50 dark:bg-red-950/20" : "border-zinc-200 dark:border-zinc-800"}
              ${success ? "border-green-500/50 bg-green-50/50 dark:bg-green-950/20" : ""}
            `}>
              <CardContent className="flex flex-col items-center justify-center h-64 text-center space-y-6 pt-6">
                {success ? (
                  // --- NEW: Premium Success State UI ---
                  <div className="flex flex-col items-center justify-center space-y-4 animate-in zoom-in duration-300">
                    <div className="h-20 w-20 rounded-full bg-green-100 dark:bg-green-500/10 flex items-center justify-center border border-green-200 dark:border-green-500/20">
                      <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-500" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-semibold text-xl text-zinc-900 dark:text-zinc-50">Upload Complete</h3>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        Dataset has been successfully validated and imported to your workspace.
                      </p>
                    </div>
                    <Button onClick={() => setSuccess(false)} variant="outline" className="mt-2">
                      Upload Another File
                    </Button>
                  </div>
                ) : (
                  // --- Default Upload State ---
                  <>
                    <div className="h-12 w-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                      {error ? <AlertCircle className="h-6 w-6 text-red-500" /> : <UploadCloud className="h-6 w-6 text-zinc-600 dark:text-zinc-400" />}
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-medium text-lg">Stage Dataset for Validation</h3>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                        {error || "Select an .xlsx file to open the interactive staging validation view."}
                      </p>
                    </div>
                    <input type="file" accept=".xlsx, .xls, .csv" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
                    <Button onClick={() => fileInputRef.current?.click()}>Select Excel File</Button>
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
             <div className="text-center py-12 border rounded-md border-zinc-200 dark:border-zinc-800 text-zinc-500 h-full flex items-center justify-center">
               Create or select a project from the sidebar to begin.
             </div>
          )}
        </div>
      </div>

      {/* ================= BOTTOM ROW: FULL WIDTH TABLE ================= */}
      {/* Notice this is completely outside the sidebar flex container now! */}
      <div className="pt-8 border-t border-zinc-200 dark:border-zinc-800 mt-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold tracking-tight">Project Articles</h2>
        </div>
        <ArticleTable projectId={activeProjectId} refreshTrigger={refreshTrigger} />
      </div>

    </div>
  );
}