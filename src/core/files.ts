import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export interface TrustCenterPaths {
  root: string;
  evidenceDir: string;
  reportsDir: string;
  reportJson: string;
  reportMarkdown: string;
  reportHtml: string;
}

export function resolveTrustCenterPaths(cwd: string): TrustCenterPaths {
  const root = join(cwd, ".trust-center");
  const evidenceDir = join(root, "evidence");
  const reportsDir = join(root, "reports");
  return {
    root,
    evidenceDir,
    reportsDir,
    reportJson: join(reportsDir, "agent-trust-report.json"),
    reportMarkdown: join(reportsDir, "agent-trust-report.md"),
    reportHtml: join(reportsDir, "agent-trust-report.html")
  };
}

export async function ensureTrustCenterDirs(paths: TrustCenterPaths): Promise<void> {
  await Promise.all([
    mkdir(paths.root, { recursive: true }),
    mkdir(paths.evidenceDir, { recursive: true }),
    mkdir(paths.reportsDir, { recursive: true })
  ]);
}

export async function readText(path: string): Promise<string> {
  return readFile(path, "utf8");
}

export async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readText(path)) as unknown;
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function writeText(path: string, value: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value, "utf8");
}

export async function copyFileEnsuringDir(source: string, destination: string): Promise<void> {
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
}

export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
