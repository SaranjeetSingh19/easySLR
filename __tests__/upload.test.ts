import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "../app/api/articles/upload/route"; 
import { prisma } from "../lib/prisma";
import { getServerSession } from "next-auth";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("../lib/prisma", () => ({
  prisma: {
    project: { findFirst: vi.fn() },
    article: { createMany: vi.fn() },
  },
}));

describe("Article Upload API", () => {
  
  // clearing mocks before every test so they don't interfere with each other
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("TEST 1: Should block upload if user is not logged in", async () => {
    (getServerSession as any).mockResolvedValue(null);

    const req = new Request("http://localhost:3000/api/articles/upload", {
      method: "POST",
      body: JSON.stringify({ projectId: "123", articles: [] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);  
  });

  it("TEST 2: Should block upload if user does not have access to the project", async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: "hacker@test.com" } });
    
    (prisma.project.findFirst as any).mockResolvedValue(null);

    const req = new Request("http://localhost/api/articles/upload", {
      method: "POST",
      body: JSON.stringify({ projectId: "secret-project", articles: [] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403); 
  });

  it("TEST 3: Should successfully filter out duplicate articles and save the rest", async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: "hr@easyslr.com" } });
    
    (prisma.project.findFirst as any).mockResolvedValue({ id: "valid-project-id" });
    
    (prisma.article.createMany as any).mockResolvedValue({ count: 2 });

    const fakeExcelData = [
      { Title: "Valid Article One", DOI: "10.1000/1" },
      { Title: "Duplicate Article", DOI: "10.1000/2" },
      { Title: "Duplicate Article", DOI: "10.1000/2" },   
    ];

    const req = new Request("http://localhost/api/articles/upload", {
      method: "POST",
      body: JSON.stringify({ projectId: "valid-project-id", articles: fakeExcelData }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    
    expect(prisma.article.createMany).toHaveBeenCalledWith({
      data: expect.any(Array),
      skipDuplicates: true,
    });
    
    const prismaArgs = (prisma.article.createMany as any).mock.calls[0][0];
    expect(prismaArgs.data.length).toBe(2); 
  });
});