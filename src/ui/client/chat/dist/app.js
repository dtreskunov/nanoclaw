// node_modules/preact/dist/preact.module.js
var n;
var l;
var u;
var t;
var i;
var r;
var o;
var e;
var f;
var c;
var s;
var a;
var h;
var p = {};
var v = [];
var y = /acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i;
var d = Array.isArray;
function w(n4, l7) {
  for (var u4 in l7) n4[u4] = l7[u4];
  return n4;
}
function _(n4) {
  n4 && n4.parentNode && n4.parentNode.removeChild(n4);
}
function g(l7, u4, t5) {
  var i4, r4, o4, e4 = {};
  for (o4 in u4) "key" == o4 ? i4 = u4[o4] : "ref" == o4 ? r4 = u4[o4] : e4[o4] = u4[o4];
  if (arguments.length > 2 && (e4.children = arguments.length > 3 ? n.call(arguments, 2) : t5), "function" == typeof l7 && null != l7.defaultProps) for (o4 in l7.defaultProps) void 0 === e4[o4] && (e4[o4] = l7.defaultProps[o4]);
  return m(l7, e4, i4, r4, null);
}
function m(n4, t5, i4, r4, o4) {
  var e4 = { type: n4, props: t5, key: i4, ref: r4, __k: null, __: null, __b: 0, __e: null, __c: null, constructor: void 0, __v: null == o4 ? ++u : o4, __i: -1, __u: 0 };
  return null == o4 && null != l.vnode && l.vnode(e4), e4;
}
function k(n4) {
  return n4.children;
}
function x(n4, l7) {
  this.props = n4, this.context = l7;
}
function C(n4, l7) {
  if (null == l7) return n4.__ ? C(n4.__, n4.__i + 1) : null;
  for (var u4; l7 < n4.__k.length; l7++) if (null != (u4 = n4.__k[l7]) && null != u4.__e) return u4.__e;
  return "function" == typeof n4.type ? C(n4) : null;
}
function S(n4) {
  var l7, u4;
  if (null != (n4 = n4.__) && null != n4.__c) {
    for (n4.__e = n4.__c.base = null, l7 = 0; l7 < n4.__k.length; l7++) if (null != (u4 = n4.__k[l7]) && null != u4.__e) {
      n4.__e = n4.__c.base = u4.__e;
      break;
    }
    return S(n4);
  }
}
function M(n4) {
  (!n4.__d && (n4.__d = true) && i.push(n4) && !P.__r++ || r !== l.debounceRendering) && ((r = l.debounceRendering) || o)(P);
}
function P() {
  var n4, u4, t5, r4, o4, f4, c4, s5;
  for (i.sort(e); n4 = i.shift(); ) n4.__d && (u4 = i.length, r4 = void 0, f4 = (o4 = (t5 = n4).__v).__e, c4 = [], s5 = [], t5.__P && ((r4 = w({}, o4)).__v = o4.__v + 1, l.vnode && l.vnode(r4), j(t5.__P, r4, o4, t5.__n, t5.__P.namespaceURI, 32 & o4.__u ? [f4] : null, c4, null == f4 ? C(o4) : f4, !!(32 & o4.__u), s5), r4.__v = o4.__v, r4.__.__k[r4.__i] = r4, z(c4, r4, s5), r4.__e != f4 && S(r4)), i.length > u4 && i.sort(e));
  P.__r = 0;
}
function $(n4, l7, u4, t5, i4, r4, o4, e4, f4, c4, s5) {
  var a4, h5, y5, d5, w5, _5, g5 = t5 && t5.__k || v, m6 = l7.length;
  for (f4 = I(u4, l7, g5, f4, m6), a4 = 0; a4 < m6; a4++) null != (y5 = u4.__k[a4]) && (h5 = -1 === y5.__i ? p : g5[y5.__i] || p, y5.__i = a4, _5 = j(n4, y5, h5, i4, r4, o4, e4, f4, c4, s5), d5 = y5.__e, y5.ref && h5.ref != y5.ref && (h5.ref && V(h5.ref, null, y5), s5.push(y5.ref, y5.__c || d5, y5)), null == w5 && null != d5 && (w5 = d5), 4 & y5.__u || h5.__k === y5.__k ? f4 = A(y5, f4, n4) : "function" == typeof y5.type && void 0 !== _5 ? f4 = _5 : d5 && (f4 = d5.nextSibling), y5.__u &= -7);
  return u4.__e = w5, f4;
}
function I(n4, l7, u4, t5, i4) {
  var r4, o4, e4, f4, c4, s5 = u4.length, a4 = s5, h5 = 0;
  for (n4.__k = new Array(i4), r4 = 0; r4 < i4; r4++) null != (o4 = l7[r4]) && "boolean" != typeof o4 && "function" != typeof o4 ? (f4 = r4 + h5, (o4 = n4.__k[r4] = "string" == typeof o4 || "number" == typeof o4 || "bigint" == typeof o4 || o4.constructor == String ? m(null, o4, null, null, null) : d(o4) ? m(k, { children: o4 }, null, null, null) : void 0 === o4.constructor && o4.__b > 0 ? m(o4.type, o4.props, o4.key, o4.ref ? o4.ref : null, o4.__v) : o4).__ = n4, o4.__b = n4.__b + 1, e4 = null, -1 !== (c4 = o4.__i = L(o4, u4, f4, a4)) && (a4--, (e4 = u4[c4]) && (e4.__u |= 2)), null == e4 || null === e4.__v ? (-1 == c4 && h5--, "function" != typeof o4.type && (o4.__u |= 4)) : c4 != f4 && (c4 == f4 - 1 ? h5-- : c4 == f4 + 1 ? h5++ : (c4 > f4 ? h5-- : h5++, o4.__u |= 4))) : n4.__k[r4] = null;
  if (a4) for (r4 = 0; r4 < s5; r4++) null != (e4 = u4[r4]) && 0 == (2 & e4.__u) && (e4.__e == t5 && (t5 = C(e4)), q(e4, e4));
  return t5;
}
function A(n4, l7, u4) {
  var t5, i4;
  if ("function" == typeof n4.type) {
    for (t5 = n4.__k, i4 = 0; t5 && i4 < t5.length; i4++) t5[i4] && (t5[i4].__ = n4, l7 = A(t5[i4], l7, u4));
    return l7;
  }
  n4.__e != l7 && (l7 && n4.type && !u4.contains(l7) && (l7 = C(n4)), u4.insertBefore(n4.__e, l7 || null), l7 = n4.__e);
  do {
    l7 = l7 && l7.nextSibling;
  } while (null != l7 && 8 == l7.nodeType);
  return l7;
}
function L(n4, l7, u4, t5) {
  var i4, r4, o4 = n4.key, e4 = n4.type, f4 = l7[u4];
  if (null === f4 || f4 && o4 == f4.key && e4 === f4.type && 0 == (2 & f4.__u)) return u4;
  if (t5 > (null != f4 && 0 == (2 & f4.__u) ? 1 : 0)) for (i4 = u4 - 1, r4 = u4 + 1; i4 >= 0 || r4 < l7.length; ) {
    if (i4 >= 0) {
      if ((f4 = l7[i4]) && 0 == (2 & f4.__u) && o4 == f4.key && e4 === f4.type) return i4;
      i4--;
    }
    if (r4 < l7.length) {
      if ((f4 = l7[r4]) && 0 == (2 & f4.__u) && o4 == f4.key && e4 === f4.type) return r4;
      r4++;
    }
  }
  return -1;
}
function T(n4, l7, u4) {
  "-" == l7[0] ? n4.setProperty(l7, null == u4 ? "" : u4) : n4[l7] = null == u4 ? "" : "number" != typeof u4 || y.test(l7) ? u4 : u4 + "px";
}
function F(n4, l7, u4, t5, i4) {
  var r4;
  n: if ("style" == l7) if ("string" == typeof u4) n4.style.cssText = u4;
  else {
    if ("string" == typeof t5 && (n4.style.cssText = t5 = ""), t5) for (l7 in t5) u4 && l7 in u4 || T(n4.style, l7, "");
    if (u4) for (l7 in u4) t5 && u4[l7] === t5[l7] || T(n4.style, l7, u4[l7]);
  }
  else if ("o" == l7[0] && "n" == l7[1]) r4 = l7 != (l7 = l7.replace(f, "$1")), l7 = l7.toLowerCase() in n4 || "onFocusOut" == l7 || "onFocusIn" == l7 ? l7.toLowerCase().slice(2) : l7.slice(2), n4.l || (n4.l = {}), n4.l[l7 + r4] = u4, u4 ? t5 ? u4.u = t5.u : (u4.u = c, n4.addEventListener(l7, r4 ? a : s, r4)) : n4.removeEventListener(l7, r4 ? a : s, r4);
  else {
    if ("http://www.w3.org/2000/svg" == i4) l7 = l7.replace(/xlink(H|:h)/, "h").replace(/sName$/, "s");
    else if ("width" != l7 && "height" != l7 && "href" != l7 && "list" != l7 && "form" != l7 && "tabIndex" != l7 && "download" != l7 && "rowSpan" != l7 && "colSpan" != l7 && "role" != l7 && "popover" != l7 && l7 in n4) try {
      n4[l7] = null == u4 ? "" : u4;
      break n;
    } catch (n5) {
    }
    "function" == typeof u4 || (null == u4 || false === u4 && "-" != l7[4] ? n4.removeAttribute(l7) : n4.setAttribute(l7, "popover" == l7 && 1 == u4 ? "" : u4));
  }
}
function O(n4) {
  return function(u4) {
    if (this.l) {
      var t5 = this.l[u4.type + n4];
      if (null == u4.t) u4.t = c++;
      else if (u4.t < t5.u) return;
      return t5(l.event ? l.event(u4) : u4);
    }
  };
}
function j(n4, u4, t5, i4, r4, o4, e4, f4, c4, s5) {
  var a4, h5, p5, v5, y5, g5, m6, b4, C3, S3, M3, P3, I3, A5, H2, L3, T4, F3 = u4.type;
  if (void 0 !== u4.constructor) return null;
  128 & t5.__u && (c4 = !!(32 & t5.__u), o4 = [f4 = u4.__e = t5.__e]), (a4 = l.__b) && a4(u4);
  n: if ("function" == typeof F3) try {
    if (b4 = u4.props, C3 = "prototype" in F3 && F3.prototype.render, S3 = (a4 = F3.contextType) && i4[a4.__c], M3 = a4 ? S3 ? S3.props.value : a4.__ : i4, t5.__c ? m6 = (h5 = u4.__c = t5.__c).__ = h5.__E : (C3 ? u4.__c = h5 = new F3(b4, M3) : (u4.__c = h5 = new x(b4, M3), h5.constructor = F3, h5.render = B), S3 && S3.sub(h5), h5.props = b4, h5.state || (h5.state = {}), h5.context = M3, h5.__n = i4, p5 = h5.__d = true, h5.__h = [], h5._sb = []), C3 && null == h5.__s && (h5.__s = h5.state), C3 && null != F3.getDerivedStateFromProps && (h5.__s == h5.state && (h5.__s = w({}, h5.__s)), w(h5.__s, F3.getDerivedStateFromProps(b4, h5.__s))), v5 = h5.props, y5 = h5.state, h5.__v = u4, p5) C3 && null == F3.getDerivedStateFromProps && null != h5.componentWillMount && h5.componentWillMount(), C3 && null != h5.componentDidMount && h5.__h.push(h5.componentDidMount);
    else {
      if (C3 && null == F3.getDerivedStateFromProps && b4 !== v5 && null != h5.componentWillReceiveProps && h5.componentWillReceiveProps(b4, M3), !h5.__e && (null != h5.shouldComponentUpdate && false === h5.shouldComponentUpdate(b4, h5.__s, M3) || u4.__v == t5.__v)) {
        for (u4.__v != t5.__v && (h5.props = b4, h5.state = h5.__s, h5.__d = false), u4.__e = t5.__e, u4.__k = t5.__k, u4.__k.some(function(n5) {
          n5 && (n5.__ = u4);
        }), P3 = 0; P3 < h5._sb.length; P3++) h5.__h.push(h5._sb[P3]);
        h5._sb = [], h5.__h.length && e4.push(h5);
        break n;
      }
      null != h5.componentWillUpdate && h5.componentWillUpdate(b4, h5.__s, M3), C3 && null != h5.componentDidUpdate && h5.__h.push(function() {
        h5.componentDidUpdate(v5, y5, g5);
      });
    }
    if (h5.context = M3, h5.props = b4, h5.__P = n4, h5.__e = false, I3 = l.__r, A5 = 0, C3) {
      for (h5.state = h5.__s, h5.__d = false, I3 && I3(u4), a4 = h5.render(h5.props, h5.state, h5.context), H2 = 0; H2 < h5._sb.length; H2++) h5.__h.push(h5._sb[H2]);
      h5._sb = [];
    } else do {
      h5.__d = false, I3 && I3(u4), a4 = h5.render(h5.props, h5.state, h5.context), h5.state = h5.__s;
    } while (h5.__d && ++A5 < 25);
    h5.state = h5.__s, null != h5.getChildContext && (i4 = w(w({}, i4), h5.getChildContext())), C3 && !p5 && null != h5.getSnapshotBeforeUpdate && (g5 = h5.getSnapshotBeforeUpdate(v5, y5)), f4 = $(n4, d(L3 = null != a4 && a4.type === k && null == a4.key ? a4.props.children : a4) ? L3 : [L3], u4, t5, i4, r4, o4, e4, f4, c4, s5), h5.base = u4.__e, u4.__u &= -161, h5.__h.length && e4.push(h5), m6 && (h5.__E = h5.__ = null);
  } catch (n5) {
    if (u4.__v = null, c4 || null != o4) if (n5.then) {
      for (u4.__u |= c4 ? 160 : 128; f4 && 8 == f4.nodeType && f4.nextSibling; ) f4 = f4.nextSibling;
      o4[o4.indexOf(f4)] = null, u4.__e = f4;
    } else for (T4 = o4.length; T4--; ) _(o4[T4]);
    else u4.__e = t5.__e, u4.__k = t5.__k;
    l.__e(n5, u4, t5);
  }
  else null == o4 && u4.__v == t5.__v ? (u4.__k = t5.__k, u4.__e = t5.__e) : f4 = u4.__e = N(t5.__e, u4, t5, i4, r4, o4, e4, c4, s5);
  return (a4 = l.diffed) && a4(u4), 128 & u4.__u ? void 0 : f4;
}
function z(n4, u4, t5) {
  for (var i4 = 0; i4 < t5.length; i4++) V(t5[i4], t5[++i4], t5[++i4]);
  l.__c && l.__c(u4, n4), n4.some(function(u5) {
    try {
      n4 = u5.__h, u5.__h = [], n4.some(function(n5) {
        n5.call(u5);
      });
    } catch (n5) {
      l.__e(n5, u5.__v);
    }
  });
}
function N(u4, t5, i4, r4, o4, e4, f4, c4, s5) {
  var a4, h5, v5, y5, w5, g5, m6, b4 = i4.props, k4 = t5.props, x5 = t5.type;
  if ("svg" == x5 ? o4 = "http://www.w3.org/2000/svg" : "math" == x5 ? o4 = "http://www.w3.org/1998/Math/MathML" : o4 || (o4 = "http://www.w3.org/1999/xhtml"), null != e4) {
    for (a4 = 0; a4 < e4.length; a4++) if ((w5 = e4[a4]) && "setAttribute" in w5 == !!x5 && (x5 ? w5.localName == x5 : 3 == w5.nodeType)) {
      u4 = w5, e4[a4] = null;
      break;
    }
  }
  if (null == u4) {
    if (null == x5) return document.createTextNode(k4);
    u4 = document.createElementNS(o4, x5, k4.is && k4), c4 && (l.__m && l.__m(t5, e4), c4 = false), e4 = null;
  }
  if (null === x5) b4 === k4 || c4 && u4.data === k4 || (u4.data = k4);
  else {
    if (e4 = e4 && n.call(u4.childNodes), b4 = i4.props || p, !c4 && null != e4) for (b4 = {}, a4 = 0; a4 < u4.attributes.length; a4++) b4[(w5 = u4.attributes[a4]).name] = w5.value;
    for (a4 in b4) if (w5 = b4[a4], "children" == a4) ;
    else if ("dangerouslySetInnerHTML" == a4) v5 = w5;
    else if (!(a4 in k4)) {
      if ("value" == a4 && "defaultValue" in k4 || "checked" == a4 && "defaultChecked" in k4) continue;
      F(u4, a4, null, w5, o4);
    }
    for (a4 in k4) w5 = k4[a4], "children" == a4 ? y5 = w5 : "dangerouslySetInnerHTML" == a4 ? h5 = w5 : "value" == a4 ? g5 = w5 : "checked" == a4 ? m6 = w5 : c4 && "function" != typeof w5 || b4[a4] === w5 || F(u4, a4, w5, b4[a4], o4);
    if (h5) c4 || v5 && (h5.__html === v5.__html || h5.__html === u4.innerHTML) || (u4.innerHTML = h5.__html), t5.__k = [];
    else if (v5 && (u4.innerHTML = ""), $(u4, d(y5) ? y5 : [y5], t5, i4, r4, "foreignObject" == x5 ? "http://www.w3.org/1999/xhtml" : o4, e4, f4, e4 ? e4[0] : i4.__k && C(i4, 0), c4, s5), null != e4) for (a4 = e4.length; a4--; ) _(e4[a4]);
    c4 || (a4 = "value", "progress" == x5 && null == g5 ? u4.removeAttribute("value") : void 0 !== g5 && (g5 !== u4[a4] || "progress" == x5 && !g5 || "option" == x5 && g5 !== b4[a4]) && F(u4, a4, g5, b4[a4], o4), a4 = "checked", void 0 !== m6 && m6 !== u4[a4] && F(u4, a4, m6, b4[a4], o4));
  }
  return u4;
}
function V(n4, u4, t5) {
  try {
    if ("function" == typeof n4) {
      var i4 = "function" == typeof n4.__u;
      i4 && n4.__u(), i4 && null == u4 || (n4.__u = n4(u4));
    } else n4.current = u4;
  } catch (n5) {
    l.__e(n5, t5);
  }
}
function q(n4, u4, t5) {
  var i4, r4;
  if (l.unmount && l.unmount(n4), (i4 = n4.ref) && (i4.current && i4.current !== n4.__e || V(i4, null, u4)), null != (i4 = n4.__c)) {
    if (i4.componentWillUnmount) try {
      i4.componentWillUnmount();
    } catch (n5) {
      l.__e(n5, u4);
    }
    i4.base = i4.__P = null;
  }
  if (i4 = n4.__k) for (r4 = 0; r4 < i4.length; r4++) i4[r4] && q(i4[r4], u4, t5 || "function" != typeof n4.type);
  t5 || _(n4.__e), n4.__c = n4.__ = n4.__e = void 0;
}
function B(n4, l7, u4) {
  return this.constructor(n4, u4);
}
function D(u4, t5, i4) {
  var r4, o4, e4, f4;
  t5 == document && (t5 = document.documentElement), l.__ && l.__(u4, t5), o4 = (r4 = "function" == typeof i4) ? null : i4 && i4.__k || t5.__k, e4 = [], f4 = [], j(t5, u4 = (!r4 && i4 || t5).__k = g(k, null, [u4]), o4 || p, p, t5.namespaceURI, !r4 && i4 ? [i4] : o4 ? null : t5.firstChild ? n.call(t5.childNodes) : null, e4, !r4 && i4 ? i4 : o4 ? o4.__e : t5.firstChild, r4, f4), z(e4, u4, f4);
}
n = v.slice, l = { __e: function(n4, l7, u4, t5) {
  for (var i4, r4, o4; l7 = l7.__; ) if ((i4 = l7.__c) && !i4.__) try {
    if ((r4 = i4.constructor) && null != r4.getDerivedStateFromError && (i4.setState(r4.getDerivedStateFromError(n4)), o4 = i4.__d), null != i4.componentDidCatch && (i4.componentDidCatch(n4, t5 || {}), o4 = i4.__d), o4) return i4.__E = i4;
  } catch (l8) {
    n4 = l8;
  }
  throw n4;
} }, u = 0, t = function(n4) {
  return null != n4 && null == n4.constructor;
}, x.prototype.setState = function(n4, l7) {
  var u4;
  u4 = null != this.__s && this.__s !== this.state ? this.__s : this.__s = w({}, this.state), "function" == typeof n4 && (n4 = n4(w({}, u4), this.props)), n4 && w(u4, n4), null != n4 && this.__v && (l7 && this._sb.push(l7), M(this));
}, x.prototype.forceUpdate = function(n4) {
  this.__v && (this.__e = true, n4 && this.__h.push(n4), M(this));
}, x.prototype.render = k, i = [], o = "function" == typeof Promise ? Promise.prototype.then.bind(Promise.resolve()) : setTimeout, e = function(n4, l7) {
  return n4.__v.__b - l7.__v.__b;
}, P.__r = 0, f = /(PointerCapture)$|Capture$/i, c = 0, s = O(false), a = O(true), h = 0;

