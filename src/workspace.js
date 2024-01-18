import { watch } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";


const workspaceFolders = new Set();

export const addWorkspaceFolders = (folders) => {
  for (const folder of folders) {
    workspaceFolders.add(folder);
  }
};

export const removeWorkspaceFolders = (folders) => {
  for (const folder of folders) {
    if (watchers[folder.uri]) {
      watchers[folder.uri].close();
    }

    workspaceFolders.delete(folder);
  }
};

const watchers = {};

export const watchWorkspace = (handler) => {
  for (const { uri } of workspaceFolders) {
    const path = fileURLToPath(uri);

    if (watchers[path]) {
      watchers[path].close();
    }

    watchers[path] = watch(path, { recursive: true }, (eventType, filename) => {
      handler(eventType, filename);
    });
  }
};

export const workspaceSchemas = async function* () {
  for (const { uri } of workspaceFolders) {
    const path = fileURLToPath(uri);

    for (const filename of await readdir(path, { recursive: true })) {
      if (!filename.endsWith(".schema.json")) {
        continue;
      }

      const schemaPath = resolve(path, filename);
      const schemaText = await readFile(schemaPath, "utf8");

      if (schemaText.trim() === "") {
        continue;
      }

      yield [pathToFileURL(schemaPath).toString(), schemaText];
    }
  }
};
