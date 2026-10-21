import fs from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import { prisma } from "./prisma";
import { callLlm } from "./llm";
import { getEnabledStandards } from "./flags";

const execAsync = promisify(exec);

interface ParsedControlItem {
  standard_id: string;
  title: string;
  category?: string;
  result: "Meets" | "Partially Meets" | "Does Not Meet" | "Not Applicable";
  severity?: "Critical" | "High" | "Medium" | "Low" | "Info";
  evidence?: string;
  recommendation?: string;
}

interface LlmAssessmentOutput {
  summary: string;
  compliance_score?: number;
  items: ParsedControlItem[];
}

/**
 * Scan a cloned repository directory to collect file tree and config snippets.
 */
function inspectRepository(repoDir: string): { fileTree: string[]; snippets: Record<string, string> } {
  const fileTree: string[] = [];
  const snippets: Record<string, string> = {};

  const ignoreDirs = new Set([
    ".git",
    "node_modules",
    ".next",
    "dist",
    "build",
    "out",
    ".cache",
    ".vscode",
    ".idea",
    "vendor",
    "target",
    "coverage",
  ]);

  const targetSnippetFiles = new Set([
    "package.json",
    "dockerfile",
    "docker-compose.yml",
    "docker-compose.yaml",
    ".env.example",
    ".env.sample",
    ".env.template",
    "readme.md",
    "security.md",
    "middleware.ts",
    "middleware.js",
    "pom.xml",
    "requirements.txt",
    "go.mod",
  ]);

  function walk(currentDir: string, relPath = "") {
    if (fileTree.length >= 120) return; // avoid huge trees
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith(".") && entry.name !== ".env.example" && entry.name !== ".env.sample") {
          if (entry.isDirectory()) continue;
        }

        const childRel = relPath ? `${relPath}/${entry.name}` : entry.name;
        const childAbs = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          if (!ignoreDirs.has(entry.name.toLowerCase())) {
            fileTree.push(`${childRel}/`);
            walk(childAbs, childRel);
          }
        } else if (entry.isFile()) {
          fileTree.push(childRel);

          const lowerName = entry.name.toLowerCase();
          if (targetSnippetFiles.has(lowerName) && Object.keys(snippets).length < 8) {
            try {
              const content = fs.readFileSync(childAbs, "utf-8");
              snippets[childRel] = content.slice(0, 1800);
            } catch {}
          }
        }
      }
    } catch {}
  }

  walk(repoDir);
  return { fileTree, snippets };
}

/**
 * Executes an assessment in the background.
 */