// node_modules/preact/hooks/dist/hooks.module.js
var t2;
var r2;
var u2;
var i2;
var o2 = 0;
var f2 = [];
var c2 = l;
var e2 = c2.__b;
var a2 = c2.__r;
var v2 = c2.diffed;
var l2 = c2.__c;
var m2 = c2.unmount;
var s2 = c2.__;
function d2(n4, t5) {
  c2.__h && c2.__h(r2, n4, o2 || t5), o2 = 0;
  var u4 = r2.__H || (r2.__H = { __: [], __h: [] });
  return n4 >= u4.__.length && u4.__.push({}), u4.__[n4];
}
function h2(n4) {
  return o2 = 1, p2(D2, n4);
}
function p2(n4, u4, i4) {
  var o4 = d2(t2++, 2);
  if (o4.t = n4, !o4.__c && (o4.__ = [i4 ? i4(u4) : D2(void 0, u4), function(n5) {
    var t5 = o4.__N ? o4.__N[0] : o4.__[0], r4 = o4.t(t5, n5);
    t5 !== r4 && (o4.__N = [r4, o4.__[1]], o4.__c.setState({}));
  }], o4.__c = r2, !r2.u)) {
    var f4 = function(n5, t5, r4) {
      if (!o4.__c.__H) return true;
      var u5 = o4.__c.__H.__.filter(function(n6) {
        return !!n6.__c;
      });
      if (u5.every(function(n6) {
        return !n6.__N;
      })) return !c4 || c4.call(this, n5, t5, r4);
      var i5 = o4.__c.props !== n5;
      return u5.forEach(function(n6) {
        if (n6.__N) {
          var t6 = n6.__[0];
          n6.__ = n6.__N, n6.__N = void 0, t6 !== n6.__[0] && (i5 = true);
        }
      }), c4 && c4.call(this, n5, t5, r4) || i5;
    };
    r2.u = true;
    var c4 = r2.shouldComponentUpdate, e4 = r2.componentWillUpdate;
    r2.componentWillUpdate = function(n5, t5, r4) {
      if (this.__e) {
        var u5 = c4;
        c4 = void 0, f4(n5, t5, r4), c4 = u5;
      }
      e4 && e4.call(this, n5, t5, r4);
    }, r2.shouldComponentUpdate = f4;
  }
  return o4.__N || o4.__;
}
function y2(n4, u4) {
  var i4 = d2(t2++, 3);
  !c2.__s && C2(i4.__H, u4) && (i4.__ = n4, i4.i = u4, r2.__H.__h.push(i4));
}
function A2(n4) {
  return o2 = 5, T2(function() {
    return { current: n4 };
  }, []);
}
function T2(n4, r4) {
  var u4 = d2(t2++, 7);
  return C2(u4.__H, r4) && (u4.__ = n4(), u4.__H = r4, u4.__h = n4), u4.__;
}
function j2() {
  for (var n4; n4 = f2.shift(); ) if (n4.__P && n4.__H) try {
    n4.__H.__h.forEach(z2), n4.__H.__h.forEach(B2), n4.__H.__h = [];
  } catch (t5) {
    n4.__H.__h = [], c2.__e(t5, n4.__v);
  }
}
c2.__b = function(n4) {
  r2 = null, e2 && e2(n4);
}, c2.__ = function(n4, t5) {
  n4 && t5.__k && t5.__k.__m && (n4.__m = t5.__k.__m), s2 && s2(n4, t5);
}, c2.__r = function(n4) {
  a2 && a2(n4), t2 = 0;
  var i4 = (r2 = n4.__c).__H;
  i4 && (u2 === r2 ? (i4.__h = [], r2.__h = [], i4.__.forEach(function(n5) {
    n5.__N && (n5.__ = n5.__N), n5.i = n5.__N = void 0;
  })) : (i4.__h.forEach(z2), i4.__h.forEach(B2), i4.__h = [], t2 = 0)), u2 = r2;
}, c2.diffed = function(n4) {
  v2 && v2(n4);
  var t5 = n4.__c;
  t5 && t5.__H && (t5.__H.__h.length && (1 !== f2.push(t5) && i2 === c2.requestAnimationFrame || ((i2 = c2.requestAnimationFrame) || w2)(j2)), t5.__H.__.forEach(function(n5) {
    n5.i && (n5.__H = n5.i), n5.i = void 0;
  })), u2 = r2 = null;
}, c2.__c = function(n4, t5) {
  t5.some(function(n5) {
    try {
      n5.__h.forEach(z2), n5.__h = n5.__h.filter(function(n6) {
        return !n6.__ || B2(n6);
      });
    } catch (r4) {
      t5.some(function(n6) {
        n6.__h && (n6.__h = []);
      }), t5 = [], c2.__e(r4, n5.__v);
    }
  }), l2 && l2(n4, t5);
}, c2.unmount = function(n4) {
  m2 && m2(n4);
  var t5, r4 = n4.__c;
  r4 && r4.__H && (r4.__H.__.forEach(function(n5) {
    try {
      z2(n5);
    } catch (n6) {
      t5 = n6;
    }
  }), r4.__H = void 0, t5 && c2.__e(t5, r4.__v));
};
var k2 = "function" == typeof requestAnimationFrame;
function w2(n4) {
  var t5, r4 = function() {
    clearTimeout(u4), k2 && cancelAnimationFrame(t5), setTimeout(n4);
  }, u4 = setTimeout(r4, 100);
  k2 && (t5 = requestAnimationFrame(r4));
}
function z2(n4) {
  var t5 = r2, u4 = n4.__c;
  "function" == typeof u4 && (n4.__c = void 0, u4()), r2 = t5;
}
function B2(n4) {
  var t5 = r2;
  n4.__c = n4.__(), r2 = t5;
}
function C2(n4, t5) {
  return !n4 || n4.length !== t5.length || t5.some(function(t6, r4) {
    return t6 !== n4[r4];
  });
}
function D2(n4, t5) {
  return "function" == typeof t5 ? t5(n4) : t5;
}

// node_modules/@preact/signals-core/dist/signals-core.module.js
var i3 = Symbol.for("preact-signals");
function t3() {
  if (!(s3 > 1)) {
    var i4, t5 = false;
    !function() {
      var i5 = c3;
      c3 = void 0;
      while (void 0 !== i5) {
        if (i5.S.v === i5.v) i5.S.i = i5.i;
        i5 = i5.o;
      }
    }();
    while (void 0 !== h3) {
      var n4 = h3;
      h3 = void 0;
      v3++;
      while (void 0 !== n4) {
        var r4 = n4.u;
        n4.u = void 0;
        n4.f &= -3;
        if (!(8 & n4.f) && w3(n4)) try {
          n4.c();
        } catch (n5) {
          if (!t5) {
            i4 = n5;
            t5 = true;
          }
        }
        n4 = r4;
      }
    }
    v3 = 0;
    s3--;
    if (t5) throw i4;
  } else s3--;
}
function n2(i4) {
  if (s3 > 0) return i4();
  e3 = ++u3;
  s3++;
  try {
    return i4();
  } finally {
    t3();
  }
}
var r3 = void 0;
function o3(i4) {
  var t5 = r3;
  r3 = void 0;
  try {
    return i4();
  } finally {
    r3 = t5;
  }
}
var f3;
var h3 = void 0;
var s3 = 0;
var v3 = 0;
var u3 = 0;
var e3 = 0;
var c3 = void 0;
var d3 = 0;
function a3(i4) {
  if (void 0 !== r3) {
    var t5 = i4.n;
    if (void 0 === t5 || t5.t !== r3) {
      t5 = { i: 0, S: i4, p: r3.s, n: void 0, t: r3, e: void 0, x: void 0, r: t5 };
      if (void 0 !== r3.s) r3.s.n = t5;
      r3.s = t5;
      i4.n = t5;
      if (32 & r3.f) i4.S(t5);
      return t5;
    } else if (-1 === t5.i) {
      t5.i = 0;
      if (void 0 !== t5.n) {
        t5.n.p = t5.p;
        if (void 0 !== t5.p) t5.p.n = t5.n;
        t5.p = r3.s;
        t5.n = void 0;
        r3.s.n = t5;
        r3.s = t5;
      }
      return t5;
    }
  }
}
function l3(i4, t5) {
  this.v = i4;
  this.i = 0;
  this.n = void 0;
  this.t = void 0;
  this.l = 0;
  this.W = null == t5 ? void 0 : t5.watched;
  this.Z = null == t5 ? void 0 : t5.unwatched;
  this.name = null == t5 ? void 0 : t5.name;
}
l3.prototype.brand = i3;
l3.prototype.h = function() {
  return true;
};
l3.prototype.S = function(i4) {
  var t5 = this, n4 = this.t;
  if (n4 !== i4 && void 0 === i4.e) {
    i4.x = n4;
    this.t = i4;
    if (void 0 !== n4) n4.e = i4;
    else o3(function() {
      var i5;
      null == (i5 = t5.W) || i5.call(t5);
    });
  }
};
l3.prototype.U = function(i4) {
  var t5 = this;
  if (void 0 !== this.t) {
    var n4 = i4.e, r4 = i4.x;
    if (void 0 !== n4) {
      n4.x = r4;
      i4.e = void 0;
    }
    if (void 0 !== r4) {
      r4.e = n4;
      i4.x = void 0;
    }
    if (i4 === this.t) {
      this.t = r4;
      if (void 0 === r4) o3(function() {
        var i5;
        null == (i5 = t5.Z) || i5.call(t5);
      });
    }
  }
};
l3.prototype.subscribe = function(i4) {
  var t5 = this;
  return j3(function() {
    var n4 = t5.value, o4 = r3;
    r3 = void 0;
    try {
      i4(n4);
    } finally {
      r3 = o4;
    }
  }, { name: "sub" });
};
l3.prototype.valueOf = function() {
  return this.value;
};
l3.prototype.toString = function() {
  return this.value + "";
};
l3.prototype.toJSON = function() {
  return this.value;
};
l3.prototype.peek = function() {
  var i4 = this;
  return o3(function() {
    return i4.value;
  });
};
Object.defineProperty(l3.prototype, "value", { get: function() {
  var i4 = a3(this);
  if (void 0 !== i4) i4.i = this.i;
  return this.v;
}, set: function(i4) {
  if (i4 !== this.v) {
    if (v3 > 100) throw new Error("Cycle detected");
    !function(i5) {
      if (0 !== s3 && 0 === v3) {
        if (i5.l !== e3) {
          i5.l = e3;
          c3 = { S: i5, v: i5.v, i: i5.i, o: c3 };
        }
      }
    }(this);
    this.v = i4;
    this.i++;
    d3++;
    s3++;
    try {
      for (var n4 = this.t; void 0 !== n4; n4 = n4.x) n4.t.N();
    } finally {
      t3();
    }
  }
} });
function y3(i4, t5) {
  return new l3(i4, t5);
}
function w3(i4) {
  for (var t5 = i4.s; void 0 !== t5; t5 = t5.n) if (t5.S.i !== t5.i || !t5.S.h() || t5.S.i !== t5.i) return true;
  return false;
}
function _2(i4) {
  for (var t5 = i4.s; void 0 !== t5; t5 = t5.n) {
    var n4 = t5.S.n;
    if (void 0 !== n4) t5.r = n4;
    t5.S.n = t5;
    t5.i = -1;
    if (void 0 === t5.n) {
      i4.s = t5;
      break;
    }
  }
}
function b(i4) {
  var t5 = i4.s, n4 = void 0;
  while (void 0 !== t5) {
    var r4 = t5.p;
    if (-1 === t5.i) {
      t5.S.U(t5);
      if (void 0 !== r4) r4.n = t5.n;
      if (void 0 !== t5.n) t5.n.p = r4;
    } else n4 = t5;
    t5.S.n = t5.r;
    if (void 0 !== t5.r) t5.r = void 0;
    t5 = r4;
  }
  i4.s = n4;
}
function p3(i4, t5) {
  l3.call(this, void 0);
  this.x = i4;
  this.s = void 0;
  this.g = d3 - 1;
  this.f = 4;
  this.W = null == t5 ? void 0 : t5.watched;
  this.Z = null == t5 ? void 0 : t5.unwatched;
  this.name = null == t5 ? void 0 : t5.name;
}
p3.prototype = new l3();
p3.prototype.h = function() {
  this.f &= -3;
  if (1 & this.f) return false;
  if (32 == (36 & this.f)) return true;
  this.f &= -5;
  if (this.g === d3) return true;
  this.g = d3;
  this.f |= 1;
  if (this.i > 0 && !w3(this)) {
    this.f &= -2;
    return true;
  }
  var i4 = r3;
  try {
    _2(this);
    r3 = this;
    var t5 = this.x();
    if (16 & this.f || this.v !== t5 || 0 === this.i) {
      this.v = t5;
      this.f &= -17;
      this.i++;
    }
  } catch (i5) {
    this.v = i5;
    this.f |= 16;
    this.i++;
  }
  r3 = i4;
  b(this);
  this.f &= -2;
  return true;
};
p3.prototype.S = function(i4) {
  if (void 0 === this.t) {
    this.f |= 36;
    for (var t5 = this.s; void 0 !== t5; t5 = t5.n) t5.S.S(t5);
  }
  l3.prototype.S.call(this, i4);
};
p3.prototype.U = function(i4) {
  if (void 0 !== this.t) {
    l3.prototype.U.call(this, i4);
    if (void 0 === this.t) {
      this.f &= -33;
      for (var t5 = this.s; void 0 !== t5; t5 = t5.n) t5.S.U(t5);
    }
  }
};
p3.prototype.N = function() {
  if (!(2 & this.f)) {
    this.f |= 6;
    for (var i4 = this.t; void 0 !== i4; i4 = i4.x) i4.t.N();
  }
};
Object.defineProperty(p3.prototype, "value", { get: function() {
  if (1 & this.f) throw new Error("Cycle detected");
  var i4 = a3(this);
  this.h();
  if (void 0 !== i4) i4.i = this.i;
  if (16 & this.f) throw this.v;
  return this.v;
} });
function g2(i4, t5) {
  return new p3(i4, t5);
}
function S2(i4) {
  var n4 = i4.m;
  i4.m = void 0;
  if ("function" == typeof n4) {
    s3++;
    var o4 = r3;
    r3 = void 0;
    try {
      n4();
    } catch (t5) {
      i4.f &= -2;
      i4.f |= 8;
      m3(i4);
      throw t5;
    } finally {
      r3 = o4;
      t3();
    }
  }
}
function m3(i4) {
  for (var t5 = i4.s; void 0 !== t5; t5 = t5.n) t5.S.U(t5);
  i4.x = void 0;
  i4.s = void 0;
  S2(i4);
}
function x2(i4) {
  if (r3 !== this) throw new Error("Out-of-order effect");
  b(this);
  r3 = i4;
  this.f &= -2;
  if (8 & this.f) m3(this);
  t3();
}
function E(i4, t5) {
  this.x = i4;
  this.m = void 0;
  this.s = void 0;
  this.u = void 0;
  this.f = 32;
  this.name = null == t5 ? void 0 : t5.name;
  if (f3) f3.push(this);
}
E.prototype.c = function() {
  var i4 = this.S();
  try {
    if (8 & this.f) return;
    if (void 0 === this.x) return;
    var t5 = this.x();
    if ("function" == typeof t5) this.m = t5;
  } finally {
    i4();
  }
};
E.prototype.S = function() {
  if (1 & this.f) throw new Error("Cycle detected");
  this.f |= 1;
  this.f &= -9;
  S2(this);
  _2(this);
  s3++;
  var i4 = r3;
  r3 = this;
  return x2.bind(this, i4);
};
E.prototype.N = function() {
  if (!(2 & this.f)) {
    this.f |= 2;
    this.u = h3;
    h3 = this;
  }
};
E.prototype.d = function() {
  this.f |= 8;
  if (!(1 & this.f)) m3(this);
};
E.prototype.dispose = function() {
  this.d();
};
function j3(i4, t5) {
  var n4 = new E(i4, t5);
  try {
    n4.c();
  } catch (i5) {
    n4.d();
    throw i5;
  }
  var r4 = n4.d.bind(n4);
  r4[Symbol.dispose] = r4;
  return r4;
}

// node_modules/@preact/signals/dist/signals.module.js
var s4;
var h4;
var l4;
var p4 = [];
j3(function() {
  s4 = this.N;
})();
function _3(i4, r4) {
  l[i4] = r4.bind(null, l[i4] || function() {
  });
}
function m4(i4) {
  if (l4) l4();
  l4 = i4 && i4.S();
}
function g3(i4) {
  var n4 = this, f4 = i4.data, o4 = useSignal(f4);
  o4.value = f4;
  var u4 = T2(function() {
    var i5 = n4, t5 = n4.__v;
    while (t5 = t5.__) if (t5.__c) {
      t5.__c.__$f |= 4;
      break;
    }
    var f5 = g2(function() {
      var i6 = o4.value.value;
      return 0 === i6 ? 0 : true === i6 ? "" : i6 || "";
    }), u5 = g2(function() {
      return !t(f5.value);
    }), c5 = j3(function() {
      this.N = A3;
      if (u5.value) {
        var n5 = f5.value;
        if (i5.base && 3 === i5.base.nodeType) i5.base.data = n5;
      }
    }), v6 = n4.__$u.d;
    n4.__$u.d = function() {
      c5();
      v6.call(this);
    };
    return [u5, f5];
  }, []), c4 = u4[0], v5 = u4[1];
  return c4.value ? v5.peek() : v5.value;
}
g3.displayName = "_st";
Object.defineProperties(l3.prototype, { constructor: { configurable: true, value: void 0 }, type: { configurable: true, value: g3 }, props: { configurable: true, get: function() {
  return { data: this };
} }, __b: { configurable: true, value: 1 } });
_3("__b", function(i4, n4) {
  if ("string" == typeof n4.type) {
    var r4, t5 = n4.props;
    for (var f4 in t5) if ("children" !== f4) {
      var o4 = t5[f4];
      if (o4 instanceof l3) {
        if (!r4) n4.__np = r4 = {};
        r4[f4] = o4;
        t5[f4] = o4.peek();
      }
    }
  }
  i4(n4);
});
_3("__r", function(i4, n4) {
  m4();
  var r4, t5 = n4.__c;
  if (t5) {
    t5.__$f &= -2;
    if (void 0 === (r4 = t5.__$u)) t5.__$u = r4 = function(i5) {
      var n5;
      j3(function() {
        n5 = this;
      });
      n5.c = function() {
        t5.__$f |= 1;
        t5.setState({});
      };
      return n5;
    }();
  }
  h4 = t5;
  m4(r4);
  i4(n4);
});
_3("__e", function(i4, n4, r4, t5) {
  m4();
  h4 = void 0;
  i4(n4, r4, t5);
});
_3("diffed", function(i4, n4) {
  m4();
  h4 = void 0;
  var r4;
  if ("string" == typeof n4.type && (r4 = n4.__e)) {
    var t5 = n4.__np, f4 = n4.props;
    if (t5) {
      var o4 = r4.U;
      if (o4) for (var e4 in o4) {
        var u4 = o4[e4];
        if (void 0 !== u4 && !(e4 in t5)) {
          u4.d();
          o4[e4] = void 0;
        }
      }
      else {
        o4 = {};
        r4.U = o4;
      }
      for (var a4 in t5) {
        var c4 = o4[a4], v5 = t5[a4];
        if (void 0 === c4) {
          c4 = b2(r4, a4, v5, f4);
          o4[a4] = c4;
        } else c4.o(v5, f4);
      }
    }
  }
  i4(n4);
});
function b2(i4, n4, r4, t5) {
  var f4 = n4 in i4 && void 0 === i4.ownerSVGElement, o4 = y3(r4);
  return { o: function(i5, n5) {
    o4.value = i5;
    t5 = n5;
  }, d: j3(function() {
    this.N = A3;
    var r5 = o4.value.value;
    if (t5[n4] !== r5) {
      t5[n4] = r5;
      if (f4) i4[n4] = r5;
      else if (r5) i4.setAttribute(n4, r5);
      else i4.removeAttribute(n4);
    }
  }) };
}
_3("unmount", function(i4, n4) {
  if ("string" == typeof n4.type) {
    var r4 = n4.__e;
    if (r4) {
      var t5 = r4.U;
      if (t5) {
        r4.U = void 0;
        for (var f4 in t5) {
          var o4 = t5[f4];
          if (o4) o4.d();
        }
      }
    }
  } else {
    var e4 = n4.__c;
    if (e4) {
      var u4 = e4.__$u;
      if (u4) {
        e4.__$u = void 0;
        u4.d();
      }
    }
  }
  i4(n4);
});
_3("__h", function(i4, n4, r4, t5) {
  if (t5 < 3 || 9 === t5) n4.__$f |= 2;
  i4(n4, r4, t5);
});
x.prototype.shouldComponentUpdate = function(i4, n4) {
  var r4 = this.__$u, t5 = r4 && void 0 !== r4.s;
  for (var f4 in n4) return true;
  if (this.__f || "boolean" == typeof this.u && true === this.u) {
    var o4 = 2 & this.__$f;
    if (!(t5 || o4 || 4 & this.__$f)) return true;
    if (1 & this.__$f) return true;
  } else {
    if (!(t5 || 4 & this.__$f)) return true;
    if (3 & this.__$f) return true;
  }
  for (var e4 in i4) if ("__source" !== e4 && i4[e4] !== this.props[e4]) return true;
  for (var u4 in this.props) if (!(u4 in i4)) return true;
  return false;
};
function useSignal(i4) {
  return T2(function() {
    return y3(i4);
  }, []);
}
var k3 = function(i4) {
  queueMicrotask(function() {
    queueMicrotask(i4);
  });
};
function x3() {
  n2(function() {
    var i4;
    while (i4 = p4.shift()) s4.call(i4);
  });
}
function A3() {
  if (1 === p4.push(this)) (l.requestAnimationFrame || k3)(x3);
}

// node_modules/htm/dist/htm.module.js
var n3 = function(t5, s5, r4, e4) {
  var u4;
  s5[0] = 0;
  for (var h5 = 1; h5 < s5.length; h5++) {
    var p5 = s5[h5++], a4 = s5[h5] ? (s5[0] |= p5 ? 1 : 2, r4[s5[h5++]]) : s5[++h5];
    3 === p5 ? e4[0] = a4 : 4 === p5 ? e4[1] = Object.assign(e4[1] || {}, a4) : 5 === p5 ? (e4[1] = e4[1] || {})[s5[++h5]] = a4 : 6 === p5 ? e4[1][s5[++h5]] += a4 + "" : p5 ? (u4 = t5.apply(a4, n3(t5, a4, r4, ["", null])), e4.push(u4), a4[0] ? s5[0] |= 2 : (s5[h5 - 2] = 0, s5[h5] = u4)) : e4.push(a4);
  }
  return e4;
};
var t4 = /* @__PURE__ */ new Map();
function htm_module_default(s5) {
  var r4 = t4.get(this);
  return r4 || (r4 = /* @__PURE__ */ new Map(), t4.set(this, r4)), (r4 = n3(this, r4.get(s5) || (r4.set(s5, r4 = function(n4) {
    for (var t5, s6, r5 = 1, e4 = "", u4 = "", h5 = [0], p5 = function(n5) {
      1 === r5 && (n5 || (e4 = e4.replace(/^\s*\n\s*|\s*\n\s*$/g, ""))) ? h5.push(0, n5, e4) : 3 === r5 && (n5 || e4) ? (h5.push(3, n5, e4), r5 = 2) : 2 === r5 && "..." === e4 && n5 ? h5.push(4, n5, 0) : 2 === r5 && e4 && !n5 ? h5.push(5, 0, true, e4) : r5 >= 5 && ((e4 || !n5 && 5 === r5) && (h5.push(r5, 0, e4, s6), r5 = 6), n5 && (h5.push(r5, n5, 0, s6), r5 = 6)), e4 = "";
    }, a4 = 0; a4 < n4.length; a4++) {
      a4 && (1 === r5 && p5(), p5(a4));
      for (var l7 = 0; l7 < n4[a4].length; l7++) t5 = n4[a4][l7], 1 === r5 ? "<" === t5 ? (p5(), h5 = [h5], r5 = 3) : e4 += t5 : 4 === r5 ? "--" === e4 && ">" === t5 ? (r5 = 1, e4 = "") : e4 = t5 + e4[0] : u4 ? t5 === u4 ? u4 = "" : e4 += t5 : '"' === t5 || "'" === t5 ? u4 = t5 : ">" === t5 ? (p5(), r5 = 1) : r5 && ("=" === t5 ? (r5 = 5, s6 = e4, e4 = "") : "/" === t5 && (r5 < 5 || ">" === n4[a4][l7 + 1]) ? (p5(), 3 === r5 && (h5 = h5[0]), r5 = h5, (h5 = h5[0]).push(2, 0, r5), r5 = 0) : " " === t5 || "	" === t5 || "\n" === t5 || "\r" === t5 ? (p5(), r5 = 2) : e4 += t5), 3 === r5 && "!--" === e4 && (r5 = 4, h5 = h5[0]);
    }
    return p5(), h5;
  }(s5)), r4), arguments, [])).length > 1 ? r4 : r4[0];
}

