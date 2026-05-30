#!/usr/bin/env node
import { access, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { Command, InvalidArgumentError } from "commander";
import {
  buildTrustReport,
  collectKnownEvidence,
  importTrustEvidence,
  loadImportedEvidence,
  shouldFailGate
} from "./core/evidence.js";
import {
  ensureTrustCenterDirs,
  resolveTrustCenterPaths,
  writeJson,
  writeText,
  type TrustCenterPaths
} from "./core/files.js";
import { renderHtmlReport, renderMarkdownReport } from "./core/report.js";
import { trustDecisionSchema, type TrustDecision, type TrustReport } from "./core/schemas.js";

interface GlobalOptions {
  cwd?: string;
}

const currentFile = fileURLToPath(import.meta.url);
const packageRoot = dirname(dirname(currentFile));
const knownTools = ["agent-skillguard", "agentops-watchtower", "agent-cognicheck", "nim-doctor", "agent-endpoint-doctor"];

const program = new Command();
program
  .name("agent-trust-center")
  .description("Local-first trust report and CI gate for AI agent tooling evidence.")
  .version(await readPackageVersion())
  .option("--cwd <path>", "working directory for .trust-center output", process.cwd());

program
  .command("demo")
  .description("Run an offline demo with fixture evidence from all five trust domains.")
  .action(async () => {
    const ctx = commandContext();
    await ensureTrustCenterDirs(ctx.paths);
    const fixtures = [
      "skillguard.json",
      "watchtower.json",
      "cognicheck.json",
      "nim-doctor.json",
      "endpoint-doctor.json"
    ].map((file) => join(packageRoot, "examples", "evidence", file));
    const imported = await importTrustEvidence(ctx.paths, fixtures);
    const report = await writeTrustReport(ctx.paths, buildTrustReport(imported));
    console.log("Agent Trust Center demo complete");
    console.log(`Decision: ${report.summary.decision.toUpperCase()}`);
    console.log(`Risk score: ${report.summary.score}/100`);
    console.log(`JSON: ${ctx.paths.reportJson}`);
    console.log(`Markdown: ${ctx.paths.reportMarkdown}`);
    console.log(`HTML: ${ctx.paths.reportHtml}`);
  });

program
  .command("doctor")
  .description("Check Node version, workspace write access, and known tool availability.")
  .action(async () => {
    const ctx = commandContext();
    await ensureTrustCenterDirs(ctx.paths);
    const major = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
    const checks = [
      { name: "node", ok: major >= 22, message: process.version },
      { name: "workspace", ok: await isWritable(ctx.paths.reportsDir), message: ctx.paths.reportsDir },
      ...knownTools.map((tool) => ({ name: tool, ok: commandExists(tool), message: commandExists(tool) ? "available on PATH" : "not found on PATH" }))
    ];
    for (const check of checks) {
      console.log(`${check.ok ? "ok" : "warn"} ${check.name}: ${check.message}`);
    }
    if (!checks[0]?.ok || !checks[1]?.ok) {
      process.exitCode = 1;
    }
  });

program
  .command("import")
  .argument("<files...>", "Trust evidence JSON files to import.")
  .description("Import normalized trust evidence JSON files into .trust-center/evidence.")
  .action(async (files: string[]) => {
    const ctx = commandContext();
    await ensureTrustCenterDirs(ctx.paths);
    const imported = await importTrustEvidence(ctx.paths, files);
    console.log(`Imported ${imported.length} evidence file(s).`);
    for (const evidence of imported) {
      console.log(`- ${evidence.tool.name}: ${evidence.decision.toUpperCase()} (${Math.round(evidence.score)}/100)`);
    }
  });

program
  .command("collect")
  .description("Collect existing local trust-evidence.json files from known tools in this workspace.")
  .action(async () => {
    const ctx = commandContext();
    await ensureTrustCenterDirs(ctx.paths);
    const imported = await collectKnownEvidence(ctx.cwd, ctx.paths);
    console.log(`Collected ${imported.length} known evidence file(s).`);
    if (imported.length === 0) {
      console.log("Run individual tool demos/reports and their evidence command first, then rerun collect.");
    }
  });

program
  .command("report")
  .description("Generate one Markdown, HTML, and JSON trust report from imported evidence.")
  .action(async () => {
    const ctx = commandContext();
    await ensureTrustCenterDirs(ctx.paths);
    const evidence = await loadImportedEvidence(ctx.paths);
    const report = await writeTrustReport(ctx.paths, buildTrustReport(evidence));
    console.log(`Decision: ${report.summary.decision.toUpperCase()}`);
    console.log(`Risk score: ${report.summary.score}/100`);
    console.log(`JSON: ${ctx.paths.reportJson}`);
    console.log(`Markdown: ${ctx.paths.reportMarkdown}`);
    console.log(`HTML: ${ctx.paths.reportHtml}`);
  });

program
  .command("gate")
  .option("--fail-on <decision>", "Fail when trust decision is review or block.", parseDecision, "block")
  .description("Exit non-zero when the merged trust report reaches the chosen decision threshold.")
  .action(async (options: { failOn: TrustDecision }) => {
    const ctx = commandContext();
    await ensureTrustCenterDirs(ctx.paths);
    const evidence = await loadImportedEvidence(ctx.paths);
    const report = await writeTrustReport(ctx.paths, buildTrustReport(evidence));
    console.log(`Decision: ${report.summary.decision.toUpperCase()} (fail-on ${options.failOn.toUpperCase()})`);
    if (shouldFailGate(report.summary.decision, options.failOn)) {
      process.exitCode = 1;
    }
  });

program
  .command("profile")
  .description("Print a one-page local trust summary.")
  .action(async () => {
    const ctx = commandContext();
    await ensureTrustCenterDirs(ctx.paths);
    const evidence = await loadImportedEvidence(ctx.paths);
    const report = buildTrustReport(evidence);
    console.log(`Agent Trust Profile: ${report.summary.decision.toUpperCase()} (${report.summary.score}/100)`);
    console.log(`Evidence: ${report.summary.evidenceFiles} | Findings: ${report.summary.findings}`);
    for (const item of report.evidence) {
      console.log(`- ${item.tool.name}: ${item.decision.toUpperCase()} ${Math.round(item.score)}/100`);
    }
  });

program.showHelpAfterError();

try {
  await program.parseAsync(process.argv);
} catch (error) {
  console.error(`agent-trust-center: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}

function commandContext(): {
  cwd: string;
  paths: TrustCenterPaths;
} {
  const options = program.opts<GlobalOptions>();
  const cwd = resolve(options.cwd ?? process.cwd());
  return {
    cwd,
    paths: resolveTrustCenterPaths(cwd)
  };
}

async function writeTrustReport(paths: TrustCenterPaths, report: TrustReport): Promise<TrustReport> {
  await Promise.all([
    writeJson(paths.reportJson, report),
    writeText(paths.reportMarkdown, renderMarkdownReport(report)),
    writeText(paths.reportHtml, renderHtmlReport(report))
  ]);
  return report;
}

function parseDecision(value: string): TrustDecision {
  const parsed = trustDecisionSchema.safeParse(value);
  if (!parsed.success) {
    throw new InvalidArgumentError("Expected one of: allow, review, block");
  }
  return parsed.data;
}

async function readPackageVersion(): Promise<string> {
  try {
    const raw = await readFile(join(packageRoot, "package.json"), "utf8");
    const parsed = JSON.parse(raw) as { version?: unknown };
    return typeof parsed.version === "string" ? parsed.version : "0.1.0";
  } catch {
    return "0.1.0";
  }
}

async function isWritable(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function commandExists(command: string): boolean {
  const result = process.platform === "win32"
    ? spawnSync("cmd", ["/c", "where", command], { stdio: "ignore" })
    : spawnSync("sh", ["-c", `command -v ${shellQuote(command)}`], { stdio: "ignore" });
  return result.status === 0;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
