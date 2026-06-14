import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { email, name } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists." },
        { status: 400 }
      );
    }

    const newUser = await prisma.user.create({
      data: {
        email,
        name: name || "New User",
        organization: {
          create: {
            name: `${name || "My"} Workspace`,
            projects: {
              create: {
                name: "First Review Project",
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ success: true, user: newUser });
  } catch (error) {
    console.error("Registration Error:", error);
    return NextResponse.json(
      { error: "Something went wrong during registration." },
      { status: 500 }
    );
  }
}