// src/html.js
var html = htm_module_default.bind(g);

// src/api.js
async function api(url, opts) {
  const r4 = await fetch(url, Object.assign({ credentials: "same-origin" }, opts || {}));
  if (r4.status === 401) {
    document.body.innerHTML = '<div style="padding:24px;font:14px system-ui">Not logged in. Visit the magic link your operator sent you.</div>';
    throw new Error("unauthorized");
  }
  if (!r4.ok) throw new Error("HTTP " + r4.status);
  return r4.json();
}
async function postJson(path, body) {
  const r4 = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  });
  let data = {};
  try {
    data = await r4.json();
  } catch (_5) {
  }
  return { ok: r4.ok, status: r4.status, data };
}

// src/state.js
var groups = y3([]);
var groupId = y3(null);
var isAdmin = y3(false);
var treePath = y3("");
var filePath = y3(null);
var treeEntries = y3([]);
var treeError = y3("");
var threads = y3([]);
var threadId = y3(null);
var channelType = y3("web");
var messagingGroupId = y3(null);
var canSend = y3(true);
var chatMessages = y3([]);
var chatStatus = y3("");
var chatLoading = y3(false);
var pending = y3([]);
var paneOpen = {
  threads: y3(true),
  files: y3(true)
};
var drawerOpen = {
  threads: y3(false),
  files: y3(false)
};
var isMobile = y3(false);
var uploadItems = y3([]);
var me = y3("");
var notifMutedSig = y3(false);
var previewBlock = y3(null);
var nowTick = y3(Date.now());
var pinnedContext = y3([]);
var refs = {
  ws: null,
  reconnectTimer: null,
  reconnectAttempt: 0,
  pollTimer: null,
  threadsPollTimer: null,
  // Set of `${direction}:${id}` for every row currently in chatMessages.
  // Used to dedup WS pushes against history refetches. Cleared on
  // openChat / clearChat. Initial-load and full-replace rebuild it
  // from scratch; append-only refetch and appendMsg add to it.
  seenIds: /* @__PURE__ */ new Set(),
  suppressHashCount: 0,
  uploadDragDepth: 0
};
var POLL_INTERVAL_MS = 1e4;
var THREADS_POLL_MS = 2e4;
var UPLOAD_MAX_FILE_SIZE = 25 * 1024 * 1024;
var UPLOAD_MAX_TOTAL_SIZE = 50 * 1024 * 1024;
var UPLOAD_MAX_FILES = 10;
var MOBILE_MQ = window.matchMedia("(max-width: 720px)");
var NOTIF_MUTE_KEY = "nanoclaw:notif:muted";
var CHANNEL_META = {
  web: { label: "Web", icon: "\u{1F4AC}" },
  resend: { label: "Email", icon: "\u{1F4E7}" },
  discord: { label: "Discord", icon: "\u{1F47E}" },
  telegram: { label: "Telegram", icon: "\u2708\uFE0F" },
  whatsapp: { label: "WhatsApp", icon: "\u{1F4DE}" },
  imessage: { label: "iMessage", icon: "\u{1F4AC}" },
  signal: { label: "Signal", icon: "\u{1F512}" },
  slack: { label: "Slack", icon: "#" },
  matrix: { label: "Matrix", icon: "M" },
  gchat: { label: "Chat", icon: "G" }
};
function channelMeta(ct) {
  return CHANNEL_META[ct] || { label: ct || "Channel", icon: "\u2022" };
}

