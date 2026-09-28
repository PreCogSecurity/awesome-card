'use strict';

/**
 * 一个极简的 DOM 桩。
 *
 * 为什么不用 jsdom？
 *  - 这个库只用到 classList / style.transform / getBoundingClientRect /
 *    addEventListener 这几个 API，用桩对象覆盖得到的是同样的代码路径，
 *    但不需要给 devDependencies 再加一个（间接依赖非常多的）jsdom。
 *  - 供应链面更小，CI 更快。
 */

var COUNTER = 0;

/**
 * 模拟 Element.classList：按空白切分做精确 token 匹配。
 *
 * @param {!Object} element
 * @return {!Object}
 */
function createClassList(element) {
  return {
    contains: function (token) {
      return element.className.split(/\s+/).indexOf(token) >= 0;
    },
    add: function (token) {
      if (!this.contains(token)) {
        element.className = element.className ? element.className + ' ' + token : token;
      }
    },
    remove: function (token) {
      if (!this.contains(token)) {
        return;
      }
      var kept = element.className.split(/\s+/).filter(function (item) {
        return item !== '' && item !== token;
      });
      element.className = kept.join(' ');
    }
  };
}

/**
 * 造一个元素桩。
 *
 * @param {{left: number, top: number, width: number, height: number, className: string}=} box
 * @return {!Object}
 */
function createElement(box) {
  var layout = {
    left: 0,
    top: 0,
    width: 100,
    height: 50
  };
  if (box) {
    Object.keys(box).forEach(function (key) {
      layout[key] = box[key];
    });
  }

  var element = {
    nodeType: 1,
    nodeName: 'DIV',
    className: '',
    style: {},
    offsetLeft: layout.left,
    offsetTop: layout.top,
    offsetWidth: layout.width,
    offsetHeight: layout.height,
    getBoundingClientRect: function () {
      return {
        left: element.offsetLeft,
        top: element.offsetTop,
        width: element.offsetWidth,
        height: element.offsetHeight
      };
    }
  };
  element.classList = createClassList(element);
  return element;
}

/**
 * 造一个事件目标，带 emit/count 方便断言。
 *
 * @return {!Object}
 */
function createEventTarget() {
  var listeners = {};

  return {
    listeners: listeners,
    addEventListener: function (type, handler, options) {
      if (!listeners[type]) {
        listeners[type] = [];
      }
      listeners[type].push({ handler: handler, options: options });
    },
    removeEventListener: function (type, handler) {
      var registered = listeners[type] || [];
      for (var i = registered.length - 1; i >= 0; i--) {
        if (registered[i].handler === handler) {
          registered.splice(i, 1);
        }
      }
    },
    emit: function (type, event) {
      (listeners[type] || []).slice().forEach(function (entry) {
        entry.handler(event);
      });
    },
    count: function (type) {
      return (listeners[type] || []).length;
    },
    optionsFor: function (type) {
      var registered = listeners[type] || [];
      return registered.length ? registered[0].options : undefined;
    }
  };
}

/**
 * 装上 document / window / HTMLElement 全局对象，返回 teardown。
 *
 * @return {{doc: !Object, win: !Object, restore: !Function}}
 */
function installDom() {
  var doc = createEventTarget();
  var win = createEventTarget();
  var previous = {
    document: global.document,
    window: global.window,
    HTMLElement: global.HTMLElement
  };

  COUNTER += 1;
  var FakeHTMLElement = function () {};
  FakeHTMLElement.displayName = 'FakeHTMLElement' + COUNTER;

  global.document = doc;
  global.window = win;
  global.HTMLElement = FakeHTMLElement;

  return {
    doc: doc,
    win: win,
    HTMLElement: FakeHTMLElement,
    restore: function () {
      global.document = previous.document;
      global.window = previous.window;
      global.HTMLElement = previous.HTMLElement;
    }
  };
}

/**
 * 把 matrix3d(...) 解析成 16 个数字，方便断言。
 *
 * @param {string} value
 * @return {!Array<number>}
 */
function parseTransform(value) {
  if (typeof value !== 'string' || value.indexOf('matrix3d(') !== 0) {
    throw new Error('unexpected transform: ' + value);
  }
  var body = value.slice('matrix3d('.length, -1);
  return body.split(',').map(Number);
}

module.exports = {
  createClassList: createClassList,
  createElement: createElement,
  createEventTarget: createEventTarget,
  installDom: installDom,
  parseTransform: parseTransform
};
