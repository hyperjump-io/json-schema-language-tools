# Hyperjump - JSON Schema Language Server

A Language Server for JSON Schema development.

Features:
* Inline diagnostics for invalid schemas
* Semantic highlighting of JSON Schema keywords
* Semantic highlighting of deprecated keywords
* Full support for draft-04/06/07/2019-09/2020-12

## Settings

* `jsonSchemaLanguageServer.defaultDialect` -- The dialect to use if the schema
  doesn't use `$schema` to declare the schema's dialect.

## Contributing

Contributions are welcome and encouraged! If you have a feature/bug/improvement
you want to work on, it's usually best to open an issue to discuss the issue
before starting work.

### Automated Tests

PRs are expected to include automated tests whenever possible.

* `npm run test` - Run all the tests once
* `npm run test -- --watch` - Run all the tests with a continuous test runner
* `npm run test -- path/to/something.test.js` - Run a specific test suite

There are test coverage tools available for you to analyze where your tests
might be lacking.

`npm run coverage` - Run the coverage analysis
`npx http-server coverage` - View the HTML report

### Manual Testing

Make sure to check that any changes work in both VSCode and Neovim before
submitting PRs.
