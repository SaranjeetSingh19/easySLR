# EasySLR: Article Review Workspace

A full-stack, multi-tenant SaaS workspace for systematic literature reviews. Researchers can create projects, stage and validate Excel datasets, and utilize a high-performance data table to review, filter, and bulk-process articles.

**Live Deployment:** [https://main.d2sw0ph2iwv9et.amplifyapp.com]
**Demo Credentials:** - Email: `john@gmail.com`
- Password: `1234`

---

## 🚀 Quick Start (Local Setup)

**Prerequisites:** Node.js (v18+) and a PostgreSQL database (e.g., Neon, Supabase, or local Docker).

1. **Clone & Install**
   ```bash
   git clone [your-repo-link]
   cd easyslr-workspace
   npm install

2. **Environment Variables**
Create a .env file in the root directory:

    DATABASE_URL="postgresql://user:password@host:port/db"
    NEXTAUTH_SECRET="generate-a-random-32-char-string"
    NEXTAUTH_URL="http://localhost:3000"

3. **Database Migration**
Push the Prisma schema to your PostgreSQL database
    npx prisma db push

4. **Run the Application**
    npm run dev
    The app will be available at http://localhost:3000.

5. **Run the Test Suite**
    npm run test



🏗️ Architecture & Data Model
The application is built on the T3-adjacent stack: Next.js (App Router), Tailwind CSS, Shadcn UI, Prisma, and NextAuth.

Domain Model Boundaries:

Organizations: The top-level tenant.

Users: Belong to Organizations.

Projects: Belong to Organizations.

Articles: Belong strictly to Projects.

Authorization Security:
Project access is enforced strictly server-side. UI hiding is insufficient. Every API route (GET, POST, PATCH) verifies the NextAuth session and executes a deep Prisma query to ensure the requesting user belongs to the Organization that owns the target Project:

// Server-Side Authorization Boundary Example
where: { 
  id: projectId,
  organization: { users: { some: { email: session.user.email } } } 
}



🧠 Product Judgment & Workflows
Instead of a generic CRUD table, the workspace is designed specifically for researcher velocity and data integrity.

1. Staged Import Validation (Excel)
Raw data is never piped directly into the database. When a user uploads an .xlsx file, it enters a client-side staging preview.

Validation: Rows are checked for missing required fields (e.g., Title) and data type mismatches (e.g., non-numeric Publication Years).

Duplicate Handling: The system generates a composite key (Title + DOI) to detect file-level duplicates before they hit the database.

User Agency: The user reviews the flagged errors in a staging table and explicitly commits the valid subset to the database.

2. High-Performance Review Table
Once imported, articles are managed in a fixed-layout data table optimized for large datasets.

Real-time Engine: Search (Title/Author), Status Filtering, and Year Sorting are processed in-memory using React useMemo to prevent unnecessary database hits and re-renders.

Bulk Actions: Reviewers can select multiple rows and apply bulk status changes (Include/Exclude/Maybe) via a floating action bar, executing a single updateMany Prisma transaction.

CSV Export: Researchers can instantly export their currently filtered view (e.g., only "Included" articles) back to a .csv for their final paper.

⚖️ Assumptions & Tradeoffs (Scope Control)
To respect the 8-12 hour timebox, the following scope control decisions were made:

1. Auto-Provisioning Organizations: While the database fully supports multi-user organizations, I skipped building an "Admin Settings" UI for inviting users. On registration, a user is automatically provisioned a personal Organization and a default Project so they can immediately test the core workspace workflow.

2. Client-Side Staging vs. Server-Side Queues: For enterprise apps with 100,000+ row Excel files, import validation should happen in a background server queue (e.g., AWS SQS). For this slice, client-side memory parsing is utilized for instant feedback, assuming typical SLR exports of 1,000-5,000 rows.


.

🧪 Testing Strategy
I implemented Vitest to ensure the integrity of the critical data pipelines. The test suite (__tests__/upload.test.ts) mocks NextAuth and Prisma to verify:

1. Rejection of unauthenticated API requests.

2. Cross-Tenant Data Isolation: Ensuring a user cannot upload to a project owned by a different organization.

3. Duplicate Filtering: Proving the upload pipeline successfully drops duplicate rows and only passes valid records to the createMany transaction


.

🤖 AI Usage Policy Disclosure
In accordance with the assessment guidelines, AI tools (Gemini) were used during development.

Assisted With: Rapid scaffolding of Shadcn UI components, Tailwind CSS grid/flexbox layout troubleshooting, and generating the boilerplate mock setup for the Vitest test suite.

Personally Verified: All Prisma schema relations, the Excel parsing logic (xlsx library integration), and the NextAuth server-side authorization checks.

Correction Example: Initially, the AI suggested a generic findMany() call for fetching projects. I rejected and corrected this to ensure the query was strictly scoped to the user's organizationId to prevent cross-tenant data leaks.

⏱️ Time Spent & Next Steps
Approximate Time Spent: ~7 Hours.

If given more time, I would improve:

1. Role-Based Access Control (RBAC): Implementing ADMIN and REVIEWER enums on the User model. Reviewers could only update statuses, while Admins could upload datasets and delete projects.

2. Conflict Resolution UI: Instead of dropping duplicate rows silently, providing a UI for the user to manually merge conflicting metadata between a PubMed export and a Scopus export. 