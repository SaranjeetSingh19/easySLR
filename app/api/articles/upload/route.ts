import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    // 1. Security Check: Who is uploading this?
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 },
      );
    }

    const { projectId, articles } = await req.json();

    if (!projectId || !articles || !Array.isArray(articles)) {
      return NextResponse.json(
        { error: "Invalid data format." },
        { status: 400 },
      );
    }

    // 2. Authorization Check: Does this user actually own this project?
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organization: {
          users: { some: { email: session.user.email } },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found or access denied." },
        { status: 403 },
      );
    }

    // 3. Format the Excel data to match our Prisma schema
    const formattedArticles = articles.map((row: any) => ({
      projectId,
      // We convert values to strings because Excel sometimes reads numbers (like Years) as Ints
      pmid: row["PMID"]?.toString() || null,
      title: row["Title"]?.toString() || null,
      authors: row["Authors"]?.toString() || null,
      citation: row["Citation"]?.toString() || null,
      firstAuthor: row["First Author"]?.toString() || null,
      journalBook: row["Journal/Book"]?.toString() || null,
      publicationYear: row["Publication Year"]?.toString() || null,
      createDate: row["Create Date"]?.toString() || null,
      pmcid: row["PMCID"]?.toString() || null,
      nihmsId: row["NIHMS ID"]?.toString() || null,
      doi: row["DOI"]?.toString() || null,
    }));

    // 4. Trap Handling: Remove exact duplicates within this specific payload
    // We check if a row has the exact same Title and DOI as another row in the upload
    const uniqueArticlesMap = new Map();
    formattedArticles.forEach((article) => {
      // If there's no title, we skip it (bad data trap)
      if (!article.title) return;

      const uniqueKey = `${article.title}-${article.doi}`;
      if (!uniqueArticlesMap.has(uniqueKey)) {
        uniqueArticlesMap.set(uniqueKey, article);
      }
    });

    const finalArticlesToInsert = Array.from(uniqueArticlesMap.values());

    // 5. Bulk Insert into PostgreSQL
    const result = await prisma.article.createMany({
      data: finalArticlesToInsert,
      skipDuplicates: true, // Prisma will ignore rows that violate database constraints
    });

    return NextResponse.json({
      success: true,
      insertedCount: result.count,
      totalProcessed: articles.length,
    });
  } catch (error) {
    console.error("Upload API Error:", error);
    return NextResponse.json(
      { error: "Failed to process the upload. Check server logs." },
      { status: 500 },
    );
  }
}