// node_modules/marked/lib/marked.esm.js
function M2() {
  return { async: false, breaks: false, extensions: null, gfm: true, hooks: null, pedantic: false, renderer: null, silent: false, tokenizer: null, walkTokens: null };
}
var T3 = M2();
function N2(l7) {
  T3 = l7;
}
var _4 = { exec: () => null };
function E2(l7) {
  let e4 = [];
  return (t5) => {
    let n4 = Math.max(0, Math.min(3, t5 - 1)), s5 = e4[n4];
    return s5 || (s5 = l7(n4), e4[n4] = s5), s5;
  };
}
function d4(l7, e4 = "") {
  let t5 = typeof l7 == "string" ? l7 : l7.source, n4 = { replace: (s5, r4) => {
    let i4 = typeof r4 == "string" ? r4 : r4.source;
    return i4 = i4.replace(m5.caret, "$1"), t5 = t5.replace(s5, i4), n4;
  }, getRegex: () => new RegExp(t5, e4) };
  return n4;
}
var Te = ((l7 = "") => {
  try {
    return !!new RegExp("(?<=1)(?<!1)" + l7);
  } catch {
    return false;
  }
})();
var m5 = { codeRemoveIndent: /^(?: {1,4}| {0,3}\t)/gm, outputLinkReplace: /\\([\[\]])/g, indentCodeCompensation: /^(\s+)(?:```)/, beginningSpace: /^\s+/, endingHash: /#$/, startingSpaceChar: /^ /, endingSpaceChar: / $/, nonSpaceChar: /[^ ]/, newLineCharGlobal: /\n/g, tabCharGlobal: /\t/g, multipleSpaceGlobal: /\s+/g, blankLine: /^[ \t]*$/, doubleBlankLine: /\n[ \t]*\n[ \t]*$/, blockquoteStart: /^ {0,3}>/, blockquoteSetextReplace: /\n {0,3}((?:=+|-+) *)(?=\n|$)/g, blockquoteSetextReplace2: /^ {0,3}>[ \t]?/gm, listReplaceNesting: /^ {1,4}(?=( {4})*[^ ])/g, listIsTask: /^\[[ xX]\] +\S/, listReplaceTask: /^\[[ xX]\] +/, listTaskCheckbox: /\[[ xX]\]/, anyLine: /\n.*\n/, hrefBrackets: /^<(.*)>$/, tableDelimiter: /[:|]/, tableAlignChars: /^\||\| *$/g, tableRowBlankLine: /\n[ \t]*$/, tableAlignRight: /^ *-+: *$/, tableAlignCenter: /^ *:-+: *$/, tableAlignLeft: /^ *:-+ *$/, startATag: /^<a /i, endATag: /^<\/a>/i, startPreScriptTag: /^<(pre|code|kbd|script)(\s|>)/i, endPreScriptTag: /^<\/(pre|code|kbd|script)(\s|>)/i, startAngleBracket: /^</, endAngleBracket: />$/, pedanticHrefTitle: /^([^'"]*[^\s])\s+(['"])(.*)\2/, unicodeAlphaNumeric: /[\p{L}\p{N}]/u, escapeTest: /[&<>"']/, escapeReplace: /[&<>"']/g, escapeTestNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/, escapeReplaceNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g, caret: /(^|[^\[])\^/g, percentDecode: /%25/g, findPipe: /\|/g, splitPipe: / \|/, slashPipe: /\\\|/g, carriageReturn: /\r\n|\r/g, spaceLine: /^ +$/gm, notSpaceStart: /^\S*/, endingNewline: /\n$/, listItemRegex: (l7) => new RegExp(`^( {0,3}${l7})((?:[	 ][^\\n]*)?(?:\\n|$))`), nextBulletRegex: E2((l7) => new RegExp(`^ {0,${l7}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`)), hrRegex: E2((l7) => new RegExp(`^ {0,${l7}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`)), fencesBeginRegex: E2((l7) => new RegExp(`^ {0,${l7}}(?:\`\`\`|~~~)`)), headingBeginRegex: E2((l7) => new RegExp(`^ {0,${l7}}#`)), htmlBeginRegex: E2((l7) => new RegExp(`^ {0,${l7}}<(?:[a-z].*>|!--)`, "i")), blockquoteBeginRegex: E2((l7) => new RegExp(`^ {0,${l7}}>`)) };
var Oe = /^(?:[ \t]*(?:\n|$))+/;
var we = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/;
var ye = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/;
var B3 = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/;
var Pe = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/;
var j4 = / {0,3}(?:[*+-]|\d{1,9}[.)])/;
var oe = /^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/;
var ae = d4(oe).replace(/bull/g, j4).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/\|table/g, "").getRegex();
var Se = d4(oe).replace(/bull/g, j4).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/table/g, / {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex();
var F2 = /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/;
var $e = /^[^\n]+/;
var U = /(?!\s*\])(?:\\[\s\S]|[^\[\]\\])+/;
var Le = d4(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label", U).replace("title", /(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex();
var _e = d4(/^(bull)([ \t][^\n]+?)?(?:\n|$)/).replace(/bull/g, j4).getRegex();
var H = "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul";
var K = /<!--(?:-?>|[\s\S]*?(?:-->|$))/;
var ze = d4("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))", "i").replace("comment", K).replace("tag", H).replace("attribute", / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex();
var le = d4(F2).replace("hr", B3).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("|table", "").replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", H).getRegex();
var Me = d4(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph", le).getRegex();
var W = { blockquote: Me, code: we, def: Le, fences: ye, heading: Pe, hr: B3, html: ze, lheading: ae, list: _e, newline: Oe, paragraph: le, table: _4, text: $e };
var se = d4("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr", B3).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("blockquote", " {0,3}>").replace("code", "(?: {4}| {0,3}	)[^\\n]").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", H).getRegex();
var Ee = { ...W, lheading: Se, table: se, paragraph: d4(F2).replace("hr", B3).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("table", se).replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", H).getRegex() };
var Ie = { ...W, html: d4(`^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`).replace("comment", K).replace(/tag/g, "(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(), def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/, heading: /^(#{1,6})(.*)(?:\n+|$)/, fences: _4, lheading: /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/, paragraph: d4(F2).replace("hr", B3).replace("heading", ` *#{1,6} *[^
]`).replace("lheading", ae).replace("|table", "").replace("blockquote", " {0,3}>").replace("|fences", "").replace("|list", "").replace("|html", "").replace("|tag", "").getRegex() };
var Ae = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/;
var Ce = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/;
var ue = /^( {2,}|\\)\n(?!\s*$)/;
var Be = /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/;
var I2 = /[\p{P}\p{S}]/u;
var Z = /[\s\p{P}\p{S}]/u;
var X = /[^\s\p{P}\p{S}]/u;
var De = d4(/^((?![*_])punctSpace)/, "u").replace(/punctSpace/g, Z).getRegex();
var pe = /(?!~)[\p{P}\p{S}]/u;
var qe = /(?!~)[\s\p{P}\p{S}]/u;
var ve = /(?:[^\s\p{P}\p{S}]|~)/u;
var He = d4(/link|precode-code|html/, "g").replace("link", /\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)/).replace("precode-", Te ? "(?<!`)()" : "(^^|[^`])").replace("code", /(?<b>`+)[^`]+\k<b>(?!`)/).replace("html", /<(?! )[^<>]*?>/).getRegex();
var ce = /^(?:\*+(?:((?!\*)punct)|([^\s*]))?)|^_+(?:((?!_)punct)|([^\s_]))?/;
var Ze = d4(ce, "u").replace(/punct/g, I2).getRegex();
var Ge = d4(ce, "u").replace(/punct/g, pe).getRegex();
var he = "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)";
var Ne = d4(he, "gu").replace(/notPunctSpace/g, X).replace(/punctSpace/g, Z).replace(/punct/g, I2).getRegex();
var Qe = d4(he, "gu").replace(/notPunctSpace/g, ve).replace(/punctSpace/g, qe).replace(/punct/g, pe).getRegex();
var je = d4("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)", "gu").replace(/notPunctSpace/g, X).replace(/punctSpace/g, Z).replace(/punct/g, I2).getRegex();
var Fe = d4(/^~~?(?:((?!~)punct)|[^\s~])/, "u").replace(/punct/g, I2).getRegex();
var Ue = "^[^~]+(?=[^~])|(?!~)punct(~~?)(?=[\\s]|$)|notPunctSpace(~~?)(?!~)(?=punctSpace|$)|(?!~)punctSpace(~~?)(?=notPunctSpace)|[\\s](~~?)(?!~)(?=punct)|(?!~)punct(~~?)(?!~)(?=punct)|notPunctSpace(~~?)(?=notPunctSpace)";
var Ke = d4(Ue, "gu").replace(/notPunctSpace/g, X).replace(/punctSpace/g, Z).replace(/punct/g, I2).getRegex();
var We = d4(/\\(punct)/, "gu").replace(/punct/g, I2).getRegex();
var Xe = d4(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme", /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email", /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex();
var Je = d4(K).replace("(?:-->|$)", "-->").getRegex();
var Ve = d4("^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment", Je).replace("attribute", /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex();
var v4 = /(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\])|[^\[\]\\`])*?/;
var Ye = d4(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]+(?:\n[ \t]*)?|\n[ \t]*)(title))?\s*\)/).replace("label", v4).replace("href", /<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]*/).replace("title", /"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex();
var ke = d4(/^!?\[(label)\]\[(ref)\]/).replace("label", v4).replace("ref", U).getRegex();
var de = d4(/^!?\[(ref)\](?:\[\])?/).replace("ref", U).getRegex();
var et = d4("reflink|nolink(?!\\()", "g").replace("reflink", ke).replace("nolink", de).getRegex();
var ie = /[hH][tT][tT][pP][sS]?|[fF][tT][pP]/;
var J = { _backpedal: _4, anyPunctuation: We, autolink: Xe, blockSkip: He, br: ue, code: Ce, del: _4, delLDelim: _4, delRDelim: _4, emStrongLDelim: Ze, emStrongRDelimAst: Ne, emStrongRDelimUnd: je, escape: Ae, link: Ye, nolink: de, punctuation: De, reflink: ke, reflinkSearch: et, tag: Ve, text: Be, url: _4 };
var tt = { ...J, link: d4(/^!?\[(label)\]\((.*?)\)/).replace("label", v4).getRegex(), reflink: d4(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label", v4).getRegex() };
var Q = { ...J, emStrongRDelimAst: Qe, emStrongLDelim: Ge, delLDelim: Fe, delRDelim: Ke, url: d4(/^((?:protocol):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/).replace("protocol", ie).replace("email", /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(), _backpedal: /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/, del: /^(~~?)(?=[^\s~])((?:\\[\s\S]|[^\\])*?(?:\\[\s\S]|[^\s~\\]))\1(?=[^~]|$)/, text: d4(/^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|protocol:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/).replace("protocol", ie).getRegex() };
var nt = { ...Q, br: d4(ue).replace("{2,}", "*").getRegex(), text: d4(Q.text).replace("\\b_", "\\b_| {2,}\\n").replace(/\{2,\}/g, "*").getRegex() };
var D3 = { normal: W, gfm: Ee, pedantic: Ie };
var A4 = { normal: J, gfm: Q, breaks: nt, pedantic: tt };
var rt = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
var ge = (l7) => rt[l7];
function O2(l7, e4) {
  if (e4) {
    if (m5.escapeTest.test(l7)) return l7.replace(m5.escapeReplace, ge);
  } else if (m5.escapeTestNoEncode.test(l7)) return l7.replace(m5.escapeReplaceNoEncode, ge);
  return l7;
}
function V2(l7) {
  try {
    l7 = encodeURI(l7).replace(m5.percentDecode, "%");
  } catch {
    return null;
  }
  return l7;
}
function Y(l7, e4) {
  let t5 = l7.replace(m5.findPipe, (r4, i4, o4) => {
    let u4 = false, a4 = i4;
    for (; --a4 >= 0 && o4[a4] === "\\"; ) u4 = !u4;
    return u4 ? "|" : " |";
  }), n4 = t5.split(m5.splitPipe), s5 = 0;
  if (n4[0].trim() || n4.shift(), n4.length > 0 && !n4.at(-1)?.trim() && n4.pop(), e4) if (n4.length > e4) n4.splice(e4);
  else for (; n4.length < e4; ) n4.push("");
  for (; s5 < n4.length; s5++) n4[s5] = n4[s5].trim().replace(m5.slashPipe, "|");
  return n4;
}
function $2(l7, e4, t5) {
  let n4 = l7.length;
  if (n4 === 0) return "";
  let s5 = 0;
  for (; s5 < n4; ) {
    let r4 = l7.charAt(n4 - s5 - 1);
    if (r4 === e4 && !t5) s5++;
    else if (r4 !== e4 && t5) s5++;
    else break;
  }
  return l7.slice(0, n4 - s5);
}
function ee(l7) {
  let e4 = l7.split(`
`), t5 = e4.length - 1;
  for (; t5 >= 0 && m5.blankLine.test(e4[t5]); ) t5--;
  return e4.length - t5 <= 2 ? l7 : e4.slice(0, t5 + 1).join(`
`);
}
function fe(l7, e4) {
  if (l7.indexOf(e4[1]) === -1) return -1;
  let t5 = 0;
  for (let n4 = 0; n4 < l7.length; n4++) if (l7[n4] === "\\") n4++;
  else if (l7[n4] === e4[0]) t5++;
  else if (l7[n4] === e4[1] && (t5--, t5 < 0)) return n4;
  return t5 > 0 ? -2 : -1;
}
function me2(l7, e4 = 0) {
  let t5 = e4, n4 = "";
  for (let s5 of l7) if (s5 === "	") {
    let r4 = 4 - t5 % 4;
    n4 += " ".repeat(r4), t5 += r4;
  } else n4 += s5, t5++;
  return n4;
}
function xe(l7, e4, t5, n4, s5) {
  let r4 = e4.href, i4 = e4.title || null, o4 = l7[1].replace(s5.other.outputLinkReplace, "$1");
  n4.state.inLink = true;
  let u4 = { type: l7[0].charAt(0) === "!" ? "image" : "link", raw: t5, href: r4, title: i4, text: o4, tokens: n4.inlineTokens(o4) };
  return n4.state.inLink = false, u4;
}
function st(l7, e4, t5) {
  let n4 = l7.match(t5.other.indentCodeCompensation);
  if (n4 === null) return e4;
  let s5 = n4[1];
  return e4.split(`
`).map((r4) => {
    let i4 = r4.match(t5.other.beginningSpace);
    if (i4 === null) return r4;
    let [o4] = i4;
    return o4.length >= s5.length ? r4.slice(s5.length) : r4;
  }).join(`
`);
}
var w4 = class {
  options;
  rules;
  lexer;
  constructor(e4) {
    this.options = e4 || T3;
  }
  space(e4) {
    let t5 = this.rules.block.newline.exec(e4);
    if (t5 && t5[0].length > 0) return { type: "space", raw: t5[0] };
  }
  code(e4) {
    let t5 = this.rules.block.code.exec(e4);
    if (t5) {
      let n4 = this.options.pedantic ? t5[0] : ee(t5[0]), s5 = n4.replace(this.rules.other.codeRemoveIndent, "");
      return { type: "code", raw: n4, codeBlockStyle: "indented", text: s5 };
    }
  }
  fences(e4) {
    let t5 = this.rules.block.fences.exec(e4);
    if (t5) {
      let n4 = t5[0], s5 = st(n4, t5[3] || "", this.rules);
      return { type: "code", raw: n4, lang: t5[2] ? t5[2].trim().replace(this.rules.inline.anyPunctuation, "$1") : t5[2], text: s5 };
    }
  }
  heading(e4) {
    let t5 = this.rules.block.heading.exec(e4);
    if (t5) {
      let n4 = t5[2].trim();
      if (this.rules.other.endingHash.test(n4)) {
        let s5 = $2(n4, "#");
        (this.options.pedantic || !s5 || this.rules.other.endingSpaceChar.test(s5)) && (n4 = s5.trim());
      }
      return { type: "heading", raw: $2(t5[0], `
`), depth: t5[1].length, text: n4, tokens: this.lexer.inline(n4) };
    }
  }
  hr(e4) {
    let t5 = this.rules.block.hr.exec(e4);
    if (t5) return { type: "hr", raw: $2(t5[0], `
`) };
  }
  blockquote(e4) {
    let t5 = this.rules.block.blockquote.exec(e4);
    if (t5) {
      let n4 = $2(t5[0], `
`).split(`
`), s5 = "", r4 = "", i4 = [];
      for (; n4.length > 0; ) {
        let o4 = false, u4 = [], a4;
        for (a4 = 0; a4 < n4.length; a4++) if (this.rules.other.blockquoteStart.test(n4[a4])) u4.push(n4[a4]), o4 = true;
        else if (!o4) u4.push(n4[a4]);
        else break;
        n4 = n4.slice(a4);
        let c4 = u4.join(`
`), p5 = c4.replace(this.rules.other.blockquoteSetextReplace, `
    $1`).replace(this.rules.other.blockquoteSetextReplace2, "");
        s5 = s5 ? `${s5}
${c4}` : c4, r4 = r4 ? `${r4}
${p5}` : p5;
        let k4 = this.lexer.state.top;
        if (this.lexer.state.top = true, this.lexer.blockTokens(p5, i4, true), this.lexer.state.top = k4, n4.length === 0) break;
        let h5 = i4.at(-1);
        if (h5?.type === "code") break;
        if (h5?.type === "blockquote") {
          let R = h5, f4 = R.raw + `
` + n4.join(`
`), S3 = this.blockquote(f4);
          i4[i4.length - 1] = S3, s5 = s5.substring(0, s5.length - R.raw.length) + S3.raw, r4 = r4.substring(0, r4.length - R.text.length) + S3.text;
          break;
        } else if (h5?.type === "list") {
          let R = h5, f4 = R.raw + `
` + n4.join(`
`), S3 = this.list(f4);
          i4[i4.length - 1] = S3, s5 = s5.substring(0, s5.length - h5.raw.length) + S3.raw, r4 = r4.substring(0, r4.length - R.raw.length) + S3.raw, n4 = f4.substring(i4.at(-1).raw.length).split(`
`);
          continue;
        }
      }
      return { type: "blockquote", raw: s5, tokens: i4, text: r4 };
    }
  }
  list(e4) {
    let t5 = this.rules.block.list.exec(e4);
    if (t5) {
      let n4 = t5[1].trim(), s5 = n4.length > 1, r4 = { type: "list", raw: "", ordered: s5, start: s5 ? +n4.slice(0, -1) : "", loose: false, items: [] };
      n4 = s5 ? `\\d{1,9}\\${n4.slice(-1)}` : `\\${n4}`, this.options.pedantic && (n4 = s5 ? n4 : "[*+-]");
      let i4 = this.rules.other.listItemRegex(n4), o4 = false;
      for (; e4; ) {
        let a4 = false, c4 = "", p5 = "";
        if (!(t5 = i4.exec(e4)) || this.rules.block.hr.test(e4)) break;
        c4 = t5[0], e4 = e4.substring(c4.length);
        let k4 = me2(t5[2].split(`
`, 1)[0], t5[1].length), h5 = e4.split(`
`, 1)[0], R = !k4.trim(), f4 = 0;
        if (this.options.pedantic ? (f4 = 2, p5 = k4.trimStart()) : R ? f4 = t5[1].length + 1 : (f4 = k4.search(this.rules.other.nonSpaceChar), f4 = f4 > 4 ? 1 : f4, p5 = k4.slice(f4), f4 += t5[1].length), R && this.rules.other.blankLine.test(h5) && (c4 += h5 + `
`, e4 = e4.substring(h5.length + 1), a4 = true), !a4) {
          let S3 = this.rules.other.nextBulletRegex(f4), te = this.rules.other.hrRegex(f4), ne = this.rules.other.fencesBeginRegex(f4), re = this.rules.other.headingBeginRegex(f4), be = this.rules.other.htmlBeginRegex(f4), Re = this.rules.other.blockquoteBeginRegex(f4);
          for (; e4; ) {
            let G = e4.split(`
`, 1)[0], C3;
            if (h5 = G, this.options.pedantic ? (h5 = h5.replace(this.rules.other.listReplaceNesting, "  "), C3 = h5) : C3 = h5.replace(this.rules.other.tabCharGlobal, "    "), ne.test(h5) || re.test(h5) || be.test(h5) || Re.test(h5) || S3.test(h5) || te.test(h5)) break;
            if (C3.search(this.rules.other.nonSpaceChar) >= f4 || !h5.trim()) p5 += `
` + C3.slice(f4);
            else {
              if (R || k4.replace(this.rules.other.tabCharGlobal, "    ").search(this.rules.other.nonSpaceChar) >= 4 || ne.test(k4) || re.test(k4) || te.test(k4)) break;
              p5 += `
` + h5;
            }
            R = !h5.trim(), c4 += G + `
`, e4 = e4.substring(G.length + 1), k4 = C3.slice(f4);
          }
        }
        r4.loose || (o4 ? r4.loose = true : this.rules.other.doubleBlankLine.test(c4) && (o4 = true)), r4.items.push({ type: "list_item", raw: c4, task: !!this.options.gfm && this.rules.other.listIsTask.test(p5), loose: false, text: p5, tokens: [] }), r4.raw += c4;
      }
      let u4 = r4.items.at(-1);
      if (u4) u4.raw = u4.raw.trimEnd(), u4.text = u4.text.trimEnd();
      else return;
      r4.raw = r4.raw.trimEnd();
      for (let a4 of r4.items) {
        this.lexer.state.top = false, a4.tokens = this.lexer.blockTokens(a4.text, []);
        let c4 = a4.tokens[0];
        if (a4.task && (c4?.type === "text" || c4?.type === "paragraph")) {
          a4.text = a4.text.replace(this.rules.other.listReplaceTask, ""), c4.raw = c4.raw.replace(this.rules.other.listReplaceTask, ""), c4.text = c4.text.replace(this.rules.other.listReplaceTask, "");
          for (let k4 = this.lexer.inlineQueue.length - 1; k4 >= 0; k4--) if (this.rules.other.listIsTask.test(this.lexer.inlineQueue[k4].src)) {
            this.lexer.inlineQueue[k4].src = this.lexer.inlineQueue[k4].src.replace(this.rules.other.listReplaceTask, "");
            break;
          }
          let p5 = this.rules.other.listTaskCheckbox.exec(a4.raw);
          if (p5) {
            let k4 = { type: "checkbox", raw: p5[0] + " ", checked: p5[0] !== "[ ]" };
            a4.checked = k4.checked, r4.loose ? a4.tokens[0] && ["paragraph", "text"].includes(a4.tokens[0].type) && "tokens" in a4.tokens[0] && a4.tokens[0].tokens ? (a4.tokens[0].raw = k4.raw + a4.tokens[0].raw, a4.tokens[0].text = k4.raw + a4.tokens[0].text, a4.tokens[0].tokens.unshift(k4)) : a4.tokens.unshift({ type: "paragraph", raw: k4.raw, text: k4.raw, tokens: [k4] }) : a4.tokens.unshift(k4);
          }
        } else a4.task && (a4.task = false);
        if (!r4.loose) {
          let p5 = a4.tokens.filter((h5) => h5.type === "space"), k4 = p5.length > 0 && p5.some((h5) => this.rules.other.anyLine.test(h5.raw));
          r4.loose = k4;
        }
      }
      if (r4.loose) for (let a4 of r4.items) {
        a4.loose = true;
        for (let c4 of a4.tokens) c4.type === "text" && (c4.type = "paragraph");
      }
      return r4;
    }
  }
  html(e4) {
    let t5 = this.rules.block.html.exec(e4);
    if (t5) {
      let n4 = ee(t5[0]);
      return { type: "html", block: true, raw: n4, pre: t5[1] === "pre" || t5[1] === "script" || t5[1] === "style", text: n4 };
    }
  }
  def(e4) {
    let t5 = this.rules.block.def.exec(e4);
    if (t5) {
      let n4 = t5[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal, " "), s5 = t5[2] ? t5[2].replace(this.rules.other.hrefBrackets, "$1").replace(this.rules.inline.anyPunctuation, "$1") : "", r4 = t5[3] ? t5[3].substring(1, t5[3].length - 1).replace(this.rules.inline.anyPunctuation, "$1") : t5[3];
      return { type: "def", tag: n4, raw: $2(t5[0], `
`), href: s5, title: r4 };
    }
  }
  table(e4) {
    let t5 = this.rules.block.table.exec(e4);
    if (!t5 || !this.rules.other.tableDelimiter.test(t5[2])) return;
    let n4 = Y(t5[1]), s5 = t5[2].replace(this.rules.other.tableAlignChars, "").split("|"), r4 = t5[3]?.trim() ? t5[3].replace(this.rules.other.tableRowBlankLine, "").split(`
`) : [], i4 = { type: "table", raw: $2(t5[0], `
`), header: [], align: [], rows: [] };
    if (n4.length === s5.length) {
      for (let o4 of s5) this.rules.other.tableAlignRight.test(o4) ? i4.align.push("right") : this.rules.other.tableAlignCenter.test(o4) ? i4.align.push("center") : this.rules.other.tableAlignLeft.test(o4) ? i4.align.push("left") : i4.align.push(null);
      for (let o4 = 0; o4 < n4.length; o4++) i4.header.push({ text: n4[o4], tokens: this.lexer.inline(n4[o4]), header: true, align: i4.align[o4] });
      for (let o4 of r4) i4.rows.push(Y(o4, i4.header.length).map((u4, a4) => ({ text: u4, tokens: this.lexer.inline(u4), header: false, align: i4.align[a4] })));
      return i4;
    }
  }
  lheading(e4) {
    let t5 = this.rules.block.lheading.exec(e4);
    if (t5) {
      let n4 = t5[1].trim();
      return { type: "heading", raw: $2(t5[0], `
`), depth: t5[2].charAt(0) === "=" ? 1 : 2, text: n4, tokens: this.lexer.inline(n4) };
    }
  }
  paragraph(e4) {
    let t5 = this.rules.block.paragraph.exec(e4);
    if (t5) {
      let n4 = t5[1].charAt(t5[1].length - 1) === `
` ? t5[1].slice(0, -1) : t5[1];
      return { type: "paragraph", raw: t5[0], text: n4, tokens: this.lexer.inline(n4) };
    }
  }
  text(e4) {
    let t5 = this.rules.block.text.exec(e4);
    if (t5) return { type: "text", raw: t5[0], text: t5[0], tokens: this.lexer.inline(t5[0]) };
  }
  escape(e4) {
    let t5 = this.rules.inline.escape.exec(e4);
    if (t5) return { type: "escape", raw: t5[0], text: t5[1] };
  }
  tag(e4) {
    let t5 = this.rules.inline.tag.exec(e4);
    if (t5) return !this.lexer.state.inLink && this.rules.other.startATag.test(t5[0]) ? this.lexer.state.inLink = true : this.lexer.state.inLink && this.rules.other.endATag.test(t5[0]) && (this.lexer.state.inLink = false), !this.lexer.state.inRawBlock && this.rules.other.startPreScriptTag.test(t5[0]) ? this.lexer.state.inRawBlock = true : this.lexer.state.inRawBlock && this.rules.other.endPreScriptTag.test(t5[0]) && (this.lexer.state.inRawBlock = false), { type: "html", raw: t5[0], inLink: this.lexer.state.inLink, inRawBlock: this.lexer.state.inRawBlock, block: false, text: t5[0] };
  }
  link(e4) {
    let t5 = this.rules.inline.link.exec(e4);
    if (t5) {
      let n4 = t5[2].trim();
      if (!this.options.pedantic && this.rules.other.startAngleBracket.test(n4)) {
        if (!this.rules.other.endAngleBracket.test(n4)) return;
        let i4 = $2(n4.slice(0, -1), "\\");
        if ((n4.length - i4.length) % 2 === 0) return;
      } else {
        let i4 = fe(t5[2], "()");
        if (i4 === -2) return;
        if (i4 > -1) {
          let u4 = (t5[0].indexOf("!") === 0 ? 5 : 4) + t5[1].length + i4;
          t5[2] = t5[2].substring(0, i4), t5[0] = t5[0].substring(0, u4).trim(), t5[3] = "";
        }
      }
      let s5 = t5[2], r4 = "";
      if (this.options.pedantic) {
        let i4 = this.rules.other.pedanticHrefTitle.exec(s5);
        i4 && (s5 = i4[1], r4 = i4[3]);
      } else r4 = t5[3] ? t5[3].slice(1, -1) : "";
      return s5 = s5.trim(), this.rules.other.startAngleBracket.test(s5) && (this.options.pedantic && !this.rules.other.endAngleBracket.test(n4) ? s5 = s5.slice(1) : s5 = s5.slice(1, -1)), xe(t5, { href: s5 && s5.replace(this.rules.inline.anyPunctuation, "$1"), title: r4 && r4.replace(this.rules.inline.anyPunctuation, "$1") }, t5[0], this.lexer, this.rules);
    }
  }
  reflink(e4, t5) {
    let n4;
    if ((n4 = this.rules.inline.reflink.exec(e4)) || (n4 = this.rules.inline.nolink.exec(e4))) {
      let s5 = (n4[2] || n4[1]).replace(this.rules.other.multipleSpaceGlobal, " "), r4 = t5[s5.toLowerCase()];
      if (!r4) {
        let i4 = n4[0].charAt(0);
        return { type: "text", raw: i4, text: i4 };
      }
      return xe(n4, r4, n4[0], this.lexer, this.rules);
    }
  }
  emStrong(e4, t5, n4 = "") {
    let s5 = this.rules.inline.emStrongLDelim.exec(e4);
    if (!s5 || !s5[1] && !s5[2] && !s5[3] && !s5[4] || s5[4] && n4.match(this.rules.other.unicodeAlphaNumeric)) return;
    if (!(s5[1] || s5[3] || "") || !n4 || this.rules.inline.punctuation.exec(n4)) {
      let i4 = [...s5[0]].length - 1, o4, u4, a4 = i4, c4 = 0, p5 = s5[0][0] === "*" ? this.rules.inline.emStrongRDelimAst : this.rules.inline.emStrongRDelimUnd;
      for (p5.lastIndex = 0, t5 = t5.slice(-1 * e4.length + i4); (s5 = p5.exec(t5)) !== null; ) {
        if (o4 = s5[1] || s5[2] || s5[3] || s5[4] || s5[5] || s5[6], !o4) continue;
        if (u4 = [...o4].length, s5[3] || s5[4]) {
          a4 += u4;
          continue;
        } else if ((s5[5] || s5[6]) && i4 % 3 && !((i4 + u4) % 3)) {
          c4 += u4;
          continue;
        }
        if (a4 -= u4, a4 > 0) continue;
        u4 = Math.min(u4, u4 + a4 + c4);
        let k4 = [...s5[0]][0].length, h5 = e4.slice(0, i4 + s5.index + k4 + u4);
        if (Math.min(i4, u4) % 2) {
          let f4 = h5.slice(1, -1);
          return { type: "em", raw: h5, text: f4, tokens: this.lexer.inlineTokens(f4) };
        }
        let R = h5.slice(2, -2);
        return { type: "strong", raw: h5, text: R, tokens: this.lexer.inlineTokens(R) };
      }
    }
  }
  codespan(e4) {
    let t5 = this.rules.inline.code.exec(e4);
    if (t5) {
      let n4 = t5[2].replace(this.rules.other.newLineCharGlobal, " "), s5 = this.rules.other.nonSpaceChar.test(n4), r4 = this.rules.other.startingSpaceChar.test(n4) && this.rules.other.endingSpaceChar.test(n4);
      return s5 && r4 && (n4 = n4.substring(1, n4.length - 1)), { type: "codespan", raw: t5[0], text: n4 };
    }
  }
  br(e4) {
    let t5 = this.rules.inline.br.exec(e4);
    if (t5) return { type: "br", raw: t5[0] };
  }
  del(e4, t5, n4 = "") {
    let s5 = this.rules.inline.delLDelim.exec(e4);
    if (!s5) return;
    if (!(s5[1] || "") || !n4 || this.rules.inline.punctuation.exec(n4)) {
      let i4 = [...s5[0]].length - 1, o4, u4, a4 = i4, c4 = this.rules.inline.delRDelim;
      for (c4.lastIndex = 0, t5 = t5.slice(-1 * e4.length + i4); (s5 = c4.exec(t5)) !== null; ) {
        if (o4 = s5[1] || s5[2] || s5[3] || s5[4] || s5[5] || s5[6], !o4 || (u4 = [...o4].length, u4 !== i4)) continue;
        if (s5[3] || s5[4]) {
          a4 += u4;
          continue;
        }
        if (a4 -= u4, a4 > 0) continue;
        u4 = Math.min(u4, u4 + a4);
        let p5 = [...s5[0]][0].length, k4 = e4.slice(0, i4 + s5.index + p5 + u4), h5 = k4.slice(i4, -i4);
        return { type: "del", raw: k4, text: h5, tokens: this.lexer.inlineTokens(h5) };
      }
    }
  }
  autolink(e4) {
    let t5 = this.rules.inline.autolink.exec(e4);
    if (t5) {
      let n4, s5;
      return t5[2] === "@" ? (n4 = t5[1], s5 = "mailto:" + n4) : (n4 = t5[1], s5 = n4), { type: "link", raw: t5[0], text: n4, href: s5, tokens: [{ type: "text", raw: n4, text: n4 }] };
    }
  }
  url(e4) {
    let t5;
    if (t5 = this.rules.inline.url.exec(e4)) {
      let n4, s5;
      if (t5[2] === "@") n4 = t5[0], s5 = "mailto:" + n4;
      else {
        let r4;
        do
          r4 = t5[0], t5[0] = this.rules.inline._backpedal.exec(t5[0])?.[0] ?? "";
        while (r4 !== t5[0]);
        n4 = t5[0], t5[1] === "www." ? s5 = "http://" + t5[0] : s5 = t5[0];
      }
      return { type: "link", raw: t5[0], text: n4, href: s5, tokens: [{ type: "text", raw: n4, text: n4 }] };
    }
  }
  inlineText(e4) {
    let t5 = this.rules.inline.text.exec(e4);
    if (t5) {
      let n4 = this.lexer.state.inRawBlock;
      return { type: "text", raw: t5[0], text: t5[0], escaped: n4 };
    }
  }
};
var x4 = class l5 {
  tokens;
  options;
  state;
  inlineQueue;
  tokenizer;
  constructor(e4) {
    this.tokens = [], this.tokens.links = /* @__PURE__ */ Object.create(null), this.options = e4 || T3, this.options.tokenizer = this.options.tokenizer || new w4(), this.tokenizer = this.options.tokenizer, this.tokenizer.options = this.options, this.tokenizer.lexer = this, this.inlineQueue = [], this.state = { inLink: false, inRawBlock: false, top: true };
    let t5 = { other: m5, block: D3.normal, inline: A4.normal };
    this.options.pedantic ? (t5.block = D3.pedantic, t5.inline = A4.pedantic) : this.options.gfm && (t5.block = D3.gfm, this.options.breaks ? t5.inline = A4.breaks : t5.inline = A4.gfm), this.tokenizer.rules = t5;
  }
  static get rules() {
    return { block: D3, inline: A4 };
  }
  static lex(e4, t5) {
    return new l5(t5).lex(e4);
  }
  static lexInline(e4, t5) {
    return new l5(t5).inlineTokens(e4);
  }
  lex(e4) {
    e4 = e4.replace(m5.carriageReturn, `
`), this.blockTokens(e4, this.tokens);
    for (let t5 = 0; t5 < this.inlineQueue.length; t5++) {
      let n4 = this.inlineQueue[t5];
      this.inlineTokens(n4.src, n4.tokens);
    }
    return this.inlineQueue = [], this.tokens;
  }
  blockTokens(e4, t5 = [], n4 = false) {
    this.tokenizer.lexer = this, this.options.pedantic && (e4 = e4.replace(m5.tabCharGlobal, "    ").replace(m5.spaceLine, ""));
    let s5 = 1 / 0;
    for (; e4; ) {
      if (e4.length < s5) s5 = e4.length;
      else {
        this.infiniteLoopError(e4.charCodeAt(0));
        break;
      }
      let r4;
      if (this.options.extensions?.block?.some((o4) => (r4 = o4.call({ lexer: this }, e4, t5)) ? (e4 = e4.substring(r4.raw.length), t5.push(r4), true) : false)) continue;
      if (r4 = this.tokenizer.space(e4)) {
        e4 = e4.substring(r4.raw.length);
        let o4 = t5.at(-1);
        r4.raw.length === 1 && o4 !== void 0 ? o4.raw += `
` : t5.push(r4);
        continue;
      }
      if (r4 = this.tokenizer.code(e4)) {
        e4 = e4.substring(r4.raw.length);
        let o4 = t5.at(-1);
        o4?.type === "paragraph" || o4?.type === "text" ? (o4.raw += (o4.raw.endsWith(`
`) ? "" : `
`) + r4.raw, o4.text += `
` + r4.text, this.inlineQueue.at(-1).src = o4.text) : t5.push(r4);
        continue;
      }
      if (r4 = this.tokenizer.fences(e4)) {
        e4 = e4.substring(r4.raw.length), t5.push(r4);
        continue;
      }
      if (r4 = this.tokenizer.heading(e4)) {
        e4 = e4.substring(r4.raw.length), t5.push(r4);
        continue;
      }
      if (r4 = this.tokenizer.hr(e4)) {
        e4 = e4.substring(r4.raw.length), t5.push(r4);
        continue;
      }
      if (r4 = this.tokenizer.blockquote(e4)) {
        e4 = e4.substring(r4.raw.length), t5.push(r4);
        continue;
      }
      if (r4 = this.tokenizer.list(e4)) {
        e4 = e4.substring(r4.raw.length), t5.push(r4);
        continue;
      }
      if (r4 = this.tokenizer.html(e4)) {
        e4 = e4.substring(r4.raw.length), t5.push(r4);
        continue;
      }
      if (r4 = this.tokenizer.def(e4)) {
        e4 = e4.substring(r4.raw.length);
        let o4 = t5.at(-1);
        o4?.type === "paragraph" || o4?.type === "text" ? (o4.raw += (o4.raw.endsWith(`
`) ? "" : `
`) + r4.raw, o4.text += `
` + r4.raw, this.inlineQueue.at(-1).src = o4.text) : this.tokens.links[r4.tag] || (this.tokens.links[r4.tag] = { href: r4.href, title: r4.title }, t5.push(r4));
        continue;
      }
      if (r4 = this.tokenizer.table(e4)) {
        e4 = e4.substring(r4.raw.length), t5.push(r4);
        continue;
      }
      if (r4 = this.tokenizer.lheading(e4)) {
        e4 = e4.substring(r4.raw.length), t5.push(r4);
        continue;
      }
      let i4 = e4;
      if (this.options.extensions?.startBlock) {
        let o4 = 1 / 0, u4 = e4.slice(1), a4;
        this.options.extensions.startBlock.forEach((c4) => {
          a4 = c4.call({ lexer: this }, u4), typeof a4 == "number" && a4 >= 0 && (o4 = Math.min(o4, a4));
        }), o4 < 1 / 0 && o4 >= 0 && (i4 = e4.substring(0, o4 + 1));
      }
      if (this.state.top && (r4 = this.tokenizer.paragraph(i4))) {
        let o4 = t5.at(-1);
        n4 && o4?.type === "paragraph" ? (o4.raw += (o4.raw.endsWith(`
`) ? "" : `
`) + r4.raw, o4.text += `
` + r4.text, this.inlineQueue.pop(), this.inlineQueue.at(-1).src = o4.text) : t5.push(r4), n4 = i4.length !== e4.length, e4 = e4.substring(r4.raw.length);
        continue;
      }
      if (r4 = this.tokenizer.text(e4)) {
        e4 = e4.substring(r4.raw.length);
        let o4 = t5.at(-1);
        o4?.type === "text" ? (o4.raw += (o4.raw.endsWith(`
`) ? "" : `
`) + r4.raw, o4.text += `
` + r4.text, this.inlineQueue.pop(), this.inlineQueue.at(-1).src = o4.text) : t5.push(r4);
        continue;
      }
      if (e4) {
        this.infiniteLoopError(e4.charCodeAt(0));
        break;
      }
    }
    return this.state.top = true, t5;
  }
  inline(e4, t5 = []) {
    return this.inlineQueue.push({ src: e4, tokens: t5 }), t5;
  }
  inlineTokens(e4, t5 = []) {
    this.tokenizer.lexer = this;
    let n4 = e4, s5 = null;
    if (this.tokens.links) {
      let a4 = Object.keys(this.tokens.links);
      if (a4.length > 0) for (; (s5 = this.tokenizer.rules.inline.reflinkSearch.exec(n4)) !== null; ) a4.includes(s5[0].slice(s5[0].lastIndexOf("[") + 1, -1)) && (n4 = n4.slice(0, s5.index) + "[" + "a".repeat(s5[0].length - 2) + "]" + n4.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex));
    }
    for (; (s5 = this.tokenizer.rules.inline.anyPunctuation.exec(n4)) !== null; ) n4 = n4.slice(0, s5.index) + "++" + n4.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);
    let r4;
    for (; (s5 = this.tokenizer.rules.inline.blockSkip.exec(n4)) !== null; ) r4 = s5[2] ? s5[2].length : 0, n4 = n4.slice(0, s5.index + r4) + "[" + "a".repeat(s5[0].length - r4 - 2) + "]" + n4.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);
    n4 = this.options.hooks?.emStrongMask?.call({ lexer: this }, n4) ?? n4;
    let i4 = false, o4 = "", u4 = 1 / 0;
    for (; e4; ) {
      if (e4.length < u4) u4 = e4.length;
      else {
        this.infiniteLoopError(e4.charCodeAt(0));
        break;
      }
      i4 || (o4 = ""), i4 = false;
      let a4;
      if (this.options.extensions?.inline?.some((p5) => (a4 = p5.call({ lexer: this }, e4, t5)) ? (e4 = e4.substring(a4.raw.length), t5.push(a4), true) : false)) continue;
      if (a4 = this.tokenizer.escape(e4)) {
        e4 = e4.substring(a4.raw.length), t5.push(a4);
        continue;
      }
      if (a4 = this.tokenizer.tag(e4)) {
        e4 = e4.substring(a4.raw.length), t5.push(a4);
        continue;
      }
      if (a4 = this.tokenizer.link(e4)) {
        e4 = e4.substring(a4.raw.length), t5.push(a4);
        continue;
      }
      if (a4 = this.tokenizer.reflink(e4, this.tokens.links)) {
        e4 = e4.substring(a4.raw.length);
        let p5 = t5.at(-1);
        a4.type === "text" && p5?.type === "text" ? (p5.raw += a4.raw, p5.text += a4.text) : t5.push(a4);
        continue;
      }
      if (a4 = this.tokenizer.emStrong(e4, n4, o4)) {
        e4 = e4.substring(a4.raw.length), t5.push(a4);
        continue;
      }
      if (a4 = this.tokenizer.codespan(e4)) {
        e4 = e4.substring(a4.raw.length), t5.push(a4);
        continue;
      }
      if (a4 = this.tokenizer.br(e4)) {
        e4 = e4.substring(a4.raw.length), t5.push(a4);
        continue;
      }
      if (a4 = this.tokenizer.del(e4, n4, o4)) {
        e4 = e4.substring(a4.raw.length), t5.push(a4);
        continue;
      }
      if (a4 = this.tokenizer.autolink(e4)) {
        e4 = e4.substring(a4.raw.length), t5.push(a4);
        continue;
      }
      if (!this.state.inLink && (a4 = this.tokenizer.url(e4))) {
        e4 = e4.substring(a4.raw.length), t5.push(a4);
        continue;
      }
      let c4 = e4;
      if (this.options.extensions?.startInline) {
        let p5 = 1 / 0, k4 = e4.slice(1), h5;
        this.options.extensions.startInline.forEach((R) => {
          h5 = R.call({ lexer: this }, k4), typeof h5 == "number" && h5 >= 0 && (p5 = Math.min(p5, h5));
        }), p5 < 1 / 0 && p5 >= 0 && (c4 = e4.substring(0, p5 + 1));
      }
      if (a4 = this.tokenizer.inlineText(c4)) {
        e4 = e4.substring(a4.raw.length), a4.raw.slice(-1) !== "_" && (o4 = a4.raw.slice(-1)), i4 = true;
        let p5 = t5.at(-1);
        p5?.type === "text" ? (p5.raw += a4.raw, p5.text += a4.text) : t5.push(a4);
        continue;
      }
      if (e4) {
        this.infiniteLoopError(e4.charCodeAt(0));
        break;
      }
    }
    return t5;
  }
  infiniteLoopError(e4) {
    let t5 = "Infinite loop on byte: " + e4;
    if (this.options.silent) console.error(t5);
    else throw new Error(t5);
  }
};
var y4 = class {
  options;
  parser;
  constructor(e4) {
    this.options = e4 || T3;
  }
  space(e4) {
    return "";
  }
  code({ text: e4, lang: t5, escaped: n4 }) {
    let s5 = (t5 || "").match(m5.notSpaceStart)?.[0], r4 = e4.replace(m5.endingNewline, "") + `
`;
    return s5 ? '<pre><code class="language-' + O2(s5) + '">' + (n4 ? r4 : O2(r4, true)) + `</code></pre>
` : "<pre><code>" + (n4 ? r4 : O2(r4, true)) + `</code></pre>
`;
  }
  blockquote({ tokens: e4 }) {
    return `<blockquote>
${this.parser.parse(e4)}</blockquote>
`;
  }
  html({ text: e4 }) {
    return e4;
  }
  def(e4) {
    return "";
  }
  heading({ tokens: e4, depth: t5 }) {
    return `<h${t5}>${this.parser.parseInline(e4)}</h${t5}>
`;
  }
  hr(e4) {
    return `<hr>
`;
  }
  list(e4) {
    let t5 = e4.ordered, n4 = e4.start, s5 = "";
    for (let o4 = 0; o4 < e4.items.length; o4++) {
      let u4 = e4.items[o4];
      s5 += this.listitem(u4);
    }
    let r4 = t5 ? "ol" : "ul", i4 = t5 && n4 !== 1 ? ' start="' + n4 + '"' : "";
    return "<" + r4 + i4 + `>
` + s5 + "</" + r4 + `>
`;
  }
  listitem(e4) {
    return `<li>${this.parser.parse(e4.tokens)}</li>
`;
  }
  checkbox({ checked: e4 }) {
    return "<input " + (e4 ? 'checked="" ' : "") + 'disabled="" type="checkbox"> ';
  }
  paragraph({ tokens: e4 }) {
    return `<p>${this.parser.parseInline(e4)}</p>
`;
  }
  table(e4) {
    let t5 = "", n4 = "";
    for (let r4 = 0; r4 < e4.header.length; r4++) n4 += this.tablecell(e4.header[r4]);
    t5 += this.tablerow({ text: n4 });
    let s5 = "";
    for (let r4 = 0; r4 < e4.rows.length; r4++) {
      let i4 = e4.rows[r4];
      n4 = "";
      for (let o4 = 0; o4 < i4.length; o4++) n4 += this.tablecell(i4[o4]);
      s5 += this.tablerow({ text: n4 });
    }
    return s5 && (s5 = `<tbody>${s5}</tbody>`), `<table>
<thead>
` + t5 + `</thead>
` + s5 + `</table>
`;
  }
  tablerow({ text: e4 }) {
    return `<tr>
${e4}</tr>
`;
  }
  tablecell(e4) {
    let t5 = this.parser.parseInline(e4.tokens), n4 = e4.header ? "th" : "td";
    return (e4.align ? `<${n4} align="${e4.align}">` : `<${n4}>`) + t5 + `</${n4}>
`;
  }
  strong({ tokens: e4 }) {
    return `<strong>${this.parser.parseInline(e4)}</strong>`;
  }
  em({ tokens: e4 }) {
    return `<em>${this.parser.parseInline(e4)}</em>`;
  }
  codespan({ text: e4 }) {
    return `<code>${O2(e4, true)}</code>`;
  }
  br(e4) {
    return "<br>";
  }
  del({ tokens: e4 }) {
    return `<del>${this.parser.parseInline(e4)}</del>`;
  }
  link({ href: e4, title: t5, tokens: n4 }) {
    let s5 = this.parser.parseInline(n4), r4 = V2(e4);
    if (r4 === null) return s5;
    e4 = r4;
    let i4 = '<a href="' + e4 + '"';
    return t5 && (i4 += ' title="' + O2(t5) + '"'), i4 += ">" + s5 + "</a>", i4;
  }
  image({ href: e4, title: t5, text: n4, tokens: s5 }) {
    s5 && (n4 = this.parser.parseInline(s5, this.parser.textRenderer));
    let r4 = V2(e4);
    if (r4 === null) return O2(n4);
    e4 = r4;
    let i4 = `<img src="${e4}" alt="${O2(n4)}"`;
    return t5 && (i4 += ` title="${O2(t5)}"`), i4 += ">", i4;
  }
  text(e4) {
    return "tokens" in e4 && e4.tokens ? this.parser.parseInline(e4.tokens) : "escaped" in e4 && e4.escaped ? e4.text : O2(e4.text);
  }
};
var L2 = class {
  strong({ text: e4 }) {
    return e4;
  }
  em({ text: e4 }) {
    return e4;
  }
  codespan({ text: e4 }) {
    return e4;
  }
  del({ text: e4 }) {
    return e4;
  }
  html({ text: e4 }) {
    return e4;
  }
  text({ text: e4 }) {
    return e4;
  }
  link({ text: e4 }) {
    return "" + e4;
  }
  image({ text: e4 }) {
    return "" + e4;
  }
  br() {
    return "";
  }
  checkbox({ raw: e4 }) {
    return e4;
  }
};
var b3 = class l6 {
  options;
  renderer;
  textRenderer;
  constructor(e4) {
    this.options = e4 || T3, this.options.renderer = this.options.renderer || new y4(), this.renderer = this.options.renderer, this.renderer.options = this.options, this.renderer.parser = this, this.textRenderer = new L2();
  }
  static parse(e4, t5) {
    return new l6(t5).parse(e4);
  }
  static parseInline(e4, t5) {
    return new l6(t5).parseInline(e4);
  }
  parse(e4) {
    this.renderer.parser = this;
    let t5 = "";
    for (let n4 = 0; n4 < e4.length; n4++) {
      let s5 = e4[n4];
      if (this.options.extensions?.renderers?.[s5.type]) {
        let i4 = s5, o4 = this.options.extensions.renderers[i4.type].call({ parser: this }, i4);
        if (o4 !== false || !["space", "hr", "heading", "code", "table", "blockquote", "list", "html", "def", "paragraph", "text"].includes(i4.type)) {
          t5 += o4 || "";
          continue;
        }
      }
      let r4 = s5;
      switch (r4.type) {
        case "space": {
          t5 += this.renderer.space(r4);
          break;
        }
        case "hr": {
          t5 += this.renderer.hr(r4);
          break;
        }
        case "heading": {
          t5 += this.renderer.heading(r4);
          break;
        }
        case "code": {
          t5 += this.renderer.code(r4);
          break;
        }
        case "table": {
          t5 += this.renderer.table(r4);
          break;
        }
        case "blockquote": {
          t5 += this.renderer.blockquote(r4);
          break;
        }
        case "list": {
          t5 += this.renderer.list(r4);
          break;
        }
        case "checkbox": {
          t5 += this.renderer.checkbox(r4);
          break;
        }
        case "html": {
          t5 += this.renderer.html(r4);
          break;
        }
        case "def": {
          t5 += this.renderer.def(r4);
          break;
        }
        case "paragraph": {
          t5 += this.renderer.paragraph(r4);
          break;
        }
        case "text": {
          t5 += this.renderer.text(r4);
          break;
        }
        default: {
          let i4 = 'Token with "' + r4.type + '" type was not found.';
          if (this.options.silent) return console.error(i4), "";
          throw new Error(i4);
        }
      }
    }
    return t5;
  }
  parseInline(e4, t5 = this.renderer) {
    this.renderer.parser = this;
    let n4 = "";
    for (let s5 = 0; s5 < e4.length; s5++) {
      let r4 = e4[s5];
      if (this.options.extensions?.renderers?.[r4.type]) {
        let o4 = this.options.extensions.renderers[r4.type].call({ parser: this }, r4);
        if (o4 !== false || !["escape", "html", "link", "image", "strong", "em", "codespan", "br", "del", "text"].includes(r4.type)) {
          n4 += o4 || "";
          continue;
        }
      }
      let i4 = r4;
      switch (i4.type) {
        case "escape": {
          n4 += t5.text(i4);
          break;
        }
        case "html": {
          n4 += t5.html(i4);
          break;
        }
        case "link": {
          n4 += t5.link(i4);
          break;
        }
        case "image": {
          n4 += t5.image(i4);
          break;
        }
        case "checkbox": {
          n4 += t5.checkbox(i4);
          break;
        }
        case "strong": {
          n4 += t5.strong(i4);
          break;
        }
        case "em": {
          n4 += t5.em(i4);
          break;
        }
        case "codespan": {
          n4 += t5.codespan(i4);
          break;
        }
        case "br": {
          n4 += t5.br(i4);
          break;
        }
        case "del": {
          n4 += t5.del(i4);
          break;
        }
        case "text": {
          n4 += t5.text(i4);
          break;
        }
        default: {
          let o4 = 'Token with "' + i4.type + '" type was not found.';
          if (this.options.silent) return console.error(o4), "";
          throw new Error(o4);
        }
      }
    }
    return n4;
  }
};
var P2 = class {
  options;
  block;
  constructor(e4) {
    this.options = e4 || T3;
  }
  static passThroughHooks = /* @__PURE__ */ new Set(["preprocess", "postprocess", "processAllTokens", "emStrongMask"]);
  static passThroughHooksRespectAsync = /* @__PURE__ */ new Set(["preprocess", "postprocess", "processAllTokens"]);
  preprocess(e4) {
    return e4;
  }
  postprocess(e4) {
    return e4;
  }
  processAllTokens(e4) {
    return e4;
  }
  emStrongMask(e4) {
    return e4;
  }
  provideLexer(e4 = this.block) {
    return e4 ? x4.lex : x4.lexInline;
  }
  provideParser(e4 = this.block) {
    return e4 ? b3.parse : b3.parseInline;
  }
};
var q2 = class {
  defaults = M2();
  options = this.setOptions;
  parse = this.parseMarkdown(true);
  parseInline = this.parseMarkdown(false);
  Parser = b3;
  Renderer = y4;
  TextRenderer = L2;
  Lexer = x4;
  Tokenizer = w4;
  Hooks = P2;
  constructor(...e4) {
    this.use(...e4);
  }
  walkTokens(e4, t5) {
    let n4 = [];
    for (let s5 of e4) switch (n4 = n4.concat(t5.call(this, s5)), s5.type) {
      case "table": {
        let r4 = s5;
        for (let i4 of r4.header) n4 = n4.concat(this.walkTokens(i4.tokens, t5));
        for (let i4 of r4.rows) for (let o4 of i4) n4 = n4.concat(this.walkTokens(o4.tokens, t5));
        break;
      }
      case "list": {
        let r4 = s5;
        n4 = n4.concat(this.walkTokens(r4.items, t5));
        break;
      }
      default: {
        let r4 = s5;
        this.defaults.extensions?.childTokens?.[r4.type] ? this.defaults.extensions.childTokens[r4.type].forEach((i4) => {
          let o4 = r4[i4].flat(1 / 0);
          n4 = n4.concat(this.walkTokens(o4, t5));
        }) : r4.tokens && (n4 = n4.concat(this.walkTokens(r4.tokens, t5)));
      }
    }
    return n4;
  }
  use(...e4) {
    let t5 = this.defaults.extensions || { renderers: {}, childTokens: {} };
    return e4.forEach((n4) => {
      let s5 = { ...n4 };
      if (s5.async = this.defaults.async || s5.async || false, n4.extensions && (n4.extensions.forEach((r4) => {
        if (!r4.name) throw new Error("extension name required");
        if ("renderer" in r4) {
          let i4 = t5.renderers[r4.name];
          i4 ? t5.renderers[r4.name] = function(...o4) {
            let u4 = r4.renderer.apply(this, o4);
            return u4 === false && (u4 = i4.apply(this, o4)), u4;
          } : t5.renderers[r4.name] = r4.renderer;
        }
        if ("tokenizer" in r4) {
          if (!r4.level || r4.level !== "block" && r4.level !== "inline") throw new Error("extension level must be 'block' or 'inline'");
          let i4 = t5[r4.level];
          i4 ? i4.unshift(r4.tokenizer) : t5[r4.level] = [r4.tokenizer], r4.start && (r4.level === "block" ? t5.startBlock ? t5.startBlock.push(r4.start) : t5.startBlock = [r4.start] : r4.level === "inline" && (t5.startInline ? t5.startInline.push(r4.start) : t5.startInline = [r4.start]));
        }
        "childTokens" in r4 && r4.childTokens && (t5.childTokens[r4.name] = r4.childTokens);
      }), s5.extensions = t5), n4.renderer) {
        let r4 = this.defaults.renderer || new y4(this.defaults);
        for (let i4 in n4.renderer) {
          if (!(i4 in r4)) throw new Error(`renderer '${i4}' does not exist`);
          if (["options", "parser"].includes(i4)) continue;
          let o4 = i4, u4 = n4.renderer[o4], a4 = r4[o4];
          r4[o4] = (...c4) => {
            let p5 = u4.apply(r4, c4);
            return p5 === false && (p5 = a4.apply(r4, c4)), p5 || "";
          };
        }
        s5.renderer = r4;
      }
      if (n4.tokenizer) {
        let r4 = this.defaults.tokenizer || new w4(this.defaults);
        for (let i4 in n4.tokenizer) {
          if (!(i4 in r4)) throw new Error(`tokenizer '${i4}' does not exist`);
          if (["options", "rules", "lexer"].includes(i4)) continue;
          let o4 = i4, u4 = n4.tokenizer[o4], a4 = r4[o4];
          r4[o4] = (...c4) => {
            let p5 = u4.apply(r4, c4);
            return p5 === false && (p5 = a4.apply(r4, c4)), p5;
          };
        }
        s5.tokenizer = r4;
      }
      if (n4.hooks) {
        let r4 = this.defaults.hooks || new P2();
        for (let i4 in n4.hooks) {
          if (!(i4 in r4)) throw new Error(`hook '${i4}' does not exist`);
          if (["options", "block"].includes(i4)) continue;
          let o4 = i4, u4 = n4.hooks[o4], a4 = r4[o4];
          P2.passThroughHooks.has(i4) ? r4[o4] = (c4) => {
            if (this.defaults.async && P2.passThroughHooksRespectAsync.has(i4)) return (async () => {
              let k4 = await u4.call(r4, c4);
              return a4.call(r4, k4);
            })();
            let p5 = u4.call(r4, c4);
            return a4.call(r4, p5);
          } : r4[o4] = (...c4) => {
            if (this.defaults.async) return (async () => {
              let k4 = await u4.apply(r4, c4);
              return k4 === false && (k4 = await a4.apply(r4, c4)), k4;
            })();
            let p5 = u4.apply(r4, c4);
            return p5 === false && (p5 = a4.apply(r4, c4)), p5;
          };
        }
        s5.hooks = r4;
      }
      if (n4.walkTokens) {
        let r4 = this.defaults.walkTokens, i4 = n4.walkTokens;
        s5.walkTokens = function(o4) {
          let u4 = [];
          return u4.push(i4.call(this, o4)), r4 && (u4 = u4.concat(r4.call(this, o4))), u4;
        };
      }
      this.defaults = { ...this.defaults, ...s5 };
    }), this;
  }
  setOptions(e4) {
    return this.defaults = { ...this.defaults, ...e4 }, this;
  }
  lexer(e4, t5) {
    return x4.lex(e4, t5 ?? this.defaults);
  }
  parser(e4, t5) {
    return b3.parse(e4, t5 ?? this.defaults);
  }
  parseMarkdown(e4) {
    return (n4, s5) => {
      let r4 = { ...s5 }, i4 = { ...this.defaults, ...r4 }, o4 = this.onError(!!i4.silent, !!i4.async);
      if (this.defaults.async === true && r4.async === false) return o4(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));
      if (typeof n4 > "u" || n4 === null) return o4(new Error("marked(): input parameter is undefined or null"));
      if (typeof n4 != "string") return o4(new Error("marked(): input parameter is of type " + Object.prototype.toString.call(n4) + ", string expected"));
      if (i4.hooks && (i4.hooks.options = i4, i4.hooks.block = e4), i4.async) return (async () => {
        let u4 = i4.hooks ? await i4.hooks.preprocess(n4) : n4, c4 = await (i4.hooks ? await i4.hooks.provideLexer(e4) : e4 ? x4.lex : x4.lexInline)(u4, i4), p5 = i4.hooks ? await i4.hooks.processAllTokens(c4) : c4;
        i4.walkTokens && await Promise.all(this.walkTokens(p5, i4.walkTokens));
        let h5 = await (i4.hooks ? await i4.hooks.provideParser(e4) : e4 ? b3.parse : b3.parseInline)(p5, i4);
        return i4.hooks ? await i4.hooks.postprocess(h5) : h5;
      })().catch(o4);
      try {
        i4.hooks && (n4 = i4.hooks.preprocess(n4));
        let a4 = (i4.hooks ? i4.hooks.provideLexer(e4) : e4 ? x4.lex : x4.lexInline)(n4, i4);
        i4.hooks && (a4 = i4.hooks.processAllTokens(a4)), i4.walkTokens && this.walkTokens(a4, i4.walkTokens);
        let p5 = (i4.hooks ? i4.hooks.provideParser(e4) : e4 ? b3.parse : b3.parseInline)(a4, i4);
        return i4.hooks && (p5 = i4.hooks.postprocess(p5)), p5;
      } catch (u4) {
        return o4(u4);
      }
    };
  }
  onError(e4, t5) {
    return (n4) => {
      if (n4.message += `
Please report this to https://github.com/markedjs/marked.`, e4) {
        let s5 = "<p>An error occurred:</p><pre>" + O2(n4.message + "", true) + "</pre>";
        return t5 ? Promise.resolve(s5) : s5;
      }
      if (t5) return Promise.reject(n4);
      throw n4;
    };
  }
};
var z3 = new q2();
function g4(l7, e4) {
  return z3.parse(l7, e4);
}
g4.options = g4.setOptions = function(l7) {
  return z3.setOptions(l7), g4.defaults = z3.defaults, N2(g4.defaults), g4;
};
g4.getDefaults = M2;
g4.defaults = T3;
g4.use = function(...l7) {
  return z3.use(...l7), g4.defaults = z3.defaults, N2(g4.defaults), g4;
};
g4.walkTokens = function(l7, e4) {
  return z3.walkTokens(l7, e4);
};
g4.parseInline = z3.parseInline;
g4.Parser = b3;
g4.parser = b3.parse;
g4.Renderer = y4;
g4.TextRenderer = L2;
g4.Lexer = x4;
g4.lexer = x4.lex;
g4.Tokenizer = w4;
g4.Hooks = P2;
g4.parse = g4;
var Ft = g4.options;
var Ut = g4.setOptions;
var Kt = g4.use;
var Wt = g4.walkTokens;
var Xt = g4.parseInline;
var Vt = b3.parse;
var Yt = x4.lex;

// src/utils.js
function fmtBytes(n4) {
  if (n4 == null) return "";
  if (n4 < 1024) return n4 + " B";
  if (n4 < 1024 * 1024) return (n4 / 1024).toFixed(1) + " K";
  if (n4 < 1024 * 1024 * 1024) return (n4 / 1024 / 1024).toFixed(1) + " M";
  return (n4 / 1024 / 1024 / 1024).toFixed(1) + " G";
}
function fmtBytesShort(n4) {
  if (!n4 && n4 !== 0) return "";
  if (n4 < 1024) return n4 + " B";
  if (n4 < 1024 * 1024) return (n4 / 1024).toFixed(0) + " KB";
  return (n4 / (1024 * 1024)).toFixed(1) + " MB";
}
function fmtRelative(ts) {
  if (!ts) return "";
  const norm = ts.includes("T") ? ts : ts.replace(" ", "T") + "Z";
  const t5 = Date.parse(norm);
  if (!t5) return "";
  const sec = Math.max(0, (Date.now() - t5) / 1e3);
  if (sec < 60) return "just now";
  if (sec < 3600) return Math.floor(sec / 60) + "m";
  if (sec < 86400) return Math.floor(sec / 3600) + "h";
  if (sec < 86400 * 7) return Math.floor(sec / 86400) + "d";
  return new Date(t5).toLocaleDateString();
}
function fmtAbsolute(ts) {
  if (!ts) return "";
  const norm = ts.includes("T") ? ts : ts.replace(" ", "T") + "Z";
  const t5 = Date.parse(norm);
  if (!t5) return "";
  return new Date(t5).toLocaleString();
}
function tsKey(s5) {
  if (!s5) return 0;
  const norm = s5.includes("T") ? s5 : s5.replace(" ", "T") + "Z";
  const n4 = Date.parse(norm);
  return Number.isFinite(n4) ? n4 : 0;
}
function parentPath(p5) {
  const i4 = p5.lastIndexOf("/");
  return i4 < 0 ? "" : p5.slice(0, i4);
}
function renderMarkdown(text) {
  try {
    return g4.parse(text || "", { breaks: true, gfm: true });
  } catch (_5) {
    return null;
  }
}
function rewriteFileLinks(root, groupId2, onNavFile) {
  if (!groupId2 || !root) return;
  const gid = encodeURIComponent(groupId2);
  const isExternal = (h5) => /^[a-z][a-z0-9+.-]*:/i.test(h5) || h5.startsWith("#") || h5.startsWith("//") || h5.startsWith("mailto:");
  const normalizeRel = (p5) => String(p5 || "").replace(/^\.?\/+/, "").replace(/^workspace\/+/, "");
  const toFileUrl = (rel) => `api/groups/${gid}/file?path=${encodeURIComponent(rel)}`;
  const attachPreviewClick = (a4, rel) => {
    a4.addEventListener("click", (ev) => {
      if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      ev.preventDefault();
      onNavFile({ path: rel, name: rel.slice(rel.lastIndexOf("/") + 1) });
    });
  };
  root.querySelectorAll("a[href]").forEach((a4) => {
    const href = a4.getAttribute("href") || "";
    if (!href || isExternal(href)) return;
    const rel = normalizeRel(href);
    if (!rel) return;
    a4.setAttribute("href", toFileUrl(rel));
    a4.setAttribute("target", "_blank");
    a4.setAttribute("rel", "noopener");
    attachPreviewClick(a4, rel);
  });
  const fileLikeRe = /^[\w.\-/ ]+\.[A-Za-z0-9]{1,8}$/;
  root.querySelectorAll("code").forEach((c4) => {
    if (c4.closest("pre")) return;
    const txt = c4.textContent || "";
    if (!fileLikeRe.test(txt)) return;
    if (txt.length > 200) return;
    const rel = normalizeRel(txt);
    if (!rel) return;
    const a4 = document.createElement("a");
    a4.href = toFileUrl(rel);
    a4.target = "_blank";
    a4.rel = "noopener";
    a4.textContent = txt;
    attachPreviewClick(a4, rel);
    c4.replaceWith(a4);
  });
}

// src/hash.js
function parseHash() {
  const raw = location.hash.replace(/^#/, "");
  if (!raw) return null;
  const qIdx = raw.indexOf("?");
  const pathPart = qIdx < 0 ? raw : raw.slice(0, qIdx);
  const params = new URLSearchParams(qIdx < 0 ? "" : raw.slice(qIdx + 1));
  const tid = params.get("t") || null;
  const ct = params.get("c") || null;
  const mg = params.get("mg") || null;
  const h5 = decodeURI(pathPart);
  const base = { threadId: tid, channelType: ct, messagingGroupId: mg };
  if (!h5) return tid ? { groupId: "", path: "", isDir: true, ...base } : null;
  const slash = h5.indexOf("/");
  if (slash < 0) return { groupId: h5, path: "", isDir: true, ...base };
  const gid = h5.slice(0, slash);
  const rest = h5.slice(slash + 1);
  const isDir = rest === "" || rest.endsWith("/");
  const path = isDir ? rest.replace(/\/$/, "") : rest;
  return { groupId: gid, path, isDir, ...base };
}
function buildHash() {
  if (!groupId.value) return "";
  let h5 = "#" + encodeURI(groupId.value);
  if (filePath.value) h5 += "/" + encodeURI(filePath.value);
  else if (treePath.value) h5 += "/" + encodeURI(treePath.value) + "/";
  if (threadId.value) {
    h5 += "?t=" + encodeURIComponent(threadId.value);
    if (channelType.value && channelType.value !== "web") {
      h5 += "&c=" + encodeURIComponent(channelType.value);
      if (messagingGroupId.value) h5 += "&mg=" + encodeURIComponent(messagingGroupId.value);
    }
  }
  return h5;
}
function writeHash() {
  const h5 = buildHash();
  if (!h5) return;
  if (location.hash !== h5) {
    refs.suppressHashCount++;
    location.hash = h5;
  }
}
function applyAdminFlag() {
  const g5 = groups.value.find((x5) => x5.id === groupId.value);
  isAdmin.value = !!(g5 && g5.isAdmin);
  document.body.classList.toggle("is-admin", isAdmin.value);
}
function threadCtx(t5) {
  if (!t5) return null;
  if (!t5.channelType || t5.channelType === "web") return null;
  return { channelType: t5.channelType, messagingGroupId: t5.messagingGroupId, canSend: !!t5.canSend };
}
async function applyHash(router2) {
  const parsed = parseHash();
  if (!parsed) {
    if (groups.value.length) await router2.selectGroup(groups.value[0].id);
    return;
  }
  if (!groups.value.find((g5) => g5.id === parsed.groupId)) {
    router2.notFound("No access to group " + parsed.groupId);
    return;
  }
  const groupChanged = groupId.value !== parsed.groupId;
  n2(() => {
    groupId.value = parsed.groupId;
    filePath.value = null;
  });
  applyAdminFlag();
  if (groupChanged) await router2.loadThreads(parsed.groupId);
  if (parsed.threadId) {
    const ctx = parsed.channelType && parsed.channelType !== "web" && parsed.messagingGroupId ? { channelType: parsed.channelType, messagingGroupId: parsed.messagingGroupId, canSend: true } : null;
    router2.openChat(parsed.groupId, parsed.threadId, ctx).catch((err) => console.error("chat open failed", err));
  } else if (groupChanged) {
    const latest = threads.value.length > 0 ? threads.value[0] : null;
    if (latest) router2.openChat(parsed.groupId, latest.threadId, threadCtx(latest)).catch((err) => console.error("chat open failed", err));
    else router2.clearChat();
  }
  if (parsed.isDir) {
    await router2.loadTree(parsed.path);
  } else {
    const parent = parentPath(parsed.path);
    await router2.loadTree(parent);
    const name = parent ? parsed.path.slice(parent.length + 1) : parsed.path;
    await router2.selectFile({ path: parsed.path, name });
  }
}

// src/notify.js
function loadMuted() {
  try {
    return localStorage.getItem(NOTIF_MUTE_KEY) === "1";
  } catch (_5) {
    return false;
  }
}
function initNotif() {
  notifMutedSig.value = loadMuted();
  j3(() => {
    try {
      localStorage.setItem(NOTIF_MUTE_KEY, notifMutedSig.value ? "1" : "0");
    } catch (_5) {
    }
  });
}
function toggleMute() {
  notifMutedSig.value = !notifMutedSig.value;
  if (!notifMutedSig.value && "Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {
    });
  }
}
function maybeNotify(text, files) {
  if (notifMutedSig.value) return;
  if (document.visibilityState === "visible" && document.hasFocus()) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const body = (text || "").slice(0, 200) + (files && files.length ? ` \xB7 ${files.length} file${files.length > 1 ? "s" : ""}` : "");
    const n4 = new Notification("NanoClaw", { body, icon: "icon.svg", tag: "nanoclaw-chat" });
    n4.onclick = () => {
      window.focus();
      n4.close();
    };
  } catch (_5) {
  }
}

