import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch all projects that belong to the User's Organization
  const projects = await prisma.project.findMany({
    where: { 
      organization: {
        users: { some: { email: session.user.email } }
      } 
    },
    select: { id: true, name: true }
  });

  return NextResponse.json({ projects });
}


export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { name } = await req.json();
    if (!name) return NextResponse.json({ error: "Project name is required" }, { status: 400 });

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { organizationId: true }
    });

    if (!user?.organizationId) {
      return NextResponse.json({ error: "User does not belong to an organization" }, { status: 400 });
    }

    const newProject = await prisma.project.create({
      data: {
        name,
        organizationId: user.organizationId,
        users: { connect: { email: session.user.email } }
      }
    });

    return NextResponse.json({ success: true, project: newProject });
  } catch (error) {
    console.error("Create Project Error:", error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}

