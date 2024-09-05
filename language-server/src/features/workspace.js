import { DidChangeWatchedFilesNotification, TextDocumentSyncKind } from "vscode-languageserver";
import { publishAsync } from "../pubsub.js";

/**
 * @import { ServerCapabilities } from "vscode-languageserver"
 * @import { Feature } from "../build-server.js"
 */


let hasWorkspaceFolderCapability = false;
let hasWorkspaceWatchCapability = false;

/** @type Feature */
export default {
  async load(_connection, schemas) {
    schemas.onDidChangeWatchedFiles(async (params) => {
      await publishAsync("workspaceChanged", params);
    });

    schemas.onDidChangeContent(async ({ document }) => {
      await publishAsync("validateSchema", document);
    });
  },

  onInitialize({ capabilities, workspaceFolders }, _connection, schemas) {
    if (workspaceFolders) {
      schemas.addWorkspaceFolders(workspaceFolders);
    }

    hasWorkspaceFolderCapability = !!capabilities.workspace?.workspaceFolders;
    hasWorkspaceWatchCapability = !!capabilities.workspace?.didChangeWatchedFiles?.dynamicRegistration;

    /** @type ServerCapabilities */
    const serverCapabilities = {
      textDocumentSync: TextDocumentSyncKind.Incremental
    };

    if (hasWorkspaceFolderCapability) {
      serverCapabilities.workspace = {
        workspaceFolders: {
          supported: true,
          changeNotifications: true
        }
      };
    }

    return serverCapabilities;
  },

  async onInitialized(connection, schemas) {
    if (hasWorkspaceWatchCapability) {
      await connection.client.register(DidChangeWatchedFilesNotification.type, {
        watchers: [{ globPattern: "**/*" }]
      });
    } else {
      schemas.watch();
    }

    if (hasWorkspaceFolderCapability) {
      connection.workspace.onDidChangeWorkspaceFolders(({ added, removed }) => {
        schemas.addWorkspaceFolders(added);
        schemas.removeWorkspaceFolders(removed);
      });
    }
  },

  async onShutdown(_connection, schemas) {
    await schemas.stop();
  }
};