// src/actions.js
async function loadThreads(gid) {
  try {
    const { threads: t5 } = await api(`api/groups/${encodeURIComponent(gid)}/chat/threads`);
    threads.value = t5 || [];
  } catch (err) {
    console.error("threads load failed", err);
    threads.value = [];
  }
}
async function deleteThread(tid) {
  try {
    const r4 = await fetch(`api/groups/${encodeURIComponent(groupId.value)}/chat/${encodeURIComponent(tid)}`, {
      method: "DELETE",
      credentials: "same-origin"
    });
    if (!r4.ok) {
      chatStatus.value = "delete failed (HTTP " + r4.status + ")";
      return;
    }
  } catch (err) {
    console.error("delete failed", err);
    chatStatus.value = "delete failed: " + (err.message || "network error");
    return;
  }
  threads.value = threads.value.filter((x5) => x5.threadId !== tid);
  if (threadId.value === tid) {
    const latest = threads.value.length > 0 ? threads.value[0] : null;
    if (latest) openChat(groupId.value, latest.threadId, threadCtxOf(latest)).catch(console.error);
    else clearChat();
  }
}
function threadCtxOf(t5) {
  if (!t5 || !t5.channelType || t5.channelType === "web") return null;
  return { channelType: t5.channelType, messagingGroupId: t5.messagingGroupId, canSend: !!t5.canSend };
}
function bumpActiveThread(maxTs) {
  if (!threadId.value) return;
  const list = threads.value.slice();
  const idx = list.findIndex((x5) => x5.threadId === threadId.value);
  if (idx < 0) {
    loadThreads(groupId.value);
    return;
  }
  const t5 = { ...list[idx] };
  t5.lastActivityAt = maxTs || (/* @__PURE__ */ new Date()).toISOString();
  t5.messageCount = (t5.messageCount || 0) + 1;
  list.splice(idx, 1);
  list.unshift(t5);
  threads.value = list;
}
function updateActiveThreadTitleFromFirstMessage(text) {
  if (!threadId.value) return;
  const list = threads.value.slice();
  const idx = list.findIndex((x5) => x5.threadId === threadId.value);
  if (idx < 0) return;
  const t5 = list[idx];
  if (t5.title !== "(new chat)") return;
  const clean = String(text || "").replace(/^>\s*Context[^\n]*\n+/i, "").replace(/\s+/g, " ").trim();
  if (!clean) return;
  list[idx] = { ...t5, title: clean.slice(0, 60) };
  threads.value = list;
}
function clearChat() {
  n2(() => {
    chatMessages.value = [];
    chatStatus.value = "";
    chatLoading.value = false;
    threadId.value = null;
    channelType.value = "web";
    messagingGroupId.value = null;
    canSend.value = true;
  });
  stopChatPoll();
  if (refs.ws) {
    try {
      refs.ws.close();
    } catch (_5) {
    }
    refs.ws = null;
  }
  if (refs.reconnectTimer) {
    clearTimeout(refs.reconnectTimer);
    refs.reconnectTimer = null;
  }
  refs.seenIds.clear();
}
function stopChatPoll() {
  if (refs.pollTimer) {
    clearInterval(refs.pollTimer);
    refs.pollTimer = null;
  }
}
function startChatPoll() {
  stopChatPoll();
  refs.pollTimer = setInterval(async () => {
    if (!threadId.value || channelType.value === "web") {
      stopChatPoll();
      return;
    }
    try {
      await refetchThreadHistory(true);
    } catch (err) {
      console.error("poll failed", err);
    }
  }, POLL_INTERVAL_MS);
}
function historyUrl(gid, tid) {
  let u4 = `api/groups/${encodeURIComponent(gid)}/chat/${encodeURIComponent(tid)}/history`;
  if (channelType.value && channelType.value !== "web" && messagingGroupId.value) {
    u4 += `?channel=${encodeURIComponent(channelType.value)}&mg=${encodeURIComponent(messagingGroupId.value)}`;
  }
  return u4;
}
function appendMsg(direction, text, files, ts, id) {
  const key = id ? `${direction}:${id}` : null;
  if (key && refs.seenIds.has(key)) return;
  if (key) refs.seenIds.add(key);
  chatMessages.value = chatMessages.value.concat({ direction, text, files: files || null, ts });
}
async function refetchThreadHistory(appendNewOnly) {
  const gid = groupId.value, tid = threadId.value;
  const r4 = await fetch(historyUrl(gid, tid), { credentials: "same-origin", cache: "no-store" });
  if (!r4.ok) return;
  const { messages } = await r4.json();
  if (!Array.isArray(messages)) return;
  if (!appendNewOnly) {
    chatMessages.value = messages.map((m6) => ({
      direction: m6.direction === "in" ? "in" : "out",
      text: m6.text,
      files: m6.files || null,
      ts: m6.timestamp
    }));
    refs.seenIds = new Set(messages.filter((m6) => m6.id).map((m6) => `${m6.direction === "in" ? "in" : "out"}:${m6.id}`));
    return;
  }
  let maxTs = "";
  const additions = [];
  for (const m6 of messages) {
    const direction = m6.direction === "in" ? "in" : "out";
    const key = m6.id ? `${direction}:${m6.id}` : null;
    if (key && refs.seenIds.has(key)) continue;
    const ts = m6.timestamp || "";
    additions.push({ direction, text: m6.text, files: m6.files || null, ts });
    if (key) refs.seenIds.add(key);
    if (ts > maxTs) maxTs = ts;
    if (direction !== "in") maybeNotify(m6.text, m6.files || []);
  }
  if (additions.length) {
    chatMessages.value = chatMessages.value.concat(additions);
    bumpActiveThread(maxTs);
  }
}
async function openChat(gid, resumeTid, opts) {
  if (resumeTid && groupId.value === gid && threadId.value === resumeTid) return;
  if (refs.ws) {
    try {
      refs.ws.close();
    } catch (_5) {
    }
    refs.ws = null;
  }
  if (refs.reconnectTimer) {
    clearTimeout(refs.reconnectTimer);
    refs.reconnectTimer = null;
  }
  stopChatPoll();
  refs.reconnectAttempt = 0;
  let ct = "web", mg = null, cs = true;
  if (opts && opts.channelType) {
    ct = opts.channelType;
    mg = opts.messagingGroupId || null;
    cs = !!opts.canSend;
  } else if (resumeTid) {
    const t5 = threads.value.find((x5) => x5.threadId === resumeTid);
    if (t5 && t5.channelType && t5.channelType !== "web") {
      ct = t5.channelType;
      mg = t5.messagingGroupId || null;
      cs = !!t5.canSend;
    }
  }
  n2(() => {
    groupId.value = gid;
    chatMessages.value = [];
    channelType.value = ct;
    messagingGroupId.value = mg;
    canSend.value = ct === "web" ? true : cs;
    if (resumeTid) {
      threadId.value = resumeTid;
      chatLoading.value = true;
      chatStatus.value = "loading history\u2026";
    }
  });
  if (resumeTid) {
    writeHash();
    try {
      const r4 = await fetch(historyUrl(gid, resumeTid), { credentials: "same-origin", cache: "no-store" });
      if (r4.ok) {
        const { messages } = await r4.json();
        n2(() => {
          chatMessages.value = (messages || []).map((m6) => ({
            direction: m6.direction === "in" ? "in" : "out",
            text: m6.text,
            files: m6.files || null,
            ts: m6.timestamp
          }));
          chatLoading.value = false;
        });
        if (Array.isArray(messages)) {
          refs.seenIds = new Set(messages.filter((m6) => m6.id).map((m6) => `${m6.direction === "in" ? "in" : "out"}:${m6.id}`));
        }
      } else {
        chatLoading.value = false;
      }
    } catch (err) {
      console.error("history load failed", err);
      chatLoading.value = false;
    }
    if (ct === "web") connectChatWs();
    else {
      chatStatus.value = "";
      startChatPoll();
    }
    return;
  }
  n2(() => {
    channelType.value = "web";
    messagingGroupId.value = null;
    canSend.value = true;
  });
  chatStatus.value = "starting\u2026";
  let started;
  try {
    const r4 = await fetch(`api/groups/${encodeURIComponent(gid)}/chat/start`, { method: "POST", credentials: "same-origin" });
    if (!r4.ok) throw new Error("HTTP " + r4.status);
    started = await r4.json();
  } catch (err) {
    chatStatus.value = "failed to start chat: " + err.message;
    return;
  }
  threadId.value = started.threadId;
  threads.value = [{
    threadId: started.threadId,
    sessionId: started.sessionId || null,
    channelType: "web",
    messagingGroupId: started.messagingGroupId || null,
    sessionMode: started.sessionMode || "per-thread",
    title: "(new chat)",
    lastActivityAt: (/* @__PURE__ */ new Date()).toISOString(),
    messageCount: 0
  }, ...threads.value];
  writeHash();
  connectChatWs();
}
function connectChatWs() {
  if (!groupId.value || !threadId.value) return;
  const gid = groupId.value, tid = threadId.value;
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${proto}//${location.host}/ui/chat/api/groups/${encodeURIComponent(gid)}/chat/${encodeURIComponent(tid)}/ws`;
  const ws = new WebSocket(wsUrl);
  refs.ws = ws;
  ws.onopen = () => {
    const wasReconnect = refs.reconnectAttempt > 0;
    refs.reconnectAttempt = 0;
    chatStatus.value = "connected";
    if (wasReconnect) {
      refetchThreadHistory(true).catch((err) => console.error("reconnect catchup failed", err));
    }
  };
  ws.onclose = () => {
    if (refs.ws !== ws) return;
    refs.ws = null;
    if (groupId.value !== gid || threadId.value !== tid) return;
    const attempt = ++refs.reconnectAttempt;
    const delay = Math.min(15e3, 500 * Math.pow(2, attempt - 1));
    chatStatus.value = `disconnected \xB7 reconnecting in ${Math.round(delay / 1e3)}s\u2026`;
    refs.reconnectTimer = setTimeout(() => {
      refs.reconnectTimer = null;
      if (groupId.value === gid && threadId.value === tid) connectChatWs();
    }, delay);
  };
  ws.onerror = () => {
    chatStatus.value = "connection error";
  };
  ws.onmessage = (ev) => {
    let payload;
    try {
      payload = JSON.parse(ev.data);
    } catch (_5) {
      return;
    }
    if (payload.kind === "ready") return;
    if (payload.kind === "inbound") {
      appendMsg("in", payload.text, payload.files || null, payload.timestamp, payload.id);
      updateActiveThreadTitleFromFirstMessage(payload.text);
      bumpActiveThread();
      return;
    }
    if (payload.kind === "outbound") {
      const c4 = payload.content || {};
      const text = typeof c4 === "string" ? c4 : c4.text || c4.markdown || "";
      appendMsg("out", text, payload.files || [], payload.timestamp, payload.id);
      bumpActiveThread();
      maybeNotify(text, payload.files || []);
      return;
    }
  };
}
async function sendChat(text, files) {
  if (!groupId.value || !threadId.value) return;
  const isWeb = !channelType.value || channelType.value === "web";
  const hasFiles = Array.isArray(files) && files.length > 0;
  if (!isWeb) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const fileMetas = hasFiles ? files.map((f4) => ({ filename: f4.name, size: f4.size })) : null;
    appendMsg("in", text || "", fileMetas, now);
  }
  let url = `api/groups/${encodeURIComponent(groupId.value)}/chat/${encodeURIComponent(threadId.value)}/send`;
  if (!isWeb && messagingGroupId.value) {
    url += `?channel=${encodeURIComponent(channelType.value)}&mg=${encodeURIComponent(messagingGroupId.value)}`;
  }
  try {
    let res;
    if (hasFiles) {
      const fd = new FormData();
      fd.append("text", text || "");
      for (const f4 of files) fd.append("file", f4, f4.name);
      res = await fetch(url, { method: "POST", credentials: "same-origin", body: fd });
    } else {
      res = await fetch(url, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });
    }
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const j5 = await res.json();
        if (j5 && j5.error) detail = j5.error + (j5.detail ? ` (${j5.detail})` : "");
      } catch (_5) {
      }
      chatStatus.value = `send failed: ${detail}`;
    } else if (!isWeb) {
      try {
        await refetchThreadHistory(false);
      } catch (_5) {
      }
    }
  } catch (err) {
    console.error("send failed", err);
    chatStatus.value = `send failed: ${err && err.message ? err.message : "network error"}`;
  }
}
function startThreadsPoll(gid) {
  if (refs.threadsPollTimer) {
    clearInterval(refs.threadsPollTimer);
    refs.threadsPollTimer = null;
  }
  refs.threadsPollTimer = setInterval(() => {
    if (groupId.value === gid) loadThreads(gid).catch(() => {
    });
    else {
      clearInterval(refs.threadsPollTimer);
      refs.threadsPollTimer = null;
    }
  }, THREADS_POLL_MS);
}
async function selectGroup(gid) {
  n2(() => {
    groupId.value = gid;
    treePath.value = "";
    filePath.value = null;
  });
  await loadThreads(gid);
  startThreadsPoll(gid);
  await loadTree("");
  const latest = threads.value.length > 0 ? threads.value[0] : null;
  if (latest) {
    openChat(gid, latest.threadId, threadCtxOf(latest)).catch((err) => console.error("chat open failed", err));
  } else {
    clearChat();
    writeHash();
  }
}
async function loadTree(p5) {
  n2(() => {
    treePath.value = p5;
    filePath.value = null;
    previewBlock.value = null;
    treeError.value = "";
    treeEntries.value = [];
  });
  try {
    const { entries } = await api(`api/groups/${encodeURIComponent(groupId.value)}/tree?path=${encodeURIComponent(p5)}`);
    treeEntries.value = entries || [];
  } catch (err) {
    const msg = /HTTP 404/.test(String(err && err.message)) ? "Not found. It may have been renamed or deleted." : String(err && err.message || err);
    treeError.value = msg;
  }
}
async function navTree(p5) {
  await loadTree(p5);
  writeHash();
}
async function navFile(entry) {
  if (isMobile.value) drawerOpen.files.value = true;
  else paneOpen.files.value = true;
  const parent = parentPath(entry.path);
  if (treePath.value !== parent) await loadTree(parent);
  await selectFile(entry);
  writeHash();
}
async function selectFile(entry) {
  filePath.value = entry.path;
  const url = `api/groups/${encodeURIComponent(groupId.value)}/file?path=${encodeURIComponent(entry.path)}`;
  let size = entry.size, mtime = entry.mtime;
  try {
    const h5 = await fetch(url, { method: "HEAD", credentials: "same-origin" });
    if (h5.status >= 400) {
      const msg = h5.status === 404 ? "File not found. It may have been renamed or deleted." : `HTTP ${h5.status}`;
      previewBlock.value = { kind: "error", text: msg, name: entry.name, url };
      return;
    }
    if (size == null) {
      const cl = h5.headers.get("content-length");
      if (cl) size = Number(cl);
    }
    if (!mtime) {
      const lm = h5.headers.get("last-modified");
      if (lm) {
        const t5 = Date.parse(lm);
        if (t5) mtime = new Date(t5).toISOString();
      }
    }
  } catch (_5) {
  }
  const ext = entry.name.toLowerCase().split(".").pop();
  const meta = { name: entry.name, size, mtime, url, path: entry.path };
  const mediaExts = /* @__PURE__ */ new Set([
    "png",
    "jpg",
    "jpeg",
    "gif",
    "webp",
    "tif",
    "tiff",
    "heic",
    "heif",
    "mp3",
    "m4a",
    "aac",
    "wav",
    "ogg",
    "oga",
    "opus",
    "flac",
    "weba",
    "mp4",
    "m4v",
    "mov",
    "webm",
    "ogv"
  ]);
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) previewBlock.value = { kind: "image", ...meta };
  else if (["mp3", "m4a", "aac", "wav", "ogg", "oga", "opus", "flac", "weba"].includes(ext)) previewBlock.value = { kind: "audio", ...meta };
  else if (["mp4", "m4v", "mov", "webm", "ogv"].includes(ext)) previewBlock.value = { kind: "video", ...meta };
  else if (ext === "pdf") previewBlock.value = { kind: "pdf", ...meta };
  else {
    try {
      const r4 = await fetch(url, { credentials: "same-origin" });
      if (!r4.ok) {
        previewBlock.value = { kind: "error", text: `HTTP ${r4.status}`, ...meta };
        return;
      }
      const ctType = r4.headers.get("content-type") || "";
      if (ctType.startsWith("text/") || ctType.includes("json") || ctType.includes("xml")) {
        const txt = await r4.text();
        const isMd = ext === "md" || ext === "markdown";
        previewBlock.value = { kind: isMd ? "markdown" : "text", text: txt, ...meta };
      } else {
        previewBlock.value = { kind: "binary", mime: ctType, ...meta };
      }
    } catch (err) {
      previewBlock.value = { kind: "error", text: String(err && err.message || err), ...meta };
    }
  }
  if (mediaExts.has(ext)) fetchAndAttachMeta(entry.path).catch(() => {
  });
}
async function fetchAndAttachMeta(p5) {
  const gid = groupId.value;
  const u4 = `api/groups/${encodeURIComponent(gid)}/meta?path=${encodeURIComponent(p5)}`;
  const r4 = await fetch(u4, { credentials: "same-origin", cache: "no-store" });
  if (!r4.ok) return;
  const data = await r4.json();
  const cur = previewBlock.value;
  if (!cur || cur.path !== p5) return;
  previewBlock.value = { ...cur, tags: data.tags || null, lyrics: data.lyrics || null, mime: data.mime || cur.mime };
}
function closePreview() {
  n2(() => {
    filePath.value = null;
    previewBlock.value = null;
  });
  writeHash();
}
function togglePinnedFile(path) {
  if (!path) return;
  const cur = pinnedContext.value;
  pinnedContext.value = cur.includes(path) ? cur.filter((p5) => p5 !== path) : cur.concat(path);
}
function removePinnedPath(path) {
  pinnedContext.value = pinnedContext.value.filter((p5) => p5 !== path);
}
function clearPinnedContext() {
  pinnedContext.value = [];
}
function addPendingFiles(fileList, max, maxSize, maxTotal) {
  if (!fileList || fileList.length === 0) return;
  const next = pending.value.slice();
  let totalBytes = next.reduce((n4, f4) => n4 + f4.size, 0);
  for (const f4 of fileList) {
    if (next.length >= max) {
      chatStatus.value = `max ${max} files per message`;
      break;
    }
    if (f4.size > maxSize) {
      chatStatus.value = `${f4.name} too large (max ${(maxSize / 1024 / 1024).toFixed(0)} MB)`;
      continue;
    }
    if (totalBytes + f4.size > maxTotal) {
      chatStatus.value = `total upload too large (max ${(maxTotal / 1024 / 1024).toFixed(0)} MB)`;
      break;
    }
    next.push(f4);
    totalBytes += f4.size;
  }
  pending.value = next;
}
function removePending(i4) {
  const next = pending.value.slice();
  next.splice(i4, 1);
  pending.value = next;
}
function clearPending() {
  pending.value = [];
}
var NOW_TICK_MS = 3e4;
function installLivenessHandlers() {
  setInterval(() => {
    if (!document.hidden) nowTick.value = Date.now();
  }, NOW_TICK_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    nowTick.value = Date.now();
    if (!threadId.value) return;
    refetchThreadHistory(true).catch((err) => console.error("resume catchup failed", err));
    const ws = refs.ws;
    const open = ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING);
    if (channelType.value === "web" && !open) {
      if (refs.reconnectTimer) {
        clearTimeout(refs.reconnectTimer);
        refs.reconnectTimer = null;
      }
      connectChatWs();
    }
  });
}

