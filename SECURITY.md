# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| 1.1.x | yes |
| < 1.1.0 | no |

`awesome-card` has zero runtime dependencies: what npm installs is a single
`index.js`. If you are pinned to an older version, the main reason to upgrade is
that 1.1.0 validates all configuration, writes `classList` instead of
concatenating strings, and no longer leaks event listeners.

## Reporting a vulnerability

**Please do not open a public issue for a security report.**

Report privately through GitHub's security advisory form:
**<https://github.com/PreCogSecurity/awesome-card/security/advisories/new>**

Please include:

- the affected version, the browser and the calling code,
- a minimal reproduction,
- the impact you believe it has.

You can expect an acknowledgement within 3 business days and an assessment
within 10 business days. If a fix is warranted we will agree a disclosure date
with you, and credit you in the advisory and `CHANGELOG.md` unless you prefer
otherwise.

## Threat model

The library takes a DOM node and a configuration object, attaches one event
listener, and writes `style.transform` plus one CSS class. It runs inside the
caller's page, so it inherits the page's privileges. In scope:

- input that reaches `awesomeCard` from untrusted sources - markup, URL
  parameters, API responses, `postMessage`;
- the state the library leaves on the element it was given;
- listener lifetime and memory growth;
- prototype pollution or global-object tampering through the configuration.

Out of scope:

- anything a script already running in the same page can do on its own;
- the third-party stylesheet loaded by the demo page (`index.html`); that is a
  demo-only CDN asset, self-host it if you copy the demo.

## What the library guarantees

- **Input validation at the entry point.** `dom`, `config`, `activeClass`,
  `transCenterX`, `transCenterY`, `getParamX` and `getParamY` are all validated.
  Failures throw an `AwesomeCardError` with a stable `code`.
- **`activeClass` is a single class token** matching `^[A-Za-z_-][A-Za-z0-9_-]*$`
  and is applied with `classList`. A value taken from untrusted input therefore
  cannot inject attributes, styles or additional classes into the element.
- **No invalid CSS.** `NaN` and `Infinity` are filtered before
  `style.transform` is written, including for zero-sized elements.
- **No `innerHTML`, `eval` or `new Function`.** The library builds no code from
  strings.
- **No listener leaks.** Every call returns a `handle` whose `destroy()`
  detaches the listener and resets the element; `destroy()` is idempotent and
  never throws.
- **No runtime dependencies**, so nothing transitive reaches your bundle.

## Deploying it safely

The demo page loads Ant Design's stylesheet from a third-party CDN. That is fine
for a demo and **not** fine for a product page:

- self-host the CSS, or pin it with an `integrity` hash and `crossorigin`
  (Subresource Integrity), so a compromised CDN cannot restyle or read your page;
- serve it with a strict CSP, which is only possible because the demo has no
  inline script:

  ```
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'
  ```

- if you serve the library itself, add
  `Cross-Origin-Resource-Policy: same-origin` and
  `X-Content-Type-Options: nosniff`.
