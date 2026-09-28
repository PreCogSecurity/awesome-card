# Awesome Card

[![CI](https://github.com/PreCogSecurity/awesome-card/actions/workflows/ci.yml/badge.svg)](https://github.com/PreCogSecurity/awesome-card/actions/workflows/ci.yml)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/awesome-card.svg)](https://www.npmjs.com/package/awesome-card)

A 3D tilt / parallax effect for a DOM card, driven by mouse position or device
orientation. One file, **zero runtime dependencies**, no build step.

![gif](https://gw.alipayobjects.com/zos/rmsportal/lYDnKrCDEonpELHohURM.gif)

[![video on youtube](https://img.youtube.com/vi/jJs57q1RqmU/0.jpg)](https://youtu.be/jJs57q1RqmU)

Live demo: <https://precogsecurity.github.io/awesome-card/> (source: [`index.html`](index.html) + [`demo.js`](demo.js))

## Install

```sh
npm install awesome-card
```

Or drop the single file in and skip the package manager entirely:

```html
<script src="node_modules/awesome-card/index.js"></script>
```

## Usage

```javascript
const handle = awesomeCard(document.querySelector('#d'), {
  activeClass: 'active',
  isPC: true
});
```

```js
// ESM
import awesomeCard from 'awesome-card';

// CommonJS
const awesomeCard = require('awesome-card');

// AMD
define(['awesome-card'], function (awesomeCard) { /* ... */ });
```

`index.js` is a UMD module, so the same file works as a `<script>` global
(`window.awesomeCard`), as a CommonJS module, and as an AMD module.

## API

### `awesomeCard(dom, config) -> handle`

| Argument | Type | Description |
| --- | --- | --- |
| `dom` | `Element` | The card to tilt. Selectors, jQuery and Zepto objects are **not** accepted - pass the node itself. |
| `config` | `Object` | Options, see below. Required. |

### `config`

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `transCenterX` | `string \| number` | `'50%'` | Tilt centre on the X axis. `'50%'` or a number between `0` and `1`. |
| `transCenterY` | `string \| number` | `'50%'` | Tilt centre on the Y axis. Ignored on the gyroscope path. |
| `isPC` | `boolean` | `true` | `true` drives the effect from the mouse, `false` from the gyroscope. |
| `attachToMouseEvent` | `boolean` | - | Advanced: explicit override of `isPC`. `isPC` wins if both are given. |
| `activeClass` | `string \| null` | `null` | A single CSS class added to the element while it is active, removed when it resets. |
| `getParamX` | `() => number` | `() => 0.00005` | Called on every event; the return value scales the X amplitude. Start at `0.00005`. |
| `getParamY` | `() => number` | `() => 0.00005` | Same, for Y. |

```javascript
// Amplitude that grows while the pointer is near the right edge.
awesomeCard(card, {
  activeClass: 'active',
  getParamX: () => (pointerX / window.innerWidth > 0.8 ? 0.0002 : 0.00005),
  getParamY: () => 0.00005
});
```

### `handle`

| Member | Type | Description |
| --- | --- | --- |
| `element` | `Element` | The element the handle is bound to. |
| `version` | `string` | Library version. |
| `isActive()` | `() => boolean` | Whether the card is currently tilted. |
| `destroy()` | `() => void` | Detaches the listener, removes `activeClass` and resets the transform. Idempotent, never throws. |

**Call `destroy()` when the card goes away** (SPA route change, modal close,
list reorder). Without it, a `mousemove` listener stays on `document` for the
lifetime of the page:

```javascript
let handle = awesomeCard(card, { activeClass: 'active' });

router.onLeave(() => handle.destroy());
```

### Errors

Invalid arguments throw an `AwesomeCardError` (a real `Error` subclass) with a
stable `code`, so you never have to match on message text:

| `code` | Raised when |
| --- | --- |
| `ERR_INVALID_DOM` | `dom` is not an element node. |
| `ERR_INVALID_CONFIG` | `config` is missing or is not a plain object. |
| `ERR_INVALID_ACTIVE_CLASS` | `activeClass` is not a single class token. |
| `ERR_INVALID_TRANS_CENTER` | `transCenterX` / `transCenterY` is not a percentage or a number in `[0, 1]`. |
| `ERR_INVALID_PARAM_GETTER` | `getParamX` / `getParamY` is not a function. |
| `ERR_UNSUPPORTED_ENV` | No usable `document` / `window` in this environment. |

```javascript
const { ERROR_CODES, AwesomeCardError } = awesomeCard;

try {
  awesomeCard(card, { activeClass: 'not a class' });
} catch (err) {
  if (err instanceof AwesomeCardError && err.code === ERROR_CODES.INVALID_ACTIVE_CLASS) {
    // ...
  }
}
```

## Behaviour notes

- **Defaults to the mouse.** Omitting `isPC` attaches a `mousemove` listener.
  (Before 1.1.0 the comparison was `typeof config.isPC === undefined`, which is
  always false, so omitting `isPC` silently fell through to the gyroscope.)
- **`transCenterX` / `transCenterY` are actually read.** Before 1.1.0 they were
  overwritten by the defaults and ignored.
- **Class matching is token-exact.** `activeClass: 'active'` no longer matches
  `inactive`, which the old `className.indexOf(...)` check did.
- **Viewport coordinates.** Hit testing uses `clientX` / `clientY` and
  `getBoundingClientRect()`, so the effect stays correct on a scrolled page.
- **Hidden or zero-sized elements** are safe: no `NaN` / `Infinity` ever reaches
  `style.transform`.
- **Degenerate sensor data** (iOS can report `beta: null`) is ignored instead of
  being written into the transform.
- `mousemove` is registered as a **passive** listener, so it never blocks
  scrolling.

## Gyroscope notes

iOS 13+ only emits `deviceorientation` after the user grants motion permission,
and the request must originate from a user gesture:

```javascript
DeviceOrientationEvent.requestPermission().then((state) => {
  if (state === 'granted') {
    awesomeCard(card, { isPC: false, activeClass: 'active' });
  }
});
```

## Security

- All configuration is validated at the entry point. Invalid input fails fast
  with a coded error instead of producing a broken transform.
- `activeClass` must be a single class token (`^[A-Za-z_-][A-Za-z0-9_-]*$`), so a
  value that came from markup, a URL or an API response can never inject
  attributes, styles or extra classes into your element.
- The library never writes `NaN` or `Infinity` into `style.transform`, and never
  uses `innerHTML`, `eval` or `Function`.
- Zero runtime dependencies, so there is no transitive supply-chain surface in
  your bundle. `npm audit` is a hard gate in CI.
- See [SECURITY.md](SECURITY.md) for how to report a vulnerability.

## Browser support

Any browser with `classList`, `getBoundingClientRect` and CSS 3D transforms -
that is every evergreen browser. The code stays ES5 and needs no polyfills, so it
is safe to drop into an existing page without a build step.

## Development

```sh
nvm use          # reads .nvmrc
npm ci           # reproducible install from package-lock.json
npm run verify   # lint + tests with coverage thresholds
```

| Script | What it does |
| --- | --- |
| `npm test` | Runs the Jest suite **with coverage** and enforces the thresholds in `package.json`. |
| `npm run test:coverage` | Same, explicit. |
| `npm run test:watch` | Watch mode. |
| `npm run lint` | ESLint over the repo. |
| `npm run lint:fix` | ESLint with `--fix`. |
| `npm run verify` | `lint` then `test` - what CI runs. |

Tests use a small hand-rolled DOM double (`tests/helpers/dom.js`) rather than
jsdom: the library touches only a handful of DOM APIs, and skipping jsdom keeps
the dev dependency tree and CI time small.

Contributing guidelines: [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[ISC](LICENSE)
