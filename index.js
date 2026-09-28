/**
 * awesome-card
 *
 * 让一张卡片跟着鼠标（或者陀螺仪）做 3D 倾斜 / 视差效果。
 *
 * 单文件、零运行时依赖、不需要构建：可以直接用 <script> 引入（挂到 window.awesomeCard），
 * 也可以用 CommonJS / AMD / ESM import 引入。
 *
 * 安全约定：
 *  - 所有 config 都在入口处做校验，非法输入抛 AwesomeCardError（带 code 字段），
 *    不会把 NaN / undefined 写进 style，也不会把未校验的字符串拼进 className。
 *  - 事件监听器一定会被回收：返回一个 handle，调用 handle.destroy() 即可解绑。
 *
 * @license ISC
 */
(function (root, factory) {
  'use strict';

  if (typeof module === 'object' && module.exports) {
    // CommonJS / Node
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    // AMD
    define([], factory);
  } else {
    // 浏览器 <script> 全局
    root.awesomeCard = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = '1.1.0';
  var DEFAULT_TRANS_CENTER = 0.5;
  var DEFAULT_PARAM = 0.00005;
  var ORIENTATION_SCALE = 100;

  /**
   * 错误码，方便调用方按 code 分支处理，而不是去 parse message。
   * ERR_INVALID_DOM            dom 不是元素节点
   * ERR_INVALID_CONFIG         config 不是普通对象
   * ERR_INVALID_ACTIVE_CLASS   activeClass 不是合法的单个 class token
   * ERR_INVALID_TRANS_CENTER   transCenterX / transCenterY 非法
   * ERR_INVALID_PARAM_GETTER   getParamX / getParamY 不是函数
   * ERR_UNSUPPORTED_ENV        找不到 document / window
   */
  var ERROR_CODES = {
    INVALID_DOM: 'ERR_INVALID_DOM',
    INVALID_CONFIG: 'ERR_INVALID_CONFIG',
    INVALID_ACTIVE_CLASS: 'ERR_INVALID_ACTIVE_CLASS',
    INVALID_TRANS_CENTER: 'ERR_INVALID_TRANS_CENTER',
    INVALID_PARAM_GETTER: 'ERR_INVALID_PARAM_GETTER',
    UNSUPPORTED_ENV: 'ERR_UNSUPPORTED_ENV'
  };

  /**
   * 结构化错误：既是 Error 的实例，也带稳定的 code。
   *
   * @param {string} message 人类可读的说明
   * @param {string} code 见 ERROR_CODES
   * @constructor
   */
  function AwesomeCardError(message, code) {
    this.name = 'AwesomeCardError';
    this.message = message;
    this.code = code;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AwesomeCardError);
    } else {
      this.stack = new Error(message).stack;
    }
  }
  AwesomeCardError.prototype = Object.create(Error.prototype);
  AwesomeCardError.prototype.constructor = AwesomeCardError;

  /**
   * 拿到当前环境的全局对象。
   * 之所以不直接写 window / document，是为了在 Node（跑测试）里也能注入桩对象。
   *
   * @return {!Object}
   */
  function getGlobal() {
    if (typeof globalThis !== 'undefined') {
      return globalThis;
    }
    if (typeof window !== 'undefined') {
      return window;
    }
    if (typeof global !== 'undefined') {
      return global;
    }
    return {};
  }

  /**
   * 判断是不是 DOM 元素。
   * 只用 instanceof 会漏掉跨 iframe / 跨 realm 的节点和 SVG 节点，所以再补一个结构判断。
   *
   * @param {*} obj
   * @return {boolean}
   */
  function isElement(obj) {
    if (!obj || typeof obj !== 'object') {
      return false;
    }
    var global = getGlobal();
    if (typeof global.HTMLElement === 'function' && obj instanceof global.HTMLElement) {
      return true;
    }
    return obj.nodeType === 1 && typeof obj.nodeName === 'string';
  }

  /**
   * 只接受普通对象（排除 null、数组、函数、DOM 节点等）。
   *
   * @param {*} value
   * @return {boolean}
   */
  function isPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }
    return !isElement(value);
  }

  /**
   * activeClass 会被写到 DOM 上，所以必须是一个干净的 class token。
   * 不允许空格、引号、尖括号、冒号、逗号之类的字符，避免把任意属性 / 样式写进元素
   * （以前这里是 `dom.className += ' ' + activeClass` 字符串拼接）。
   *
   * @param {*} value
   * @return {?string}
   */
  var CLASS_TOKEN_RE = /^[A-Za-z_-][A-Za-z0-9_-]*$/;
  function parseActiveClass(value) {
    if (value === undefined || value === null || value === false) {
      return null;
    }
    if (typeof value !== 'string') {
      throw new AwesomeCardError(
        'awesome-card: config.activeClass must be a string (or omitted), got ' + typeof value,
        ERROR_CODES.INVALID_ACTIVE_CLASS
      );
    }
    var token = value.trim();
    if (token === '') {
      return null;
    }
    if (!CLASS_TOKEN_RE.test(token)) {
      throw new AwesomeCardError(
        'awesome-card: config.activeClass must be a single CSS class token ' +
        '(letters, digits, "-" and "_" only); refusing to write "' + token + '" to the element',
        ERROR_CODES.INVALID_ACTIVE_CLASS
      );
    }
    return token;
  }

  /**
   * transCenterX / transCenterY 支持 "50%" 这种百分比，也支持 0~1 的数字。
   * 之前这两个参数压根没从 config 里读，调用方传了也是被默认值覆盖掉。
   *
   * @param {*} value
   * @param {string} name
   * @return {number} 0~1
   */
  function parseTransCenter(value, name) {
    if (value === undefined || value === null || value === '') {
      return DEFAULT_TRANS_CENTER;
    }
    var ratio = NaN;
    if (typeof value === 'number') {
      ratio = value;
    } else if (typeof value === 'string') {
      var trimmed = value.trim();
      ratio = trimmed.charAt(trimmed.length - 1) === '%' ?
        parseFloat(trimmed.slice(0, -1)) / 100 :
        parseFloat(trimmed);
    }
    if (typeof ratio !== 'number' || !isFinite(ratio)) {
      throw new AwesomeCardError(
        'awesome-card: config.' + name + ' must be a percentage string such as "50%" ' +
        'or a number between 0 and 1, got ' + JSON.stringify(value),
        ERROR_CODES.INVALID_TRANS_CENTER
      );
    }
    if (ratio < 0 || ratio > 1) {
      throw new AwesomeCardError(
        'awesome-card: config.' + name + ' must resolve to a value between 0 and 1, got ' + ratio,
        ERROR_CODES.INVALID_TRANS_CENTER
      );
    }
    return ratio;
  }

  /**
   * getParamX / getParamY 必须是函数；返回值必须是有限数字，
   * 否则退回默认值，避免把 NaN 写进 style.transform。
   *
   * @param {*} fn
   * @param {string} name
   * @return {!Function}
   */
  function parseParamGetter(fn, name) {
    if (fn === undefined || fn === null) {
      return defaultParamGetter;
    }
    if (typeof fn !== 'function') {
      throw new AwesomeCardError(
        'awesome-card: config.' + name + ' must be a function, got ' + typeof fn,
        ERROR_CODES.INVALID_PARAM_GETTER
      );
    }
    return function () {
      var value = fn();
      return typeof value === 'number' && isFinite(value) ? value : DEFAULT_PARAM;
    };
  }

  /**
   * @return {number}
   */
  function defaultParamGetter() {
    return DEFAULT_PARAM;
  }

  /**
   * 决定用鼠标还是陀螺仪。
   * 原来的写法是 `typeof config.isPC === undefined`，typeof 返回的是字符串，
   * 这个条件恒为 false，于是 config.isPC 永远是 undefined（falsy），
   * 不传 isPC 的调用方会被静默丢到陀螺仪分支。现在按文档默认值走：默认鼠标。
   *
   * @param {!Object} config
   * @return {boolean} true 表示监听鼠标
   */
  function resolveAttachToMouse(config) {
    if (typeof config.isPC === 'boolean') {
      return config.isPC;
    }
    if (typeof config.attachToMouseEvent === 'boolean') {
      return config.attachToMouseEvent;
    }
    return true;
  }

  /**
   * 校验并归一化配置。
   *
   * @param {!Object} config
   * @return {!Object}
   */
  function normalizeConfig(config) {
    return {
      transCenterX: parseTransCenter(config.transCenterX, 'transCenterX'),
      transCenterY: parseTransCenter(config.transCenterY, 'transCenterY'),
      activeClass: parseActiveClass(config.activeClass),
      attachToMouseEvent: resolveAttachToMouse(config),
      getParamX: parseParamGetter(config.getParamX, 'getParamX'),
      getParamY: parseParamGetter(config.getParamY, 'getParamY')
    };
  }

  /**
   * 读元素的尺寸 / 位置。getBoundingClientRect 一次就能拿到全部数据，
   * 比分别读 offsetLeft/offsetTop/offsetWidth/offsetHeight 更省（少几次强制重排），
   * 而且用的是视口坐标，页面滚动之后依然正确。
   *
   * @param {!Object} element
   * @return {{left: number, top: number, width: number, height: number}}
   */
  function measure(element) {
    if (typeof element.getBoundingClientRect === 'function') {
      var rect = element.getBoundingClientRect();
      if (rect) {
        return {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height
        };
      }
    }
    return {
      left: element.offsetLeft,
      top: element.offsetTop,
      width: element.offsetWidth,
      height: element.offsetHeight
    };
  }

  /**
   * 除法保护：元素隐藏（宽高为 0）时返回 0，而不是 Infinity / NaN。
   *
   * @param {number} value
   * @param {number} size
   * @return {number}
   */
  function safeRatio(value, size) {
    return size > 0 ? value / size : 0;
  }

  /**
   * 精确判断 class 是否存在。
   * 以前是 `dom.className.indexOf(activeClass) >= 0`，子串匹配，
   * activeClass: 'active' 会把 'inactive' 也当成命中。
   *
   * @param {!Object} element
   * @param {string} className
   * @return {boolean}
   */
  function hasClass(element, className) {
    if (element.classList && typeof element.classList.contains === 'function') {
      return element.classList.contains(className);
    }
    return (' ' + (element.className || '') + ' ').indexOf(' ' + className + ' ') >= 0;
  }

  /**
   * @param {!Object} element
   * @param {string} className 已经校验过的 class token
   */
  function addClass(element, className) {
    if (element.classList && typeof element.classList.add === 'function') {
      element.classList.add(className);
      return;
    }
    if (!hasClass(element, className)) {
      element.className = (element.className ? element.className + ' ' : '') + className;
    }
  }

  /**
   * @param {!Object} element
   * @param {string} className 已经校验过的 class token
   */
  function removeClass(element, className) {
    if (element.classList && typeof element.classList.remove === 'function') {
      element.classList.remove(className);
      return;
    }
    element.className = (' ' + (element.className || '') + ' ')
      .replace(' ' + className + ' ', ' ')
      .replace(/^\s+|\s+$/g, '');
  }

  /**
   * 写 transform。矩阵字符串的格式和以前完全一致（matrix3d 逗号分隔的 16 个数）。
   * 防御性写法：teardown 路径不能因为元素没有 style 对象而抛错。
   *
   * @param {!Object} element
   * @param {number} x
   * @param {number} y
   * @param {!Object} options
   */
  function applyTransform(element, x, y, options) {
    var matrix = [
      [1, 0, 0, x * options.getParamX()],
      [0, 1, 0, y * options.getParamY()],
      [0, 0, 1, 1],
      [0, 0, 0, 1]
    ];
    var values = [];
    for (var i = 0; i < matrix.length; i++) {
      values.push(matrix[i].join(','));
    }
    setTransform(element, 'matrix3d(' + values.join(',') + ')');
  }

  /**
   * @param {!Object} element
   * @param {string} value
   */
  function setTransform(element, value) {
    if (element.style) {
      element.style.transform = value;
    }
  }

  /**
   * 复位 transform。
   *
   * @param {!Object} element
   */
  function resetTransform(element) {
    setTransform(element, 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,1,0,0,0,1)');
  }

  /**
   * 主函数
   *
   * @param {!DOM} dom 要 awesome 的 card 的 dom，选择器不支持，jquery不支持，zepto不支持
   * @param {!Object} config 配置参数
   *
   * @param {!String} config.transCenterX eg:'50%', 压感的中心X轴，如果是移动端这个参数不考虑。
   * @param {!String} config.transCenterY eg:'50%', 压感的中心Y轴，如果是移动端这个参数不考虑。
   * @param {Boolean} config.isPC eg:true, false的话就是移动端，会通过陀螺仪去awesome起来。
   * @param {String} config.activeClass eg:'active', 当 card awesome 起来的时候，class会被添加到dom上
   * @param {Function} config.getParamX eg: ()=>0.00005 这个函数可以动态的配置X方向参数，这个参数直接影响了运动的幅度，建议你从0.00005开始体验
   * @param {Function} config.getParamY eg: ()=>0.00005 这个函数可以动态的配置Y方向参数，这个参数直接影响了运动的幅度，建议你从0.00005开始体验
   *
   * @return {!Object} handle 调用 handle.destroy() 可以解绑事件、移除 class、复位 transform
   * @throws {AwesomeCardError} config 非法时抛出，err.code 见 ERROR_CODES
   */
  var awesomeCard = function (dom, config) {
    var global = getGlobal();
    var doc = global.document;
    var win = global.window || global;

    if (!isElement(dom)) {
      throw new AwesomeCardError('you are passing something not a dom, shutting down!', ERROR_CODES.INVALID_DOM);
    }
    if (!isPlainObject(config)) {
      throw new AwesomeCardError(
        'awesome-card: config must be a plain object, got ' + (config === null ? 'null' : typeof config),
        ERROR_CODES.INVALID_CONFIG
      );
    }
    if (!doc || typeof doc.addEventListener !== 'function' ||
      !win || typeof win.addEventListener !== 'function') {
      throw new AwesomeCardError(
        'awesome-card: no document/window available in this environment',
        ERROR_CODES.UNSUPPORTED_ENV
      );
    }

    var options = normalizeConfig(config);
    var element = dom;
    var destroyed = false;
    var active = false;
    var baseline = null;
    var target = options.attachToMouseEvent ? doc : win;
    var type = options.attachToMouseEvent ? 'mousemove' : 'deviceorientation';

    /**
     * @param {boolean} next
     */
    function setActive(next) {
      active = next;
      if (!options.activeClass) {
        return;
      }
      if (next) {
        addClass(element, options.activeClass);
      } else {
        removeClass(element, options.activeClass);
      }
    }

    /**
     * 鼠标分支：指针在卡片内部时按相对位置算偏移，移出去就复位。
     *
     * @param {!Object} event
     */
    function onMouseMove(event) {
      if (destroyed) {
        return;
      }
      var box = measure(element);
      var x = event.clientX - box.left;
      if (x < 0 || x > box.width) {
        setActive(false);
        resetTransform(element);
        return;
      }
      var y = event.clientY - box.top;
      if (y < 0 || y > box.height) {
        setActive(false);
        resetTransform(element);
        return;
      }
      setActive(true);
      applyTransform(
        element,
        safeRatio(x - options.transCenterX * box.width, box.width),
        safeRatio(y - options.transCenterY * box.height, box.height),
        options
      );
    }

    /**
     * 陀螺仪分支：以第一次读到的角度为基准，用偏移量驱动。
     *
     * @param {!Object} event
     */
    function onDeviceOrientation(event) {
      if (destroyed) {
        return;
      }
      // 有些设备 / 权限被拒时 beta、gamma 是 null，这种情况直接忽略。
      if (!event || typeof event.beta !== 'number' || typeof event.gamma !== 'number' ||
        !isFinite(event.beta) || !isFinite(event.gamma)) {
        return;
      }
      if (baseline === null) {
        baseline = { beta: event.beta, gamma: event.gamma };
      }
      var box = measure(element);
      setActive(true);
      applyTransform(
        element,
        safeRatio(degToDis(-(event.gamma - baseline.gamma)), box.width),
        safeRatio(degToDis(-(event.beta - baseline.beta)), box.height),
        options
      );
    }

    var listener = options.attachToMouseEvent ? onMouseMove : onDeviceOrientation;
    // mousemove 用 passive，避免在移动端拖动时白白阻塞滚动。
    target.addEventListener(type, listener, options.attachToMouseEvent
      ? { passive: true }
      : true);

    /**
     * 解绑事件、复位元素状态。可以重复调用。
     */
    function destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;
      target.removeEventListener(type, listener, options.attachToMouseEvent
        ? { passive: true }
        : true);
      setActive(false);
      resetTransform(element);
      baseline = null;
    }

    return {
      version: VERSION,
      element: element,
      destroy: destroy,
      /**
       * @return {boolean} 卡片当前是否处于 active 状态
       */
      isActive: function () {
        return active;
      }
    };
  };

  /**
   * 角度 -> 位移的映射，保持原有的算法。
   *
   * @param {number} deg
   * @return {number}
   */
  function degToDis(deg) {
    if (typeof deg !== 'number' || !isFinite(deg)) {
      return 0;
    }
    return Math.sqrt(Math.abs(deg)) * (deg > 0 ? 1 : -1) * ORIENTATION_SCALE;
  }

  awesomeCard.AwesomeCardError = AwesomeCardError;
  awesomeCard.ERROR_CODES = ERROR_CODES;
  awesomeCard.VERSION = VERSION;

  return awesomeCard;
}));
