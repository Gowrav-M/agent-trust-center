import { z } from "zod";

export const trustDecisionSchema = z.enum(["allow", "review", "block"]);
export type TrustDecision = z.infer<typeof trustDecisionSchema>;

export const trustSeveritySchema = z.enum(["info", "low", "medium", "warning", "high", "critical"]);
export type TrustSeverity = z.infer<typeof trustSeveritySchema>;

export const trustSubjectTypeSchema = z.enum(["skill", "endpoint", "nim", "mcp", "runtime", "toolset"]);
export type TrustSubjectType = z.infer<typeof trustSubjectTypeSchema>;

export const trustEvidenceFindingSchema = z.object({
  id: z.string().min(1),
  severity: trustSeveritySchema,
  title: z.string().min(1),
  message: z.string().min(1),
  recommendation: z.string().min(1).optional(),
  source: z.string().min(1).optional()
});
export type TrustEvidenceFinding = z.infer<typeof trustEvidenceFindingSchema>;

export const trustEvidenceArtifactSchema = z.object({
  type: z.string().min(1),
  path: z.string().min(1)
});
export type TrustEvidenceArtifact = z.infer<typeof trustEvidenceArtifactSchema>;

export const trustEvidenceSchema = z.object({
  schemaVersion: z.literal("agent.trust.evidence.v1"),
  tool: z.object({
    name: z.string().min(1),
    version: z.string().min(1)
  }),
  subject: z.object({
    type: trustSubjectTypeSchema,
    name: z.string().min(1)
  }),
  decision: trustDecisionSchema,
  score: z.number().min(0).max(100),
  generatedAt: z.iso.datetime(),
  findings: z.array(trustEvidenceFindingSchema),
  artifacts: z.array(trustEvidenceArtifactSchema),
  recommendations: z.array(z.string().min(1))
});
export type TrustEvidence = z.infer<typeof trustEvidenceSchema>;

export const trustReportSchema = z.object({
  schemaVersion: z.literal("agent.trust.report.v1"),
  generatedAt: z.iso.datetime(),
  summary: z.object({
    decision: trustDecisionSchema,
    score: z.number().min(0).max(100),
    evidenceFiles: z.number().int().nonnegative(),
    findings: z.number().int().nonnegative(),
    blockingEvidence: z.number().int().nonnegative(),
    reviewEvidence: z.number().int().nonnegative()
  }),
  evidence: z.array(trustEvidenceSchema),
  findings: z.array(trustEvidenceFindingSchema.extend({
    tool: z.string().min(1),
    subject: z.string().min(1)
  })),
  recommendations: z.array(z.string().min(1))
});
export type TrustReport = z.infer<typeof trustReportSchema>;

export function decisionRank(decision: TrustDecision): number {
  switch (decision) {
    case "allow":
      return 0;
    case "review":
      return 1;
    case "block":
      return 2;
  }
}

export function severityRank(severity: TrustSeverity): number {
  switch (severity) {
    case "info":
      return 0;
    case "low":
      return 1;
    case "warning":
    case "medium":
      return 2;
    case "high":
      return 3;
    case "critical":
      return 4;
  }
}
