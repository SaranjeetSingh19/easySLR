"use client";

import { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ArrowUpDown, Search, Filter, Download, CheckSquare } from "lucide-react";

type ReviewStatus = "PENDING" | "INCLUDE" | "EXCLUDE" | "MAYBE" | "ALL";

type Article = {
  id: string;
  title: string;
  authors: string;
  journalBook: string;
  publicationYear: string;
  status: ReviewStatus;
};

export function ArticleTable({ projectId, refreshTrigger }: { projectId: string | null, refreshTrigger: number }) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReviewStatus>("ALL");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | null>(null);

  // Bulk Action State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isUpdatingBulk, setIsUpdatingBulk] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    const fetchArticles = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/articles?projectId=${projectId}`);
        const data = await res.json();
        if (data.articles) setArticles(data.articles);
      } catch (error) {
        console.error("Failed to fetch articles:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchArticles();
    setSelectedIds(new Set()); // Clear selections on refresh
  }, [projectId, refreshTrigger]);

  // --- Filtering & Sorting Logic ---
  const filteredAndSortedArticles = useMemo(() => {
    let result = [...articles];
    if (searchTerm) {
      const lowerQuery = searchTerm.toLowerCase();
      result = result.filter(
        (a) => a.title?.toLowerCase().includes(lowerQuery) || a.authors?.toLowerCase().includes(lowerQuery)
      );
    }
    if (statusFilter !== "ALL") {
      result = result.filter((a) => a.status === statusFilter);
    }
    if (sortOrder) {
      result.sort((a, b) => {
        const yearA = parseInt(a.publicationYear) || 0;
        const yearB = parseInt(b.publicationYear) || 0;
        return sortOrder === "asc" ? yearA - yearB : yearB - yearA;
      });
    }
    return result;
  }, [articles, searchTerm, statusFilter, sortOrder]);

  const toggleSort = () => setSortOrder((prev) => (prev === "asc" ? "desc" : prev === "desc" ? null : "asc"));

  // --- CSV Export Logic ---
  const handleExportCSV = () => {
    // We only export the articles currently visible in the table
    const exportData = filteredAndSortedArticles.map(a => ({
      Title: a.title,
      Authors: a.authors,
      Journal: a.journalBook,
      Year: a.publicationYear,
      Review_Status: a.status
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Reviewed_Articles");
    XLSX.writeFile(workbook, "EasySLR_Export.csv", { bookType: "csv" });
  };

  // --- Individual Status Update ---
  const handleStatusChange = async (articleId: string, newStatus: ReviewStatus) => {
    setArticles((prev) => prev.map((article) => article.id === articleId ? { ...article, status: newStatus } : article));
    try {
      await fetch("/api/articles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId, status: newStatus }),
      });
    } catch (error) {
      console.error("Failed to update status", error);
    }
  };

  // --- Bulk Action Logic ---
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(filteredAndSortedArticles.map(a => a.id));
      setSelectedIds(allIds);
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) newSelected.add(id);
    else newSelected.delete(id);
    setSelectedIds(newSelected);
  };

  const handleBulkUpdate = async (newStatus: ReviewStatus) => {
    if (selectedIds.size === 0) return;
    setIsUpdatingBulk(true);
    
    const idsArray = Array.from(selectedIds);

    // Optimistic UI Update
    setArticles((prev) => prev.map((article) => idsArray.includes(article.id) ? { ...article, status: newStatus } : article));

    try {
      await fetch("/api/articles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleIds: idsArray, status: newStatus }),
      });
      setSelectedIds(new Set()); // Clear selection after success
    } catch (error) {
      console.error("Bulk update failed", error);
    } finally {
      setIsUpdatingBulk(false);
    }
  };

  const getStatusColor = (status: ReviewStatus) => {
    switch (status) {
      case "INCLUDE": return "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400";
      case "EXCLUDE": return "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400";
      case "MAYBE": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400";
      default: return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400";
    }
  };

  if (!projectId) return null;
  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-zinc-400" /></div>;
  if (articles.length === 0) return <div className="text-center py-12 border rounded-md border-zinc-200 dark:border-zinc-800 text-zinc-500">No articles in this project.</div>;

  const isAllSelected = filteredAndSortedArticles.length > 0 && selectedIds.size === filteredAndSortedArticles.length;

  return (
    <div className="space-y-4 relative">
      {/* --- Toolbar --- */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
          <Input placeholder="Search titles or authors..." className="pl-9 bg-white dark:bg-zinc-950" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="hidden sm:flex" disabled={filteredAndSortedArticles.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
          <div className="flex items-center text-sm text-zinc-500 gap-2 ml-2 mr-1">
            <Filter className="h-4 w-4" />
          </div>
          <Select value={statusFilter} onValueChange={(v: ReviewStatus) => setStatusFilter(v)}>
            <SelectTrigger className="w-[140px] bg-white dark:bg-zinc-950">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="INCLUDE">Included</SelectItem>
              <SelectItem value="MAYBE">Maybe</SelectItem>
              <SelectItem value="EXCLUDE">Excluded</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* --- Data Table --- */}
      <div className="rounded-md border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-950 relative">
        <Table className="table-fixed w-full min-w-[800px]">
          <TableHeader className="bg-zinc-50 dark:bg-zinc-900">
            <TableRow>
              {/* Checkbox Column */}
              <TableHead className="w-[50px] text-center">
                <Checkbox checked={isAllSelected} onCheckedChange={handleSelectAll} aria-label="Select all" />
              </TableHead>
              <TableHead className="w-[35%] min-w-[200px]">Title</TableHead>
              <TableHead className="w-[20%] min-w-[150px]">Authors</TableHead>
              <TableHead className="w-[20%] min-w-[150px]">Journal</TableHead>
              <TableHead className="w-[10%] min-w-[80px] cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" onClick={toggleSort}>
                <div className="flex items-center gap-1">Year<ArrowUpDown className="h-3 w-3" /></div>
              </TableHead>
              <TableHead className="w-[15%] min-w-[140px]">Review Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedArticles.length > 0 ? (
              filteredAndSortedArticles.map((article) => {
                const isSelected = selectedIds.has(article.id);
                return (
                  <TableRow key={article.id} className={isSelected ? "bg-zinc-50 dark:bg-zinc-800/50" : ""}>
                    <TableCell className="text-center">
                      <Checkbox checked={isSelected} onCheckedChange={(checked) => handleSelectOne(article.id, checked as boolean)} />
                    </TableCell>
                    <TableCell className="font-medium"><div className="line-clamp-2" title={article.title}>{article.title}</div></TableCell>
                    <TableCell className="text-zinc-500"><div className="line-clamp-1" title={article.authors}>{article.authors || "N/A"}</div></TableCell>
                    <TableCell className="text-zinc-500"><div className="line-clamp-1">{article.journalBook || "N/A"}</div></TableCell>
                    <TableCell className="text-zinc-500">{article.publicationYear || "N/A"}</TableCell>
                    <TableCell>
                      <Select value={article.status} onValueChange={(value: ReviewStatus) => handleStatusChange(article.id, value)}>
                        <SelectTrigger className={`h-8 w-full border-0 focus:ring-0 font-medium ${getStatusColor(article.status)}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PENDING">Pending</SelectItem>
                          <SelectItem value="INCLUDE">Include</SelectItem>
                          <SelectItem value="MAYBE">Maybe</SelectItem>
                          <SelectItem value="EXCLUDE">Exclude</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow><TableCell colSpan={6} className="h-24 text-center text-zinc-500">No articles found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      
      <div className="flex justify-between items-center text-sm text-zinc-500">
        <div>{selectedIds.size > 0 && <span>{selectedIds.size} row(s) selected.</span>}</div>
        <div>Showing {filteredAndSortedArticles.length} of {articles.length} articles</div>
      </div>

      {/* --- Floating Action Bar (Dynamic Island) --- */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-8 fade-in duration-300">
          <div className="bg-zinc-900 dark:bg-white text-zinc-50 dark:text-zinc-900 px-6 py-3 rounded-full shadow-2xl flex items-center gap-4">
            <span className="text-sm font-medium mr-2 flex items-center gap-2">
              <CheckSquare className="h-4 w-4" /> {selectedIds.size} Selected
            </span>
            <div className="h-4 w-px bg-zinc-700 dark:bg-zinc-300" />
            <Button size="sm" variant="ghost" className="hover:bg-green-500/20 hover:text-green-400" onClick={() => handleBulkUpdate("INCLUDE")} disabled={isUpdatingBulk}>Include</Button>
            <Button size="sm" variant="ghost" className="hover:bg-red-500/20 hover:text-red-400" onClick={() => handleBulkUpdate("EXCLUDE")} disabled={isUpdatingBulk}>Exclude</Button>
            <Button size="sm" variant="ghost" className="hover:bg-yellow-500/20 hover:text-yellow-400" onClick={() => handleBulkUpdate("MAYBE")} disabled={isUpdatingBulk}>Maybe</Button>
          </div>
        </div>
      )}
    </div>
  );
}