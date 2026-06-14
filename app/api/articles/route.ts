import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

// GET: Fetch all articles for a specific project
export async function GET(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Grab the projectId from the URL (e.g., /api/articles?projectId=123)
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    // Fetch articles, ordering by newest first
    const articles = await prisma.article.findMany({
      where: {
        projectId: projectId,
        project: {
          organization: {
            users: { some: { email: session.user.email } }
          }
        }
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ articles });
  } catch (error) {
    console.error("GET Articles Error:", error);
    return NextResponse.json({ error: "Failed to fetch articles" }, { status: 500 });
  }
}

// PATCH: Update the review status (INCLUDE, EXCLUDE, MAYBE)
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { articleId, articleIds, status } = await req.json();

    if (!status || (!articleId && (!articleIds || articleIds.length === 0))) {
      return NextResponse.json({ error: "Article ID(s) and status are required" }, { status: 400 });
    }

    // Determine if we are updating a single article or an array of them
    const idsToUpdate = articleIds || [articleId];

    // Bulk update in PostgreSQL
    const result = await prisma.article.updateMany({
      where: { id: { in: idsToUpdate } },
      data: { status },
    });

    return NextResponse.json({ success: true, count: result.count });
  } catch (error) {
    console.error("Update Article Error:", error);
    return NextResponse.json({ error: "Failed to update article status" }, { status: 500 });
  }
}