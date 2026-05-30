import type { TrustEvidence, TrustReport } from "./schemas.js";

export function renderMarkdownReport(report: TrustReport): string {
  const lines = [
    "# Agent Trust Center Report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "```mermaid",
    "flowchart LR",
    ...report.evidence.map((item, index) => `  T${index}["${escapeMermaid(item.tool.name)}"] --> R["one trust report"]`),
    "  R --> G[\"CI gate\"]",
    "```",
    "",
    "## Summary",
    "",
    `- Decision: **${report.summary.decision.toUpperCase()}**`,
    `- Risk score: ${report.summary.score}/100`,
    `- Evidence files: ${report.summary.evidenceFiles}`,
    `- Findings: ${report.summary.findings}`,
    `- Blocking evidence: ${report.summary.blockingEvidence}`,
    `- Review evidence: ${report.summary.reviewEvidence}`,
    "",
    "## Evidence",
    "",
    ...renderEvidence(report.evidence),
    "",
    "## Findings",
    "",
    ...(report.findings.length === 0
      ? ["- No findings in imported evidence."]
      : report.findings.map((finding) => `- [${finding.severity.toUpperCase()}] ${finding.tool}: ${finding.title} - ${finding.message}`)),
    "",
    "## Recommendations",
    "",
    ...(report.recommendations.length === 0 ? ["- No recommendations."] : report.recommendations.map((item) => `- ${item}`)),
    ""
  ];
  return `${lines.join("\n")}\n`;
}

export function renderHtmlReport(report: TrustReport): string {
  const rows = report.evidence.map((item) =>
    `<tr><td>${escapeHtml(item.tool.name)}</td><td>${escapeHtml(item.subject.type)}</td><td>${escapeHtml(item.subject.name)}</td><td>${escapeHtml(item.decision)}</td><td>${item.score}</td><td>${item.findings.length}</td></tr>`
  ).join("\n");
  const findings = report.findings.map((finding) =>
    `<li><strong>[${escapeHtml(finding.severity)}] ${escapeHtml(finding.tool)}</strong>: ${escapeHtml(finding.title)} - ${escapeHtml(finding.message)}</li>`
  ).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Agent Trust Center Report</title>
  <style>
    body { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 1120px; margin: 2rem auto; color: #17202a; line-height: 1.55; }
    h1, h2 { line-height: 1.15; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem; margin: 1rem 0 2rem; }
    .metric { border: 1px solid #d8e0ea; border-radius: 8px; padding: 0.8rem; }
    .metric span { display: block; color: #576579; font-size: 0.85rem; }
    .metric strong { font-size: 1.5rem; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { border: 1px solid #d8e0ea; padding: 0.55rem; text-align: left; vertical-align: top; }
    th { background: #eef3f8; }
    li { margin: 0.35rem 0; }
  </style>
</head>
<body>
  <h1>Agent Trust Center Report</h1>
  <p>Generated: ${escapeHtml(report.generatedAt)}</p>
  <section class="summary">
    <div class="metric"><span>Decision</span><strong>${escapeHtml(report.summary.decision.toUpperCase())}</strong></div>
    <div class="metric"><span>Risk score</span><strong>${report.summary.score}/100</strong></div>
    <div class="metric"><span>Evidence files</span><strong>${report.summary.evidenceFiles}</strong></div>
    <div class="metric"><span>Findings</span><strong>${report.summary.findings}</strong></div>
  </section>
  <h2>Evidence</h2>
  <table>
    <thead><tr><th>Tool</th><th>Subject Type</th><th>Subject</th><th>Decision</th><th>Score</th><th>Findings</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <h2>Findings</h2>
  <ul>${findings || "<li>No findings in imported evidence.</li>"}</ul>
  <h2>Recommendations</h2>
  <ul>${report.recommendations.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
</body>
</html>
`;
}

function renderEvidence(evidence: TrustEvidence[]): string[] {
  if (evidence.length === 0) {
    return ["- No evidence imported."];
  }
  return evidence.map((item) =>
    `- ${item.tool.name}@${item.tool.version} -> ${item.subject.type}:${item.subject.name} (${item.decision.toUpperCase()}, score ${Math.round(item.score)}/100)`
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeMermaid(value: string): string {
  return value.replaceAll('"', "'");
}
