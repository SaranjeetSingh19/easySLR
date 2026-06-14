import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

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

    const idsToUpdate = articleIds || [articleId];

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