// src/components/Header.js
function Header() {
  const onChange = (e4) => {
    selectGroup(e4.target.value).catch(console.error);
  };
  const muted = notifMutedSig.value;
  return html`
    <header>
      <button type="button" class="icon-btn mobile-only" aria-label="Threads"
              onClick=${() => {
    drawerOpen.threads.value = !drawerOpen.threads.value;
    drawerOpen.files.value = false;
  }}>\u2630</button>
      <span class="brand">NanoClaw</span>
      <select id="group-select" aria-label="Agent group" value=${groupId.value || ""} onChange=${onChange}>
        ${groups.value.map((g5) => html`<option value=${g5.id}>${g5.name}${g5.isAdmin ? " [admin]" : ""}</option>`)}
      </select>
      <div class="spacer"></div>
      <span class="user" id="me">${me.value}</span>
      <button type="button" class="icon-btn" aria-label="Notifications" title=${muted ? "Notifications muted (click to enable)" : "Mute notifications"}
              onClick=${toggleMute}>${muted ? "\u{1F515}" : "\u{1F514}"}</button>
      <button type="button" class="icon-btn mobile-only" aria-label="Files"
              onClick=${() => {
    drawerOpen.files.value = !drawerOpen.files.value;
    drawerOpen.threads.value = false;
  }}>\uD83D\uDCC1</button>
      <form method="POST" action="/ui/auth/logout" id="logout-form" style="margin:0">
        <button type="submit" aria-label="Log out" title="Log out">
          <svg class="mobile-only" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span id="logout-label" class="desktop-only">Log out</span>
        </button>
      </form>
    </header>
  `;
}

