// Language Server
import { ProposedFeatures } from "vscode-languageserver";
import { createConnection } from "vscode-languageserver/node.js";
import { buildServer } from "./build-server.js";


const connection = createConnection(ProposedFeatures.all);
connection.console.log("Starting JSON Schema service ...");

const server = buildServer(connection);
server.listen();
