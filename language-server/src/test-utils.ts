import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";


export const setupWorkspace = async (files: Record<string, string>) => {
  const workspaceFolder = await mkdtemp(join(tmpdir(), "test-workspace-"));

  for (const path in files) {
    await writeFile(join(workspaceFolder, path), files[path], "utf-8");
  }

  return pathToFileURL(workspaceFolder).toString();
};

export const tearDownWorkspace = async (workspaceFolder: string) => {
  await rm(fileURLToPath(workspaceFolder), { recursive: true });
};

export const wait = async (delay: number) => new Promise((resolve) => {
  setTimeout(resolve, delay);
});
