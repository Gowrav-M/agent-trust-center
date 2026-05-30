import { readdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { readJson, writeJson, type TrustCenterPaths } from "./files.js";
import {
  decisionRank,
  trustEvidenceSchema,
  trustReportSchema,
  type TrustDecision,
  type TrustEvidence,
  type TrustReport
} from "./schemas.js";

const knownEvidencePaths = [
  [".skillguard", "reports", "trust-evidence.json"],
  [".watchtower", "reports", "trust-evidence.json"],
  [".cognicheck", "reports", "trust-evidence.json"],
  [".nim-doctor", "reports", "trust-evidence.json"],
  [".endpoint-doctor", "reports", "trust-evidence.json"]
];

export async function readTrustEvidenceFile(path: string): Promise<TrustEvidence> {
  return trustEvidenceSchema.parse(await readJson(path));
}

export async function importTrustEvidence(paths: TrustCenterPaths, evidenceFiles: string[]): Promise<TrustEvidence[]> {
  const imported: TrustEvidence[] = [];
  for (const evidenceFile of evidenceFiles) {
    const resolved = resolve(evidenceFile);
    const evidence = await readTrustEvidenceFile(resolved);
    const destination = join(paths.evidenceDir, `${safeEvidenceName(evidence)}.json`);
    await writeJson(destination, evidence);
    imported.push(evidence);
  }
  return imported;
}

export async function loadImportedEvidence(paths: TrustCenterPaths): Promise<TrustEvidence[]> {
  let entries: string[];
  try {
    entries = await readdir(paths.evidenceDir);
  } catch {
    return [];
  }
  const evidence: TrustEvidence[] = [];
  for (const entry of entries.filter((item) => item.endsWith(".json")).sort()) {
    evidence.push(await readTrustEvidenceFile(join(paths.evidenceDir, entry)));
  }
  return evidence;
}

export async function collectKnownEvidence(cwd: string, paths: TrustCenterPaths): Promise<TrustEvidence[]> {
  const candidates = knownEvidencePaths.map((parts) => join(cwd, ...parts));
  const imported: TrustEvidence[] = [];
  for (const candidate of candidates) {
    try {
      imported.push(...await importTrustEvidence(paths, [candidate]));
    } catch {
      // Missing or invalid evidence is ignored by collect; doctor/report will show what was imported.
    }
  }
  return imported;
}

export function buildTrustReport(evidence: TrustEvidence[]): TrustReport {
  const decision = worstDecision(evidence.map((item) => item.decision));
  const score = evidence.length === 0 ? 0 : Math.max(...evidence.map((item) => Math.round(item.score)));
  const findings = evidence.flatMap((item) =>
    item.findings.map((finding) => ({
      ...finding,
      tool: item.tool.name,
      subject: `${item.subject.type}:${item.subject.name}`
    }))
  );
  const recommendations = new Set<string>();
  for (const item of evidence) {
    for (const recommendation of item.recommendations) {
      recommendations.add(recommendation);
    }
  }
  if (evidence.length === 0) {
    recommendations.add("Import trust evidence from SkillGuard, Watchtower, Cognicheck, nim-doctor, or endpoint-doctor.");
  }
  return trustReportSchema.parse({
    schemaVersion: "agent.trust.report.v1",
    generatedAt: new Date().toISOString(),
    summary: {
      decision,
      score,
      evidenceFiles: evidence.length,
      findings: findings.length,
      blockingEvidence: evidence.filter((item) => item.decision === "block").length,
      reviewEvidence: evidence.filter((item) => item.decision === "review").length
    },
    evidence,
    findings,
    recommendations: [...recommendations]
  });
}

export function shouldFailGate(decision: TrustDecision, failOn: TrustDecision): boolean {
  return decisionRank(decision) >= decisionRank(failOn);
}

function worstDecision(decisions: TrustDecision[]): TrustDecision {
  if (decisions.includes("block")) {
    return "block";
  }
  if (decisions.includes("review")) {
    return "review";
  }
  return "allow";
}

function safeEvidenceName(evidence: TrustEvidence): string {
  return `${evidence.tool.name}-${basename(evidence.subject.type)}`.replace(/[^a-zA-Z0-9._-]+/gu, "-").toLowerCase();
}
