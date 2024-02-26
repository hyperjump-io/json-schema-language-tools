# Hyperjump - JSON Schema VSCode Extension

A VSCode extension for using the JSON Schema Language Server.

## Disable JSON Language Features

VSCode's built-in "JSON Language Features" extension includes JSON Schema
functionality. That means you could end up getting the same messages twice (once
from the built-in extension and once from this extension) or you might get
incorrect or confusing messaging. For example, JSON Language Features will warn
you against using 2020-12 because it doesn't support dynamic references, but
this extension fully supports 2020-12 and you are encouraged to use it.

If you wish, you can disable the built-in extension. In the "Extensions" tool,
search for `@builtin json language features`. This is the built-in extension
that's causing the conflict. Click "Disable" to disable this extension.

If you do choose to disable the built-in extension, keep in mind that this
extension is not yet a complete replacement and you may end up losing some
functionality you're used to.

## Contributing

### Launch Extension

This is the launcher I use to launch the extension for development. Yours may
vary slightly depending on your environment.

`.vscode/launch.json`
```jsonc
{
  // Use IntelliSense to learn about possible attributes.
  // Hover to view descriptions of existing attributes.
  // For more information, visit: https://go.microsoft.com/fwlink/?linkid=830387
  "version": "0.2.0",
  "configurations": [
    {
      "args": [
        "--extensionDevelopmentPath=${workspaceFolder}/vscode"
      ],
      "name": "Launch Extension",
      "outFiles": [
        "${workspaceFolder}/vscode/out/**/*.js"
      ],
      "preLaunchTask": "npm: build - vscode",
      "request": "launch",
      "type": "extensionHost"
    }
  ]
}
```

`.vscode/tasks.json`
```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "type": "npm",
      "script": "build",
      "path": "vscode",
      "group": "build",
      "problemMatcher": [],
      "label": "npm: build - vscode",
      "detail": "npm run build-client -- --sourcemap && npm run build-server -- --sourcemap"
    }
  ]
}
```
