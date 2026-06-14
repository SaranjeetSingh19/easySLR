import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="text-center space-y-6">
        <div className="flex justify-center">
          <div className="bg-zinc-100 dark:bg-zinc-900 p-4 rounded-full">
            <FileQuestion className="h-12 w-12 text-zinc-500" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            404 - Page Not Found
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
            We couldn't find the page you were looking for. It might have been moved or deleted.
          </p>
        </div>
        <Button asChild className="mt-8">
          <Link href="/dashboard">Return to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}