# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0]

### Added

- `module.exports` / AMD / global UMD wrapper, so the file can finally be
  `require`d, imported and unit tested. Previously the export was commented out.
- `awesomeCard()` now returns a `handle` with `destroy()`, `isActive()`,
  `element` and `version`. `destroy()` detaches the listener, removes
  `activeClass` and resets the transform, and is safe to call twice. This is
  what stops `mousemove` / `deviceorientation` listeners from accumulating when a
  card is re-initialised.
- Structured errors: `AwesomeCardError` (a real `Error` subclass) with a stable
  `code`, plus the exported `ERROR_CODES` map. Callers can branch on `code`
  instead of parsing message strings.
- Configuration validation for `dom`, `config`, `activeClass`, `transCenterX`,
  `transCenterY`, `getParamX` and `getParamY`.
- `attachToMouseEvent` as an explicit, documented override of `isPC`.
- A Jest test suite (43 tests) with coverage thresholds enforced from
  `npm test`, an ESLint rule set enforced from CI, `npm audit` as a CI gate, and
  Dependabot for npm and GitHub Actions updates.
- README API reference, `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md` and an
  ISC `LICENSE` file.

### Fixed

- **`isPC` never worked.** `typeof config.isPC === undefined` compares a string
  against a keyword and is always false, so `attachToMouseEvent` was always
  assigned `config.isPC` verbatim. Omitting `isPC` therefore produced `undefined`
  (falsy) and silently attached the **gyroscope** instead of the mouse. It now
  honours `isPC` and defaults to the documented mouse behaviour.
- **`transCenterX` / `transCenterY` were ignored.** They were parsed from the
  default values, never from `config`, so any value passed by the caller was
  discarded. They are now read, validated and clamped to `[0, 1]`.
- **Class matching was a substring test.** `className.indexOf('active')` also
  matches `inactive`, `deactivated` or `is-active`, so `activeClass: 'active'`
  could never be added to an element that had any of those, and reset removed
  the wrong token. Matching is now token-exact via `classList`.
- **`activeClass` was concatenated into `className` unvalidated.**
  `dom.className += ' ' + activeClass` is an injection sink for any value
  containing quotes or markup. It is now restricted to a single safe class token
  and applied through `classList`.
- **NaN / Infinity could reach `style.transform`.** A `getParamX` returning
  `NaN`, or an element with a zero width or height, produced an invalid
  `matrix3d()` value. Both are now guarded.
- **The gyroscope baseline was re-read when the first angle was exactly `0`**
  (`if (!oy)`), so the effect never moved. The baseline now uses a `null`
  sentinel, and `null` / non-finite `beta` and `gamma` readings are ignored.
- **Hit testing broke on a scrolled page.** `pageX` / `pageY` were compared
  against `offsetLeft` / `offsetTop`, which are unaffected by scroll. It now uses
  `clientX` / `clientY` with `getBoundingClientRect()`, which is also one layout
  read per event instead of four.
- **`isDOM` only accepted same-realm HTML elements.** `typeof HTMLElement ===
  'object'` never matches in a real browser, and `instanceof` alone misses
  cross-realm and SVG nodes. Detection now tries `instanceof` and falls back to a
  structural check.
- A leftover `console.log` on every `deviceorientation` event (a per-frame
  console write) was removed.

### Changed

- `mousemove` is registered as a passive listener, so it no longer risks
  blocking scrolling on touch devices.
- `classList` is used instead of string concatenation, so SVG elements work.
- The `index.html` demo lost its inline scripts (moved to `demo.js`) and its
  ~4KB user-agent sniffing regex, replaced by feature detection.
- Node engine requirement declared as `>=18` and pinned in `.nvmrc`.

[1.1.0]: https://github.com/PreCogSecurity/awesome-card/releases/tag/v1.1.0
