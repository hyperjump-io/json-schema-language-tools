# Hyperjump - JSON Schema Language Tools

JSON Schema Language Tools is a collection of tools for validating and linting
your project's JSON Schemas in editors/IDEs and on the command line.

## Projects

* [Language Server](./language-server) - An LSP implementation 
* [VSCode Extension](./vscode) - A VSCode extension for using the Language
  Server in VSCode
* [Neovim](./neovim) - Configuring neovim for to use the Language Server

## Project Status - SPIKE

Language Server Development is entirely new to me, so for now, I'm doing a
[spike](https://en.wikipedia.org/wiki/Spike_(software_development)) to help
me learn and discover what problems I'll need to solve. That means that for now,
the code may be a bit messy and is often only manually tested. Once I feel like
I'm ready to move past the spike phase, what exists now will be rewritten using
Test Driven Development.

## Why?

The JSON Language Server that's built-in to VSCode already has JSON Schema
support, so why is this project necessary? Unfortunately, what's built-in to
VSCode doesn't support recent versions of JSON Schema and is missing support for
some features in the versions it does support. In addition, there's so much more
that could be done including linting schemas as well as validating them. There
hasn't been any interest from them to improve this situation, so I'm taking on
the challenge.

## Contributing

Contributions are welcome and encouraged! If you have a feature/bug/improvement
you want to work on, it's usually best to open an issue to discuss the issue
before starting work.
