/**
 * awesome-card demo bootstrap.
 *
 * Kept in its own file (instead of inline in index.html) on purpose: an inline
 * <script> forces every deployment that embeds this page to keep 'unsafe-inline'
 * in its Content-Security-Policy. A same-origin file lets a deployment ship a
 * strict CSP such as: default-src 'self'; script-src 'self'; object-src 'none'.
 */
(function () {
  'use strict';

  var card = document.querySelector('#d');
  if (!card || typeof awesomeCard !== 'function') {
    return;
  }

  /**
   * Feature detection instead of a user-agent regex.
   * A UA string is trivially spoofed and the regex was ~4KB of maintenance
   * liability. What we actually want is "this device can report orientation and
   * has no precise pointer".
   *
   * Note: iOS 13+ only fires `deviceorientation` after the user grants motion
   * permission, which must be requested from a user gesture via
   * DeviceOrientationEvent.requestPermission(). That is an application concern,
   * so this demo does not do it - see README ("Gyroscope notes").
   *
   * @return {boolean} true when the gyroscope should drive the effect
   */
  function shouldUseGyroscope() {
    var hasFinePointer = !!(window.matchMedia && window.matchMedia('(pointer: fine)').matches);
    return 'DeviceOrientationEvent' in window && !hasFinePointer;
  }

  var useGyroscope = shouldUseGyroscope();

  var handle = awesomeCard(card, {
    activeClass: 'active',
    isPC: !useGyroscope
  });

  if (useGyroscope) {
    // The gyroscope stream is not smooth enough to be worth CSS-transitioning.
    card.style.transition = 'none';
  }

  // Nothing to clean up on a static page, but this is the pattern to copy:
  // release the listener when the card goes away (SPA route change, modal close).
  window.addEventListener('pagehide', function () {
    handle.destroy();
  });
}());
