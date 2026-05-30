import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildTrustReport, importTrustEvidence, loadImportedEvidence, shouldFailGate } from "../src/core/evidence.js";
import { ensureTrustCenterDirs, readJson, resolveTrustCenterPaths } from "../src/core/files.js";
import { renderMarkdownReport } from "../src/core/report.js";
import { trustEvidenceSchema } from "../src/core/schemas.js";

const fixtureRoot = join(import.meta.dirname, "..", "examples", "evidence");
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("trust evidence", () => {
  it("validates fixture evidence", async () => {
    const parsed = trustEvidenceSchema.parse(await readJson(join(fixtureRoot, "skillguard.json")));
    expect(parsed.schemaVersion).toBe("agent.trust.evidence.v1");
    expect(parsed.decision).toBe("allow");
  });

  it("imports all five fixture evidence files and builds a merged report", async () => {
    const cwd = await tempWorkspace();
    const paths = resolveTrustCenterPaths(cwd);
    await ensureTrustCenterDirs(paths);
    await importTrustEvidence(paths, [
      join(fixtureRoot, "skillguard.json"),
      join(fixtureRoot, "watchtower.json"),
      join(fixtureRoot, "cognicheck.json"),
      join(fixtureRoot, "nim-doctor.json"),
      join(fixtureRoot, "endpoint-doctor.json")
    ]);

    const evidence = await loadImportedEvidence(paths);
    const report = buildTrustReport(evidence);

    expect(evidence).toHaveLength(5);
    expect(report.summary.decision).toBe("block");
    expect(report.summary.evidenceFiles).toBe(5);
    expect(report.findings.some((finding) => finding.tool === "agent-cognicheck")).toBe(true);
  });

  it("gates on review or block thresholds", () => {
    expect(shouldFailGate("review", "review")).toBe(true);
    expect(shouldFailGate("review", "block")).toBe(false);
    expect(shouldFailGate("block", "review")).toBe(true);
  });

  it("renders report Markdown with the suite diagram", () => {
    const report = buildTrustReport([
      trustEvidenceSchema.parse({
        schemaVersion: "agent.trust.evidence.v1",
        tool: { name: "agent-skillguard", version: "1.0.0" },
        subject: { type: "skill", name: "safe-skill" },
        decision: "allow",
        score: 0,
        generatedAt: "2026-05-30T00:00:00.000Z",
        findings: [],
        artifacts: [],
        recommendations: []
      })
    ]);

    const markdown = renderMarkdownReport(report);
    expect(markdown).toContain("```mermaid");
    expect(markdown).toContain("agent-skillguard");
    expect(markdown).toContain("Decision: **ALLOW**");
  });
});

async function tempWorkspace(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "agent-trust-center-"));
  tempDirs.push(dir);
  return dir;
}
