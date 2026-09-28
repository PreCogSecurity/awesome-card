# Contributing

Thanks for taking the time. This repository is small on purpose, so the bar is
"obvious, tested, and reviewable".

## Getting set up

```sh
git clone https://github.com/PreCogSecurity/awesome-card.git
cd awesome-card
nvm use          # reads .nvmrc (Node 20)
npm ci           # reproducible install from the committed lockfile
npm run verify   # lint + tests
```

Please use `npm ci` rather than `npm install` locally, so you are testing the
same dependency tree CI builds.

## Before you open a pull request

```sh
npm run verify
```

That runs `npm run lint` and `npm test`. The test command always collects
coverage and **fails** if coverage of `index.js` drops below the thresholds in
`package.json` (`lines` 90, `statements` 90, `functions` 95, `branches` 85), so
new code needs new tests.

CI additionally runs on Node 18, 20 and 22, plus `npm audit --audit-level=high`.
All of it must be green.

## Style

- [.eslintrc.json](.eslintrc.json) is the source of truth. Run
  `npm run lint:fix` before pushing.
- `index.js` is ES5 on purpose: it ships as a plain `<script>` with no build
  step, so it must run untranspiled in older mobile webviews. Use `var` and
  `function`; do not introduce a bundler, a transpiler or a framework.
- JSDoc on every exported function, and a comment on anything non-obvious.
  Existing comments are in Chinese; keep the surrounding language when you edit
  existing code.
- Keep `awesome-card` at zero **runtime** dependencies. A dev dependency is fine
  if it earns its place, and a new one must come with a reason in the PR body.
- One behavioural change per commit, with its tests in the same commit. Mixed
  "reformat + feature" commits are hard to review and hard to revert.

## Tests

- Tests live in `tests/` and use the DOM double in `tests/helpers/dom.js`
  rather than jsdom. If you need a new DOM behaviour, extend the double rather
  than reaching for a heavy test environment.
- A test that pins a bug fix should say so in its name, e.g.
  `(regression: typeof x === undefined was always false)`. That way the reason
  the assertion exists survives the next refactor.
- Every bug fix needs a test that fails before the fix and passes after it.

## Security

Do not report vulnerabilities in a public issue. See
[SECURITY.md](SECURITY.md) for the private reporting channel.

## Commits and pull requests

- Branch from `master`, rebase rather than merge when `master` moves on.
- Describe the *why* in the PR body, and list anything a reviewer needs to
  verify by hand.
- By contributing you agree that your work is licensed under the ISC license in
  [LICENSE](LICENSE).