export async function runAssessment(assessmentId: string): Promise<void> {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: { application: true },
  });

  if (!assessment) {
    console.error(`[AssessmentEngine] Assessment ${assessmentId} not found.`);
    return;
  }

  const app = assessment.application;
  const tempDir = path.join(os.tmpdir(), `pixxelai_review_${assessment.id}_${Date.now()}`);
  let repoCloned = false;
  let cloneError: string | null = null;
  let fileTree: string[] = [];
  let snippets: Record<string, string> = {};

  try {
    // Phase 1: Repository inspection
    if (app.repo_url) {
      await prisma.assessment.update({
        where: { id: assessmentId },
        data: { status: "cloning" },
      });

      try {
        // Shallow clone single branch for fast retrieval (timeout 45s)
        await execAsync(`git clone --depth 1 --single-branch "${app.repo_url}" "${tempDir}"`, {
          timeout: 45000,
        });
        repoCloned = true;
        const repoData = inspectRepository(tempDir);
        fileTree = repoData.fileTree;
        snippets = repoData.snippets;
      } catch (err: any) {
        console.warn(`[AssessmentEngine] Git clone failed for ${app.repo_url}:`, err.message);
        cloneError = err.message || "Failed to clone repository.";
      }
    }

    // Phase 2: Retrieve standard
    await prisma.assessment.update({
      where: { id: assessmentId },
      data: { status: "analyzing" },
    });

    const enabledCategories = await getEnabledStandards();
    const activeStandards = await prisma.standard.findMany({
      where: {
        category: { in: enabledCategories },
      },
      orderBy: { category: "asc" },
    });

    let standardContent = "";
    if (activeStandards.length > 0) {
      standardContent = activeStandards.map((s) => s.content).join("\n\n---\n\n");
    } else {
      const fallbackStandard = await prisma.standard.findFirst({
        where: { slug: "security" },
      });
      standardContent = fallbackStandard?.content || `
# Application Security Baseline
- SEC-01: SSO (Single Sign-On) - Corporate IdP SAML/OIDC integration
- SEC-02: MFA (Multi-Factor Authentication) - Enforced for logins and admins
- SEC-03: Centralized Audit Logging - Security events to SIEM
- SEC-04: SCIM Automated Deprovisioning - Automated user deactivation
- SEC-05: Role-Based Access Control (RBAC) - Granular permissions
- SEC-06: Secrets & Vault Management - Zero hardcoded credentials
- SEC-07: Vulnerability Scanning & Patching - Regular dependency scans
- SEC-08: Data Encryption in Transit & at Rest - TLS 1.2+ & AES-256
`;
    }

    // Phase 3: Construct LLM prompt
    const systemPrompt = `You are a Principal Enterprise Architect, Security Specialist, and Compliance Auditor.
Your task is to assess a software application against the organization's active baseline standards (${enabledCategories.join(", ")}).
You must review the application profile, repository structure, and configuration files, then provide a rigorous, objective evaluation for each mandatory control in the standard.

For each control, assign one of these exact result classifications:
- "Meets": Evidence indicates the control is properly designed, configured, or implemented.
- "Partially Meets": Partial implementation or planned controls exist, but with clear gaps or risks.
- "Does Not Meet": Control is missing, violated, or no evidence of required safeguard is present.
- "Not Applicable": Control is irrelevant due to application architecture (e.g. static documentation site without user auth).

You MUST return a valid JSON object matching this schema:
{
  "summary": "2-4 sentence executive summary highlighting key strengths and primary security risks",
  "compliance_score": 75,
  "items": [
    {
      "standard_id": "SEC-01",
      "title": "SSO (Single Sign-On)",
      "category": "Security",
      "result": "Meets",
      "severity": "Critical",
      "evidence": "Describe specific observations from repository, dependencies, config, or metadata",
      "recommendation": "Actionable next steps to address gaps (or maintain compliance)"
    }
  ]
}
Ensure all standard controls are evaluated. Do not include markdown code block syntax outside the JSON object. Output ONLY raw JSON.`;

    let codebaseContext = "No repository URL was configured for this application.";
    if (app.repo_url) {
      if (repoCloned) {
        codebaseContext = `Repository: ${app.repo_url}\nCloned successfully.\n\nFile Tree Excerpt (${fileTree.length} items):\n${fileTree.slice(0, 80).join("\n")}\n\n`;
        if (Object.keys(snippets).length > 0) {
          codebaseContext += "Configuration & Setup Snippets:\n";
          for (const [filename, code] of Object.entries(snippets)) {
            codebaseContext += `--- ${filename} ---\n${code}\n\n`;
          }
        }
      } else {
        codebaseContext = `Repository: ${app.repo_url}\nClone attempt failed: ${cloneError}.\nEvaluate based on application architecture and standard patterns for this application type.`;
      }
    }

    const userPrompt = `Assess the following application against the Security Baseline Standard:

APPLICATION DETAILS:
- Name: ${app.name}
- Short Code: ${app.short_code || "N/A"}
- Category: ${app.category}
- Hosting / Type: ${app.type}
- Lifecycle Status: ${app.lifecycle_status}
- Business Owner: ${app.business_owner || "Unassigned"}
- Technical Owner: ${app.technical_owner || "Unassigned"}
- Vendor: ${app.vendor || "Internal / Self-hosted"}
- App URL: ${app.app_url || "N/A"}
- Documentation URL: ${app.doc_url || "N/A"}
- Knowledge Base URL: ${app.knowledge_base_url || "N/A"}
- Regulatory Sources: ${app.regulatory_sources || "None specified"}
- Description: ${app.description || "N/A"}

REPOSITORY & CODEBASE AUDIT:
${codebaseContext}

STANDARDS REFERENCE:
${standardContent}

Perform the assessment and return the strict JSON output.`;

    // Phase 4: Call active LLM
    const llmRes = await callLlm({
      prompt: userPrompt,
      systemPrompt,
      temperature: 0.1,
      maxTokens: 4096,
    });

    // Clean JSON response (strip markdown fences if present)
    let rawText = llmRes.text.trim();
    if (rawText.startsWith("```")) {
      rawText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    }

    let parsed: LlmAssessmentOutput;
    try {
      parsed = JSON.parse(rawText);
    } catch (parseErr) {
      // Fallback regex attempt to find { ... }
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        throw new Error(`LLM output did not contain valid JSON: ${rawText.slice(0, 200)}...`);
      }
    }

    const items = Array.isArray(parsed.items) ? parsed.items : [];

    // Count statistics
    let meetsCount = 0;
    let partialCount = 0;
    let failsCount = 0;
    let naCount = 0;

    for (const item of items) {
      const res = (item.result || "").trim();
      if (res.toLowerCase().includes("partially")) {
        item.result = "Partially Meets";
        partialCount++;
      } else if (res.toLowerCase().includes("does not") || res.toLowerCase().includes("fail")) {
        item.result = "Does Not Meet";
        failsCount++;
      } else if (res.toLowerCase().includes("not applicable") || res.toLowerCase() === "n/a") {
        item.result = "Not Applicable";
        naCount++;
      } else {
        item.result = "Meets";
        meetsCount++;
      }
    }

    const applicableCount = items.length - naCount;
    let calculatedScore = parsed.compliance_score ?? 0;
    if (applicableCount > 0) {
      calculatedScore = Math.round(((meetsCount * 100) + (partialCount * 50)) / applicableCount);
    } else if (items.length > 0) {
      calculatedScore = 100;
    }

    // Phase 5: Persist results
    await prisma.$transaction(async (tx) => {
      // Remove any prior items for this assessment
      await tx.assessmentItem.deleteMany({
        where: { assessment_id: assessmentId },
      });

      // Insert new items
      if (items.length > 0) {
        await tx.assessmentItem.createMany({
          data: items.map((it) => ({
            assessment_id: assessmentId,
            standard_id: it.standard_id || "SEC-00",
            title: it.title || "Control",
            category: it.category || "Security",
            result: it.result,
            severity: it.severity || "Medium",
            evidence: it.evidence || "",
            recommendation: it.recommendation || "",
          })),
        });
      }

      // Update assessment record
      await tx.assessment.update({
        where: { id: assessmentId },
        data: {
          status: "completed",
          compliance_score: calculatedScore,
          summary: parsed.summary || "Security review completed.",
          items_count: items.length,
          meets_count: meetsCount,
          partial_count: partialCount,
          fails_count: failsCount,
          na_count: naCount,
          llm_provider: llmRes.provider,
          llm_model: llmRes.model,
          completed_at: new Date(),
        },
      });

      // Generate Review Tasks based on Workflow Configuration
      const wfConfig = await tx.workflowConfig.findFirst({
        where: { category: assessment.category },
      });

      const assignedRole = wfConfig?.assigned_role || "security";
      const shouldCreateTasks = wfConfig?.auto_create_tasks ?? 1;

      if (shouldCreateTasks) {
        // Query the newly inserted items to link tasks
        const savedItems = await tx.assessmentItem.findMany({
          where: { assessment_id: assessmentId },
        });

        for (const it of savedItems) {
          if (it.result === "Does Not Meet" || it.result === "Partially Meets") {
            const task = await tx.reviewTask.create({
              data: {
                application_id: app.id,
                assessment_id: assessmentId,
                assessment_item_id: it.id,
                standard_id: it.standard_id,
                standard_title: it.title,
                category: it.category,
                assigned_role: assignedRole,
                status: "pending",
                severity: it.severity,
              },
            });

            await tx.taskActivity.create({
              data: {
                task_id: task.id,
                action: "created",
                to_status: "pending",
                comment: `Task automatically spawned from ${it.category} assessment. Result: ${it.result}.`,
              },
            });
          }
        }
      }
    });

    console.log(`[AssessmentEngine] Assessment ${assessmentId} completed successfully. Score: ${calculatedScore}%`);
  } catch (err: any) {
    console.error(`[AssessmentEngine] Assessment ${assessmentId} failed:`, err);
    await prisma.assessment.update({
      where: { id: assessmentId },
      data: {
        status: "failed",
        error_message: err.message || String(err),
        completed_at: new Date(),
      },
    }).catch(() => {});
  } finally {
    // Cleanup temporary clone folder
    if (fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (rmErr) {
        console.warn(`[AssessmentEngine] Could not delete temp dir ${tempDir}:`, rmErr);
      }
    }
  }
}