// src/components/Pane.js
function Pane({ paneKey, name, label, extraClass, headActions, children }) {
  const mobile = isMobile.value;
  const collapsed = !mobile && !paneOpen[paneKey].value;
  const drawer = drawerOpen[paneKey].value;
  const cls = "nc-pane " + name + (collapsed ? " collapsed" : "") + (drawer ? " open" : "") + (extraClass ? " " + extraClass : "");
  const toggle = () => {
    paneOpen[paneKey].value = !paneOpen[paneKey].value;
  };
  const onPaneClick = (ev) => {
    if (!collapsed) return;
    if (ev.target.closest("button, a")) return;
    paneOpen[paneKey].value = true;
  };
  const onHeadClick = (ev) => {
    if (mobile) return;
    if (ev.target.closest("button, a")) return;
    ev.stopPropagation();
    toggle();
  };
  return html`
    <aside class=${cls} id=${name} onClick=${onPaneClick}>
      <div class="head" onClick=${onHeadClick}>
        <button type="button" class="icon-btn desktop-only" id=${"btn-" + paneKey + "-toggle"}
                aria-label=${collapsed ? "Expand " + label : "Collapse " + label}
                onClick=${(e4) => {
    e4.stopPropagation();
    toggle();
  }}></button>
        <span class="title">${label}</span>
      </div>
      ${headActions || null}
      ${children}
    </aside>
  `;
}

// src/components/RelativeTime.js
function RelativeTime({ ts, className }) {
  nowTick.value;
  if (!ts) return null;
  return html`<span class=${className || "ts"} title=${fmtAbsolute(ts)}>${fmtRelative(ts)}</span>`;
}

// src/components/ThreadsRail.js
function threadCtxOf2(t5) {
  if (!t5 || !t5.channelType || t5.channelType === "web") return null;
  return { channelType: t5.channelType, messagingGroupId: t5.messagingGroupId, canSend: !!t5.canSend };
}
function ThreadRow({ t: t5 }) {
  const ct = t5.channelType || "web";
  const meta = channelMeta(ct);
  const active = t5.threadId === threadId.value;
  const pillTitle = `${meta.label}${t5.counterparty ? " \xB7 " + t5.counterparty : ""}`;
  const subTrailer = `${t5.messageCount ? " \xB7 " + t5.messageCount + " msg" : ""}${ct !== "web" && t5.counterparty ? " \xB7 " + t5.counterparty : ""}`;
  const onOpen = (ev) => {
    if (ev.target.classList.contains("del")) return;
    openChat(groupId.value, t5.threadId, threadCtxOf2(t5)).catch(console.error);
    drawerOpen.threads.value = false;
  };
  const onDel = async (ev) => {
    ev.stopPropagation();
    if (!confirm(`Delete this chat?

"${t5.title}"`)) return;
    await deleteThread(t5.threadId);
  };
  return html`
    <div class=${"thread" + (active ? " active" : "")} data-id=${t5.threadId} onClick=${onOpen}>
      <div class="title">
        ${ct !== "web" ? html`<span class="ch-pill" title=${pillTitle}>${meta.icon}</span>` : null}
        ${t5.title}
      </div>
      <div class="meta"><${RelativeTime} ts=${t5.lastActivityAt} />${subTrailer}</div>
      ${ct === "web" ? html`<button type="button" class="del" title="Delete chat" aria-label="Delete chat" onClick=${onDel}>\u00d7</button>` : null}
    </div>
  `;
}
function ThreadsRail() {
  const list = threads.value;
  const onNewChat = () => {
    if (!groupId.value) return;
    openChat(groupId.value, null).then(() => {
      const el = document.getElementById("chat-input");
      if (el) el.focus();
      drawerOpen.threads.value = false;
      drawerOpen.files.value = false;
    }).catch(console.error);
  };
  return html`
    <${Pane} paneKey="threads" name="threads-rail" label="Chats">
      <div class="threads-actions">
        <button type="button" id="btn-new-chat" onClick=${onNewChat}>
          <span class="plus">+</span> <span class="label">New chat</span>
        </button>
      </div>
      <div class="list" id="threads-list">
        ${list.length === 0 ? html`<div class="empty">No chats yet</div>` : list.slice().sort((a4, b4) => tsKey(b4.lastActivityAt) - tsKey(a4.lastActivityAt)).map((t5) => html`<${ThreadRow} key=${t5.threadId} t=${t5} />`)}
      </div>
    <//>
  `;
}

// src/components/ChatMain.js
function Message({ m: m6 }) {
  const ref = A2(null);
  const md = renderMarkdown(m6.text);
  y2(() => {
    if (md != null && ref.current) {
      rewriteFileLinks(ref.current, groupId.value, (entry) => navFile(entry).catch(console.error));
    }
  }, [m6.text, md != null]);
  const cls = "msg " + m6.direction + (md != null ? " markdown" : "");
  return html`
    <div class=${cls}>
      ${md != null ? html`<div ref=${ref} dangerouslySetInnerHTML=${{ __html: md }} />` : m6.text || ""}
      ${m6.files && m6.files.length ? html`<div class="files">${m6.files.map((f4) => `\u{1F4CE} ${f4.filename} (${fmtBytes(f4.size)})`).join("  ")}</div>` : null}
      ${m6.ts ? html`<div class="meta"><${RelativeTime} ts=${m6.ts} /></div>` : null}
    </div>
  `;
}
function MessageLog() {
  const ref = A2(null);
  y2(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  });
  const list = chatMessages.value;
  return html`
    <div class="log" id="chat-log" ref=${ref}>
      ${chatLoading.value ? null : !threadId.value ? html`<div class="empty">Pick or start a chat.</div>` : list.length === 0 ? html`<div class="empty">No messages yet.</div>` : list.map((m6, i4) => html`<${Message} key=${i4} m=${m6} />`)}
    </div>
  `;
}
function ContextChip() {
  const pins = pinnedContext.value;
  if (pins.length === 0) return html`<div class="context" id="chat-context" hidden></div>`;
  return html`
    <div class="context" id="chat-context">
      ${pins.map((p5) => html`
        <span class="chip" key=${p5}>
          <span>\uD83D\uDCCE</span>
          <span class="path" title=${p5}>${p5}</span>
          <button type="button" title="Unpin" onClick=${() => removePinnedPath(p5)}>\u00d7</button>
        </span>
      `)}
    </div>
  `;
}
function PendingTray() {
  const list = pending.value;
  if (list.length === 0) return html`<div class="pending" id="chat-pending" hidden></div>`;
  return html`
    <div class="pending" id="chat-pending">
      ${list.map((f4, i4) => html`
        <span class="item" key=${i4}>
          \uD83D\uDCCE ${f4.name} (${fmtBytesShort(f4.size)})
          <button type="button" title="Remove" onClick=${() => removePending(i4)}>\u00d7</button>
        </span>
      `)}
    </div>
  `;
}
function Composer() {
  const inputRef = A2(null);
  const fileRef = A2(null);
  const showComposer = !channelType.value || channelType.value === "web" || canSend.value;
  const onSubmit = (ev) => {
    ev.preventDefault();
    const text = (inputRef.current?.value || "").trim();
    const files = pending.value.slice();
    if (!text && files.length === 0) return;
    const pins = pinnedContext.value;
    const prefix = pins.length > 0 ? "> Context (file browser):\n" + pins.map((p5) => `> - \`${p5}\``).join("\n") + "\n\n" : "";
    const fullText = prefix + text;
    if (inputRef.current) inputRef.current.value = "";
    clearPending();
    clearPinnedContext();
    sendChat(fullText, files).catch(console.error);
  };
  const onKey = (ev) => {
    if (ev.key === "Enter" && !ev.shiftKey) {
      ev.preventDefault();
      ev.currentTarget.form?.requestSubmit();
    }
  };
  const onAttachClick = () => fileRef.current?.click();
  const onFileChange = (ev) => {
    addPendingFiles(Array.from(ev.target.files || []), UPLOAD_MAX_FILES, UPLOAD_MAX_FILE_SIZE, UPLOAD_MAX_TOTAL_SIZE);
    ev.target.value = "";
  };
  const onPaste = (ev) => {
    const items = ev.clipboardData && ev.clipboardData.files;
    if (!items || items.length === 0) return;
    ev.preventDefault();
    addPendingFiles(Array.from(items), UPLOAD_MAX_FILES, UPLOAD_MAX_FILE_SIZE, UPLOAD_MAX_TOTAL_SIZE);
  };
  return html`
    <form id="chat-form" onSubmit=${onSubmit} style=${showComposer ? "" : "display:none"}>
      <input type="file" id="chat-file" multiple hidden ref=${fileRef} onChange=${onFileChange} />
      <button type="button" id="chat-attach" title="Attach files" aria-label="Attach files" onClick=${onAttachClick}>\uD83D\uDCCE</button>
      <textarea id="chat-input" rows="1" placeholder="Message the agent\u2026" ref=${inputRef} onKeyDown=${onKey} onPaste=${onPaste}></textarea>
      <button type="submit" id="chat-send">Send</button>
    </form>
  `;
}
function ReadonlyBanner() {
  const isWeb = !channelType.value || channelType.value === "web";
  const showComposer = isWeb || canSend.value;
  if (showComposer) return html`<div class="readonly-banner" hidden></div>`;
  const meta = channelMeta(channelType.value);
  return html`<div class="readonly-banner">Read-only view \u2014 reply on ${meta.label} to continue this thread.</div>`;
}
function Subnotice() {
  const isWeb = !channelType.value || channelType.value === "web";
  const showComposer = isWeb || canSend.value;
  if (!(showComposer && !isWeb)) return html`<div class="chat-subnotice" hidden></div>`;
  const meta = channelMeta(channelType.value);
  const t5 = threads.value.find((x5) => x5.threadId === threadId.value);
  const cp = t5 && t5.counterparty ? ` \xB7 ${t5.counterparty}` : "";
  return html`<div class="chat-subnotice">${meta.icon} Sending via ${meta.label}${cp}</div>`;
}
function ChatMain() {
  const ref = A2(null);
  y2(() => {
    const el = ref.current;
    if (!el) return void 0;
    let depth = 0;
    const hasFiles = (ev) => ev.dataTransfer && Array.from(ev.dataTransfer.types || []).includes("Files");
    const onEnter = (ev) => {
      if (!hasFiles(ev)) return;
      ev.preventDefault();
      depth++;
      el.classList.add("drag-active");
    };
    const onOver = (ev) => {
      if (!hasFiles(ev)) return;
      ev.preventDefault();
      ev.dataTransfer.dropEffect = "copy";
    };
    const onLeave = () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) el.classList.remove("drag-active");
    };
    const onDrop = (ev) => {
      if (!ev.dataTransfer) return;
      ev.preventDefault();
      depth = 0;
      el.classList.remove("drag-active");
      const files = Array.from(ev.dataTransfer.files || []);
      if (files.length > 0) addPendingFiles(files, UPLOAD_MAX_FILES, UPLOAD_MAX_FILE_SIZE, UPLOAD_MAX_TOTAL_SIZE);
    };
    el.addEventListener("dragenter", onEnter);
    el.addEventListener("dragover", onOver);
    el.addEventListener("dragleave", onLeave);
    el.addEventListener("drop", onDrop);
    return () => {
      el.removeEventListener("dragenter", onEnter);
      el.removeEventListener("dragover", onOver);
      el.removeEventListener("dragleave", onLeave);
      el.removeEventListener("drop", onDrop);
    };
  }, []);
  return html`
    <section class="chat-main" id="chat-main" ref=${ref}>
      <${MessageLog} />
      <div class="status" id="chat-status">${chatStatus.value}</div>
      <${ContextChip} />
      <${PendingTray} />
      <${ReadonlyBanner} />
      <${Subnotice} />
      <${Composer} />
    </section>
  `;
}

// src/uploads.js
function curDir() {
  return treePath.value || "";
}
function joinPath(dir, name) {
  return dir ? dir + "/" + name : name;
}
async function mkdirPrompt() {
  if (!groupId.value || !isAdmin.value) return;
  const name = prompt("New folder name:");
  if (!name) return;
  const trimmed = name.trim();
  if (!trimmed) return;
  const target = joinPath(curDir(), trimmed);
  const r4 = await postJson(`api/groups/${groupId.value}/mkdir`, { path: target });
  if (!r4.ok) {
    alert("mkdir failed: " + (r4.data.error || r4.status));
    return;
  }
  await loadTree(treePath.value);
}
async function touchPrompt() {
  if (!groupId.value || !isAdmin.value) return;
  const name = prompt("New file name:");
  if (!name) return;
  const trimmed = name.trim();
  if (!trimmed) return;
  const target = joinPath(curDir(), trimmed);
  const r4 = await postJson(`api/groups/${groupId.value}/touch`, { path: target });
  if (!r4.ok) {
    alert("create file failed: " + (r4.data.error || r4.status));
    return;
  }
  await loadTree(treePath.value);
}
async function renameEntry(entry) {
  if (!isAdmin.value) return;
  const next = prompt("Rename to:", entry.name);
  if (!next) return;
  const trimmed = next.trim();
  if (!trimmed || trimmed === entry.name) return;
  const dir = entry.path.includes("/") ? entry.path.slice(0, entry.path.lastIndexOf("/")) : "";
  const toPath = joinPath(dir, trimmed);
  const r4 = await postJson(`api/groups/${groupId.value}/rename`, { from: entry.path, to: toPath });
  if (!r4.ok) {
    alert("rename failed: " + (r4.data.error || r4.status));
    return;
  }
  await loadTree(treePath.value);
}
async function deleteEntry(entry) {
  if (!isAdmin.value) return;
  if (!confirm(`Delete ${entry.type === "dir" ? "folder" : "file"} "${entry.name}"?`)) return;
  const r4 = await postJson(`api/groups/${groupId.value}/delete`, { path: entry.path });
  if (!r4.ok) {
    alert("delete failed: " + (r4.data.error || r4.status));
    return;
  }
  await loadTree(treePath.value);
}
async function deletePaths(paths) {
  if (!isAdmin.value || paths.length === 0) return;
  if (!confirm(`Delete ${paths.length} item${paths.length === 1 ? "" : "s"}?`)) return;
  const errors = [];
  for (const p5 of paths) {
    const r4 = await postJson(`api/groups/${groupId.value}/delete`, { path: p5 });
    if (!r4.ok) errors.push(`${p5}: ${r4.data.error || r4.status}`);
  }
  if (errors.length) alert("Some deletes failed:\n" + errors.join("\n"));
  await loadTree(treePath.value);
}
function downloadPaths(paths, entries) {
  if (!groupId.value || paths.length === 0) return;
  if (paths.length === 1) {
    const single = paths[0];
    const entry = entries?.find((e4) => e4.path === single);
    if (entry && entry.type !== "dir") {
      const url = `api/groups/${groupId.value}/file?path=${encodeURIComponent(single)}`;
      triggerDownload(url, entry.name);
      return;
    }
  }
  const qs = paths.map((p5) => `path=${encodeURIComponent(p5)}`).join("&");
  triggerDownload(`api/groups/${groupId.value}/zip?${qs}`);
}
function triggerDownload(url, filename) {
  const a4 = document.createElement("a");
  a4.href = url;
  if (filename) a4.download = filename;
  a4.rel = "noopener";
  document.body.appendChild(a4);
  a4.click();
  a4.remove();
}
function updateItem(idx, patch) {
  const next = uploadItems.value.slice();
  next[idx] = { ...next[idx], ...patch };
  uploadItems.value = next;
}
function clearUploadStrip() {
  uploadItems.value = [];
}
function resolveConflict(idx, action) {
  if (action === "skip") {
    updateItem(idx, { status: "error", statusText: "skipped" });
    return;
  }
  updateItem(idx, { status: "uploading", pct: 0, statusText: "uploading\u2026" });
  uploadOne(idx, action).catch((err) => updateItem(idx, { status: "error", statusText: String(err && err.message || err) }));
}
function uploadOne(idx, mode) {
  return new Promise((resolve) => {
    const item = uploadItems.value[idx];
    if (!item) return resolve();
    const fd = new FormData();
    fd.append("file", item.file, item.name);
    const xhr = new XMLHttpRequest();
    const url = `api/groups/${groupId.value}/upload?path=${encodeURIComponent(curDir())}&mode=${encodeURIComponent(mode)}`;
    xhr.open("POST", url);
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) updateItem(idx, { pct: ev.loaded / ev.total * 100 });
    };
    xhr.onload = () => {
      let body = {};
      try {
        body = JSON.parse(xhr.responseText || "{}");
      } catch (_5) {
      }
      const r4 = body.results && body.results[0] || {};
      if (xhr.status >= 200 && xhr.status < 300 && r4.status === "ok") {
        updateItem(idx, { status: "ok", statusText: "uploaded", path: r4.path });
      } else if (r4.status === "conflict") {
        updateItem(idx, { status: "conflict", statusText: "file exists" });
      } else {
        updateItem(idx, { status: "error", statusText: r4.reason || r4.status || "http " + xhr.status });
      }
      resolve();
    };
    xhr.onerror = () => {
      updateItem(idx, { status: "error", statusText: "network error" });
      resolve();
    };
    xhr.send(fd);
  });
}
async function uploadFiles(fileList) {
  if (!groupId.value || !isAdmin.value || !fileList || fileList.length === 0) return;
  uploadItems.value = Array.from(fileList).map((file) => ({
    file,
    name: file.name,
    size: file.size,
    status: "uploading",
    pct: 0,
    statusText: "uploading\u2026",
    path: null
  }));
  for (let i4 = 0; i4 < uploadItems.value.length; i4++) {
    await uploadOne(i4, "skip").catch((err) => updateItem(i4, { status: "error", statusText: String(err && err.message || err) }));
  }
  await loadTree(treePath.value);
}
async function notifyAgent(paths) {
  if (!threadId.value || !groupId.value || paths.length === 0) return;
  const list = paths.slice(0, 20).map((p5) => "`" + p5 + "`").join(", ");
  const more = paths.length > 20 ? ` (and ${paths.length - 20} more)` : "";
  const text = `Files updated via web UI: ${list}${more}`;
  const r4 = await postJson(`api/groups/${groupId.value}/chat/${threadId.value}/send`, { text });
  if (!r4.ok) {
    alert("notify failed: " + (r4.data.error || r4.status));
    return;
  }
  clearUploadStrip();
}

