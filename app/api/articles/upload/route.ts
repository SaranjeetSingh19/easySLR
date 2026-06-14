import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
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

    const formattedArticles = articles.map((row: any) => ({
      projectId,
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

    const uniqueArticlesMap = new Map();
    formattedArticles.forEach((article) => {
      if (!article.title) return;

      const uniqueKey = `${article.title}-${article.doi}`;
      if (!uniqueArticlesMap.has(uniqueKey)) {
        uniqueArticlesMap.set(uniqueKey, article);
      }
    });

    const finalArticlesToInsert = Array.from(uniqueArticlesMap.values());

    const result = await prisma.article.createMany({
      data: finalArticlesToInsert,
      skipDuplicates: true, 
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