/**
 * Executes a targeted re-check on a single control/standard task.
 */
export async function recheckSingleControl(
  taskId: string,
  userId?: number
): Promise<{ ok: boolean; result?: string; evidence?: string; compliance_score?: number; error?: string }> {
  const task = await prisma.reviewTask.findUnique({
    where: { id: taskId },
    include: {
      application: true,
      assessment: true,
      assessment_item: true,
    },
  });

  if (!task) {
    return { ok: false, error: "Task not found." };
  }

  const app = task.application;
  const tempDir = path.join(os.tmpdir(), `pixxelai_recheck_${task.id}_${Date.now()}`);
  let repoCloned = false;
  let fileTree: string[] = [];
  let snippets: Record<string, string> = {};

  try {
    if (app.repo_url) {
      try {
        await execAsync(`git clone --depth 1 --single-branch "${app.repo_url}" "${tempDir}"`, {
          timeout: 45000,
        });
        repoCloned = true;
        const repoData = inspectRepository(tempDir);
        fileTree = repoData.fileTree;
        snippets = repoData.snippets;
      } catch (err: any) {
        console.warn(`[Recheck] Git clone failed:`, err.message);
      }
    }

    // Fetch baseline standard for reference context
    const standard = await prisma.standard.findFirst({
      where: { category: task.category },
    });

    const systemPrompt = `You are a Principal Security Architect and Compliance Auditor.
Your task is to re-evaluate a SINGLE specific security control for a software application:
Control: ${task.standard_id} - ${task.standard_title}

The previous evaluation result was: "${task.assessment_item.result}".
You must inspect the latest repository files and code snippets, and determine whether the fix or current implementation satisfies the requirement.

Assign one of these exact result classifications:
- "Meets": Evidence confirms the control is properly designed, configured, and implemented.
- "Partially Meets": Partial implementation exists, but with remaining gaps or risks.
- "Does Not Meet": Control is missing, violated, or unmitigated.
- "Not Applicable": Control is irrelevant due to application architecture.

Output ONLY a JSON object with this exact schema:
{
  "result": "Meets",
  "evidence": "Concrete observations and file findings from the latest codebase",
  "recommendation": "Next steps or confirmation of compliance"
}`;

    let codebaseContext = "No repository URL configured.";
    if (app.repo_url) {
      if (repoCloned) {
        codebaseContext = `Repository: ${app.repo_url}\nLatest files:\n${fileTree.slice(0, 60).join("\n")}\n\n`;
        if (Object.keys(snippets).length > 0) {
          codebaseContext += "Configuration & Code Snippets:\n";
          for (const [filename, code] of Object.entries(snippets)) {
            codebaseContext += `--- ${filename} ---\n${code}\n\n`;
          }
        }
      } else {
        codebaseContext = `Repository: ${app.repo_url} (Could not clone; evaluating metadata).`;
      }
    }

    const userPrompt = `Re-evaluate Control: ${task.standard_id} - ${task.standard_title}

APPLICATION CONTEXT:
- Name: ${app.name}
- Category: ${app.category}
- Type: ${app.type}
- Repo URL: ${app.repo_url || "N/A"}
- Description: ${app.description || "N/A"}

LATEST REPOSITORY AUDIT:
${codebaseContext}

STANDARD GUIDELINES:
${standard?.content?.slice(0, 1500) || "Ensure baseline security and configuration integrity."}

Return the JSON evaluation for this control.`;

    const llmRes = await callLlm({
      prompt: userPrompt,
      systemPrompt,
      temperature: 0.1,
      maxTokens: 2048,
    });

    let rawText = llmRes.text.trim();
    if (rawText.startsWith("```")) {
      rawText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    }

    let parsed: { result: string; evidence: string; recommendation: string };
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else throw new Error("Failed to parse LLM re-check JSON output.");
    }

    let normalizedResult: "Meets" | "Partially Meets" | "Does Not Meet" | "Not Applicable" = "Meets";
    const resLower = (parsed.result || "").toLowerCase();
    if (resLower.includes("partially")) normalizedResult = "Partially Meets";
    else if (resLower.includes("does not") || resLower.includes("fail")) normalizedResult = "Does Not Meet";
    else if (resLower.includes("not applicable") || resLower === "n/a") normalizedResult = "Not Applicable";

    // Update AssessmentItem
    await prisma.assessmentItem.update({
      where: { id: task.assessment_item_id },
      data: {
        result: normalizedResult,
        evidence: parsed.evidence || task.assessment_item.evidence,
        recommendation: parsed.recommendation || task.assessment_item.recommendation,
      },
    });

    // Recalculate Assessment compliance score
    const allItems = await prisma.assessmentItem.findMany({
      where: { assessment_id: task.assessment_id },
    });

    let meetsCount = 0;
    let partialCount = 0;
    let failsCount = 0;
    let naCount = 0;

    for (const it of allItems) {
      if (it.result === "Meets") meetsCount++;
      else if (it.result === "Partially Meets") partialCount++;
      else if (it.result === "Does Not Meet") failsCount++;
      else if (it.result === "Not Applicable") naCount++;
    }

    const applicableCount = allItems.length - naCount;
    let newScore = 100;
    if (applicableCount > 0) {
      newScore = Math.round(((meetsCount * 100) + (partialCount * 50)) / applicableCount);
    }

    await prisma.assessment.update({
      where: { id: task.assessment_id },
      data: {
        compliance_score: newScore,
        meets_count: meetsCount,
        partial_count: partialCount,
        fails_count: failsCount,
        na_count: naCount,
      },
    });

    // Update Task status
    const oldStatus = task.status;
    const newStatus = normalizedResult === "Meets" ? "approved" : task.status;
    const notes =
      normalizedResult === "Meets"
        ? "Re-check passed: control confirmed as Meets."
        : `Re-check run: control evaluated as ${normalizedResult}.`;

    await prisma.reviewTask.update({
      where: { id: taskId },
      data: {
        status: newStatus,
        last_recheck_at: new Date(),
        recheck_count: { increment: 1 },
        resolution_notes: notes,
      },
    });

    await prisma.taskActivity.create({
      data: {
        task_id: taskId,
        user_id: userId || null,
        action: "recheck_run",
        from_status: oldStatus,
        to_status: newStatus,
        comment: `Targeted re-check executed via ${llmRes.provider} (${llmRes.model}). Result: ${normalizedResult}. Evidence: ${(parsed.evidence || "").slice(0, 300)}`,
      },
    });

    return {
      ok: true,
      result: normalizedResult,
      evidence: parsed.evidence,
      compliance_score: newScore,
    };
  } catch (err: any) {
    console.error(`[Recheck] Failed for task ${taskId}:`, err);
    return { ok: false, error: err.message || "Re-check failed." };
  } finally {
    if (fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
  }
}

