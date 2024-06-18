# JSON Schema Language Tools - Roadmap

This is an attempt to track the progress of the JSON Schema Language Tools
project. The points are more-or-less arbitrary effort estimates in the form of
(effort-put-in/effort-estimated). Points will be updated weekly. Effort
estimates are not fixed and may go up or down weekly to reflect what we learned.

The following sections are milestones and roughly in order of priority.

## (231/315) MVP for vscode and neovim

The goal is to get something stable enough to release and get early adopters
using it, providing feedback, finding bugs, and hopefully contributing as soon
as possible.

- [ ] (140/180) Stable architecture
- [ ] (6/7) Testing strategy
- [ ] (3/21) Feature test coverage
- [ ] (2/7) Documentation
- [ ] (12/14) No known bugs
- [x] (15/15) Workspace management
  - [x] (7/7) Revalidate schema when schema changes
  - [x] (7/7) Revalidate workspace when schema is saved
  - [x] (1/1) Revalidate workspace when configuration changes
- [ ] (12/15) Schema AST
  - [x] (7/7) JSON-compatible AST
  - [x] (1/1) Schema resource identification
  - [x] (1/1) Dialect identification
  - [x] (3/3) Support for references
  - [ ] (0/3) Identify nodes as schemas
- [ ] (7/8) Code completion
  - [x] (3/3) $schema
  - [ ] (2/3) keyword
- [x] (7/7) Hover
  - [x] (7/7) Keyword documentation hover
- [x] (21/35) Diagnostics
  - [ ] (7/14) Schema validation
  - [x] (7/7) Reference validation
  - [ ] (7/14) Deprecated keywords
- [x] (6/6) Configuration
  - [x] (2/2) Default dialect
  - [x] (4/4) Schema file patterns
 
## (0/??) Linting JSON Schemas

Linting can be used for everything from identifying common mistakes to enforcing
code style.

- [ ] (0/??) Schema AST
  - [ ] (0/??) Identify properties as keywords
  - [ ] (0/??) Support for whitespace rules
- [ ] (0/1) Diagnostics for linting errors
- [ ] (0/??) Configurable rules
- [ ] (0/??) Plugin support for third-party rules
- [ ] (0/??) Auto-fix linting errors
- [ ] (0/??) TODO: Identify a minimum set of rules

## (2/??) Full LSP support for editing JSON Schema

- [ ] (0/??) Workspace management
  - [ ] (0/??) Optimize workspace refresh
- [ ] (2/??) Code completion
  - [x] (2/2) if/then/else
  - [ ] (0/??) TODO: Identify missing completions
- [ ] (0/??) Jump to def
- [ ] (0/??) Workspace symbols
- [ ] (0/??) Find references
- [ ] (0/??) Code actions
  - [ ] (0/??) Refactoring support
    - [ ] (0/??) TODO: Identify refactorings
  - [ ] (0/??) Upgrade/downgrade schemas
- [ ] (0/??) Get added to the list of language servers on
     https://microsoft.github.io/language-server-protocol/implementors/servers/
- [ ] (0/??) Get added to the list of language servers on langserver.org
- [ ] (0/??) VSCode: Add to marketplace
- [ ] (0/??) Neovim: Add to lsp-config and Mason
- [ ] (0/??) Release automation
- [ ] (0/??) Marketing
  - [ ] (0/??) Blog post
  - [ ] (0/??) Video demo
  - [ ] (0/??) Present at conferences
- [ ] (0/??) Telemetry???

## (0/??) CLI

The functionality of validating the schemas in a workspace that the language
server provides would also be valuable as CLI tool. It could even be used for
automation.

- [ ] (0/??) Workspace diagnostics
- [ ] (0/??) Configuration
- [ ] (0/??) Fix lint errors
- [ ] (0/??) GitHub action

## (0/??) Full LSP support for editing JSON/JSONC/YAML described by JSON Schemas

This is what Microsoft's JSON Language Server is designed for. Ideally, we could
leave this functionality to them, but they don't seem to have any desire to
fix/update their JSON Schema support and we'll need to implement functionality
to fill the gap.

- [ ] (0/??) TODO

## (0/??) Linting for JSON/JSONC/YAML described by JSON Schemas

There are ways that a JSON document can be valid against a schema, but have
things that are probably mistakes. This functionality would use the schema to
identify probable mistakes in the JSON document.

- [ ] (0/??) TODO

## (0/??) JetBrains support

Adding support for JetBrains means we can support IDEs for many different
languages.

- [ ] (0/??) TODO

## (0/??) Visual Studio support

Adding support for Visual Studio means we can support users of the .NET family
of languages.

- [ ] (0/??) TODO

## (0/??) Eclipse support

This would allow us to support IDEs for languages that are built on Eclipse.

- [ ] (0/??) TODO

## (0/??) Emacs support

Support the Emacs users

- [ ] (0/??) TODO

## (0/??) Monaco support

This would allow the language server to be used in the browser.

- [ ] (0/??) TODO

## (0/??) CodeMirror support

This would allow the language server to be used in the browser.

- [ ] (0/??) TODO
