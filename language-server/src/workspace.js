import { watch } from "node:fs";
import { readdir } from "node:fs/promises";
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
      const schemaPath = resolve(path, filename);

      yield pathToFileURL(schemaPath).toString();
    }
  }
};

export const waitUntil = (condition, checkInterval = 1000) => {
  return new Promise((resolve) => {
    if (condition()) {
      resolve();
    } else {
      const interval = setInterval(() => {
        if (condition()) {
          clearInterval(interval);
          resolve();
        }
      }, checkInterval);
    }
  });
};
