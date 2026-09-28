'use strict';

var awesomeCard = require('../index.js');
var dom = require('./helpers/dom.js');

var DEFAULT_CARD = { left: 0, top: 0, width: 100, height: 50 };
var RESET_TRANSFORM = 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,1,0,0,0,1)';

describe('module surface', function () {
  it('exports a function from a fresh require (main: index.js resolves)', function () {
    expect(typeof awesomeCard).toBe('function');
    expect(awesomeCard.name).toBe('awesomeCard');
  });

  it('exposes version, error type and error codes', function () {
    expect(awesomeCard.VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(typeof awesomeCard.AwesomeCardError).toBe('function');
    expect(awesomeCard.ERROR_CODES.INVALID_DOM).toBe('ERR_INVALID_DOM');
  });

  it('exposes an Error subclass that callers can branch on with instanceof', function () {
    var err = new awesomeCard.AwesomeCardError('boom', 'ERR_TEST');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(awesomeCard.AwesomeCardError);
    expect(err.name).toBe('AwesomeCardError');
    expect(err.code).toBe('ERR_TEST');
    expect(err.message).toBe('boom');
    expect(typeof err.stack).toBe('string');
  });
});

describe('input validation', function () {
  var env;

  beforeEach(function () {
    env = dom.installDom();
  });

  afterEach(function () {
    env.restore();
  });

  it('throws a coded error when the first argument is not a DOM node', function () {
    [undefined, null, {}, 'div', 42, [], function () {}].forEach(function (bad) {
      expect(function () {
        awesomeCard(bad, {});
      }).toThrow(awesomeCard.AwesomeCardError);
      try {
        awesomeCard(bad, {});
      } catch (err) {
        expect(err.code).toBe(awesomeCard.ERROR_CODES.INVALID_DOM);
      }
    });
  });

  it('rejects a structural impostor that has nodeType but no nodeName', function () {
    expect(function () {
      awesomeCard({ nodeType: 1 }, {});
    }).toThrow(/not a dom/);
  });

  it('accepts a cross-realm element detected through instanceof', function () {
    var element = Object.create(env.HTMLElement.prototype);
    var handle;
    expect(function () {
      handle = awesomeCard(element, { activeClass: 'active' });
    }).not.toThrow();
    expect(handle.element).toBe(element);
    handle.destroy();
  });

  it('throws a coded error when config is missing or is not a plain object', function () {
    var element = dom.createElement(DEFAULT_CARD);
    [undefined, null, [], 'active', 7, function () {}].forEach(function (bad) {
      expect(function () {
        awesomeCard(element, bad);
      }).toThrow(/config must be a plain object/);
      try {
        awesomeCard(element, bad);
      } catch (err) {
        expect(err.code).toBe(awesomeCard.ERROR_CODES.INVALID_CONFIG);
      }
    });
  });

  it('refuses an activeClass that is not a single class token (attribute injection guard)', function () {
    var element = dom.createElement(DEFAULT_CARD);
    [
      'a b',
      'x" onmouseover="alert(1)',
      '<script>alert(1)</script>',
      'foo; background: url(javascript:alert(1))',
      'a:hover',
      '0leading-digit',
      'has/slash'
    ].forEach(function (bad) {
      try {
        awesomeCard(element, { activeClass: bad });
        throw new Error('expected a throw for activeClass: ' + bad);
      } catch (err) {
        expect(err).toBeInstanceOf(awesomeCard.AwesomeCardError);
        expect(err.code).toBe(awesomeCard.ERROR_CODES.INVALID_ACTIVE_CLASS);
      }
      expect(element.className).toBe('');
      expect(element.style.transform).toBeUndefined();
    });
  });

  it('rejects a non-string activeClass', function () {
    expect(function () {
      awesomeCard(dom.createElement(DEFAULT_CARD), { activeClass: 42 });
    }).toThrow(/activeClass must be a string/);
  });

  it('treats an empty or omitted activeClass as "no class"', function () {
    var element = dom.createElement(DEFAULT_CARD);
    var handle = awesomeCard(element, { activeClass: '   ' });
    env.doc.emit('mousemove', { clientX: 50, clientY: 25 });
    expect(element.className).toBe('');
    handle.destroy();
  });

  it('validates transCenterX / transCenterY and rejects out-of-range or unparsable values', function () {
    var element = dom.createElement(DEFAULT_CARD);
    ['150%', -1, NaN, Infinity, 'abc', 'nope%', {}, []].forEach(function (bad) {
      try {
        awesomeCard(element, { transCenterX: bad });
        throw new Error('expected a throw for transCenterX: ' + String(bad));
      } catch (err) {
        expect(err.code).toBe(awesomeCard.ERROR_CODES.INVALID_TRANS_CENTER);
      }
    });
    try {
      awesomeCard(element, { transCenterY: '200%' });
      throw new Error('expected a throw for transCenterY');
    } catch (err) {
      expect(err.code).toBe(awesomeCard.ERROR_CODES.INVALID_TRANS_CENTER);
    }
  });

  it('validates that getParamX / getParamY are functions', function () {
    var element = dom.createElement(DEFAULT_CARD);
    expect(function () {
      awesomeCard(element, { getParamX: 0.1 });
    }).toThrow(/getParamX must be a function/);
    expect(function () {
      awesomeCard(element, { getParamY: 'nope' });
    }).toThrow(/getParamY must be a function/);
  });
});

describe('mouse branch', function () {
  var env;
  var element;

  beforeEach(function () {
    env = dom.installDom();
    element = dom.createElement(DEFAULT_CARD);
  });

  afterEach(function () {
    env.restore();
  });

  it('defaults to the mouse when isPC is omitted (regression: typeof x === undefined was always false)', function () {
    var handle = awesomeCard(element, { activeClass: 'active' });
    expect(env.doc.count('mousemove')).toBe(1);
    expect(env.win.count('deviceorientation')).toBe(0);
    handle.destroy();
  });

  it('honours isPC: true', function () {
    var handle = awesomeCard(element, { isPC: true });
    expect(env.doc.count('mousemove')).toBe(1);
    expect(env.win.count('deviceorientation')).toBe(0);
    handle.destroy();
  });

  it('honours isPC: false and switches to the gyroscope branch', function () {
    var handle = awesomeCard(element, { isPC: false, activeClass: 'active' });
    expect(env.doc.count('mousemove')).toBe(0);
    expect(env.win.count('deviceorientation')).toBe(1);
    expect(env.win.optionsFor('deviceorientation')).toBe(true);
    handle.destroy();
  });

  it('registers a passive mousemove listener so pointer moves never block scrolling', function () {
    var handle = awesomeCard(element, {});
    expect(env.doc.optionsFor('mousemove')).toEqual({ passive: true });
    handle.destroy();
  });

  it('returns a handle describing the element and its active state', function () {
    var handle = awesomeCard(element, { activeClass: 'active' });
    expect(handle.element).toBe(element);
    expect(handle.version).toBe(awesomeCard.VERSION);
    expect(handle.isActive()).toBe(false);
    env.doc.emit('mousemove', { clientX: 50, clientY: 25 });
    expect(handle.isActive()).toBe(true);
    handle.destroy();
  });

  it('adds activeClass while the pointer is over the card and removes it when it leaves', function () {
    var handle = awesomeCard(element, { activeClass: 'active' });

    env.doc.emit('mousemove', { clientX: 60, clientY: 20 });
    expect(element.className).toBe('active');
    expect(handle.isActive()).toBe(true);

    env.doc.emit('mousemove', { clientX: 900, clientY: 20 });
    expect(element.className).toBe('');
    expect(element.style.transform).toBe(RESET_TRANSFORM);
    expect(handle.isActive()).toBe(false);

    env.doc.emit('mousemove', { clientX: 60, clientY: 900 });
    expect(element.className).toBe('');

    handle.destroy();
  });

  it('resets when the pointer is vertically outside the card', function () {
    var handle = awesomeCard(element, { activeClass: 'active' });
    env.doc.emit('mousemove', { clientX: 50, clientY: -1 });
    expect(element.style.transform).toBe(RESET_TRANSFORM);
    handle.destroy();
  });

  it('matches class tokens exactly instead of by substring', function () {
    element.className = 'inactive';
    var handle = awesomeCard(element, { activeClass: 'active' });

    env.doc.emit('mousemove', { clientX: 50, clientY: 25 });
    // 'inactive' must survive: a substring match would have treated it as a hit
    // and never added 'active'.
    expect(element.className).toBe('inactive active');

    env.doc.emit('mousemove', { clientX: 500, clientY: 25 });
    expect(element.className).toBe('inactive');
    handle.destroy();
  });

  it('reads transCenterX / transCenterY from config (previously silently ignored)', function () {
    var centredEl = dom.createElement(DEFAULT_CARD);
    var leftEl = dom.createElement(DEFAULT_CARD);
    var a = awesomeCard(centredEl, { transCenterX: '50%' });
    var b = awesomeCard(leftEl, { transCenterX: '0%' });

    env.doc.emit('mousemove', { clientX: 50, clientY: 25 });
    var centredMatrix = dom.parseTransform(centredEl.style.transform);
    var leftMatrix = dom.parseTransform(leftEl.style.transform);

    // pointer at the exact centre of a 50%-centred card -> no offset
    expect(centredMatrix[3]).toBeCloseTo(0, 12);
    // pointer at 50% of a card whose centre is 0% -> full half-width offset
    expect(leftMatrix[3]).toBeCloseTo(0.5 * 0.00005, 12);

    a.destroy();
    b.destroy();
  });

  it('applies getParamX / getParamY as the amplitude multiplier', function () {
    var handle = awesomeCard(element, {
      getParamX: function () { return 0.01; },
      getParamY: function () { return 0.02; }
    });
    env.doc.emit('mousemove', { clientX: 100, clientY: 50 });
    var matrix = dom.parseTransform(element.style.transform);
    expect(matrix[3]).toBeCloseTo(0.5 * 0.01, 12);
    expect(matrix[7]).toBeCloseTo(0.5 * 0.02, 12);
    handle.destroy();
  });

  it('calls getParamX / getParamY on every event so the amplitude can be dynamic', function () {
    var calls = 0;
    var handle = awesomeCard(element, {
      getParamX: function () { calls += 1; return 0.00005; }
    });
    env.doc.emit('mousemove', { clientX: 10, clientY: 10 });
    env.doc.emit('mousemove', { clientX: 20, clientY: 20 });
    expect(calls).toBe(2);
    handle.destroy();
  });

  it('never writes NaN or Infinity into style.transform when a param getter misbehaves', function () {
    var handle = awesomeCard(element, {
      getParamX: function () { return NaN; },
      getParamY: function () { return undefined; }
    });
    env.doc.emit('mousemove', { clientX: 10, clientY: 10 });
    var matrix = dom.parseTransform(element.style.transform);
    matrix.forEach(function (value) {
      expect(isFinite(value)).toBe(true);
    });
    // a broken getter falls back to the default amplitude (0.00005) rather than NaN
    expect(matrix[3]).toBeCloseTo(-0.4 * 0.00005, 12);
    expect(matrix[7]).toBeCloseTo(-0.3 * 0.00005, 12);
    handle.destroy();
  });

  it('does not divide by zero for a hidden (zero sized) element', function () {
    var hidden = dom.createElement({ left: 0, top: 0, width: 0, height: 0 });
    var handle = awesomeCard(hidden, { activeClass: 'active' });
    env.doc.emit('mousemove', { clientX: 0, clientY: 0 });
    var matrix = dom.parseTransform(hidden.style.transform);
    matrix.forEach(function (value) {
      expect(isFinite(value)).toBe(true);
    });
    expect(matrix[3]).toBe(0);
    expect(matrix[7]).toBe(0);
    handle.destroy();
  });

  it('uses viewport coordinates so the effect survives page scroll', function () {
    element.offsetLeft = 0;
    element.offsetTop = 300;
    var handle = awesomeCard(element, {});
    // pointer is 10px above the card in viewport space
    env.doc.emit('mousemove', { clientX: 50, clientY: 295 });
    expect(element.style.transform).toBe(RESET_TRANSFORM);
    env.doc.emit('mousemove', { clientX: 50, clientY: 310 });
    expect(element.style.transform).not.toBe(RESET_TRANSFORM);
    handle.destroy();
  });
});

describe('device orientation branch', function () {
  var env;
  var element;

  beforeEach(function () {
    env = dom.installDom();
    element = dom.createElement(DEFAULT_CARD);
  });

  afterEach(function () {
    env.restore();
  });

  it('uses the first reading as the baseline and applies the delta afterwards', function () {
    var handle = awesomeCard(element, { isPC: false, activeClass: 'active' });

    env.win.emit('deviceorientation', { beta: 10, gamma: 5 });
    expect(dom.parseTransform(element.style.transform)[3]).toBeCloseTo(0, 12);
    expect(dom.parseTransform(element.style.transform)[7]).toBeCloseTo(0, 12);
    expect(element.className).toBe('active');

    env.win.emit('deviceorientation', { beta: 20, gamma: 25 });
    var matrix = dom.parseTransform(element.style.transform);
    expect(matrix[3]).toBeCloseTo((-Math.sqrt(20) * 100 / 100) * 0.00005, 12);
    expect(matrix[7]).toBeCloseTo((-Math.sqrt(10) * 100 / 50) * 0.00005, 12);
    handle.destroy();
  });

  it('keeps a baseline of exactly 0 (regression: the old !oy check re-baselined on zero)', function () {
    var handle = awesomeCard(element, { isPC: false });

    env.win.emit('deviceorientation', { beta: 0, gamma: 0 });
    env.win.emit('deviceorientation', { beta: 10, gamma: 0 });
    var matrix = dom.parseTransform(element.style.transform);
    expect(matrix[7]).toBeCloseTo((-Math.sqrt(10) * 100 / 50) * 0.00005, 12);
    expect(matrix[3]).toBeCloseTo(0, 12);
    handle.destroy();
  });

  it('ignores events with null or non-finite angles instead of poisoning the transform', function () {
    var handle = awesomeCard(element, { isPC: false, activeClass: 'active' });

    env.win.emit('deviceorientation', { beta: null, gamma: null });
    env.win.emit('deviceorientation', { beta: NaN, gamma: 1 });
    env.win.emit('deviceorientation', {});
    expect(element.style.transform).toBeUndefined();
    expect(element.className).toBe('');

    // the baseline must not have been consumed by the ignored events
    env.win.emit('deviceorientation', { beta: 4, gamma: 0 });
    env.win.emit('deviceorientation', { beta: 4, gamma: 9 });
    var matrix = dom.parseTransform(element.style.transform);
    expect(matrix[3]).toBeCloseTo((-Math.sqrt(9) * 100 / 100) * 0.00005, 12);
    handle.destroy();
  });
});

describe('lifecycle', function () {
  var env;
  var element;

  beforeEach(function () {
    env = dom.installDom();
    element = dom.createElement(DEFAULT_CARD);
  });

  afterEach(function () {
    env.restore();
  });

  it('detaches the listener and resets the element on destroy()', function () {
    var handle = awesomeCard(element, { activeClass: 'active' });
    env.doc.emit('mousemove', { clientX: 60, clientY: 20 });
    expect(element.className).toBe('active');

    handle.destroy();
    expect(env.doc.count('mousemove')).toBe(0);
    expect(element.className).toBe('');
    expect(element.style.transform).toBe(RESET_TRANSFORM);

    var after = element.style.transform;
    env.doc.emit('mousemove', { clientX: 60, clientY: 20 });
    expect(element.style.transform).toBe(after);
  });

  it('is safe to destroy twice and safe to emit after destroy', function () {
    var handle = awesomeCard(element, { activeClass: 'active' });
    handle.destroy();
    expect(function () { handle.destroy(); }).not.toThrow();
    env.doc.emit('deviceorientation', { beta: 1, gamma: 1 });
  });

  it('does not leak listeners when the card is re-initialised', function () {
    var handles = [];
    for (var i = 0; i < 5; i++) {
      handles.push(awesomeCard(element, { activeClass: 'active' }));
    }
    expect(env.doc.count('mousemove')).toBe(5);
    handles.forEach(function (handle) { handle.destroy(); });
    expect(env.doc.count('mousemove')).toBe(0);
  });

  it('resets the gyroscope baseline on destroy so a remount does not jump', function () {
    var first = awesomeCard(element, { isPC: false });
    env.win.emit('deviceorientation', { beta: 45, gamma: 45 });
    first.destroy();

    var second = awesomeCard(element, { isPC: false });
    env.win.emit('deviceorientation', { beta: 45, gamma: 45 });
    expect(dom.parseTransform(element.style.transform)[3]).toBeCloseTo(0, 12);
    second.destroy();
  });
});

describe('compatibility fallbacks', function () {
  var env;

  beforeEach(function () {
    env = dom.installDom();
  });

  afterEach(function () {
    env.restore();
  });

  it('falls back to offset* geometry when getBoundingClientRect is unavailable', function () {
    var element = dom.createElement({ left: 10, top: 20, width: 80, height: 40 });
    delete element.getBoundingClientRect;
    var handle = awesomeCard(element, {});
    env.doc.emit('mousemove', { clientX: 50, clientY: 40 });
    var matrix = dom.parseTransform(element.style.transform);
    expect(matrix[3]).toBeCloseTo(((50 - 10) - 0.5 * 80) / 80 * 0.00005, 12);
    handle.destroy();
  });

  it('adds and removes the class through className when classList is unavailable', function () {
    var element = dom.createElement(DEFAULT_CARD);
    element.className = 'card inactive';
    delete element.classList;
    var handle = awesomeCard(element, { activeClass: 'active' });

    env.doc.emit('mousemove', { clientX: 50, clientY: 25 });
    expect(element.className).toBe('card inactive active');

    env.doc.emit('mousemove', { clientX: 900, clientY: 25 });
    expect(element.className).toBe('card inactive');
    handle.destroy();
  });

  it('never removes a class that was not added by awesome-card', function () {
    var element = dom.createElement(DEFAULT_CARD);
    element.className = 'inactive';
    delete element.classList;
    var handle = awesomeCard(element, { activeClass: 'active' });
    env.doc.emit('mousemove', { clientX: 50, clientY: 25 });
    env.doc.emit('mousemove', { clientX: 900, clientY: 25 });
    expect(element.className).toBe('inactive');
    handle.destroy();
  });

  it('does not throw from destroy() on an element without a style object', function () {
    var element = { nodeType: 1, nodeName: 'DIV' };
    var handle = awesomeCard(element, { activeClass: 'active' });
    expect(function () { handle.destroy(); }).not.toThrow();
    expect(env.doc.count('mousemove')).toBe(0);
  });

  it('accepts attachToMouseEvent as an explicit override of isPC', function () {
    var handle = awesomeCard(dom.createElement(DEFAULT_CARD), { attachToMouseEvent: false });
    expect(env.win.count('deviceorientation')).toBe(1);
    expect(env.doc.count('mousemove')).toBe(0);
    handle.destroy();
  });

  it('lets isPC win over attachToMouseEvent', function () {
    var handle = awesomeCard(dom.createElement(DEFAULT_CARD), {
      isPC: true,
      attachToMouseEvent: false
    });
    expect(env.doc.count('mousemove')).toBe(1);
    handle.destroy();
  });

  it('accepts transCenter as a plain 0..1 number', function () {
    var element = dom.createElement(DEFAULT_CARD);
    var handle = awesomeCard(element, { transCenterX: 0.25, transCenterY: 0.25 });
    env.doc.emit('mousemove', { clientX: 50, clientY: 25 });
    var matrix = dom.parseTransform(element.style.transform);
    expect(matrix[3]).toBeCloseTo((0.5 - 0.25) * 0.00005, 12);
    expect(matrix[7]).toBeCloseTo((0.5 - 0.25) * 0.00005, 12);
    handle.destroy();
  });

  it('accepts boundary transCenter values', function () {
    var atStart = awesomeCard(dom.createElement(DEFAULT_CARD), { transCenterX: '0%', transCenterY: 1 });
    var atEnd = awesomeCard(dom.createElement(DEFAULT_CARD), { transCenterX: 1, transCenterY: '100%' });
    expect(function () { atStart.destroy(); atEnd.destroy(); }).not.toThrow();
  });

  it('treats a null param getter and activeClass: false as "use the default"', function () {
    var element = dom.createElement(DEFAULT_CARD);
    var handle = awesomeCard(element, { activeClass: false, getParamX: null, getParamY: null });
    env.doc.emit('mousemove', { clientX: 50, clientY: 25 });
    expect(element.className).toBe('');
    var matrix = dom.parseTransform(element.style.transform);
    expect(matrix[3]).toBeCloseTo(0, 12);
    handle.destroy();
  });
});

describe('environments without a DOM', function () {
  var saved;

  beforeEach(function () {
    saved = { document: global.document, window: global.window, HTMLElement: global.HTMLElement };
  });

  afterEach(function () {
    global.document = saved.document;
    global.window = saved.window;
    global.HTMLElement = saved.HTMLElement;
  });

  it('throws a coded error instead of a ReferenceError when document is missing', function () {
    global.document = undefined;
    global.window = undefined;
    try {
      awesomeCard(dom.createElement(DEFAULT_CARD), {});
      throw new Error('expected a throw');
    } catch (err) {
      expect(err).toBeInstanceOf(awesomeCard.AwesomeCardError);
      expect(err.code).toBe(awesomeCard.ERROR_CODES.UNSUPPORTED_ENV);
    }
  });
});
