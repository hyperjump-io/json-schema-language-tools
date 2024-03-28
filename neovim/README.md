# Hyperjump - JSON Schema Language Tools - Neovim Configuration

When we're ready for people to start using this language server, we'll want to
add it to [lspconfig](https://github.com/neovim/nvim-lspconfig) and
[Mason](https://github.com/williamboman/mason.nvim) to make setup as easy as
possible. For now, installation is manual.

First checkout this repo locally and run `npm install`. Then you can configure
Neovim to use that checkout to run the server. The following is my
configuration, yours may vary slightly depending on your environment.

`~/.config/nvim/ftplugin/json.lua`
```lua
local root_files = { ".git", "package.json" }
local paths = vim.fs.find(root_files, { stop = vim.env.HOME })

vim.lsp.start({
  name = "hyperjump-json-schema",
  cmd = { "node", "/path/to/json-schema-language-tools/language-server/src/server.js", "--stdio" },
  root_dir = vim.fs.dirname(paths[1]),
  -- settings = {
  --   jsonSchemaLanguageServer = {
  --     -- Put any settings here
  --   }
  -- }
})
```