// src/components/ActionsMenu.js
function entriesByPath(paths) {
  const set = new Set(paths);
  return treeEntries.value.filter((e4) => set.has(e4.path));
}
function ActionsMenu({ mode, entry, onUpload }) {
  const [open, setOpen] = h2(false);
  const wrapRef = A2(null);
  y2(() => {
    if (!open) return void 0;
    const onDoc = (ev) => {
      if (wrapRef.current && !wrapRef.current.contains(ev.target)) setOpen(false);
    };
    const onKey = (ev) => {
      if (ev.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const items = buildItems(mode, entry, onUpload);
  if (items.length === 0) return null;
  return html`
    <div class=${"action-menu" + (open ? " open" : "")} ref=${wrapRef}>
      <button type="button" class="text-btn action-trigger" aria-haspopup="menu" aria-expanded=${open}
              title="Actions" onClick=${(ev) => {
    ev.stopPropagation();
    setOpen((o4) => !o4);
  }}>\u22EF</button>
      ${open ? html`
        <div class="action-panel" role="menu">
          ${items.map((it, i4) => it === "---" ? html`<div class="action-sep" key=${"s" + i4}></div>` : html`
                <button type="button" class=${"action-item" + (it.danger ? " danger" : "")}
                        role="menuitem" key=${it.label} disabled=${it.disabled}
                        onClick=${(ev) => {
    ev.stopPropagation();
    setOpen(false);
    it.onClick();
  }}>
                  <span class="ico">${it.ico}</span>
                  <span class="lbl">${it.label}</span>
                </button>
              `)}
        </div>
      ` : null}
    </div>
  `;
}
function buildItems(mode, entry, onUpload) {
  const admin = isAdmin.value;
  if (mode === "row" && entry) {
    const items2 = [];
    items2.push({ ico: "\u2B07", label: "Download", onClick: () => downloadPaths([entry.path], [entry]) });
    if (admin) {
      items2.push("---");
      items2.push({ ico: "\u270E", label: "Rename", onClick: () => renameEntry(entry) });
      items2.push({ ico: "\u{1F5D1}", label: "Delete", danger: true, onClick: () => deleteEntry(entry) });
    }
    return items2;
  }
  if (mode === "preview") {
    const p5 = previewBlock.value;
    const fp = filePath.value;
    if (!p5) return [];
    const entryForPath = treeEntries.value.find((e4) => e4.path === fp) || (fp ? { path: fp, name: p5.name, type: "file" } : null);
    const items2 = [];
    items2.push({ ico: "\u2B07", label: "Download", onClick: () => fp ? downloadPaths([fp], [entryForPath]) : null, disabled: !fp });
    if (admin && entryForPath) {
      items2.push("---");
      items2.push({ ico: "\u270E", label: "Rename", onClick: () => renameEntry(entryForPath) });
      items2.push({ ico: "\u{1F5D1}", label: "Delete", danger: true, onClick: () => deleteEntry(entryForPath) });
    }
    items2.push("---");
    items2.push({ ico: "\xD7", label: "Close preview", onClick: closePreview });
    return items2;
  }
  const sel = pinnedContext.value;
  const selEntries = entriesByPath(sel);
  const items = [];
  if (admin) {
    items.push({ ico: "\uFF0B", label: "New file", onClick: touchPrompt });
    items.push({ ico: "\u{1F4C1}", label: "New folder", onClick: mkdirPrompt });
    if (onUpload) items.push({ ico: "\u2B06", label: "Upload files\u2026", onClick: onUpload });
  }
  if (sel.length > 0) {
    if (items.length) items.push("---");
    items.push({ ico: "\u2B07", label: sel.length > 1 ? `Download ${sel.length} (zip)` : "Download", onClick: () => downloadPaths(sel, selEntries) });
    if (admin) {
      if (sel.length === 1 && selEntries.length === 1) {
        items.push({ ico: "\u270E", label: "Rename", onClick: () => renameEntry(selEntries[0]) });
      }
      items.push({ ico: "\u{1F5D1}", label: sel.length > 1 ? `Delete ${sel.length}` : "Delete", danger: true, onClick: () => deletePaths(sel) });
    }
    items.push("---");
    items.push({ ico: "\u2715", label: "Clear selection", onClick: clearPinnedContext });
  }
  return items;
}

// src/components/MediaPlayer.js
function MediaPlayer({ kind, url, name }) {
  if (kind !== "audio" && kind !== "video") return null;
  const el = kind === "audio" ? html`<audio controls preload="metadata" src=${url} aria-label=${name} />` : html`<video controls preload="metadata" src=${url} aria-label=${name} />`;
  return html`<div class=${"media-player media-player-" + kind}>${el}</div>`;
}

// src/components/FilesPane.js
function Crumb() {
  const ref = A2(null);
  const p5 = treePath.value;
  const fp = filePath.value;
  const segs = p5 ? p5.split("/").filter(Boolean) : [];
  const fileName = fp ? fp.slice(fp.lastIndexOf("/") + 1) : "";
  y2(() => {
    if (ref.current) requestAnimationFrame(() => {
      ref.current.scrollLeft = ref.current.scrollWidth;
    });
  }, [p5, fp]);
  let acc = "";
  return html`
    <div class="breadcrumb" id="crumb" ref=${ref}>
      <button type="button" class=${"crumb root" + (segs.length === 0 && !fileName ? " current" : "")} data-path="" title="Root"
              onClick=${() => navTree("")}>/</button>
      ${segs.map((s5, i4) => {
    acc = acc ? acc + "/" + s5 : s5;
    const path = acc;
    const last = i4 === segs.length - 1 && !fileName;
    return html`
          <span class="sep" aria-hidden="true">\u203a</span>
          <button type="button" class=${"crumb" + (last ? " current" : "")} data-path=${path} title=${"/" + path}
                  onClick=${last ? null : () => navTree(path)}>${s5}</button>
        `;
  })}
      ${fileName ? html`
        <span class="sep" aria-hidden="true">\u203a</span>
        <span class="crumb file current" title=${"/" + fp}>${fileName}</span>
      ` : null}
    </div>
  `;
}
function Row({ e: e4 }) {
  const active = e4.path === filePath.value;
  const selected = pinnedContext.value.includes(e4.path);
  const onClick = (ev) => {
    if (ev.target.closest(".row-sel") || ev.target.closest(".action-menu")) return;
    if (e4.type === "dir") navTree(e4.path);
    else navFile(e4).catch(console.error);
  };
  return html`
    <div class=${"row tier-" + e4.tier + (active ? " active" : "") + (selected ? " selected" : "")} data-path=${e4.path} onClick=${onClick}>
      <label class="row-sel" onClick=${(ev) => ev.stopPropagation()} title=${selected ? "Detach from next message" : "Attach to next message"}>
        <input type="checkbox" checked=${selected} onChange=${() => togglePinnedFile(e4.path)} />
      </label>
      <div>${e4.type === "dir" ? "\u{1F4C1}" : "\u{1F4C4}"}</div>
      <div class="name">${e4.name}</div>
      <div class="size">${fmtBytes(e4.size)}</div>
      <div class="meta"><${RelativeTime} ts=${e4.mtime} /></div>
      <div class="row-actions"><${ActionsMenu} mode="row" entry=${e4} /></div>
    </div>
  `;
}
function Listing() {
  const p5 = treePath.value;
  const err = treeError.value;
  const entries = treeEntries.value;
  if (err) return html`<div class="listing" id="listing"><div class="empty">${err}</div></div>`;
  return html`
    <div class="listing" id="listing">
      ${p5 ? html`<div class="row" onClick=${() => navTree(parentPath(p5))}><div class="name">..</div></div>` : null}
      ${entries.length === 0 ? html`<div class="empty">Empty directory</div>` : entries.map((e4) => html`<${Row} key=${e4.path} e=${e4} />`)}
    </div>
  `;
}
function UploadStrip() {
  const items = uploadItems.value;
  if (items.length === 0) return html`<div class="upload-strip" id="upload-strip" hidden></div>`;
  const allDone = items.every((i4) => i4.status !== "uploading");
  const okPaths = items.filter((i4) => i4.status === "ok" && i4.path).map((i4) => i4.path);
  const wakeTitle = !threadId.value ? "Open a chat first" : `Send a message to the agent listing ${okPaths.length} updated file(s)`;
  return html`
    <div class="upload-strip" id="upload-strip">
      ${items.map((item, i4) => html`
        <div class=${"row " + item.status} key=${i4}>
          <div class="name">${item.name}</div>
          ${item.status === "uploading" ? html`<div class="bar"><i style=${`width:${Math.round(item.pct || 0)}%`}></i></div>` : null}
          <div class="status">${item.statusText || item.status}</div>
          ${item.status === "conflict" ? html`
            <div class="actions">
              <button onClick=${() => resolveConflict(i4, "overwrite")} title="Replace existing file">Overwrite</button>
              <button onClick=${() => resolveConflict(i4, "rename")} title="Save with a unique name">Rename</button>
              <button onClick=${() => resolveConflict(i4, "skip")} title="Cancel this upload">Skip</button>
            </div>
          ` : null}
        </div>
      `)}
      ${allDone ? html`
        <div class="footer">
          <button onClick=${() => notifyAgent(okPaths)}
                  disabled=${okPaths.length === 0 || !threadId.value}
                  title=${wakeTitle}>Notify agent</button>
          <button class="close" onClick=${clearUploadStrip} title="Dismiss">\u2715</button>
        </div>
      ` : null}
    </div>
  `;
}
function Preview() {
  const ref = A2(null);
  const p5 = previewBlock.value;
  if (!p5) return html`<div class="preview-body" id="preview" ref=${ref}></div>`;
  const fp = filePath.value;
  const pinned = !!fp && pinnedContext.value.includes(fp);
  const clippyTitle = pinned ? "Detach from next message" : "Attach to next message";
  const toolbar = html`
    <div class="preview-toolbar">
      <button class=${"text-btn clippy" + (pinned ? " active" : "")}
              onClick=${() => togglePinnedFile(fp)}
              disabled=${!fp}
              title=${clippyTitle}
              aria-pressed=${pinned}>\uD83D\uDCCE</button>
      ${p5.size != null ? html`<span class="meta">${fmtBytes(p5.size)}</span>` : null}
      ${p5.mtime ? html`<${RelativeTime} ts=${p5.mtime} className="meta ts" />` : null}
      <span style="margin-left:auto"><${ActionsMenu} mode="preview" /></span>
    </div>
  `;
  const fileRows = [];
  if (p5.mime) fileRows.push(["Type", p5.mime]);
  if (p5.size != null) fileRows.push(["Size", fmtBytes(p5.size)]);
  if (p5.mtime) fileRows.push(["Modified", new Date(p5.mtime).toLocaleString()]);
  const tagRows = p5.tags ? Object.entries(p5.tags).map(([k4, v5]) => [k4, String(v5)]) : [];
  const isMedia = p5.kind === "image" || p5.kind === "audio" || p5.kind === "video" || p5.kind === "pdf";
  const player = p5.kind === "audio" || p5.kind === "video" ? html`<${MediaPlayer} kind=${p5.kind} url=${p5.url} name=${p5.name} />` : null;
  const renderMetaPanel = (rows, cls) => html`
    <dl class=${"preview-meta " + cls}>
      ${rows.map(([k4, v5]) => html`<div class="row" key=${k4}><dt>${k4}</dt><dd>${v5}</dd></div>`)}
    </dl>
  `;
  const fileMeta = isMedia && fileRows.length > 0 ? renderMetaPanel(fileRows, "preview-meta-file") : null;
  const tagMeta = isMedia && tagRows.length > 0 ? renderMetaPanel(tagRows, "preview-meta-tags") : null;
  const lyrics = p5.lyrics ? html`
    <div class="preview-lyrics">
      <div class="preview-lyrics-head">Lyrics</div>
      <pre>${p5.lyrics}</pre>
    </div>
  ` : null;
  let body = null;
  if (p5.kind === "image") body = html`<img alt=${p5.name} src=${p5.url} />`;
  else if (p5.kind === "pdf") body = html`<iframe src=${p5.url} style="width:100%;height:90vh;border:0" />`;
  else if (p5.kind === "markdown") {
    const md = renderMarkdown(p5.text);
    body = md != null ? html`<div class="markdown-preview" dangerouslySetInnerHTML=${{ __html: md }} />` : html`<pre>${p5.text}</pre>`;
  } else if (p5.kind === "text") body = html`<pre>${p5.text}</pre>`;
  else if (p5.kind === "binary") body = html`<div class="empty">Binary file (${p5.mime}).</div>`;
  else if (p5.kind === "error") body = html`<div class="empty">${p5.text}</div>`;
  return html`<div class="preview-body" id="preview" ref=${ref}>${toolbar}${player}${fileMeta}${tagMeta}${lyrics}${body}</div>`;
}
function FilesPane() {
  const previewing = !!previewBlock.value;
  const bodyRef = A2(null);
  y2(() => {
    const body = bodyRef.current;
    const zone = document.getElementById("dropzone");
    if (!body || !zone) return void 0;
    let depth = 0;
    const hasFiles = (ev) => ev.dataTransfer && Array.from(ev.dataTransfer.types || []).includes("Files");
    const highlight = (on) => zone.classList.toggle("drag-over", !!on);
    const onEnter = (ev) => {
      if (!isAdmin.value || !hasFiles(ev)) return;
      ev.preventDefault();
      depth++;
      highlight(true);
    };
    const onOver = (ev) => {
      if (!isAdmin.value || !hasFiles(ev)) return;
      ev.preventDefault();
      ev.dataTransfer.dropEffect = "copy";
    };
    const onLeave = () => {
      if (!isAdmin.value) return;
      depth--;
      if (depth <= 0) {
        depth = 0;
        highlight(false);
      }
    };
    const onDrop = (ev) => {
      if (!isAdmin.value) return;
      ev.preventDefault();
      depth = 0;
      highlight(false);
      const files = ev.dataTransfer && ev.dataTransfer.files;
      if (files && files.length) uploadFiles(files);
    };
    body.addEventListener("dragenter", onEnter);
    body.addEventListener("dragover", onOver);
    body.addEventListener("dragleave", onLeave);
    body.addEventListener("drop", onDrop);
    return () => {
      body.removeEventListener("dragenter", onEnter);
      body.removeEventListener("dragover", onOver);
      body.removeEventListener("dragleave", onLeave);
      body.removeEventListener("drop", onDrop);
    };
  }, []);
  const uploadInputRef = A2(null);
  const headActions = html`
    <div class="head-actions">
      <input type="file" id="upload-input" multiple hidden ref=${uploadInputRef}
             onChange=${(ev) => {
    if (ev.target.files?.length) uploadFiles(ev.target.files);
    ev.target.value = "";
  }} />
      <${ActionsMenu} mode="header" onUpload=${() => uploadInputRef.current?.click()} />
    </div>
  `;
  return html`
    <${Pane} paneKey="files" name="files-pane" label="Files"
             extraClass=${previewing ? "previewing" : ""}
             headActions=${headActions}>
      <div class="files-body" ref=${bodyRef}>
        <${Crumb} />
        <${UploadStrip} />
        <${Listing} />
        <div class="drop-hint admin-only" id="dropzone">
          Drag & drop files here to upload to <code id="dropzone-path">/${treePath.value}</code>
        </div>
        <${Preview} />
      </div>
    <//>
  `;
}

// src/panels.js
var KEYS = { threads: "nc:pane:threads", files: "nc:pane:files" };
function restorePanelState() {
  try {
    const t5 = localStorage.getItem(KEYS.threads);
    const f4 = localStorage.getItem(KEYS.files);
    if (t5 === "0") paneOpen.threads.value = false;
    if (t5 === "1") paneOpen.threads.value = true;
    if (f4 === "0") paneOpen.files.value = false;
    if (f4 === "1") paneOpen.files.value = true;
  } catch (_5) {
  }
}
function persistPanelState() {
  try {
    localStorage.setItem(KEYS.threads, paneOpen.threads.value ? "1" : "0");
    localStorage.setItem(KEYS.files, paneOpen.files.value ? "1" : "0");
  } catch (_5) {
  }
}
function applyPanelClasses() {
  const mobile = MOBILE_MQ.matches;
  isMobile.value = mobile;
  if (mobile) {
    document.body.classList.add("mobile");
  } else {
    document.body.classList.remove("mobile");
    drawerOpen.threads.value = false;
    drawerOpen.files.value = false;
  }
}

// src/router.js
var router = {
  selectGroup,
  loadThreads,
  openChat,
  clearChat,
  loadTree,
  selectFile,
  notFound: (msg) => {
    console.warn(msg);
  }
};

// src/components/App.js
function App() {
  y2(() => {
    const onChange = () => applyPanelClasses();
    MOBILE_MQ.addEventListener("change", onChange);
    const onHashChange = () => {
      if (refs.suppressHashCount > 0) {
        refs.suppressHashCount--;
        return;
      }
      applyHash(router).catch(console.error);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => {
      MOBILE_MQ.removeEventListener("change", onChange);
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);
  const threadsOpen = paneOpen.threads.value;
  const filesOpen = paneOpen.files.value;
  y2(() => {
    persistPanelState();
  }, [threadsOpen, filesOpen]);
  const mainCls = (threadsOpen ? "" : " threads-collapsed") + (filesOpen ? "" : " files-collapsed");
  const backdropShown = drawerOpen.threads.value || drawerOpen.files.value;
  const onBackdrop = () => {
    drawerOpen.threads.value = false;
    drawerOpen.files.value = false;
  };
  return html`
    <${Header} />
    <main id="main" class=${mainCls.trim()}>
      <${ThreadsRail} />
      <${ChatMain} />
      <${FilesPane} />
    </main>
    <div class=${"backdrop" + (backdropShown ? " show" : "")} id="backdrop" onClick=${onBackdrop}></div>
  `;
}

// src/index.js
function sortGroups(list) {
  return list.slice().sort((a4, b4) => {
    const ta = a4.lastActivityAt ? Date.parse(a4.lastActivityAt.includes("T") ? a4.lastActivityAt : a4.lastActivityAt.replace(" ", "T") + "Z") : 0;
    const tb = b4.lastActivityAt ? Date.parse(b4.lastActivityAt.includes("T") ? b4.lastActivityAt : b4.lastActivityAt.replace(" ", "T") + "Z") : 0;
    if (tb !== ta) return tb - ta;
    return a4.name.localeCompare(b4.name);
  });
}
function setupViewportFit() {
  const vv = window.visualViewport;
  if (!vv) return;
  const apply = () => {
    document.documentElement.style.setProperty("--app-height", vv.height + "px");
  };
  apply();
  vv.addEventListener("resize", apply);
  vv.addEventListener("scroll", apply);
  document.addEventListener("focusin", (ev) => {
    if (ev.target?.id === "chat-input") {
      setTimeout(() => {
        try {
          ev.target.scrollIntoView({ block: "end", behavior: "smooth" });
        } catch {
        }
      }, 250);
    }
  });
}
async function init() {
  initNotif();
  setupViewportFit();
  installLivenessHandlers();
  restorePanelState();
  applyPanelClasses();
  try {
    const [meRes, groupsRes] = await Promise.all([api("api/me"), api("api/groups")]);
    n2(() => {
      me.value = meRes.userId;
      groups.value = sortGroups(groupsRes.groups);
    });
  } catch (_5) {
    return;
  }
  if (groups.value.length === 0) {
    document.getElementById("app").innerHTML = '<div style="padding:24px;font:14px system-ui">No accessible groups.</div>';
    return;
  }
  applyAdminFlag();
  const parsed = parseHash();
  if (parsed && parsed.groupId) chatLoading.value = true;
  applyHash(router).catch((err) => console.error("initial route failed", err));
  D(html`<${App} />`, document.getElementById("app"));
}
init().catch((err) => console.error(err));
//# sourceMappingURL=app.js.map
