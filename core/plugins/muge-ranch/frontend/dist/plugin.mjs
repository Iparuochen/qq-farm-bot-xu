// @__NO_SIDE_EFFECTS__
function zs(e) {
  const t = /* @__PURE__ */ Object.create(null);
  for (const s of e.split(",")) t[s] = 1;
  return (s) => s in t;
}
const X = {}, at = [], Ke = () => {
}, Wn = () => !1, as = (e) => e.charCodeAt(0) === 111 && e.charCodeAt(1) === 110 && // uppercase letter
(e.charCodeAt(2) > 122 || e.charCodeAt(2) < 97), ds = (e) => e.startsWith("onUpdate:"), de = Object.assign, Ys = (e, t) => {
  const s = e.indexOf(t);
  s > -1 && e.splice(s, 1);
}, ei = Object.prototype.hasOwnProperty, K = (e, t) => ei.call(e, t), F = Array.isArray, rt = (e) => Ut(e) === "[object Map]", ts = (e) => Ut(e) === "[object Set]", _n = (e) => Ut(e) === "[object Date]", D = (e) => typeof e == "function", ne = (e) => typeof e == "string", Ve = (e) => typeof e == "symbol", G = (e) => e !== null && typeof e == "object", qn = (e) => (G(e) || D(e)) && D(e.then) && D(e.catch), Gn = Object.prototype.toString, Ut = (e) => Gn.call(e), ti = (e) => Ut(e).slice(8, -1), Jn = (e) => Ut(e) === "[object Object]", Xs = (e) => ne(e) && e !== "NaN" && e[0] !== "-" && "" + parseInt(e, 10) === e, It = /* @__PURE__ */ zs(
  // the leading comma is intentional so empty string "" is also included
  ",key,ref,ref_for,ref_key,onVnodeBeforeMount,onVnodeMounted,onVnodeBeforeUpdate,onVnodeUpdated,onVnodeBeforeUnmount,onVnodeUnmounted"
), hs = (e) => {
  const t = /* @__PURE__ */ Object.create(null);
  return ((s) => t[s] || (t[s] = e(s)));
}, si = /-\w/g, Oe = hs(
  (e) => e.replace(si, (t) => t.slice(1).toUpperCase())
), ni = /\B([A-Z])/g, pt = hs(
  (e) => e.replace(ni, "-$1").toLowerCase()
), zn = hs((e) => e.charAt(0).toUpperCase() + e.slice(1)), ws = hs(
  (e) => e ? `on${zn(e)}` : ""
), ke = (e, t) => !Object.is(e, t), Cs = (e, ...t) => {
  for (let s = 0; s < e.length; s++)
    e[s](...t);
}, Yn = (e, t, s, n = !1) => {
  Object.defineProperty(e, t, {
    configurable: !0,
    enumerable: !1,
    writable: n,
    value: s
  });
}, ri = (e) => {
  const t = parseFloat(e);
  return isNaN(t) ? e : t;
};
let mn;
const ps = () => mn || (mn = typeof globalThis < "u" ? globalThis : typeof self < "u" ? self : typeof window < "u" ? window : typeof global < "u" ? global : {});
function gs(e) {
  if (F(e)) {
    const t = {};
    for (let s = 0; s < e.length; s++) {
      const n = e[s], r = ne(n) ? ci(n) : gs(n);
      if (r)
        for (const i in r)
          t[i] = r[i];
    }
    return t;
  } else if (ne(e) || G(e))
    return e;
}
const ii = /;(?![^(]*\))/g, li = /:([^]+)/, oi = /"(?:[^"\\]|\\[^])*"|'(?:[^'\\]|\\[^])*'|\\[^]|\/\*[^]*?\*\//g;
function ci(e) {
  const t = {};
  return e.replace(oi, (s) => s.startsWith("/*") ? "" : s).split(ii).forEach((s) => {
    if (s) {
      const n = s.split(li);
      n.length > 1 && (t[n[0].trim()] = n[1].trim());
    }
  }), t;
}
function st(e) {
  let t = "";
  if (ne(e))
    t = e;
  else if (F(e))
    for (let s = 0; s < e.length; s++) {
      const n = st(e[s]);
      n && (t += n + " ");
    }
  else if (G(e))
    for (const s in e)
      e[s] && (t += s + " ");
  return t.trim();
}
const fi = "itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,playsinline,readonly", ui = /* @__PURE__ */ zs(fi);
function Xn(e) {
  return !!e || e === "";
}
function ai(e, t, s) {
  if (e.length !== t.length) return !1;
  let n = !0;
  for (let r = 0; n && r < e.length; r++)
    n = _s(e[r], t[r], s);
  return n;
}
function bn(e, t, s) {
  if (e.size !== t.size) return !1;
  const n = Array.from(t), r = new Uint8Array(n.length);
  for (const i of e) {
    let l = -1;
    for (let o = 0; o < n.length; o++)
      if (!r[o] && _s(i, n[o], s)) {
        l = o;
        break;
      }
    if (l < 0) return !1;
    r[l] = 1;
  }
  return !0;
}
function di(e, t, s) {
  let n = rt(e), r = rt(t);
  if (n || r || (n = ts(e), r = ts(t), n || r))
    return n && r ? bn(e, t, s) : !1;
  const i = Object.keys(e).length, l = Object.keys(t).length;
  if (i !== l)
    return !1;
  for (const o in e) {
    const f = e.hasOwnProperty(o), d = t.hasOwnProperty(o);
    if (f && !d || !f && d || !_s(e[o], t[o], s))
      return !1;
  }
  return String(e) === String(t);
}
function vn(e, t, s, n) {
  s || (s = [/* @__PURE__ */ new Map(), /* @__PURE__ */ new Map()]);
  const [r, i] = s;
  if (r.has(e) || i.has(t))
    return r.get(e) === t && i.get(t) === e;
  r.set(e, t), i.set(t, e);
  const l = n(e, t, s);
  return r.delete(e), i.delete(t), l;
}
function _s(e, t, s) {
  if (e === t) return !0;
  let n = _n(e), r = _n(t);
  return n || r ? n && r ? e.getTime() === t.getTime() : !1 : (n = Ve(e), r = Ve(t), n || r ? e === t : (n = F(e), r = F(t), n || r ? n && r ? vn(e, t, s, ai) : !1 : (n = G(e), r = G(t), n || r ? !n || !r ? !1 : vn(e, t, s, di) : String(e) === String(t))));
}
const Zn = (e) => !!(e && e.__v_isRef === !0), $ = (e) => ne(e) ? e : e == null ? "" : F(e) || G(e) && (e.toString === Gn || !D(e.toString)) ? Zn(e) ? $(e.value) : JSON.stringify(e, Qn, 2) : String(e), Qn = (e, t) => Zn(t) ? Qn(e, t.value) : rt(t) ? {
  [`Map(${t.size})`]: [...t.entries()].reduce(
    (s, [n, r], i) => (s[Ts(n, i) + " =>"] = r, s),
    {}
  )
} : ts(t) ? {
  [`Set(${t.size})`]: [...t.values()].map((s) => Ts(s))
} : Ve(t) ? Ts(t) : G(t) && !F(t) && !Jn(t) ? String(t) : t, Ts = (e, t = "") => {
  var s;
  return (
    // Symbol.description in es2019+ so we need to cast here to pass
    // the lib: es2016 check
    Ve(e) ? `Symbol(${(s = e.description) != null ? s : t})` : e
  );
};
let oe;
class hi {
  // TODO isolatedDeclarations "__v_skip"
  constructor(t = !1) {
    this.detached = t, this._active = !0, this._on = 0, this.effects = [], this.cleanups = [], this._isPaused = !1, this._warnOnRun = !0, this.__v_skip = !0, !t && oe && (oe.active ? (this.parent = oe, this.index = (oe.scopes || (oe.scopes = [])).push(
      this
    ) - 1) : (this._active = !1, this._warnOnRun = !1));
  }
  get active() {
    return this._active;
  }
  pause() {
    if (this._active) {
      this._isPaused = !0;
      let t, s;
      if (this.scopes) {
        const n = this.scopes.slice();
        for (t = 0, s = n.length; t < s; t++)
          n[t].pause();
      }
      for (t = 0, s = this.effects.length; t < s; t++)
        this.effects[t].pause();
    }
  }
  /**
   * Resumes the effect scope, including all child scopes and effects.
   */
  resume() {
    if (this._active && this._isPaused) {
      this._isPaused = !1;
      let t, s;
      if (this.scopes) {
        const r = this.scopes.slice();
        for (t = 0, s = r.length; t < s; t++)
          r[t].resume();
      }
      const n = this.effects.slice();
      for (t = 0, s = n.length; t < s; t++)
        n[t].resume();
    }
  }
  run(t) {
    if (this._active) {
      const s = oe;
      try {
        return oe = this, t();
      } finally {
        oe = s;
      }
    }
  }
  /**
   * This should only be called on non-detached scopes
   * @internal
   */
  on() {
    ++this._on === 1 && (this.prevScope = oe, oe = this);
  }
  /**
   * This should only be called on non-detached scopes
   * @internal
   */
  off() {
    if (this._on > 0 && --this._on === 0) {
      if (oe === this)
        oe = this.prevScope;
      else {
        let t = oe;
        for (; t; ) {
          if (t.prevScope === this) {
            t.prevScope = this.prevScope;
            break;
          }
          t = t.prevScope;
        }
      }
      this.prevScope = void 0;
    }
  }
  stop(t) {
    if (this._active) {
      this._active = !1;
      let s, n;
      for (s = 0, n = this.effects.length; s < n; s++)
        this.effects[s].stop();
      for (this.effects.length = 0, s = 0, n = this.cleanups.length; s < n; s++)
        this.cleanups[s]();
      if (this.cleanups.length = 0, this.scopes) {
        const r = this.scopes.slice();
        for (s = 0, n = r.length; s < n; s++)
          r[s].stop(!0);
        this.scopes.length = 0;
      }
      if (!this.detached && this.parent && !t) {
        const r = this.parent.scopes.pop();
        r && r !== this && (this.parent.scopes[this.index] = r, r.index = this.index);
      }
      this.parent = void 0;
    }
  }
}
function pi() {
  return oe;
}
let Y;
const Es = /* @__PURE__ */ new WeakSet();
class er {
  constructor(t) {
    this.fn = t, this.deps = void 0, this.depsTail = void 0, this.flags = 5, this.next = void 0, this.cleanup = void 0, this.scheduler = void 0, oe && (oe.active ? oe.effects.push(this) : this.flags &= -2);
  }
  pause() {
    this.flags |= 64;
  }
  resume() {
    this.flags & 64 && (this.flags &= -65, Es.has(this) && (Es.delete(this), this.trigger()));
  }
  /**
   * @internal
   */
  notify() {
    this.flags & 2 && !(this.flags & 32) || this.flags & 8 || sr(this);
  }
  run() {
    if (!(this.flags & 1))
      return this.fn();
    this.flags |= 2, yn(this), nr(this);
    const t = Y, s = Pe;
    Y = this, Pe = !0;
    try {
      return this.fn();
    } finally {
      rr(this), Y = t, Pe = s, this.flags &= -3;
    }
  }
  stop() {
    if (this.flags & 1) {
      for (let t = this.deps; t; t = t.nextDep)
        en(t);
      this.deps = this.depsTail = void 0, yn(this), this.onStop && this.onStop(), this.flags &= -2;
    }
  }
  trigger() {
    this.flags & 64 ? Es.add(this) : this.scheduler ? this.scheduler() : this.runIfDirty();
  }
  /**
   * @internal
   */
  runIfDirty() {
    js(this) && this.run();
  }
  get dirty() {
    return js(this);
  }
}
let tr = 0, Rt, Ft;
function sr(e, t = !1) {
  if (e.flags |= 8, t) {
    e.next = Ft, Ft = e;
    return;
  }
  e.next = Rt, Rt = e;
}
function Zs() {
  tr++;
}
function Qs() {
  if (--tr > 0)
    return;
  if (Ft) {
    let t = Ft;
    for (Ft = void 0; t; ) {
      const s = t.next;
      t.next = void 0, t.flags &= -9, t = s;
    }
  }
  let e;
  for (; Rt; ) {
    let t = Rt;
    for (Rt = void 0; t; ) {
      const s = t.next;
      if (t.next = void 0, t.flags &= -9, t.flags & 1)
        try {
          t.trigger();
        } catch (n) {
          e || (e = n);
        }
      t = s;
    }
  }
  if (e) throw e;
}
function nr(e) {
  for (let t = e.deps; t; t = t.nextDep)
    t.version = -1, t.prevActiveLink = t.dep.activeLink, t.dep.activeLink = t;
}
function rr(e) {
  let t, s = e.depsTail, n = s;
  for (; n; ) {
    const r = n.prevDep;
    n.version === -1 ? (n === s && (s = r), en(n), gi(n)) : t = n, n.dep.activeLink = n.prevActiveLink, n.prevActiveLink = void 0, n = r;
  }
  e.deps = t, e.depsTail = s;
}
function js(e) {
  for (let t = e.deps; t; t = t.nextDep)
    if (t.dep.version !== t.version || t.dep.computed && (ir(t.dep.computed) || t.dep.version !== t.version))
      return !0;
  return !!e._dirty;
}
function ir(e) {
  if (e.flags & 4 && !(e.flags & 16) || (e.flags &= -17, e.globalVersion === jt) || (e.globalVersion = jt, !e.isSSR && e.flags & 128 && (!e.deps && !e._dirty || !js(e))))
    return;
  e.flags |= 2;
  const t = e.dep, s = Y, n = Pe;
  Y = e, Pe = !0;
  try {
    nr(e);
    const r = e.fn(e._value);
    (t.version === 0 || ke(r, e._value)) && (e.flags |= 128, e._value = r, t.version++);
  } catch (r) {
    throw t.version++, r;
  } finally {
    Y = s, Pe = n, rr(e), e.flags &= -3;
  }
}
function en(e, t = !1) {
  const { dep: s, prevSub: n, nextSub: r } = e;
  if (n && (n.nextSub = r, e.prevSub = void 0), r && (r.prevSub = n, e.nextSub = void 0), s.subs === e && (s.subs = n, !n && s.computed)) {
    s.computed.flags &= -5;
    for (let i = s.computed.deps; i; i = i.nextDep)
      en(i, !0);
  }
  !t && !--s.sc && s.map && s.map.delete(s.key);
}
function gi(e) {
  const { prevDep: t, nextDep: s } = e;
  t && (t.nextDep = s, e.prevDep = void 0), s && (s.prevDep = t, e.nextDep = void 0);
}
let Pe = !0;
const lr = [];
function Ue() {
  lr.push(Pe), Pe = !1;
}
function We() {
  const e = lr.pop();
  Pe = e === void 0 ? !0 : e;
}
function yn(e) {
  const { cleanup: t } = e;
  if (e.cleanup = void 0, t) {
    const s = Y;
    Y = void 0;
    try {
      t();
    } finally {
      Y = s;
    }
  }
}
let jt = 0;
class _i {
  constructor(t, s) {
    this.sub = t, this.dep = s, this.version = s.version, this.nextDep = this.prevDep = this.nextSub = this.prevSub = this.prevActiveLink = void 0;
  }
}
class tn {
  // TODO isolatedDeclarations "__v_skip"
  constructor(t) {
    this.computed = t, this.version = 0, this.activeLink = void 0, this.subs = void 0, this.map = void 0, this.key = void 0, this.sc = 0, this.__v_skip = !0;
  }
  track(t) {
    if (!Y || !Pe || Y === this.computed)
      return;
    let s = this.activeLink;
    if (s === void 0 || s.sub !== Y)
      s = this.activeLink = new _i(Y, this), Y.deps ? (s.prevDep = Y.depsTail, Y.depsTail.nextDep = s, Y.depsTail = s) : Y.deps = Y.depsTail = s, or(s);
    else if (s.version === -1 && (s.version = this.version, s.nextDep)) {
      const n = s.nextDep;
      n.prevDep = s.prevDep, s.prevDep && (s.prevDep.nextDep = n), s.prevDep = Y.depsTail, s.nextDep = void 0, Y.depsTail.nextDep = s, Y.depsTail = s, Y.deps === s && (Y.deps = n);
    }
    return s;
  }
  trigger(t) {
    this.version++, jt++, this.notify(t);
  }
  notify(t) {
    Zs();
    try {
      for (let s = this.subs; s; s = s.prevSub)
        s.sub.notify() && s.sub.dep.notify();
    } finally {
      Qs();
    }
  }
}
function or(e) {
  if (e.dep.sc++, e.sub.flags & 4) {
    const t = e.dep.computed;
    if (t && !e.dep.subs) {
      t.flags |= 20;
      for (let n = t.deps; n; n = n.nextDep)
        or(n);
    }
    const s = e.dep.subs;
    s !== e && (e.prevSub = s, s && (s.nextSub = e)), e.dep.subs = e;
  }
}
const Hs = /* @__PURE__ */ new WeakMap(), dt = /* @__PURE__ */ Symbol(
  ""
), Ls = /* @__PURE__ */ Symbol(
  ""
), Ht = /* @__PURE__ */ Symbol(
  ""
);
function ue(e, t, s) {
  if (Pe && Y) {
    let n = Hs.get(e);
    n || Hs.set(e, n = /* @__PURE__ */ new Map());
    let r = n.get(s);
    r || (n.set(s, r = new tn()), r.map = n, r.key = s), r.track();
  }
}
function Qe(e, t, s, n, r, i) {
  const l = Hs.get(e);
  if (!l) {
    jt++;
    return;
  }
  const o = (f) => {
    f && f.trigger();
  };
  if (Zs(), t === "clear")
    l.forEach(o);
  else {
    const f = F(e), d = f && Xs(s);
    if (f && s === "length") {
      const a = Number(n);
      l.forEach((p, C) => {
        (C === "length" || C === Ht || !Ve(C) && C >= a) && o(p);
      });
    } else
      switch ((s !== void 0 || l.has(void 0)) && o(l.get(s)), d && o(l.get(Ht)), t) {
        case "add":
          f ? d && o(l.get("length")) : (o(l.get(dt)), rt(e) && o(l.get(Ls)));
          break;
        case "delete":
          f || (o(l.get(dt)), rt(e) && o(l.get(Ls)));
          break;
        case "set":
          rt(e) && o(l.get(dt));
          break;
      }
  }
  Qs();
}
function mt(e) {
  const t = /* @__PURE__ */ W(e);
  return t === e || (ue(t, "iterate", Ht), /* @__PURE__ */ Te(e)) ? t : /* @__PURE__ */ qe(e) ? /* @__PURE__ */ it(e) ? t.map((s) => lt(Ee(s))) : t.map(lt) : t.map(Ee);
}
function ms(e) {
  return ue(e = /* @__PURE__ */ W(e), "iterate", Ht), e;
}
function je(e, t) {
  return /* @__PURE__ */ qe(e) ? lt(/* @__PURE__ */ it(e) ? Ee(t) : t) : Ee(t);
}
const mi = {
  __proto__: null,
  [Symbol.iterator]() {
    return As(this, Symbol.iterator, (e) => je(this, e));
  },
  concat(...e) {
    return mt(this).concat(
      ...e.map((t) => F(t) ? mt(t) : t)
    );
  },
  entries() {
    return As(this, "entries", (e) => (e[1] = je(this, e[1]), e));
  },
  every(e, t) {
    return ze(this, "every", e, t, void 0, arguments);
  },
  filter(e, t) {
    return ze(
      this,
      "filter",
      e,
      t,
      (s) => s.map((n) => je(this, n)),
      arguments
    );
  },
  find(e, t) {
    return ze(
      this,
      "find",
      e,
      t,
      (s) => je(this, s),
      arguments
    );
  },
  findIndex(e, t) {
    return ze(this, "findIndex", e, t, void 0, arguments);
  },
  findLast(e, t) {
    return ze(
      this,
      "findLast",
      e,
      t,
      (s) => je(this, s),
      arguments
    );
  },
  findLastIndex(e, t) {
    return ze(this, "findLastIndex", e, t, void 0, arguments);
  },
  // flat, flatMap could benefit from ARRAY_ITERATE but are not straight-forward to implement
  forEach(e, t) {
    return ze(this, "forEach", e, t, void 0, arguments);
  },
  includes(...e) {
    return Os(this, "includes", e);
  },
  indexOf(...e) {
    return Os(this, "indexOf", e);
  },
  join(e) {
    return mt(this).join(e);
  },
  // keys() iterator only reads `length`, no optimization required
  lastIndexOf(...e) {
    return Os(this, "lastIndexOf", e);
  },
  map(e, t) {
    return ze(this, "map", e, t, void 0, arguments);
  },
  pop() {
    return At(this, "pop");
  },
  push(...e) {
    return At(this, "push", e);
  },
  reduce(e, ...t) {
    return Sn(this, "reduce", e, t);
  },
  reduceRight(e, ...t) {
    return Sn(this, "reduceRight", e, t);
  },
  shift() {
    return At(this, "shift");
  },
  // slice could use ARRAY_ITERATE but also seems to beg for range tracking
  some(e, t) {
    return ze(this, "some", e, t, void 0, arguments);
  },
  splice(...e) {
    return At(this, "splice", e);
  },
  toReversed() {
    return mt(this).toReversed();
  },
  toSorted(e) {
    return mt(this).toSorted(e);
  },
  toSpliced(...e) {
    return mt(this).toSpliced(...e);
  },
  unshift(...e) {
    return At(this, "unshift", e);
  },
  values() {
    return As(this, "values", (e) => je(this, e));
  }
};
function As(e, t, s) {
  const n = ms(e), r = n[t], i = r.call(n);
  if (n !== e && !/* @__PURE__ */ Te(e)) {
    if (i[Symbol.toStringTag] === "Array Iterator") {
      const l = Object.create(Object.getPrototypeOf(i));
      return l.next = () => xn(i.next(), s), r !== cr[t] && Object.defineProperties(l, {
        return: {
          get() {
            const o = i.return;
            return typeof o == "function" ? o.bind(i) : o;
          }
        },
        throw: {
          get() {
            const o = i.throw;
            return typeof o == "function" ? o.bind(i) : o;
          }
        }
      }), l;
    }
    i._next = i.next, i.next = () => xn(i._next(), s);
  }
  return i;
}
function xn(e, t) {
  return e.done || (e.value = t(e.value)), e;
}
const cr = Array.prototype;
function ze(e, t, s, n, r, i) {
  const l = ms(e), o = l !== e && !/* @__PURE__ */ Te(e), f = l[t];
  if (f !== cr[t]) {
    const p = f.apply(e, i);
    return o ? Ee(p) : p;
  }
  let d = s;
  l !== e && (o ? d = function(p, C) {
    return s.call(this, je(e, p), C, e);
  } : s.length > 2 && (d = function(p, C) {
    return s.call(this, p, C, e);
  }));
  const a = f.call(l, d, n);
  return o && r ? r(a) : a;
}
function Sn(e, t, s, n) {
  const r = ms(e), i = r !== e && !/* @__PURE__ */ Te(e);
  let l = s, o = !1;
  r !== e && (i ? (o = n.length === 0, l = function(d, a, p) {
    return o && (o = !1, d = je(e, d)), s.call(this, d, je(e, a), p, e);
  }) : s.length > 3 && (l = function(d, a, p) {
    return s.call(this, d, a, p, e);
  }));
  const f = r[t](l, ...n);
  return o ? je(e, f) : f;
}
function Os(e, t, s) {
  const n = /* @__PURE__ */ W(e);
  ue(n, "iterate", Ht);
  const r = n[t](...s);
  return (r === -1 || r === !1) && /* @__PURE__ */ ln(s[0]) ? (s[0] = /* @__PURE__ */ W(s[0]), n[t](...s)) : r;
}
function At(e, t, s = []) {
  Ue(), Zs();
  const n = (/* @__PURE__ */ W(e))[t].apply(e, s);
  return Qs(), We(), n;
}
const bi = /* @__PURE__ */ zs("__proto__,__v_isRef,__isVue"), fr = new Set(
  /* @__PURE__ */ Object.getOwnPropertyNames(Symbol).filter((e) => e !== "arguments" && e !== "caller").map((e) => Symbol[e]).filter(Ve)
);
function vi(e) {
  Ve(e) || (e = String(e));
  const t = /* @__PURE__ */ W(this);
  return ue(t, "has", e), t.hasOwnProperty(e);
}
class ur {
  constructor(t = !1, s = !1) {
    this._isReadonly = t, this._isShallow = s;
  }
  get(t, s, n) {
    if (s === "__v_skip") return t.__v_skip;
    const r = this._isReadonly, i = this._isShallow;
    if (s === "__v_isReactive")
      return !r;
    if (s === "__v_isReadonly")
      return r;
    if (s === "__v_isShallow")
      return i;
    if (s === "__v_raw")
      return n === (r ? i ? Pi : pr : i ? hr : dr).get(t) || // receiver is not the reactive proxy, but has the same prototype
      // this means the receiver is a user proxy of the reactive proxy
      Object.getPrototypeOf(t) === Object.getPrototypeOf(n) ? t : void 0;
    const l = F(t);
    if (!r) {
      let f;
      if (l && (f = mi[s]))
        return f;
      if (s === "hasOwnProperty")
        return vi;
    }
    const o = Reflect.get(
      t,
      s,
      // if this is a proxy wrapping a ref, return methods using the raw ref
      // as receiver so that we don't have to call `toRaw` on the ref in all
      // its class methods
      /* @__PURE__ */ ae(t) ? t : n
    );
    if ((Ve(s) ? fr.has(s) : bi(s)) || (r || ue(t, "get", s), i))
      return o;
    if (/* @__PURE__ */ ae(o)) {
      const f = l && Xs(s) ? o : o.value;
      return r && G(f) ? /* @__PURE__ */ Bs(f) : f;
    }
    return G(o) ? r ? /* @__PURE__ */ Bs(o) : /* @__PURE__ */ nn(o) : o;
  }
}
class ar extends ur {
  constructor(t = !1) {
    super(!1, t);
  }
  set(t, s, n, r) {
    let i = t[s];
    const l = F(t) && Xs(s);
    if (!this._isShallow) {
      const d = /* @__PURE__ */ qe(i);
      if (!/* @__PURE__ */ Te(n) && !/* @__PURE__ */ qe(n) && (i = /* @__PURE__ */ W(i), n = /* @__PURE__ */ W(n)), !l && /* @__PURE__ */ ae(i) && !/* @__PURE__ */ ae(n))
        return d || (i.value = n), !0;
    }
    const o = l ? Number(s) < t.length : K(t, s), f = Reflect.set(
      t,
      s,
      n,
      /* @__PURE__ */ ae(t) ? t : r
    );
    return t === /* @__PURE__ */ W(r) && f && (o ? ke(n, i) && Qe(t, "set", s, n) : Qe(t, "add", s, n)), f;
  }
  deleteProperty(t, s) {
    const n = K(t, s);
    t[s];
    const r = Reflect.deleteProperty(t, s);
    return r && n && Qe(t, "delete", s, void 0), r;
  }
  has(t, s) {
    const n = Reflect.has(t, s);
    return (!Ve(s) || !fr.has(s)) && ue(t, "has", s), n;
  }
  ownKeys(t) {
    return ue(
      t,
      "iterate",
      F(t) ? "length" : dt
    ), Reflect.ownKeys(t);
  }
}
class yi extends ur {
  constructor(t = !1) {
    super(!0, t);
  }
  set(t, s) {
    return !0;
  }
  deleteProperty(t, s) {
    return !0;
  }
}
const xi = /* @__PURE__ */ new ar(), Si = /* @__PURE__ */ new yi(), wi = /* @__PURE__ */ new ar(!0);
const ks = (e) => e, Jt = (e) => Reflect.getPrototypeOf(e);
function Ci(e, t, s) {
  return function(...n) {
    const r = this.__v_raw, i = /* @__PURE__ */ W(r), l = rt(i), o = e === "entries" || e === Symbol.iterator && l, f = e === "keys" && l, d = r[e](...n), a = s ? ks : t ? lt : Ee;
    return !t && ue(
      i,
      "iterate",
      f ? Ls : dt
    ), de(
      // inheriting all iterator properties
      Object.create(d),
      {
        // iterator protocol
        next() {
          const { value: p, done: C } = d.next();
          return C ? { value: p, done: C } : {
            value: o ? [a(p[0]), a(p[1])] : a(p),
            done: C
          };
        }
      }
    );
  };
}
function zt(e) {
  return function(...t) {
    return e === "delete" ? !1 : e === "clear" ? void 0 : this;
  };
}
function Ti(e, t) {
  const s = {
    get(r) {
      const i = this.__v_raw, l = /* @__PURE__ */ W(i), o = /* @__PURE__ */ W(r);
      e || (ke(r, o) && ue(l, "get", r), ue(l, "get", o));
      const { has: f } = Jt(l), d = t ? ks : e ? lt : Ee;
      if (f.call(l, r))
        return d(i.get(r));
      if (f.call(l, o))
        return d(i.get(o));
      i !== l && i.get(r);
    },
    get size() {
      const r = this.__v_raw;
      return !e && ue(/* @__PURE__ */ W(r), "iterate", dt), r.size;
    },
    has(r) {
      const i = this.__v_raw, l = /* @__PURE__ */ W(i), o = /* @__PURE__ */ W(r);
      return e || (ke(r, o) && ue(l, "has", r), ue(l, "has", o)), r === o ? i.has(r) : i.has(r) || i.has(o);
    },
    forEach(r, i) {
      const l = this, o = l.__v_raw, f = /* @__PURE__ */ W(o), d = t ? ks : e ? lt : Ee;
      return !e && ue(f, "iterate", dt), o.forEach((a, p) => r.call(i, d(a), d(p), l));
    }
  };
  return de(
    s,
    e ? {
      add: zt("add"),
      set: zt("set"),
      delete: zt("delete"),
      clear: zt("clear")
    } : {
      add(r) {
        const i = /* @__PURE__ */ W(this), l = Jt(i), o = /* @__PURE__ */ W(r), f = !t && !/* @__PURE__ */ Te(r) && !/* @__PURE__ */ qe(r) ? o : r;
        return l.has.call(i, f) || ke(r, f) && l.has.call(i, r) || ke(o, f) && l.has.call(i, o) || (i.add(f), Qe(i, "add", f, f)), this;
      },
      set(r, i) {
        !t && !/* @__PURE__ */ Te(i) && !/* @__PURE__ */ qe(i) && (i = /* @__PURE__ */ W(i));
        const l = /* @__PURE__ */ W(this), { has: o, get: f } = Jt(l);
        let d = o.call(l, r);
        d || (r = /* @__PURE__ */ W(r), d = o.call(l, r));
        const a = f.call(l, r);
        return l.set(r, i), d ? ke(i, a) && Qe(l, "set", r, i) : Qe(l, "add", r, i), this;
      },
      delete(r) {
        const i = /* @__PURE__ */ W(this), { has: l, get: o } = Jt(i);
        let f = l.call(i, r);
        f || (r = /* @__PURE__ */ W(r), f = l.call(i, r)), o && o.call(i, r);
        const d = i.delete(r);
        return f && Qe(i, "delete", r, void 0), d;
      },
      clear() {
        const r = /* @__PURE__ */ W(this), i = r.size !== 0, l = r.clear();
        return i && Qe(
          r,
          "clear",
          void 0,
          void 0
        ), l;
      }
    }
  ), [
    "keys",
    "values",
    "entries",
    Symbol.iterator
  ].forEach((r) => {
    s[r] = Ci(r, e, t);
  }), s;
}
function sn(e, t) {
  const s = Ti(e, t);
  return (n, r, i) => r === "__v_isReactive" ? !e : r === "__v_isReadonly" ? e : r === "__v_isShallow" ? t : r === "__v_raw" ? n : Reflect.get(
    K(s, r) && r in n ? s : n,
    r,
    i
  );
}
const Ei = {
  get: /* @__PURE__ */ sn(!1, !1)
}, Ai = {
  get: /* @__PURE__ */ sn(!1, !0)
}, Oi = {
  get: /* @__PURE__ */ sn(!0, !1)
};
const dr = /* @__PURE__ */ new WeakMap(), hr = /* @__PURE__ */ new WeakMap(), pr = /* @__PURE__ */ new WeakMap(), Pi = /* @__PURE__ */ new WeakMap();
function Mi(e) {
  switch (e) {
    case "Object":
    case "Array":
      return 1;
    case "Map":
    case "Set":
    case "WeakMap":
    case "WeakSet":
      return 2;
    default:
      return 0;
  }
}
// @__NO_SIDE_EFFECTS__
function nn(e) {
  return /* @__PURE__ */ qe(e) ? e : rn(
    e,
    !1,
    xi,
    Ei,
    dr
  );
}
// @__NO_SIDE_EFFECTS__
function Ii(e) {
  return rn(
    e,
    !1,
    wi,
    Ai,
    hr
  );
}
// @__NO_SIDE_EFFECTS__
function Bs(e) {
  return rn(
    e,
    !0,
    Si,
    Oi,
    pr
  );
}
function rn(e, t, s, n, r) {
  if (!G(e) || e.__v_raw && !(t && e.__v_isReactive) || e.__v_skip || !Object.isExtensible(e))
    return e;
  const i = r.get(e);
  if (i)
    return i;
  const l = Mi(ti(e));
  if (l === 0)
    return e;
  const o = new Proxy(
    e,
    l === 2 ? n : s
  );
  return r.set(e, o), o;
}
// @__NO_SIDE_EFFECTS__
function it(e) {
  return /* @__PURE__ */ qe(e) ? /* @__PURE__ */ it(e.__v_raw) : !!(e && e.__v_isReactive);
}
// @__NO_SIDE_EFFECTS__
function qe(e) {
  return !!(e && e.__v_isReadonly);
}
// @__NO_SIDE_EFFECTS__
function Te(e) {
  return !!(e && e.__v_isShallow);
}
// @__NO_SIDE_EFFECTS__
function ln(e) {
  return e ? !!e.__v_raw : !1;
}
// @__NO_SIDE_EFFECTS__
function W(e) {
  const t = e && e.__v_raw;
  return t ? /* @__PURE__ */ W(t) : e;
}
function Ri(e) {
  return !K(e, "__v_skip") && Object.isExtensible(e) && Yn(e, "__v_skip", !0), e;
}
const Ee = (e) => G(e) ? /* @__PURE__ */ nn(e) : e, lt = (e) => G(e) ? /* @__PURE__ */ Bs(e) : e;
// @__NO_SIDE_EFFECTS__
function ae(e) {
  return e ? e.__v_isRef === !0 : !1;
}
// @__NO_SIDE_EFFECTS__
function bt(e) {
  return Fi(e, !1);
}
function Fi(e, t) {
  return /* @__PURE__ */ ae(e) ? e : new Ni(e, t);
}
class Ni {
  constructor(t, s) {
    this.dep = new tn(), this.__v_isRef = !0, this.__v_isShallow = !1, this._rawValue = s ? t : /* @__PURE__ */ W(t), this._value = s ? t : Ee(t), this.__v_isShallow = s;
  }
  get value() {
    return this.dep.track(), this._value;
  }
  set value(t) {
    const s = this._rawValue, n = this.__v_isShallow || /* @__PURE__ */ Te(t) || /* @__PURE__ */ qe(t);
    t = n ? t : /* @__PURE__ */ W(t), ke(t, s) && (this._rawValue = t, this._value = n ? t : Ee(t), this.dep.trigger());
  }
}
function $i(e) {
  return /* @__PURE__ */ ae(e) ? e.value : e;
}
const Di = {
  get: (e, t, s) => t === "__v_raw" ? e : $i(Reflect.get(e, t, s)),
  set: (e, t, s, n) => {
    const r = e[t];
    return /* @__PURE__ */ ae(r) && !/* @__PURE__ */ ae(s) ? (r.value = s, !0) : Reflect.set(e, t, s, n);
  }
};
function gr(e) {
  return /* @__PURE__ */ it(e) ? e : new Proxy(e, Di);
}
class ji {
  constructor(t, s, n) {
    this.fn = t, this.setter = s, this._value = void 0, this.dep = new tn(this), this.__v_isRef = !0, this.deps = void 0, this.depsTail = void 0, this.flags = 16, this.globalVersion = jt - 1, this.next = void 0, this.effect = this, this.__v_isReadonly = !s, this.isSSR = n;
  }
  /**
   * @internal
   */
  notify() {
    if (this.flags |= 16, !(this.flags & 8) && // avoid infinite self recursion
    Y !== this)
      return sr(this, !0), !0;
  }
  get value() {
    const t = this.dep.track();
    return ir(this), t && (t.version = this.dep.version), this._value;
  }
  set value(t) {
    this.setter && this.setter(t);
  }
}
// @__NO_SIDE_EFFECTS__
function Hi(e, t, s = !1) {
  let n, r;
  return D(e) ? n = e : (n = e.get, r = e.set), new ji(n, r, s);
}
const Yt = {}, ss = /* @__PURE__ */ new WeakMap();
let ut;
function Li(e, t = !1, s = ut) {
  if (s) {
    let n = ss.get(s);
    n || ss.set(s, n = []), n.push(e);
  }
}
function ki(e, t, s = X) {
  const { immediate: n, deep: r, once: i, scheduler: l, augmentJob: o, call: f } = s, d = (P) => r ? P : /* @__PURE__ */ Te(P) || r === !1 || r === 0 ? nt(P, 1) : nt(P);
  let a, p, C, O, V = !1, R = !1;
  if (/* @__PURE__ */ ae(e) ? (p = () => e.value, V = /* @__PURE__ */ Te(e)) : /* @__PURE__ */ it(e) ? (p = () => d(e), V = !0) : F(e) ? (R = !0, V = e.some((P) => /* @__PURE__ */ it(P) || /* @__PURE__ */ Te(P)), p = () => e.map((P) => {
    if (/* @__PURE__ */ ae(P))
      return P.value;
    if (/* @__PURE__ */ it(P))
      return d(P);
    if (D(P))
      return f ? f(P, 2) : P();
  })) : D(e) ? t ? p = f ? () => f(e, 2) : e : p = () => {
    if (C) {
      Ue();
      try {
        C();
      } finally {
        We();
      }
    }
    const P = ut;
    ut = a;
    try {
      return f ? f(e, 3, [O]) : e(O);
    } finally {
      ut = P;
    }
  } : p = Ke, t && r) {
    const P = p, se = r === !0 ? 1 / 0 : r;
    p = () => nt(P(), se);
  }
  const ee = pi(), q = () => {
    a.stop(), ee && ee.active && Ys(ee.effects, a);
  };
  if (i && t) {
    const P = t;
    t = (...se) => {
      try {
        return P(...se);
      } finally {
        q();
      }
    };
  }
  let j = R ? new Array(e.length).fill(Yt) : Yt;
  const k = (P) => {
    if (!(!(a.flags & 1) || !a.dirty && !P))
      if (t) {
        const se = a.run();
        if (P || r || V || (R ? se.some((we, fe) => ke(we, j[fe])) : ke(se, j))) {
          const we = ut;
          Ue();
          try {
            C && C(), ut = a;
            const fe = [
              se,
              // pass undefined as the old value when it's changed for the first time
              j === Yt ? void 0 : R && j[0] === Yt ? [] : j,
              O
            ];
            j = se, f ? f(t, 3, fe) : (
              // @ts-expect-error
              t(...fe)
            );
          } finally {
            ut = we, We();
          }
        }
      } else
        a.run();
  };
  return o && o(k), a = new er(p), a.scheduler = l ? () => l(k, !1) : k, O = (P) => Li(P, !1, a), C = a.onStop = () => {
    const P = ss.get(a);
    if (P) {
      if (f)
        f(P, 4);
      else
        for (const se of P) se();
      ss.delete(a);
    }
  }, t ? n ? k(!0) : j = a.run() : l ? l(k.bind(null, !0), !0) : a.run(), q.pause = a.pause.bind(a), q.resume = a.resume.bind(a), q.stop = q, q;
}
function nt(e, t = 1 / 0, s) {
  if (t <= 0 || !G(e) || e.__v_skip || (s = s || /* @__PURE__ */ new Map(), (s.get(e) || 0) >= t))
    return e;
  if (s.set(e, t), t--, /* @__PURE__ */ ae(e))
    nt(e.value, t, s);
  else if (F(e))
    for (let n = 0; n < e.length; n++)
      nt(e[n], t, s);
  else if (ts(e) || rt(e))
    e.forEach((n) => {
      nt(n, t, s);
    });
  else if (Jn(e)) {
    for (const n in e)
      nt(e[n], t, s);
    for (const n of Object.getOwnPropertySymbols(e))
      Object.prototype.propertyIsEnumerable.call(e, n) && nt(e[n], t, s);
  }
  return e;
}
function Wt(e, t, s, n) {
  try {
    return n ? e(...n) : e();
  } catch (r) {
    bs(r, t, s);
  }
}
function Me(e, t, s, n) {
  if (D(e)) {
    const r = Wt(e, t, s, n);
    return r && qn(r) && r.catch((i) => {
      bs(i, t, s);
    }), r;
  }
  if (F(e)) {
    const r = [];
    for (let i = 0; i < e.length; i++)
      r.push(Me(e[i], t, s, n));
    return r;
  }
}
function bs(e, t, s, n = !0) {
  const r = t ? t.vnode : null, { errorHandler: i, throwUnhandledErrorInProduction: l } = t && t.appContext.config || X;
  if (t) {
    let o = t.parent;
    const f = t.proxy, d = `https://vuejs.org/error-reference/#runtime-${s}`;
    for (; o; ) {
      const a = o.ec;
      if (a) {
        for (let p = 0; p < a.length; p++)
          if (a[p](e, f, d) === !1)
            return;
      }
      o = o.parent;
    }
    if (i) {
      Ue(), Wt(i, null, 10, [
        e,
        f,
        d
      ]), We();
      return;
    }
  }
  Bi(e, s, r, n, l);
}
function Bi(e, t, s, n = !0, r = !1) {
  if (r)
    throw e;
  console.error(e);
}
const pe = [];
let Ae = -1;
const He = [];
let tt = null, yt = 0;
const _r = /* @__PURE__ */ Promise.resolve();
let ns = null;
function Ki(e) {
  const t = ns || _r;
  return e ? t.then(this ? e.bind(this) : e) : t;
}
function Vi(e) {
  let t = Ae + 1, s = pe.length;
  for (; t < s; ) {
    const n = t + s >>> 1, r = pe[n], i = Lt(r);
    i < e || i === e && r.flags & 2 ? t = n + 1 : s = n;
  }
  return t;
}
function on(e) {
  if (!(e.flags & 1)) {
    const t = Lt(e), s = pe[pe.length - 1];
    !s || // fast path when the job id is larger than the tail
    !(e.flags & 2) && t >= Lt(s) ? pe.push(e) : pe.splice(Vi(t), 0, e), e.flags |= 1, mr();
  }
}
function mr() {
  ns || (ns = _r.then(yr));
}
function Ui(e) {
  if (!F(e))
    tt && e.id === -1 ? tt.splice(yt + 1, 0, e) : e.flags & 1 || (He.push(e), e.flags |= 1);
  else
    for (let t = 0; t < e.length; t++)
      He.push(e[t]);
  mr();
}
function br(e, t, s, n = Ae + 1) {
  for (; n < pe.length; n++) {
    const r = pe[n];
    if (r && r.flags & 2) {
      if (e && r.id !== e.uid || t !== void 0 && !(r.id >= t))
        continue;
      pe.splice(n, 1), n = e ? n - 1 : Ae, r.flags & 4 && (r.flags &= -2), r(), r.flags & 4 || (r.flags &= -2);
    }
  }
}
function vr(e, t, s = 0) {
  if (He.length) {
    let n = He, r = 0;
    if (t) {
      n = [];
      for (let l = 0; l < He.length; l++) {
        const o = He[l];
        (o.i !== void 0 ? !o.i || o.i.uid < s : t.has(o)) ? He[r++] = o : n.push(o);
      }
    }
    const i = [...new Set(n)].sort((l, o) => Lt(l) - Lt(o));
    if (He.length = r, tt) {
      for (let l = 0; l < i.length; l++)
        tt.push(i[l]);
      return;
    }
    for (tt = i, yt = 0; yt < tt.length; yt++) {
      const l = tt[yt];
      l.flags & 4 && (l.flags &= -2), l.flags & 8 || l(), l.flags &= -2;
    }
    tt = null, yt = 0;
  }
}
let Ps = !1;
function Wi(e, t) {
  if (Ps) {
    e();
    return;
  }
  const s = t === void 0 ? void 0 : new Set(He);
  e(), Ps = !0;
  try {
    br(void 0, t), vr(void 0, s, t);
  } finally {
    Ps = !1;
  }
}
const Lt = (e) => e.id == null ? e.flags & 2 ? -1 : 1 / 0 : e.id;
function yr(e) {
  try {
    for (Ae = 0; Ae < pe.length; Ae++) {
      const t = pe[Ae];
      t && !(t.flags & 8) && (t.flags & 4 && (t.flags &= -2), Wt(
        t,
        t.i,
        t.i ? 15 : 14
      ), t.flags & 4 || (t.flags &= -2));
    }
  } finally {
    for (; Ae < pe.length; Ae++) {
      const t = pe[Ae];
      t && (t.flags &= -2);
    }
    Ae = -1, pe.length = 0, vr(), ns = null, (pe.length || He.length) && yr();
  }
}
let Be = null, xr = null;
function rs(e) {
  const t = Be;
  return Be = e, xr = e && e.type.__scopeId || null, t;
}
function qi(e, t = Be, s) {
  if (!t || e._n)
    return e;
  const n = (...r) => {
    n._d && cs(-1);
    const i = rs(t), l = ht.length;
    let o;
    try {
      o = e(...r);
    } finally {
      for (let f = ht.length; f > l; f--) Gr();
      rs(i), n._d && cs(1);
    }
    return o;
  };
  return n._n = !0, n._c = !0, n._d = !0, n;
}
function ct(e, t, s, n) {
  const r = e.dirs, i = t && t.dirs;
  for (let l = 0; l < r.length; l++) {
    const o = r[l];
    i && (o.oldValue = i[l].value);
    let f = o.dir[n];
    f && (Ue(), Me(f, s, 8, [
      e.el,
      o,
      e,
      t
    ]), We());
  }
}
function Gi(e, t) {
  if (ge) {
    let s = ge.provides;
    const n = ge.parent && ge.parent.provides;
    n === s && (s = ge.provides = Object.create(n)), s[e] = t;
  }
}
function Zt(e, t, s = !1) {
  const n = Vl();
  if (n || xt) {
    let r = xt ? xt._context.provides : n ? n.parent == null || n.ce ? n.vnode.appContext && n.vnode.appContext.provides : n.parent.provides : void 0;
    if (r && e in r)
      return r[e];
    if (arguments.length > 1)
      return s && D(t) ? t.call(n && n.proxy) : t;
  }
}
const Ji = /* @__PURE__ */ Symbol.for("v-scx"), zi = () => Zt(Ji);
function Ms(e, t, s) {
  return Sr(e, t, s);
}
function Sr(e, t, s = X) {
  const { immediate: n, deep: r, flush: i, once: l } = s, o = de({}, s), f = t && n || !t && i !== "post";
  let d;
  if (Vt) {
    if (i === "sync") {
      const O = zi();
      d = O.__watcherHandles || (O.__watcherHandles = []);
    } else if (!f) {
      const O = () => {
      };
      return O.stop = Ke, O.resume = Ke, O.pause = Ke, O;
    }
  }
  const a = ge;
  o.call = (O, V, R) => Me(O, a, V, R);
  let p = !1;
  i === "post" ? o.scheduler = (O) => {
    O.i = a, _e(O, a && a.suspense);
  } : i !== "sync" && (p = !0, o.scheduler = (O, V) => {
    V ? O() : on(O);
  }), o.augmentJob = (O) => {
    t && (O.flags |= 4), p && (O.flags |= 2, a && (O.id = a.uid, O.i = a));
  };
  const C = ki(e, t, o);
  return Vt && (d ? d.push(C) : f && C()), C;
}
function Yi(e, t, s) {
  const n = this.proxy, r = ne(e) ? e.includes(".") ? wr(n, e) : () => n[e] : e.bind(n, n);
  let i;
  D(t) ? i = t : (i = t.handler, s = t);
  const l = qt(this), o = Sr(r, i.bind(n), s);
  return l(), o;
}
function wr(e, t) {
  const s = t.split(".");
  return () => {
    let n = e;
    for (let r = 0; r < s.length && n; r++)
      n = n[s[r]];
    return n;
  };
}
const Xi = /* @__PURE__ */ Symbol("_vte"), vs = (e) => e.__isTeleport, Is = /* @__PURE__ */ Symbol("_leaveCb");
function Zi(e) {
  let t = e[0];
  if (e.length > 1) {
    for (const s of e)
      if (s.type !== Ie) {
        t = s;
        break;
      }
  }
  return t;
}
function Cr(e) {
  if (!cn(e))
    return vs(e.type) && e.children ? Zi(e.children) : e;
  if (e.component)
    return e.component.subTree;
  const { shapeFlag: t, children: s } = e;
  if (s) {
    if (t & 16)
      return s[0];
    if (t & 32 && D(s.default))
      return s.default();
  }
}
function is(e, t) {
  if (e.shapeFlag & 6 && e.component) {
    e.transition = t;
    const s = e.component.subTree;
    is(
      vs(s.type) && Cr(s) || s,
      t
    );
  } else if (e.shapeFlag & 128)
    e.ssContent.transition = t.clone(e.ssContent), e.ssFallback.transition = t.clone(e.ssFallback);
  else if (e.transition = t, e.type === ce && F(e.children)) {
    const s = Nr(e.children, !1);
    s && is(s, t);
  }
}
function Ks(e) {
  if (e.component)
    return Ks(e.component.subTree);
  if (e.type === ce) {
    const t = F(e.children) && Nr(e.children, !1);
    return t ? Ks(t) : void 0;
  }
  if (e.type !== Ie)
    return e;
}
function Tr(e) {
  e.ids = [e.ids[0] + e.ids[2]++ + "-", 0, 0];
}
function wn(e, t) {
  let s;
  return !!((s = Object.getOwnPropertyDescriptor(e, t)) && !s.configurable);
}
const ls = /* @__PURE__ */ new WeakMap();
function Nt(e, t, s, n, r = !1) {
  if (F(e)) {
    e.forEach(
      (R, ee) => Nt(
        R,
        t && (F(t) ? t[ee] : t),
        s,
        n,
        r
      )
    );
    return;
  }
  if ($t(n) && !r) {
    n.shapeFlag & 512 && n.type.__asyncResolved && n.component.subTree.component && Nt(e, t, s, n.component.subTree);
    return;
  }
  const i = n.shapeFlag & 4 ? an(n.component) : n.el, l = r ? null : i, { i: o, r: f } = e, d = t && t.r, a = o.refs === X ? o.refs = {} : o.refs, p = o.setupState, C = /* @__PURE__ */ W(p), O = p === X ? Wn : (R) => wn(a, R) ? !1 : K(C, R), V = (R, ee) => !(ee && wn(a, ee));
  if (d != null && d !== f) {
    if (Cn(t), ne(d))
      a[d] = null, O(d) && (p[d] = null);
    else if (/* @__PURE__ */ ae(d)) {
      const R = t;
      V(d, R.k) && (d.value = null), R.k && (a[R.k] = null);
    }
  }
  if (D(f))
    Wt(f, o, 12, [l, a]);
  else {
    const R = ne(f), ee = /* @__PURE__ */ ae(f);
    if (R || ee) {
      const q = () => {
        if (e.f) {
          const j = R ? O(f) ? p[f] : a[f] : V() || !e.k ? f.value : a[e.k];
          if (r)
            F(j) && Ys(j, i);
          else if (F(j))
            j.includes(i) || j.push(i);
          else if (R)
            a[f] = [i], O(f) && (p[f] = a[f]);
          else {
            const k = [i];
            V(f, e.k) && (f.value = k), e.k && (a[e.k] = k);
          }
        } else R ? (a[f] = l, O(f) && (p[f] = l)) : ee && (V(f, e.k) && (f.value = l), e.k && (a[e.k] = l));
      };
      if (l) {
        const j = () => {
          q(), ls.delete(e);
        };
        j.id = -1, ls.set(e, j), _e(j, s);
      } else
        Cn(e), q();
    }
  }
}
function Cn(e) {
  const t = ls.get(e);
  t && (t.flags |= 8, ls.delete(e));
}
ps().requestIdleCallback;
ps().cancelIdleCallback;
const $t = (e) => !!e.type.__asyncLoader, cn = (e) => e.type.__isKeepAlive;
function Qi(e, t) {
  Er(e, "a", t);
}
function el(e, t) {
  Er(e, "da", t);
}
function Er(e, t, s = ge) {
  const n = e.__wdc || (e.__wdc = () => {
    let r = s;
    for (; r; ) {
      if (r.isDeactivated)
        return;
      r = r.parent;
    }
    return e();
  });
  if (ys(t, n, s), s) {
    let r = s.parent;
    for (; r && r.parent; )
      cn(r.parent.vnode) && tl(n, t, s, r), r = r.parent;
  }
}
function tl(e, t, s, n) {
  const r = ys(
    t,
    e,
    n,
    !0
    /* prepend */
  );
  Pr(() => {
    Ys(n[t], r);
  }, s);
}
function ys(e, t, s = ge, n = !1) {
  if (s) {
    const r = s[e] || (s[e] = []), i = t.__weh || (t.__weh = (...l) => {
      Ue();
      const o = qt(s), f = Me(t, s, e, l);
      return o(), We(), f;
    });
    return n ? r.unshift(i) : r.push(i), i;
  }
}
const et = (e) => (t, s = ge) => {
  (!Vt || e === "sp") && ys(e, (...n) => t(...n), s);
}, sl = et("bm"), Ar = et("m"), nl = et(
  "bu"
), rl = et("u"), Or = et(
  "bum"
), Pr = et("um"), il = et(
  "sp"
), ll = et("rtg"), ol = et("rtc");
function cl(e, t = ge) {
  ys("ec", e, t);
}
const fl = /* @__PURE__ */ Symbol.for("v-ndc");
function vt(e, t, s, n) {
  let r;
  const i = s, l = F(e);
  if (l || ne(e)) {
    const o = l && /* @__PURE__ */ it(e);
    let f = !1, d = !1;
    o && (f = !/* @__PURE__ */ Te(e), d = /* @__PURE__ */ qe(e), e = ms(e)), r = new Array(e.length);
    for (let a = 0, p = e.length; a < p; a++)
      r[a] = t(
        f ? d ? lt(Ee(e[a])) : Ee(e[a]) : e[a],
        a,
        void 0,
        i
      );
  } else if (typeof e == "number")
    if (!Number.isInteger(e) || e < 0)
      r = [];
    else {
      r = new Array(e);
      for (let o = 0; o < e; o++)
        r[o] = t(o + 1, o, void 0, i);
    }
  else if (G(e))
    if (e[Symbol.iterator])
      r = Array.from(
        e,
        (o, f) => t(o, f, void 0, i)
      );
    else {
      const o = Object.keys(e);
      r = new Array(o.length);
      for (let f = 0, d = o.length; f < d; f++) {
        const a = o[f];
        r[f] = t(e[a], a, f, i);
      }
    }
  else
    r = [];
  return r;
}
const Vs = (e) => e ? Xr(e) ? an(e) : Vs(e.parent) : null, Dt = (
  // Move PURE marker to new line to workaround compiler discarding it
  // due to type annotation
  /* @__PURE__ */ de(/* @__PURE__ */ Object.create(null), {
    $: (e) => e,
    $el: (e) => e.vnode.el,
    $data: (e) => e.data,
    $props: (e) => e.props,
    $attrs: (e) => e.attrs,
    $slots: (e) => e.slots,
    $refs: (e) => e.refs,
    $parent: (e) => Vs(e.parent),
    $root: (e) => Vs(e.root),
    $host: (e) => e.ce,
    $emit: (e) => e.emit,
    $options: (e) => Ir(e),
    $forceUpdate: (e) => e.f || (e.f = () => {
      on(e.update);
    }),
    $nextTick: (e) => e.n || (e.n = Ki.bind(e.proxy)),
    $watch: (e) => Yi.bind(e)
  })
), Rs = (e, t) => e !== X && !e.__isScriptSetup && K(e, t), ul = {
  get({ _: e }, t) {
    if (t === "__v_skip")
      return !0;
    const { ctx: s, setupState: n, data: r, props: i, accessCache: l, type: o, appContext: f } = e;
    if (t[0] !== "$") {
      const C = l[t];
      if (C !== void 0)
        switch (C) {
          case 1:
            return n[t];
          case 2:
            return r[t];
          case 4:
            return s[t];
          case 3:
            return i[t];
        }
      else {
        if (Rs(n, t))
          return l[t] = 1, n[t];
        if (r !== X && K(r, t))
          return l[t] = 2, r[t];
        if (K(i, t))
          return l[t] = 3, i[t];
        if (s !== X && K(s, t))
          return l[t] = 4, s[t];
        Us && (l[t] = 0);
      }
    }
    const d = Dt[t];
    let a, p;
    if (d)
      return t === "$attrs" && ue(e.attrs, "get", ""), d(e);
    if (
      // css module (injected by vue-loader)
      (a = o.__cssModules) && (a = a[t])
    )
      return a;
    if (s !== X && K(s, t))
      return l[t] = 4, s[t];
    if (
      // global properties
      p = f.config.globalProperties, K(p, t)
    )
      return p[t];
  },
  set({ _: e }, t, s) {
    const { data: n, setupState: r, ctx: i } = e;
    return Rs(r, t) ? (r[t] = s, !0) : n !== X && K(n, t) ? (n[t] = s, !0) : K(e.props, t) || t[0] === "$" && t.slice(1) in e ? !1 : (i[t] = s, !0);
  },
  has({
    _: { data: e, setupState: t, accessCache: s, ctx: n, appContext: r, props: i, type: l }
  }, o) {
    let f;
    return !!(s[o] || e !== X && o[0] !== "$" && K(e, o) || Rs(t, o) || K(i, o) || K(n, o) || K(Dt, o) || K(r.config.globalProperties, o) || (f = l.__cssModules) && f[o]);
  },
  defineProperty(e, t, s) {
    return s.get != null ? e._.accessCache[t] = 0 : K(s, "value") && this.set(e, t, s.value, null), Reflect.defineProperty(e, t, s);
  }
};
function Tn(e) {
  return F(e) ? e.reduce(
    (t, s) => (t[s] = null, t),
    {}
  ) : e;
}
let Us = !0;
function al(e) {
  const t = Ir(e), s = e.proxy, n = e.ctx;
  Us = !1, t.beforeCreate && En(t.beforeCreate, e, "bc");
  const {
    // state
    data: r,
    computed: i,
    methods: l,
    watch: o,
    provide: f,
    inject: d,
    // lifecycle
    created: a,
    beforeMount: p,
    mounted: C,
    beforeUpdate: O,
    updated: V,
    activated: R,
    deactivated: ee,
    beforeDestroy: q,
    beforeUnmount: j,
    destroyed: k,
    unmounted: P,
    render: se,
    renderTracked: we,
    renderTriggered: fe,
    errorCaptured: me,
    serverPrefetch: Ge,
    // public API
    expose: Je,
    inheritAttrs: te,
    // assets
    components: ot,
    directives: gt,
    filters: wt
  } = t;
  if (d && dl(d, n, null), l)
    for (const Z in l) {
      const U = l[Z];
      D(U) && (n[Z] = U.bind(s));
    }
  if (r) {
    const Z = r.call(s, s);
    G(Z) && (e.data = /* @__PURE__ */ nn(Z));
  }
  if (Us = !0, i)
    for (const Z in i) {
      const U = i[Z], Ce = D(U) ? U.bind(s, s) : D(U.get) ? U.get.bind(s, s) : Ke, _t = !D(U) && D(U.set) ? U.set.bind(s) : Ke, Re = ye({
        get: Ce,
        set: _t
      });
      Object.defineProperty(n, Z, {
        enumerable: !0,
        configurable: !0,
        get: () => Re.value,
        set: (A) => Re.value = A
      });
    }
  if (o)
    for (const Z in o)
      Mr(o[Z], n, s, Z);
  if (f) {
    const Z = D(f) ? f.call(s) : f;
    Reflect.ownKeys(Z).forEach((U) => {
      Gi(U, Z[U]);
    });
  }
  a && En(a, e, "c");
  function ie(Z, U) {
    F(U) ? U.forEach((Ce) => Z(Ce.bind(s))) : U && Z(U.bind(s));
  }
  if (ie(sl, p), ie(Ar, C), ie(nl, O), ie(rl, V), ie(Qi, R), ie(el, ee), ie(cl, me), ie(ol, we), ie(ll, fe), ie(Or, j), ie(Pr, P), ie(il, Ge), F(Je))
    if (Je.length) {
      const Z = e.exposed || (e.exposed = {});
      Je.forEach((U) => {
        Object.defineProperty(Z, U, {
          get: () => s[U],
          set: (Ce) => s[U] = Ce,
          enumerable: !0
        });
      });
    } else e.exposed || (e.exposed = {});
  se && e.render === Ke && (e.render = se), te != null && (e.inheritAttrs = te), ot && (e.components = ot), gt && (e.directives = gt), Ge && Tr(e);
}
function dl(e, t, s = Ke) {
  F(e) && (e = Ws(e));
  for (const n in e) {
    const r = e[n];
    let i;
    G(r) ? "default" in r ? i = Zt(
      r.from || n,
      r.default,
      !0
    ) : i = Zt(r.from || n) : i = Zt(r), /* @__PURE__ */ ae(i) ? Object.defineProperty(t, n, {
      enumerable: !0,
      configurable: !0,
      get: () => i.value,
      set: (l) => i.value = l
    }) : t[n] = i;
  }
}
function En(e, t, s) {
  Me(
    F(e) ? e.map((n) => n.bind(t.proxy)) : e.bind(t.proxy),
    t,
    s
  );
}
function Mr(e, t, s, n) {
  let r = n.includes(".") ? wr(s, n) : () => s[n];
  if (ne(e)) {
    const i = t[e];
    D(i) && Ms(r, i);
  } else if (D(e))
    Ms(r, e.bind(s));
  else if (G(e))
    if (F(e))
      e.forEach((i) => Mr(i, t, s, n));
    else {
      const i = D(e.handler) ? e.handler.bind(s) : t[e.handler];
      D(i) && Ms(r, i, e);
    }
}
function Ir(e) {
  const t = e.type, { mixins: s, extends: n } = t, {
    mixins: r,
    optionsCache: i,
    config: { optionMergeStrategies: l }
  } = e.appContext, o = i.get(t);
  let f;
  return o ? f = o : !r.length && !s && !n ? f = t : (f = {}, r.length && r.forEach(
    (d) => os(f, d, l, !0)
  ), os(f, t, l)), G(t) && i.set(t, f), f;
}
function os(e, t, s, n = !1) {
  const { mixins: r, extends: i } = t;
  i && os(e, i, s, !0), r && r.forEach(
    (l) => os(e, l, s, !0)
  );
  for (const l in t)
    if (!(n && l === "expose")) {
      const o = hl[l] || s && s[l];
      e[l] = o ? o(e[l], t[l]) : t[l];
    }
  return e;
}
const hl = {
  data: An,
  props: On,
  emits: On,
  // objects
  methods: Pt,
  computed: Pt,
  // lifecycle
  beforeCreate: he,
  created: he,
  beforeMount: he,
  mounted: he,
  beforeUpdate: he,
  updated: he,
  beforeDestroy: he,
  beforeUnmount: he,
  destroyed: he,
  unmounted: he,
  activated: he,
  deactivated: he,
  errorCaptured: he,
  serverPrefetch: he,
  // assets
  components: Pt,
  directives: Pt,
  // watch
  watch: gl,
  // provide / inject
  provide: An,
  inject: pl
};
function An(e, t) {
  return t ? e ? function() {
    return de(
      D(e) ? e.call(this, this) : e,
      D(t) ? t.call(this, this) : t
    );
  } : t : e;
}
function pl(e, t) {
  return Pt(Ws(e), Ws(t));
}
function Ws(e) {
  if (F(e)) {
    const t = {};
    for (let s = 0; s < e.length; s++)
      t[e[s]] = e[s];
    return t;
  }
  return e;
}
function he(e, t) {
  return e ? [...new Set([].concat(e, t))] : t;
}
function Pt(e, t) {
  return e ? de(/* @__PURE__ */ Object.create(null), e, t) : t;
}
function On(e, t) {
  return e ? F(e) && F(t) ? [.../* @__PURE__ */ new Set([...e, ...t])] : de(
    /* @__PURE__ */ Object.create(null),
    Tn(e),
    Tn(t ?? {})
  ) : t;
}
function gl(e, t) {
  if (!e) return t;
  if (!t) return e;
  const s = de(/* @__PURE__ */ Object.create(null), e);
  for (const n in t)
    s[n] = he(e[n], t[n]);
  return s;
}
function Rr() {
  return {
    app: null,
    config: {
      isNativeTag: Wn,
      performance: !1,
      globalProperties: {},
      optionMergeStrategies: {},
      errorHandler: void 0,
      warnHandler: void 0,
      compilerOptions: {}
    },
    mixins: [],
    components: {},
    directives: {},
    provides: /* @__PURE__ */ Object.create(null),
    optionsCache: /* @__PURE__ */ new WeakMap(),
    propsCache: /* @__PURE__ */ new WeakMap(),
    emitsCache: /* @__PURE__ */ new WeakMap()
  };
}
let _l = 0;
function ml(e, t) {
  return function(n, r = null) {
    D(n) || (n = de({}, n)), r != null && !G(r) && (r = null);
    const i = Rr(), l = /* @__PURE__ */ new WeakSet(), o = [];
    let f = !1;
    const d = i.app = {
      _uid: _l++,
      _component: n,
      _props: r,
      _container: null,
      _context: i,
      _instance: null,
      version: Yl,
      get config() {
        return i.config;
      },
      set config(a) {
      },
      use(a, ...p) {
        return l.has(a) || (a && D(a.install) ? (l.add(a), a.install(d, ...p)) : D(a) && (l.add(a), a(d, ...p))), d;
      },
      mixin(a) {
        return i.mixins.includes(a) || i.mixins.push(a), d;
      },
      component(a, p) {
        return p ? (i.components[a] = p, d) : i.components[a];
      },
      directive(a, p) {
        return p ? (i.directives[a] = p, d) : i.directives[a];
      },
      mount(a, p, C) {
        if (!f) {
          const O = d._ceVNode || Se(n, r);
          return O.appContext = i, C === !0 ? C = "svg" : C === !1 && (C = void 0), e(O, a, C), f = !0, d._container = a, a.__vue_app__ = d, an(O.component);
        }
      },
      onUnmount(a) {
        o.push(a);
      },
      unmount() {
        f && (Me(
          o,
          d._instance,
          16
        ), e(null, d._container), delete d._container.__vue_app__);
      },
      provide(a, p) {
        return i.provides[a] = p, d;
      },
      runWithContext(a) {
        const p = xt;
        xt = d;
        try {
          return a();
        } finally {
          xt = p;
        }
      }
    };
    return d;
  };
}
let xt = null;
const bl = (e, t) => t === "modelValue" || t === "model-value" ? e.modelModifiers : e[`${t}Modifiers`] || e[`${Oe(t)}Modifiers`] || e[`${pt(t)}Modifiers`];
function vl(e, t, ...s) {
  if (e.isUnmounted) return;
  const n = e.vnode.props || X;
  let r = s;
  const i = t.startsWith("update:"), l = i && bl(n, t.slice(7));
  l && (l.trim && (r = s.map((a) => ne(a) ? a.trim() : a)), l.number && (r = r.map(ri)));
  let o, f = n[o = ws(t)] || // also try camelCase event handler (#2249)
  n[o = ws(Oe(t))];
  !f && i && (f = n[o = ws(pt(t))]), f && Me(
    f,
    e,
    6,
    r
  );
  const d = n[o + "Once"];
  if (d) {
    if (!e.emitted)
      e.emitted = {};
    else if (e.emitted[o])
      return;
    e.emitted[o] = !0, Me(
      d,
      e,
      6,
      r
    );
  }
}
const yl = /* @__PURE__ */ new WeakMap();
function Fr(e, t, s = !1) {
  const n = s ? yl : t.emitsCache, r = n.get(e);
  if (r !== void 0)
    return r;
  const i = e.emits;
  let l = {}, o = !1;
  if (!D(e)) {
    const f = (d) => {
      const a = Fr(d, t, !0);
      a && (o = !0, de(l, a));
    };
    !s && t.mixins.length && t.mixins.forEach(f), e.extends && f(e.extends), e.mixins && e.mixins.forEach(f);
  }
  return !i && !o ? (G(e) && n.set(e, null), null) : (F(i) ? i.forEach((f) => l[f] = null) : de(l, i), G(e) && n.set(e, l), l);
}
function xs(e, t) {
  return !e || !as(t) ? !1 : (t = t.slice(2), t = t === "Once" ? t : t.replace(/Once$/, ""), K(e, t[0].toLowerCase() + t.slice(1)) || K(e, pt(t)) || K(e, t));
}
function Pn(e) {
  const {
    type: t,
    vnode: s,
    proxy: n,
    withProxy: r,
    propsOptions: [i],
    slots: l,
    attrs: o,
    emit: f,
    render: d,
    renderCache: a,
    props: p,
    data: C,
    setupState: O,
    ctx: V,
    inheritAttrs: R
  } = e, ee = rs(e);
  let q, j;
  try {
    if (s.shapeFlag & 4) {
      const P = r || n, se = P;
      q = Le(
        d.call(
          se,
          P,
          a,
          p,
          O,
          C,
          V
        )
      ), j = o;
    } else {
      const P = t;
      q = Le(
        P.length > 1 ? P(
          p,
          { attrs: o, slots: l, emit: f }
        ) : P(
          p,
          null
        )
      ), j = t.props ? o : xl(o);
    }
  } catch (P) {
    ht.length = 0, bs(P, e, 1), q = Se(Ie);
  }
  let k = q;
  if (j && R !== !1) {
    const P = Object.keys(j), { shapeFlag: se } = k;
    P.length && se & 7 && (i && P.some(ds) && (j = Sl(
      j,
      i
    )), k = St(k, j, !1, !0));
  }
  if (s.dirs && (k = St(k, null, !1, !0), k.dirs = k.dirs ? k.dirs.concat(s.dirs) : s.dirs), s.transition) {
    const P = vs(k.type) && Cr(k) || k;
    is(P, s.transition);
  }
  return q = k, rs(ee), q;
}
function Nr(e, t = !0) {
  let s;
  for (let n = 0; n < e.length; n++) {
    const r = e[n];
    if (Bt(r)) {
      if (r.type !== Ie || r.children === "v-if") {
        if (s)
          return;
        s = r;
      }
    } else
      return;
  }
  return s;
}
const xl = (e) => {
  let t;
  for (const s in e)
    (s === "class" || s === "style" || as(s)) && ((t || (t = {}))[s] = e[s]);
  return t;
}, Sl = (e, t) => {
  const s = {};
  for (const n in e)
    (!ds(n) || !(n.slice(9) in t)) && (s[n] = e[n]);
  return s;
};
function wl(e, t, s) {
  const { props: n, children: r, component: i } = e, { props: l, children: o, patchFlag: f } = t, d = i.emitsOptions;
  if (t.dirs || t.transition)
    return !0;
  if (s && f >= 0) {
    if (f & 1024)
      return !0;
    if (f & 16)
      return n ? Mn(n, l, d) : !!l;
    if (f & 8) {
      const a = t.dynamicProps;
      for (let p = 0; p < a.length; p++) {
        const C = a[p];
        if ($r(l, n, C) && !xs(d, C))
          return !0;
      }
    }
  } else
    return (r || o) && (!o || !o.$stable) ? !0 : n === l ? !1 : n ? l ? Mn(n, l, d) : !0 : !!l;
  return !1;
}
function Mn(e, t, s) {
  const n = Object.keys(t);
  if (n.length !== Object.keys(e).length)
    return !0;
  for (let r = 0; r < n.length; r++) {
    const i = n[r];
    if (!K(e, i) || $r(t, e, i) && !xs(s, i))
      return !0;
  }
  return !1;
}
function $r(e, t, s) {
  const n = e[s], r = t[s];
  return s === "style" && G(n) && G(r) ? !_s(n, r) : n !== r;
}
function Cl({ vnode: e, parent: t, suspense: s }, n) {
  for (; t; ) {
    const r = t.subTree;
    if (r.suspense && r.suspense.activeBranch === e && (r.suspense.vnode.el = r.el = n, e = r), r === e)
      (e = t.vnode).el = n, t = t.parent;
    else
      break;
  }
  s && s.activeBranch === e && (s.vnode.el = n);
}
const Dr = {}, jr = () => Object.create(Dr), Hr = (e) => Object.getPrototypeOf(e) === Dr;
function Tl(e, t, s, n = !1) {
  const r = {}, i = jr();
  e.propsDefaults = /* @__PURE__ */ Object.create(null), Lr(e, t, r, i);
  for (const l in e.propsOptions[0])
    l in r || (r[l] = void 0);
  s ? e.props = n ? r : /* @__PURE__ */ Ii(r) : e.type.props ? e.props = r : e.props = i, e.attrs = i;
}
function El(e, t, s, n) {
  const {
    props: r,
    attrs: i,
    vnode: { patchFlag: l }
  } = e, o = /* @__PURE__ */ W(r), [f] = e.propsOptions;
  let d = !1;
  if (
    // always force full diff in dev
    // - #1942 if hmr is enabled with sfc component
    // - vite#872 non-sfc component used by sfc component
    (n || l > 0) && !(l & 16)
  ) {
    if (l & 8) {
      const a = e.vnode.dynamicProps;
      for (let p = 0; p < a.length; p++) {
        let C = a[p];
        if (xs(e.emitsOptions, C))
          continue;
        const O = t[C];
        if (f)
          if (K(i, C))
            O !== i[C] && (i[C] = O, d = !0);
          else {
            const V = Oe(C);
            r[V] = qs(
              f,
              o,
              V,
              O,
              e,
              !1
            );
          }
        else
          O !== i[C] && (i[C] = O, d = !0);
      }
    }
  } else {
    Lr(e, t, r, i) && (d = !0);
    let a;
    for (const p in o)
      (!t || // for camelCase
      !K(t, p) && // it's possible the original props was passed in as kebab-case
      // and converted to camelCase (#955)
      ((a = pt(p)) === p || !K(t, a))) && (f ? s && // for camelCase
      (s[p] !== void 0 || // for kebab-case
      s[a] !== void 0) && (r[p] = qs(
        f,
        o,
        p,
        void 0,
        e,
        !0
      )) : delete r[p]);
    if (i !== o)
      for (const p in i)
        (!t || !K(t, p)) && (delete i[p], d = !0);
  }
  d && Qe(e.attrs, "set", "");
}
function Lr(e, t, s, n) {
  const [r, i] = e.propsOptions;
  let l = !1, o;
  if (t)
    for (let f in t) {
      if (It(f))
        continue;
      const d = t[f];
      let a;
      r && K(r, a = Oe(f)) ? !i || !i.includes(a) ? s[a] = d : (o || (o = {}))[a] = d : xs(e.emitsOptions, f) || (!(f in n) || d !== n[f]) && (n[f] = d, l = !0);
    }
  if (i) {
    const f = /* @__PURE__ */ W(s), d = o || X;
    for (let a = 0; a < i.length; a++) {
      const p = i[a];
      s[p] = qs(
        r,
        f,
        p,
        d[p],
        e,
        !K(d, p)
      );
    }
  }
  return l;
}
function qs(e, t, s, n, r, i) {
  const l = e[s];
  if (l != null) {
    const o = K(l, "default");
    if (o && n === void 0) {
      const f = l.default;
      if (l.type !== Function && !l.skipFactory && D(f)) {
        const { propsDefaults: d } = r;
        if (s in d)
          n = d[s];
        else {
          const a = qt(r);
          n = d[s] = f.call(
            null,
            t
          ), a();
        }
      } else
        n = f;
      r.ce && r.ce._setProp(s, n);
    }
    l[
      0
      /* shouldCast */
    ] && (i && !o ? n = !1 : l[
      1
      /* shouldCastTrue */
    ] && (n === "" || n === pt(s)) && (n = !0));
  }
  return n;
}
const Al = /* @__PURE__ */ new WeakMap();
function kr(e, t, s = !1) {
  const n = s ? Al : t.propsCache, r = n.get(e);
  if (r)
    return r;
  const i = e.props, l = {}, o = [];
  let f = !1;
  if (!D(e)) {
    const a = (p) => {
      f = !0;
      const [C, O] = kr(p, t, !0);
      de(l, C), O && o.push(...O);
    };
    !s && t.mixins.length && t.mixins.forEach(a), e.extends && a(e.extends), e.mixins && e.mixins.forEach(a);
  }
  if (!i && !f)
    return G(e) && n.set(e, at), at;
  if (F(i))
    for (let a = 0; a < i.length; a++) {
      const p = Oe(i[a]);
      In(p) && (l[p] = X);
    }
  else if (i)
    for (const a in i) {
      const p = Oe(a);
      if (In(p)) {
        const C = i[a], O = l[p] = F(C) || D(C) ? { type: C } : de({}, C), V = O.type;
        let R = !1, ee = !0;
        if (F(V))
          for (let q = 0; q < V.length; ++q) {
            const j = V[q], k = D(j) && j.name;
            if (k === "Boolean") {
              R = !0;
              break;
            } else k === "String" && (ee = !1);
          }
        else
          R = D(V) && V.name === "Boolean";
        O[
          0
          /* shouldCast */
        ] = R, O[
          1
          /* shouldCastTrue */
        ] = ee, (R || K(O, "default")) && o.push(p);
      }
    }
  const d = [l, o];
  return G(e) && n.set(e, d), d;
}
function In(e) {
  return e[0] !== "$" && !It(e);
}
const fn = (e) => e === "_" || e === "_ctx" || e === "$stable", un = (e) => F(e) ? e.map(Le) : [Le(e)], Ol = (e, t, s) => {
  if (t._n)
    return t;
  const n = qi((...r) => un(t(...r)), s);
  return n._c = !1, n;
}, Br = (e, t, s) => {
  const n = e._ctx;
  for (const r in e) {
    if (fn(r)) continue;
    const i = e[r];
    if (D(i))
      t[r] = Ol(r, i, n);
    else if (i != null) {
      const l = un(i);
      t[r] = () => l;
    }
  }
}, Kr = (e, t) => {
  const s = un(t);
  e.slots.default = () => s;
}, Vr = (e, t, s) => {
  for (const n in t)
    (s || !fn(n)) && (e[n] = t[n]);
}, Pl = (e, t, s) => {
  const n = e.slots = jr();
  if (e.vnode.shapeFlag & 32) {
    const r = t._;
    r ? (Vr(n, t, s), s && Yn(n, "_", r, !0)) : Br(t, n);
  } else t && Kr(e, t);
}, Ml = (e, t, s) => {
  const { vnode: n, slots: r } = e;
  let i = !0, l = X;
  if (n.shapeFlag & 32) {
    const o = t._;
    o ? s && o === 1 ? i = !1 : Vr(r, t, s) : (i = !t.$stable, Br(t, r)), l = t;
  } else t && (Kr(e, t), l = { default: 1 });
  if (i)
    for (const o in r)
      !fn(o) && l[o] == null && delete r[o];
}, _e = $l;
function Il(e) {
  return Rl(e);
}
function Rl(e, t) {
  const s = ps();
  s.__VUE__ = !0;
  const {
    insert: n,
    remove: r,
    patchProp: i,
    createElement: l,
    createText: o,
    createComment: f,
    setText: d,
    setElementText: a,
    parentNode: p,
    nextSibling: C,
    setScopeId: O = Ke,
    insertStaticContent: V
  } = e, R = (c, u, h, b = null, _ = null, m = null, x = void 0, y = null, v = !!u.dynamicChildren) => {
    if (c === u)
      return;
    c && !Ot(c, u) && (b = Gt(c), A(c, _, m, !0), c = null), u.patchFlag === -2 && (v = !1, u.dynamicChildren = null), u.dynamicChildren && c && c.dynamicChildren && c.dynamicChildren.hasOnce && (u.dynamicChildren === at && (u.dynamicChildren = []), u.dynamicChildren.hasOnce = !0);
    const { type: g, ref: M, shapeFlag: S } = u;
    switch (g) {
      case Ss:
        ee(c, u, h, b);
        break;
      case Ie:
        q(c, u, h, b);
        break;
      case Ns:
        c == null && j(u, h, b, x);
        break;
      case ce:
        ot(
          c,
          u,
          h,
          b,
          _,
          m,
          x,
          y,
          v
        );
        break;
      default:
        S & 1 ? se(
          c,
          u,
          h,
          b,
          _,
          m,
          x,
          y,
          v
        ) : S & 6 ? gt(
          c,
          u,
          h,
          b,
          _,
          m,
          x,
          y,
          v
        ) : (S & 64 || S & 128) && g.process(
          c,
          u,
          h,
          b,
          _,
          m,
          x,
          y,
          v,
          Tt
        );
    }
    M != null && _ ? Nt(M, c && c.ref, m, u || c, !u) : M == null && c && c.ref != null && Nt(c.ref, null, m, c, !0);
  }, ee = (c, u, h, b) => {
    if (c == null)
      n(
        u.el = o(u.children),
        h,
        b
      );
    else {
      const _ = u.el = c.el;
      u.children !== c.children && d(_, u.children);
    }
  }, q = (c, u, h, b) => {
    c == null ? n(
      u.el = f(u.children || ""),
      h,
      b
    ) : u.el = c.el;
  }, j = (c, u, h, b) => {
    [c.el, c.anchor] = V(
      c.children,
      u,
      h,
      b,
      c.el,
      c.anchor
    );
  }, k = ({ el: c, anchor: u }, h, b) => {
    let _;
    for (; c && c !== u; )
      _ = C(c), n(c, h, b), c = _;
    n(u, h, b);
  }, P = ({ el: c, anchor: u }) => {
    let h;
    for (; c && c !== u; )
      h = C(c), r(c), c = h;
    r(u);
  }, se = (c, u, h, b, _, m, x, y, v) => {
    if (u.type === "svg" ? x = "svg" : u.type === "math" && (x = "mathml"), c == null)
      we(
        u,
        h,
        b,
        _,
        m,
        x,
        y,
        v
      );
    else {
      const g = c.el && c.el._isVueCE ? c.el : null;
      try {
        g && g._beginPatch(), Ge(
          c,
          u,
          _,
          m,
          x,
          y,
          v
        );
      } finally {
        g && g._endPatch();
      }
    }
  }, we = (c, u, h, b, _, m, x, y) => {
    let v, g;
    const { props: M, shapeFlag: S, transition: I, dirs: N } = c;
    if (v = c.el = l(
      c.type,
      m,
      M && M.is,
      M
    ), S & 8 ? a(v, c.children) : S & 16 && me(
      c.children,
      v,
      null,
      b,
      _,
      Fs(c, m),
      x,
      y
    ), N && ct(c, null, b, "created"), fe(v, c, c.scopeId, x, b), M) {
      for (const z in M)
        z !== "value" && !It(z) && i(v, z, null, M[z], m, b);
      "value" in M && i(v, "value", null, M.value, m), (g = M.onVnodeBeforeMount) && De(g, b, c);
    }
    N && ct(c, null, b, "beforeMount");
    const H = Fl(_, I);
    H && I.beforeEnter(v), n(v, u, h), ((g = M && M.onVnodeMounted) || H || N) && _e(() => {
      g && De(g, b, c), H && I.enter(v), N && ct(c, null, b, "mounted");
    }, _);
  }, fe = (c, u, h, b, _) => {
    if (h && O(c, h), b)
      for (let m = 0; m < b.length; m++)
        O(c, b[m]);
    if (_) {
      let m = _.subTree;
      if (u === m || qr(m.type) && (m.ssContent === u || m.ssFallback === u)) {
        const x = _.vnode;
        fe(
          c,
          x,
          x.scopeId,
          x.slotScopeIds,
          _.parent
        );
      }
    }
  }, me = (c, u, h, b, _, m, x, y, v = 0) => {
    for (let g = v; g < c.length; g++) {
      const M = c[g] = y ? Ze(c[g]) : Le(c[g]);
      R(
        null,
        M,
        u,
        h,
        b,
        _,
        m,
        x,
        y
      );
    }
  }, Ge = (c, u, h, b, _, m, x) => {
    const y = u.el = c.el;
    let { patchFlag: v, dynamicChildren: g, dirs: M } = u;
    v |= c.patchFlag & 16;
    const S = c.props || X, I = u.props || X;
    let N;
    if (h && ft(h, !1), (N = I.onVnodeBeforeUpdate) && De(N, h, u, c), M && ct(u, c, h, "beforeUpdate"), h && ft(h, !0), // #6385 the old vnode may be a user-wrapped non-isomorphic block
    // Force full diff when block metadata is unstable.
    g && (!c.dynamicChildren || c.dynamicChildren.length !== g.length) && (v = 0, x = !1, g = null), (S.innerHTML && I.innerHTML == null || S.textContent && I.textContent == null) && a(y, ""), g ? Je(
      c.dynamicChildren,
      g,
      y,
      h,
      b,
      Fs(u, _),
      m
    ) : x || U(
      c,
      u,
      y,
      null,
      h,
      b,
      Fs(u, _),
      m,
      !1
    ), v > 0) {
      if (v & 16)
        te(y, S, I, h, _);
      else if (v & 2 && S.class !== I.class && i(y, "class", null, I.class, _), v & 4 && i(y, "style", S.style, I.style, _), v & 8) {
        const H = u.dynamicProps;
        for (let z = 0; z < H.length; z++) {
          const J = H[z], re = S[J], le = I[J];
          (le !== re || J === "value") && i(y, J, re, le, _, h);
        }
      }
      v & 1 && c.children !== u.children && a(y, u.children);
    } else !x && g == null && te(y, S, I, h, _);
    ((N = I.onVnodeUpdated) || M) && _e(() => {
      N && De(N, h, u, c), M && ct(u, c, h, "updated");
    }, b);
  }, Je = (c, u, h, b, _, m, x) => {
    for (let y = 0; y < u.length; y++) {
      const v = c[y], g = u[y], M = v.el || Gs(v), S = (
        // oldVNode may be an errored async setup() component inside Suspense
        // which will not have a mounted element
        M && // - In the case of a Fragment, we need to provide the actual parent
        // of the Fragment itself so it can move its children.
        (v.type === ce || // - In the case of different nodes, there is going to be a replacement
        // which also requires the correct parent container
        !Ot(v, g) || // - In the case of a component, it could contain anything.
        v.shapeFlag & 198) ? p(M) : (
          // In other cases, the parent container is not actually used so we
          // just pass the block element here to avoid a DOM parentNode call.
          h
        )
      );
      R(
        v,
        g,
        S,
        null,
        b,
        _,
        m,
        x,
        !0
      );
    }
  }, te = (c, u, h, b, _) => {
    if (u !== h) {
      if (u !== X)
        for (const m in u)
          !It(m) && !(m in h) && i(
            c,
            m,
            u[m],
            null,
            _,
            b
          );
      for (const m in h) {
        if (It(m)) continue;
        const x = h[m], y = u[m];
        x !== y && m !== "value" && i(c, m, y, x, _, b);
      }
      "value" in h && i(c, "value", u.value, h.value, _);
    }
  }, ot = (c, u, h, b, _, m, x, y, v) => {
    const g = u.el = c ? c.el : o(""), M = u.anchor = c ? c.anchor : o("");
    let { patchFlag: S, dynamicChildren: I, slotScopeIds: N } = u;
    N && (y = y ? y.concat(N) : N), c == null ? (n(g, h, b), n(M, h, b), me(
      // #10007
      // such fragment like `<></>` will be compiled into
      // a fragment which doesn't have a children.
      // In this case fallback to an empty array
      u.children || [],
      h,
      M,
      _,
      m,
      x,
      y,
      v
    )) : S > 0 && S & 64 && I && // #2715 the previous fragment could've been a BAILed one as a result
    // of renderSlot() with no valid children
    c.dynamicChildren && c.dynamicChildren.length === I.length ? (Je(
      c.dynamicChildren,
      I,
      h,
      _,
      m,
      x,
      y
    ), // #2080 if the stable fragment has a key, it's a <template v-for> that may
    //  get moved around. Make sure all root level vnodes inherit el.
    // #2134 or if it's a component root, it may also get moved around
    // as the component is being moved.
    (u.key != null || _ && u === _.subTree) && Ur(
      c,
      u,
      !0
      /* shallow */
    )) : U(
      c,
      u,
      h,
      M,
      _,
      m,
      x,
      y,
      v
    );
  }, gt = (c, u, h, b, _, m, x, y, v) => {
    u.slotScopeIds = y, c == null ? u.shapeFlag & 512 ? _.ctx.activate(
      u,
      h,
      b,
      x,
      v
    ) : wt(
      u,
      h,
      b,
      _,
      m,
      x,
      v
    ) : Ct(c, u, v);
  }, wt = (c, u, h, b, _, m, x) => {
    const y = c.component = Kl(
      c,
      b,
      _
    );
    if (cn(c) && (y.ctx.renderer = Tt), Ul(y, !1, x), y.asyncDep) {
      if (_ && _.registerDep(
        y,
        ie,
        x,
        m
      ), !c.el) {
        const v = y.subTree = Se(Ie);
        q(null, v, u, h), c.placeholder = v.el;
      }
    } else
      ie(
        y,
        c,
        u,
        h,
        _,
        m,
        x
      );
  }, Ct = (c, u, h) => {
    const b = u.component = c.component;
    if (wl(c, u, h))
      if (b.asyncDep && !b.asyncResolved) {
        u.el = c.el, u.placeholder = c.placeholder, Z(b, u, h);
        return;
      } else
        b.next = u, b.update();
    else
      u.el = c.el, u.placeholder = c.placeholder, b.vnode = u;
  }, ie = (c, u, h, b, _, m, x) => {
    const y = () => {
      if (c.isMounted) {
        let { next: S, bu: I, u: N, parent: H, vnode: z } = c;
        {
          const Ne = Wr(c);
          if (Ne) {
            S && (S.el = z.el, Z(c, S, x)), Ne.asyncDep.then(() => {
              _e(() => {
                c.isUnmounted || g();
              }, _);
            });
            return;
          }
        }
        let J = S, re;
        ft(c, !1), S ? (S.el = z.el, Z(c, S, x)) : S = z, I && Cs(I), (re = S.props && S.props.onVnodeBeforeUpdate) && De(re, H, S, z), ft(c, !0);
        const le = Pn(c), Fe = c.subTree;
        c.subTree = le, R(
          Fe,
          le,
          // parent may have changed if it's in a teleport
          p(Fe.el),
          // anchor may have changed if it's in a fragment
          Gt(Fe),
          c,
          _,
          m
        ), S.el = le.el, J === null && Cl(c, le.el), N && _e(N, _), (re = S.props && S.props.onVnodeUpdated) && _e(
          () => De(re, H, S, z),
          _
        );
      } else {
        let S;
        const { el: I, props: N } = u, { bm: H, m: z, parent: J, root: re, type: le } = c, Fe = $t(u);
        ft(c, !1), H && Cs(H), !Fe && (S = N && N.onVnodeBeforeMount) && De(S, J, u), ft(c, !0);
        {
          re.ce && re.ce._hasShadowRoot() && re.ce._injectChildStyle(
            le,
            c.parent ? c.parent.type : void 0
          );
          const Ne = c.subTree = Pn(c);
          R(
            null,
            Ne,
            h,
            b,
            c,
            _,
            m
          ), u.el = Ne.el;
        }
        if (z && _e(z, _), !Fe && (S = N && N.onVnodeMounted)) {
          const Ne = u;
          _e(
            () => De(S, J, Ne),
            _
          );
        }
        (u.shapeFlag & 256 || J && $t(J.vnode) && J.vnode.shapeFlag & 256) && c.a && _e(c.a, _), c.isMounted = !0, u = h = b = null;
      }
    };
    c.scope.on();
    const v = c.effect = new er(y);
    c.scope.off();
    const g = c.update = v.run.bind(v), M = c.job = v.runIfDirty.bind(v);
    M.i = c, M.id = c.uid, v.scheduler = () => on(M), ft(c, !0), g();
  }, Z = (c, u, h) => {
    u.component = c;
    const b = c.vnode.props;
    c.vnode = u, c.next = null, El(c, u.props, b, h), Ml(c, u.children, h), Ue(), br(c), We();
  }, U = (c, u, h, b, _, m, x, y, v = !1) => {
    const g = c && c.children, M = c ? c.shapeFlag : 0, S = u.children, { patchFlag: I, shapeFlag: N } = u;
    if (I > 0) {
      if (I & 128) {
        _t(
          g,
          S,
          h,
          b,
          _,
          m,
          x,
          y,
          v
        );
        return;
      } else if (I & 256) {
        Ce(
          g,
          S,
          h,
          b,
          _,
          m,
          x,
          y,
          v
        );
        return;
      }
    }
    N & 8 ? (M & 16 && be(g, _, m), S !== g && a(h, S)) : M & 16 ? N & 16 ? _t(
      g,
      S,
      h,
      b,
      _,
      m,
      x,
      y,
      v
    ) : be(g, _, m, !0) : (M & 8 && a(h, ""), N & 16 && me(
      S,
      h,
      b,
      _,
      m,
      x,
      y,
      v
    ));
  }, Ce = (c, u, h, b, _, m, x, y, v) => {
    c = c || at, u = u || at;
    const g = c.length, M = u.length, S = Math.min(g, M);
    let I;
    for (I = 0; I < S; I++) {
      const N = u[I] = v ? Ze(u[I]) : Le(u[I]);
      R(
        c[I],
        N,
        h,
        null,
        _,
        m,
        x,
        y,
        v
      );
    }
    g > M ? be(
      c,
      _,
      m,
      !0,
      !1,
      S
    ) : me(
      u,
      h,
      b,
      _,
      m,
      x,
      y,
      v,
      S
    );
  }, _t = (c, u, h, b, _, m, x, y, v) => {
    let g = 0;
    const M = u.length;
    let S = c.length - 1, I = M - 1;
    for (; g <= S && g <= I; ) {
      const N = c[g], H = u[g] = v ? Ze(u[g]) : Le(u[g]);
      if (Ot(N, H))
        R(
          N,
          H,
          h,
          null,
          _,
          m,
          x,
          y,
          v
        );
      else
        break;
      g++;
    }
    for (; g <= S && g <= I; ) {
      const N = c[S], H = u[I] = v ? Ze(u[I]) : Le(u[I]);
      if (Ot(N, H))
        R(
          N,
          H,
          h,
          null,
          _,
          m,
          x,
          y,
          v
        );
      else
        break;
      S--, I--;
    }
    if (g > S) {
      if (g <= I) {
        const N = I + 1, H = N < M ? u[N].el : b;
        for (; g <= I; )
          R(
            null,
            u[g] = v ? Ze(u[g]) : Le(u[g]),
            h,
            H,
            _,
            m,
            x,
            y,
            v
          ), g++;
      }
    } else if (g > I)
      for (; g <= S; )
        A(c[g], _, m, !0), g++;
    else {
      const N = g, H = g, z = /* @__PURE__ */ new Map();
      for (g = H; g <= I; g++) {
        const ve = u[g] = v ? Ze(u[g]) : Le(u[g]);
        ve.key != null && z.set(ve.key, g);
      }
      let J, re = 0;
      const le = I - H + 1;
      let Fe = !1, Ne = 0;
      const Et = new Array(le);
      for (g = 0; g < le; g++) Et[g] = 0;
      for (g = N; g <= S; g++) {
        const ve = c[g];
        if (re >= le) {
          A(ve, _, m, !0);
          continue;
        }
        let $e;
        if (ve.key != null)
          $e = z.get(ve.key);
        else
          for (J = H; J <= I; J++)
            if (Et[J - H] === 0 && Ot(ve, u[J])) {
              $e = J;
              break;
            }
        $e === void 0 ? A(ve, _, m, !0) : (Et[$e - H] = g + 1, $e >= Ne ? Ne = $e : Fe = !0, R(
          ve,
          u[$e],
          h,
          null,
          _,
          m,
          x,
          y,
          v
        ), re++);
      }
      const hn = Fe ? Nl(Et) : at;
      for (J = hn.length - 1, g = le - 1; g >= 0; g--) {
        const ve = H + g, $e = u[ve], pn = u[ve + 1], gn = ve + 1 < M ? (
          // #13559, #14173 fallback to el placeholder for unresolved async component
          pn.el || Gs(pn)
        ) : b;
        Et[g] === 0 ? R(
          null,
          $e,
          h,
          gn,
          _,
          m,
          x,
          y,
          v
        ) : Fe && (J < 0 || g !== hn[J] ? Re($e, h, gn, 2) : J--);
      }
    }
  }, Re = (c, u, h, b, _ = null) => {
    const { el: m, type: x, transition: y, children: v, shapeFlag: g } = c;
    if (g & 6) {
      Re(c.component.subTree, u, h, b);
      return;
    }
    if (g & 128) {
      c.suspense.move(u, h, b);
      return;
    }
    if (g & 64) {
      x.move(c, u, h, Tt);
      return;
    }
    if (x === ce) {
      n(m, u, h);
      for (let S = 0; S < v.length; S++)
        Re(v[S], u, h, b);
      n(c.anchor, u, h);
      return;
    }
    if (x === Ns) {
      k(c, u, h);
      return;
    }
    if (b !== 2 && g & 1 && y)
      if (b === 0)
        y.persisted && !m[Is] ? n(m, u, h) : (y.beforeEnter(m), n(m, u, h), _e(() => y.enter(m), _));
      else {
        const { leave: S, delayLeave: I, afterLeave: N } = y, H = () => {
          c.ctx.isUnmounted ? r(m) : n(m, u, h);
        }, z = () => {
          const J = m._isLeaving || !!m[Is];
          m._isLeaving && m[Is](
            !0
            /* cancelled */
          ), y.persisted && !J ? H() : S(m, () => {
            H(), N && N();
          });
        };
        I ? I(m, H, z) : z();
      }
    else
      n(m, u, h);
  }, A = (c, u, h, b = !1, _ = !1) => {
    const {
      type: m,
      props: x,
      ref: y,
      children: v,
      dynamicChildren: g,
      shapeFlag: M,
      patchFlag: S,
      dirs: I,
      cacheIndex: N,
      memo: H
    } = c;
    if ((S === -2 || g && g.hasOnce) && (_ = !1), y != null && (Ue(), Nt(y, null, h, c, !0), We()), N != null && (!c.ctx || c.ctx === u) && (u.renderCache[N] = void 0), M & 256) {
      u.ctx.deactivate(c);
      return;
    }
    const z = M & 1 && I, J = !$t(c);
    let re;
    if (J && (re = x && x.onVnodeBeforeUnmount) && De(re, u, c), M & 6)
      Q(c.component, h, b);
    else {
      if (M & 128) {
        c.suspense.unmount(h, b);
        return;
      }
      z && ct(c, null, u, "beforeUnmount"), M & 64 ? c.type.remove(
        c,
        u,
        h,
        Tt,
        b
      ) : g && // #5154
      // when v-once is used inside a block, setBlockTracking(-1) marks the
      // parent block with hasOnce: true
      // so that it doesn't take the fast path during unmount - otherwise
      // components nested in v-once are never unmounted.
      !g.hasOnce && // #1153: fast path should not be taken for non-stable (v-for) fragments
      (m !== ce || S > 0 && S & 64) ? be(
        g,
        u,
        h,
        !1,
        !0
      ) : (m === ce && S & 384 || !_ && M & 16) && be(v, u, h), b && w(c);
    }
    const le = H != null && N == null;
    (J && (re = x && x.onVnodeUnmounted) || z || le) && _e(() => {
      re && De(re, u, c), z && ct(c, null, u, "unmounted"), le && (c.el = null);
    }, h);
  }, w = (c) => {
    const { type: u, el: h, anchor: b, transition: _ } = c, m = u === ce;
    if (m && !_) {
      T(h, b);
      return;
    }
    if (u === Ns) {
      P(c), _ && !_.persisted && _.afterLeave && _.afterLeave();
      return;
    }
    const x = m ? Ks(c) : c, y = () => {
      m ? p(h) && T(h, b) : r(h), _ && !_.persisted && _.afterLeave && _.afterLeave();
    };
    if (x && x.shapeFlag & 1 && _ && !_.persisted) {
      const { leave: v, delayLeave: g } = _, M = x.el, S = () => v(M, y);
      g ? g(M, y, S) : S();
    } else
      y();
  }, T = (c, u) => {
    let h;
    for (; c !== u; )
      h = C(c), r(c), c = h;
    r(u);
  }, Q = (c, u, h) => {
    const { bum: b, scope: _, job: m, subTree: x, um: y, m: v, a: g } = c;
    Rn(v), Rn(g), b && Cs(b), _.stop(), m ? (m.flags |= 8, A(x, c, u, h)) : c.vnode.el && x && (x.transition = c.vnode.transition, A(x, c, u, h)), y && _e(y, u), _e(() => {
      c.isUnmounted = !0;
    }, u);
  }, be = (c, u, h, b = !1, _ = !1, m = 0) => {
    for (let x = m; x < c.length; x++)
      A(c[x], u, h, b, _);
  }, Gt = (c) => {
    if (c.shapeFlag & 6)
      return Gt(c.component.subTree);
    if (c.shapeFlag & 128)
      return c.suspense.next();
    const u = C(c.anchor || c.el), h = u && u[Xi];
    return h ? C(h) : u;
  }, dn = (c, u, h) => {
    const b = c && u._vnode ? void 0 : c && c.component ? c.component.uid : Bl();
    Wi(() => {
      c == null ? u._vnode && A(u._vnode, null, null, !0) : R(
        u._vnode || null,
        c,
        u,
        null,
        null,
        null,
        h
      ), u._vnode = c;
    }, b);
  }, Tt = {
    p: R,
    um: A,
    m: Re,
    r: w,
    mt: wt,
    mc: me,
    pc: U,
    pbc: Je,
    n: Gt,
    o: e
  };
  return {
    render: dn,
    hydrate: void 0,
    createApp: ml(dn)
  };
}
function Fs({ type: e, props: t }, s) {
  return s === "svg" && e === "foreignObject" || s === "mathml" && e === "annotation-xml" && t && t.encoding && t.encoding.includes("html") ? void 0 : s;
}
function ft({ effect: e, job: t }, s) {
  s ? (e.flags |= 32, t.flags |= 4) : (e.flags &= -33, t.flags &= -5);
}
function Fl(e, t) {
  return (!e || e && !e.pendingBranch) && t && !t.persisted;
}
function Ur(e, t, s = !1) {
  const n = e.children, r = t.children;
  if (F(n) && F(r))
    for (let i = 0; i < n.length; i++) {
      const l = n[i];
      let o = r[i];
      o.shapeFlag & 1 && !o.dynamicChildren && ((o.patchFlag <= 0 || o.patchFlag === 32) && (o = r[i] = Ze(r[i]), o.el = l.el), !s && o.patchFlag !== -2 && Ur(l, o)), o.type === Ss && (o.patchFlag === -1 && (o = r[i] = Ze(o)), o.el = l.el), o.type === Ie && !o.el && (o.el = l.el);
    }
}
function Nl(e) {
  const t = e.slice(), s = [0];
  let n, r, i, l, o;
  const f = e.length;
  for (n = 0; n < f; n++) {
    const d = e[n];
    if (d !== 0) {
      if (r = s[s.length - 1], e[r] < d) {
        t[n] = r, s.push(n);
        continue;
      }
      for (i = 0, l = s.length - 1; i < l; )
        o = i + l >> 1, e[s[o]] < d ? i = o + 1 : l = o;
      d < e[s[i]] && (i > 0 && (t[n] = s[i - 1]), s[i] = n);
    }
  }
  for (i = s.length, l = s[i - 1]; i-- > 0; )
    s[i] = l, l = t[l];
  return s;
}
function Wr(e) {
  const t = e.subTree.component;
  if (t)
    return t.asyncDep && !t.asyncResolved ? t : Wr(t);
}
function Rn(e) {
  if (e)
    for (let t = 0; t < e.length; t++)
      e[t].flags |= 8;
}
function Gs(e) {
  if (e.placeholder)
    return e.placeholder;
  const t = e.component;
  return t ? Gs(t.subTree) : null;
}
const qr = (e) => e.__isSuspense;
function $l(e, t) {
  t && t.pendingBranch ? F(e) ? t.effects.push(...e) : t.effects.push(e) : Ui(e);
}
const ce = /* @__PURE__ */ Symbol.for("v-fgt"), Ss = /* @__PURE__ */ Symbol.for("v-txt"), Ie = /* @__PURE__ */ Symbol.for("v-cmt"), Ns = /* @__PURE__ */ Symbol.for("v-stc"), ht = [];
let xe = null;
function L(e = !1) {
  ht.push(xe = e ? null : []);
}
function Gr() {
  ht.pop(), xe = ht[ht.length - 1] || null;
}
let kt = 1;
function cs(e, t = !1) {
  kt += e, e < 0 && xe && t && (xe.hasOnce = !0);
}
function Jr(e) {
  return e.dynamicChildren = kt > 0 ? xe || at : null, Gr(), kt > 0 && xe && xe.push(e), e;
}
function B(e, t, s, n, r, i) {
  return Jr(
    E(
      e,
      t,
      s,
      n,
      r,
      i,
      !0
    )
  );
}
function Dl(e, t, s, n, r) {
  return Jr(
    Se(
      e,
      t,
      s,
      n,
      r,
      !0
    )
  );
}
function Bt(e) {
  return e ? e.__v_isVNode === !0 : !1;
}
function Ot(e, t) {
  return e.type === t.type && e.key === t.key;
}
const zr = ({ key: e }) => e ?? null, Qt = ({
  ref: e,
  ref_key: t,
  ref_for: s
}) => (typeof e == "number" && (e = "" + e), e != null ? ne(e) || /* @__PURE__ */ ae(e) || D(e) ? { i: Be, r: e, k: t, f: !!s } : e : null);
function E(e, t = null, s = null, n = 0, r = null, i = e === ce ? 0 : 1, l = !1, o = !1) {
  const f = {
    __v_isVNode: !0,
    __v_skip: !0,
    type: e,
    props: t,
    key: t && zr(t),
    ref: t && Qt(t),
    scopeId: xr,
    slotScopeIds: null,
    children: s,
    component: null,
    suspense: null,
    ssContent: null,
    ssFallback: null,
    dirs: null,
    transition: null,
    el: null,
    anchor: null,
    target: null,
    targetStart: null,
    targetAnchor: null,
    staticCount: 0,
    shapeFlag: i,
    patchFlag: n,
    dynamicProps: r,
    dynamicChildren: null,
    appContext: null,
    ctx: Be
  };
  return o ? (fs(f, s), i & 128 && e.normalize(f)) : s && (f.shapeFlag |= ne(s) ? 8 : 16), kt > 0 && // avoid a block node from tracking itself
  !l && // has current parent block
  xe && // presence of a patch flag indicates this node needs patching on updates.
  // component nodes also should always be patched, because even if the
  // component doesn't need to update, it needs to persist the instance on to
  // the next vnode so that it can be properly unmounted later.
  (f.patchFlag > 0 || i & 6) && // the EVENTS flag is only for hydration and if it is the only flag, the
  // vnode should not be considered dynamic due to handler caching.
  f.patchFlag !== 32 && xe.push(f), f;
}
const Se = jl;
function jl(e, t = null, s = null, n = 0, r = null, i = !1) {
  if ((!e || e === fl) && (e = Ie), Bt(e)) {
    const o = St(
      e,
      t,
      !0
      /* mergeRef: true */
    );
    return s && fs(o, s), kt > 0 && !i && xe && (o.shapeFlag & 6 ? xe[xe.indexOf(e)] = o : xe.push(o)), o.patchFlag = -2, o;
  }
  if (Jl(e) && (e = e.__vccOpts), t) {
    t = Hl(t);
    let { class: o, style: f } = t;
    o && !ne(o) && (t.class = st(o)), G(f) && (/* @__PURE__ */ ln(f) && !F(f) && (f = de({}, f)), t.style = gs(f));
  }
  const l = ne(e) ? 1 : qr(e) ? 128 : vs(e) ? 64 : G(e) ? 4 : D(e) ? 2 : 0;
  return E(
    e,
    t,
    s,
    n,
    r,
    l,
    i,
    !0
  );
}
function Hl(e) {
  return e ? /* @__PURE__ */ ln(e) || Hr(e) ? de({}, e) : e : null;
}
function St(e, t, s = !1, n = !1) {
  const { props: r, ref: i, patchFlag: l, children: o, transition: f } = e, d = t ? Ll(r || {}, t) : r, a = {
    __v_isVNode: !0,
    __v_skip: !0,
    type: e.type,
    props: d,
    key: d && zr(d),
    ref: t && t.ref ? (
      // #2078 in the case of <component :is="vnode" ref="extra"/>
      // if the vnode itself already has a ref, cloneVNode will need to merge
      // the refs so the single vnode can be set on multiple refs
      s && i ? F(i) ? i.concat(Qt(t)) : [i, Qt(t)] : Qt(t)
    ) : i,
    scopeId: e.scopeId,
    slotScopeIds: e.slotScopeIds,
    children: o,
    target: e.target,
    targetStart: e.targetStart,
    targetAnchor: e.targetAnchor,
    staticCount: e.staticCount,
    shapeFlag: e.shapeFlag,
    // if the vnode is cloned with extra props, we can no longer assume its
    // existing patch flag to be reliable and need to add the FULL_PROPS flag.
    // note: preserve flag for fragments since they use the flag for children
    // fast paths only.
    patchFlag: t && e.type !== ce ? l === -1 ? 16 : l | 16 : l,
    dynamicProps: e.dynamicProps,
    dynamicChildren: e.dynamicChildren,
    appContext: e.appContext,
    dirs: e.dirs,
    transition: f,
    // These should technically only be non-null on mounted VNodes. However,
    // they *should* be copied for kept-alive vnodes. So we just always copy
    // them since them being non-null during a mount doesn't affect the logic as
    // they will simply be overwritten.
    component: e.component,
    suspense: e.suspense,
    ssContent: e.ssContent && St(e.ssContent),
    ssFallback: e.ssFallback && St(e.ssFallback),
    placeholder: e.placeholder,
    el: e.el,
    anchor: e.anchor,
    ctx: e.ctx,
    ce: e.ce,
    cacheIndex: e.cacheIndex
  };
  return f && n && is(
    a,
    f.clone(a)
  ), a;
}
function es(e = " ", t = 0) {
  return Se(Ss, null, e, t);
}
function Ye(e = "", t = !1) {
  return t ? (L(), Dl(Ie, null, e)) : Se(Ie, null, e);
}
function Le(e) {
  return e == null || typeof e == "boolean" ? Se(Ie) : F(e) ? Se(
    ce,
    null,
    // #3666, avoid reference pollution when reusing vnode
    e.slice()
  ) : Bt(e) ? Ze(e) : Se(Ss, null, String(e));
}
function Ze(e) {
  return e.el === null && e.patchFlag !== -1 || e.memo ? e : St(e);
}
function fs(e, t) {
  let s = 0;
  const { shapeFlag: n } = e;
  if (t == null)
    t = null;
  else if (F(t))
    s = 16;
  else if (typeof t == "object")
    if (n & 65) {
      const r = t.default;
      r && (r._c && (r._d = !1), fs(e, r()), r._c && (r._d = !0));
      return;
    } else {
      s = 32;
      const r = t._;
      !r && !Hr(t) ? t._ctx = Be : r === 3 && Be && (Be.slots._ === 1 ? t._ = 1 : (t._ = 2, e.patchFlag |= 1024));
    }
  else if (D(t)) {
    if (n & 65) {
      fs(e, { default: t });
      return;
    }
    t = { default: t, _ctx: Be }, s = 32;
  } else
    t = String(t), n & 64 ? (s = 16, t = [es(t)]) : s = 8;
  e.children = t, e.shapeFlag |= s;
}
function Ll(...e) {
  const t = {};
  for (let s = 0; s < e.length; s++) {
    const n = e[s];
    for (const r in n)
      if (r === "class")
        t.class !== n.class && (t.class = st([t.class, n.class]));
      else if (r === "style")
        t.style = gs([t.style, n.style]);
      else if (as(r)) {
        const i = t[r], l = n[r];
        l && i !== l && !(F(i) && i.includes(l)) ? t[r] = i ? [].concat(i, l) : l : l == null && i == null && // mergeProps({ 'onUpdate:modelValue': undefined }) should not retain
        // the model listener.
        !ds(r) && (t[r] = l);
      } else r !== "" && (t[r] = n[r]);
  }
  return t;
}
function De(e, t, s, n = null) {
  Me(e, t, 7, [
    s,
    n
  ]);
}
const kl = Rr();
let Yr = 0;
function Bl() {
  return Yr;
}
function Kl(e, t, s) {
  const n = e.type, r = (t ? t.appContext : e.appContext) || kl, i = {
    uid: Yr++,
    vnode: e,
    type: n,
    parent: t,
    appContext: r,
    root: null,
    // to be immediately set
    next: null,
    subTree: null,
    // will be set synchronously right after creation
    effect: null,
    update: null,
    // will be set synchronously right after creation
    job: null,
    scope: new hi(
      !0
      /* detached */
    ),
    render: null,
    proxy: null,
    exposed: null,
    exposeProxy: null,
    withProxy: null,
    provides: t ? t.provides : Object.create(r.provides),
    ids: t ? t.ids : ["", 0, 0],
    accessCache: null,
    renderCache: [],
    // local resolved assets
    components: null,
    directives: null,
    // resolved props and emits options
    propsOptions: kr(n, r),
    emitsOptions: Fr(n, r),
    // emit
    emit: null,
    // to be set immediately
    emitted: null,
    // props default value
    propsDefaults: X,
    // inheritAttrs
    inheritAttrs: n.inheritAttrs,
    // state
    ctx: X,
    data: X,
    props: X,
    attrs: X,
    slots: X,
    refs: X,
    setupState: X,
    setupContext: null,
    // suspense related
    suspense: s,
    suspenseId: s ? s.pendingId : 0,
    asyncDep: null,
    asyncResolved: !1,
    // lifecycle hooks
    // not using enums here because it results in computed properties
    isMounted: !1,
    isUnmounted: !1,
    isDeactivated: !1,
    bc: null,
    c: null,
    bm: null,
    m: null,
    bu: null,
    u: null,
    um: null,
    bum: null,
    da: null,
    a: null,
    rtg: null,
    rtc: null,
    ec: null,
    sp: null
  };
  return i.ctx = { _: i }, i.root = t ? t.root : i, i.emit = vl.bind(null, i), e.ce && e.ce(i), i;
}
let ge = null;
const Vl = () => ge || Be;
let us, Kt;
{
  const e = ps(), t = (s, n) => {
    let r;
    return (r = e[s]) || (r = e[s] = []), r.push(n), (i) => {
      r.length > 1 ? r.forEach((l) => l(i)) : r[0](i);
    };
  };
  us = t(
    "__VUE_INSTANCE_SETTERS__",
    (s) => ge = s
  ), Kt = t(
    "__VUE_SSR_SETTERS__",
    (s) => Vt = s
  );
}
const qt = (e) => {
  const t = ge;
  return us(e), e.scope.on(), () => {
    e.scope.off(), us(t);
  };
}, Fn = () => {
  ge && ge.scope.off(), us(null);
};
function Xr(e) {
  return e.vnode.shapeFlag & 4;
}
let Vt = !1;
function Ul(e, t = !1, s = !1) {
  t && Kt(t);
  const { props: n, children: r } = e.vnode, i = Xr(e);
  Tl(e, n, i, t), Pl(e, r, s || t);
  const l = i ? Wl(e, t) : void 0;
  return t && Kt(!1), l;
}
function Wl(e, t) {
  const s = e.type;
  e.accessCache = /* @__PURE__ */ Object.create(null), e.proxy = new Proxy(e.ctx, ul);
  const { setup: n } = s;
  if (n) {
    Ue();
    const r = e.setupContext = n.length > 1 ? Gl(e) : null, i = qt(e), l = Wt(
      n,
      e,
      0,
      [
        e.props,
        r
      ]
    ), o = qn(l);
    if (We(), i(), (o || e.sp) && !$t(e) && Tr(e), o) {
      if (l.then(Fn, Fn), t)
        return l.then((f) => {
          Kt(!0);
          try {
            Nn(e, f, t);
          } finally {
            Kt(!1);
          }
        }).catch((f) => {
          bs(f, e, 0);
        });
      e.asyncDep = l;
    } else
      Nn(e, l);
  } else
    Zr(e);
}
function Nn(e, t, s) {
  D(t) ? e.type.__ssrInlineRender ? e.ssrRender = t : e.render = t : G(t) && (e.setupState = gr(t)), Zr(e);
}
function Zr(e, t, s) {
  const n = e.type;
  e.render || (e.render = n.render || Ke);
  {
    const r = qt(e);
    Ue();
    try {
      al(e);
    } finally {
      We(), r();
    }
  }
}
const ql = {
  get(e, t) {
    return ue(e, "get", ""), e[t];
  }
};
function Gl(e) {
  const t = (s) => {
    e.exposed = s || {};
  };
  return {
    attrs: new Proxy(e.attrs, ql),
    slots: e.slots,
    emit: e.emit,
    expose: t
  };
}
function an(e) {
  return e.exposed ? e.exposeProxy || (e.exposeProxy = new Proxy(gr(Ri(e.exposed)), {
    get(t, s) {
      if (s in t)
        return t[s];
      if (s in Dt)
        return Dt[s](e);
    },
    has(t, s) {
      return s in t || s in Dt;
    }
  })) : e.proxy;
}
function Jl(e) {
  return D(e) && "__vccOpts" in e;
}
const ye = (e, t) => /* @__PURE__ */ Hi(e, t, Vt);
function zl(e, t, s) {
  try {
    cs(-1);
    const n = arguments.length;
    return n === 2 ? G(t) && !F(t) ? Bt(t) ? Se(e, null, [t]) : Se(e, t) : Se(e, null, t) : (n > 3 ? s = Array.prototype.slice.call(arguments, 2) : n === 3 && Bt(s) && (s = [s]), Se(e, t, s));
  } finally {
    cs(1);
  }
}
const Yl = "3.5.44";
let Js;
const $n = typeof window < "u" && window.trustedTypes;
if ($n)
  try {
    Js = /* @__PURE__ */ $n.createPolicy("vue", {
      createHTML: (e) => e
    });
  } catch {
  }
const Qr = Js ? (e) => Js.createHTML(e) : (e) => e, Xl = "http://www.w3.org/2000/svg", Zl = "http://www.w3.org/1998/Math/MathML", Xe = typeof document < "u" ? document : null, Dn = Xe && /* @__PURE__ */ Xe.createElement("template"), Ql = {
  insert: (e, t, s) => {
    t.insertBefore(e, s || null);
  },
  remove: (e) => {
    const t = e.parentNode;
    t && t.removeChild(e);
  },
  createElement: (e, t, s, n) => {
    const r = t === "svg" ? Xe.createElementNS(Xl, e) : t === "mathml" ? Xe.createElementNS(Zl, e) : s ? Xe.createElement(e, { is: s }) : Xe.createElement(e);
    return e === "select" && n && n.multiple != null && r.setAttribute("multiple", n.multiple), r;
  },
  createText: (e) => Xe.createTextNode(e),
  createComment: (e) => Xe.createComment(e),
  setText: (e, t) => {
    e.nodeValue = t;
  },
  setElementText: (e, t) => {
    e.textContent = t;
  },
  parentNode: (e) => e.parentNode,
  nextSibling: (e) => e.nextSibling,
  querySelector: (e) => Xe.querySelector(e),
  setScopeId(e, t) {
    e.setAttribute(t, "");
  },
  // __UNSAFE__
  // Reason: innerHTML.
  // Static content here can only come from compiled templates.
  // As long as the user only uses trusted templates, this is safe.
  insertStaticContent(e, t, s, n, r, i) {
    const l = s ? s.previousSibling : t.lastChild;
    if (r && (r === i || r.nextSibling))
      for (; t.insertBefore(r.cloneNode(!0), s), !(r === i || !(r = r.nextSibling)); )
        ;
    else {
      Dn.innerHTML = Qr(
        n === "svg" ? `<svg>${e}</svg>` : n === "mathml" ? `<math>${e}</math>` : e
      );
      const o = Dn.content;
      if (n === "svg" || n === "mathml") {
        const f = o.firstChild;
        for (; f.firstChild; )
          o.appendChild(f.firstChild);
        o.removeChild(f);
      }
      t.insertBefore(o, s);
    }
    return [
      // first
      l ? l.nextSibling : t.firstChild,
      // last
      s ? s.previousSibling : t.lastChild
    ];
  }
}, eo = /* @__PURE__ */ Symbol("_vtc");
function to(e, t, s) {
  const n = e[eo];
  n && (t = (t ? [t, ...n] : [...n]).join(" ")), t == null ? e.removeAttribute("class") : s ? e.setAttribute("class", t) : e.className = t;
}
const jn = /* @__PURE__ */ Symbol("_vod"), so = /* @__PURE__ */ Symbol("_vsh"), no = /* @__PURE__ */ Symbol(""), ro = /(?:^|;)\s*display\s*:/;
function io(e, t, s) {
  const n = e.style, r = ne(s);
  let i = !1;
  if (s && !r) {
    if (t)
      if (ne(t))
        for (const l of t.split(";")) {
          const o = l.slice(0, l.indexOf(":")).trim();
          s[o] == null && Mt(n, o, "");
        }
      else
        for (const l in t)
          s[l] == null && Mt(n, l, "");
    for (const l in s) {
      l === "display" && (i = !0);
      const o = s[l];
      o != null ? oo(
        e,
        l,
        !ne(t) && t ? t[l] : void 0,
        o
      ) || Mt(n, l, o) : Mt(n, l, "");
    }
  } else if (r) {
    if (t !== s) {
      const l = n[no];
      l && (s += ";" + l), n.cssText = s, i = ro.test(s);
    }
  } else t && e.removeAttribute("style");
  jn in e && ((!r || t !== s) && (e[jn] = i ? n.display : ""), e[so] && (n.display = "none"));
}
const Xt = /\s*!important$/;
function Mt(e, t, s) {
  if (F(s))
    s.forEach((n) => Mt(e, t, n));
  else if (s == null && (s = ""), t.startsWith("--"))
    Xt.test(s) ? e.setProperty(t, s.replace(Xt, ""), "important") : e.setProperty(t, s);
  else {
    const n = lo(e, t);
    Xt.test(s) ? e.setProperty(
      pt(n),
      s.replace(Xt, ""),
      "important"
    ) : e[n] = s;
  }
}
const Hn = ["Webkit", "Moz", "ms"], $s = {};
function lo(e, t) {
  const s = $s[t];
  if (s)
    return s;
  let n = Oe(t);
  if (n !== "filter" && n in e)
    return $s[t] = n;
  n = zn(n);
  for (let r = 0; r < Hn.length; r++) {
    const i = Hn[r] + n;
    if (i in e)
      return $s[t] = i;
  }
  return t;
}
function oo(e, t, s, n) {
  return e.tagName === "TEXTAREA" && (t === "width" || t === "height") && ne(n) && s === n;
}
const Ln = "http://www.w3.org/1999/xlink";
function kn(e, t, s, n, r, i = ui(t)) {
  n && t.startsWith("xlink:") ? s == null ? e.removeAttributeNS(Ln, t.slice(6, t.length)) : e.setAttributeNS(Ln, t, s) : s == null || i && !Xn(s) ? e.removeAttribute(t) : e.setAttribute(
    t,
    i ? "" : Ve(s) ? String(s) : s
  );
}
function Bn(e, t, s, n, r) {
  if (t === "innerHTML" || t === "textContent") {
    s != null && (e[t] = t === "innerHTML" ? Qr(s) : s);
    return;
  }
  const i = e.tagName;
  if (t === "value" && i !== "PROGRESS" && // custom elements may use _value internally
  !i.includes("-")) {
    const o = i === "OPTION" ? e.getAttribute("value") || "" : e.value, f = s == null ? (
      // #11647: value should be set as empty string for null and undefined,
      // but <input type="checkbox"> should be set as 'on'.
      e.type === "checkbox" ? "on" : ""
    ) : String(s);
    (o !== f || !("_value" in e)) && (e.value = f), s == null && e.removeAttribute(t), e._value = s;
    return;
  }
  let l = !1;
  if (s === "" || s == null) {
    const o = typeof e[t];
    o === "boolean" ? s = Xn(s) : s == null && o === "string" ? (s = "", l = !0) : o === "number" && (s = 0, l = !0);
  }
  try {
    e[t] = s;
  } catch {
  }
  l && e.removeAttribute(r || t);
}
function co(e, t, s, n) {
  e.addEventListener(t, s, n);
}
function fo(e, t, s, n) {
  e.removeEventListener(t, s, n);
}
const Kn = /* @__PURE__ */ Symbol("_vei");
function uo(e, t, s, n, r = null) {
  const i = e[Kn] || (e[Kn] = {}), l = i[t];
  if (n && l)
    l.value = n;
  else {
    const [o, f] = po(t);
    if (n) {
      const d = i[t] = mo(
        n,
        r
      );
      co(e, o, d, f);
    } else l && (fo(e, o, l, f), i[t] = void 0);
  }
}
const ao = /(Once|Passive|Capture)$/, ho = /^on:?(?:Once|Passive|Capture)$/;
function po(e) {
  let t, s;
  for (; (s = e.match(ao)) && !ho.test(e); )
    t || (t = {}), e = e.slice(0, e.length - s[1].length), t[s[1].toLowerCase()] = !0;
  return [e[2] === ":" ? e.slice(3) : pt(e.slice(2)), t];
}
let Ds = 0;
const go = /* @__PURE__ */ Promise.resolve(), _o = () => Ds || (go.then(() => Ds = 0), Ds = Date.now());
function mo(e, t) {
  const s = (n) => {
    if (!n._vts)
      n._vts = Date.now();
    else if (n._vts <= s.attached)
      return;
    const r = s.value;
    if (F(r)) {
      const i = n.stopImmediatePropagation;
      n.stopImmediatePropagation = () => {
        i.call(n), n._stopped = !0;
      };
      const l = r.slice(), o = [n];
      for (let f = 0; f < l.length && !n._stopped; f++) {
        const d = l[f];
        d && Me(
          d,
          t,
          5,
          o
        );
      }
    } else
      Me(
        r,
        t,
        5,
        [n]
      );
  };
  return s.value = e, s.attached = _o(), s;
}
const Vn = (e) => e.charCodeAt(0) === 111 && e.charCodeAt(1) === 110 && // lowercase letter
e.charCodeAt(2) > 96 && e.charCodeAt(2) < 123, bo = (e, t, s, n, r, i) => {
  const l = r === "svg";
  t === "class" ? to(e, n, l) : t === "style" ? io(e, s, n) : as(t) ? ds(t) || uo(e, t, s, n, i) : (t[0] === "." ? (t = t.slice(1), !0) : t[0] === "^" ? (t = t.slice(1), !1) : vo(e, t, n, l)) ? (Bn(e, t, n), !e.tagName.includes("-") && (t === "value" || t === "checked" || t === "selected") && kn(e, t, n, l, i, t !== "value")) : /* #11081 force set props for possible async custom element */ e._isVueCE && // #12408 check if it's declared prop or it's async custom element
  (yo(e, t) || // @ts-expect-error _def is private
  e._def.__asyncLoader && (/[A-Z]/.test(t) || !ne(n))) ? Bn(e, Oe(t), n, i, t) : (t === "true-value" ? e._trueValue = n : t === "false-value" && (e._falseValue = n), kn(e, t, n, l));
};
function vo(e, t, s, n) {
  if (n)
    return !!(t === "innerHTML" || t === "textContent" || t in e && Vn(t) && D(s));
  if (t === "spellcheck" || t === "draggable" || t === "translate" || t === "autocorrect" || t === "sandbox" && e.tagName === "IFRAME" || t === "form" || t === "list" && e.tagName === "INPUT" || t === "type" && e.tagName === "TEXTAREA")
    return !1;
  if (t === "width" || t === "height") {
    const r = e.tagName;
    if (r === "IMG" || r === "VIDEO" || r === "CANVAS" || r === "SOURCE")
      return !1;
  }
  return Vn(t) && ne(s) ? !1 : t in e;
}
function yo(e, t) {
  const s = (
    // @ts-expect-error _def is private
    e._def.props
  );
  if (!s)
    return !1;
  const n = Oe(t);
  return Array.isArray(s) ? s.some((r) => Oe(r) === n) : Object.keys(s).some((r) => Oe(r) === n);
}
const xo = /* @__PURE__ */ de({ patchProp: bo }, Ql);
let Un;
function So() {
  return Un || (Un = Il(xo));
}
const wo = ((...e) => {
  const t = So().createApp(...e), { mount: s } = t;
  return t.mount = (n) => {
    const r = To(n);
    if (!r) return;
    const i = t._component;
    !D(i) && !i.render && !i.template && (i.template = r.innerHTML), r.nodeType === 1 && (r.textContent = "");
    const l = s(r, !1, Co(r));
    return r instanceof Element && (r.removeAttribute("v-cloak"), r.setAttribute("data-v-app", "")), l;
  }, t;
});
function Co(e) {
  if (e instanceof SVGElement)
    return "svg";
  if (typeof MathMLElement == "function" && e instanceof MathMLElement)
    return "mathml";
}
function To(e) {
  return ne(e) ? document.querySelector(e) : e;
}
const Eo = (e, t) => {
  const s = e.__vccOpts || e;
  for (const [n, r] of t)
    s[n] = r;
  return s;
}, Ao = { class: "muge" }, Oo = { class: "muge-head" }, Po = { class: "title-block" }, Mo = { class: "meta" }, Io = ["disabled"], Ro = { class: "tabs" }, Fo = ["onClick"], No = {
  key: 0,
  class: "badge"
}, $o = {
  key: 1,
  class: "badge"
}, Do = {
  key: 2,
  class: "badge"
}, jo = {
  key: 0,
  class: "alert"
}, Ho = {
  key: 1,
  class: "alert warn"
}, Lo = {
  key: 2,
  class: "empty"
}, ko = {
  key: 3,
  class: "empty"
}, Bo = {
  key: 4,
  class: "panel"
}, Ko = { class: "hero" }, Vo = { class: "hero-main" }, Uo = { class: "hero-value" }, Wo = { class: "hero-sub" }, qo = ["disabled"], Go = { class: "bar" }, Jo = { class: "tiers" }, zo = { class: "threshold" }, Yo = { class: "reward" }, Xo = ["src", "alt", "onError"], Zo = { key: 1 }, Qo = { class: "state" }, ec = {
  key: 0,
  class: "empty"
}, tc = {
  key: 5,
  class: "panel"
}, sc = { class: "hero" }, nc = { class: "hero-main" }, rc = { class: "hero-value" }, ic = { class: "hero-sub" }, lc = ["disabled"], oc = { class: "tiers" }, cc = { class: "threshold" }, fc = { class: "reward" }, uc = ["src", "alt", "onError"], ac = { key: 1 }, dc = { class: "state" }, hc = {
  key: 0,
  class: "empty"
}, pc = {
  key: 6,
  class: "panel"
}, gc = { class: "hero" }, _c = { class: "hero-main" }, mc = { class: "hero-value" }, bc = { class: "hero-sub" }, vc = { class: "hero-actions" }, yc = ["disabled"], xc = ["disabled"], Sc = { class: "tiers compact" }, wc = { class: "threshold" }, Cc = { class: "reward" }, Tc = { class: "state" }, Ec = { class: "stage-head" }, Ac = { class: "muted" }, Oc = { class: "tasks" }, Pc = { class: "task-main" }, Mc = { class: "task-title" }, Ic = { class: "task-progress" }, Rc = { class: "task-meta" }, Fc = { class: "reward sm" }, Nc = { class: "state" }, $c = {
  key: 0,
  class: "empty"
}, Dc = {
  key: 7,
  class: "panel"
}, jc = { class: "notice" }, Hc = { class: "foot" }, Lc = {
  key: 0,
  class: "muted"
}, kc = {
  __name: "MugeActivityPanel",
  props: {
    host: { type: Object, default: () => ({}) }
  },
  emits: ["back"],
  setup(e, { emit: t }) {
    const s = e, n = t, r = [
      { key: "celebration", label: "兴牧庆典" },
      { key: "friend", label: "牧友同行" },
      { key: "manual", label: "成长手册" },
      { key: "personality", label: "牧场人格" }
    ], i = /* @__PURE__ */ bt(null), l = /* @__PURE__ */ bt(!1), o = /* @__PURE__ */ bt(""), f = /* @__PURE__ */ bt("celebration"), d = /* @__PURE__ */ bt(""), a = /* @__PURE__ */ bt({});
    let p = null, C = !1;
    const O = {
      success: (A) => s.host?.toast?.success?.(A),
      error: (A) => s.host?.toast?.error?.(A)
    };
    function V() {
      return String(s.host?.getAccountId?.() || "");
    }
    function R(A) {
      return (Number(A) || 0).toLocaleString("zh-CN");
    }
    function ee(A) {
      const w = Number(A) || 0;
      return w >= 1e8 ? `${(w / 1e8).toFixed(w % 1e8 === 0 ? 0 : 1)} 亿` : w >= 1e4 ? `${(w / 1e4).toFixed(w % 1e4 === 0 ? 0 : 1)} 万` : R(w);
    }
    function q(A) {
      return A ? `${A.name || `物品${A.id}`} ×${R(A.count)}` : "—";
    }
    function j(A) {
      return !A || !A.image || a.value[A.image] ? "" : A.image;
    }
    function k(A) {
      A?.image && (a.value = { ...a.value, [A.image]: !0 });
    }
    function P(A) {
      return Number(A.state) === 3 ? { text: "已领取", cls: "done" } : Number(A.state) === 2 ? { text: "可领取", cls: "ready" } : { text: "未达成", cls: "locked" };
    }
    function se(A) {
      return Number(A.state) === 3 ? { text: "已领取", cls: "done" } : Number(A.state) === 1 || Number(A.state) === 2 ? { text: "可领取", cls: "ready" } : { text: "未解锁", cls: "locked" };
    }
    const we = ye(() => i.value?.activity || null), fe = ye(() => i.value?.celebration || null), me = ye(() => i.value?.friend || null), Ge = ye(() => i.value?.manual || null), Je = ye(() => i.value?.personality || null), te = ye(() => i.value?.summary || null), ot = ye(() => {
      const A = fe.value?.tiers || [];
      if (!A.length) return 0;
      const w = A.find((T) => Number(T.state) !== 3);
      return w ? w.threshold : A[A.length - 1].threshold;
    }), gt = ye(() => {
      const A = Number(fe.value?.total) || 0, w = ot.value || 0;
      return w ? Math.max(0, Math.min(100, Math.round(A / w * 100))) : 0;
    }), wt = ye(() => {
      const A = Ge.value?.tasks || [], w = /* @__PURE__ */ new Map();
      for (const T of A) {
        const Q = Number(T.stage) || 0;
        w.has(Q) || w.set(Q, []), w.get(Q).push(T);
      }
      return [...w.entries()].sort((T, Q) => T[0] - Q[0]).map(([T, Q]) => ({
        stage: T,
        rows: Q,
        claimed: Q.filter((be) => Number(be.state) === 3).length,
        claimable: Q.filter((be) => Number(be.state) === 1 || Number(be.state) === 2).length
      }));
    }), Ct = ye(() => {
      const A = Ge.value?.stages || [];
      return { claimed: A.filter((T) => Number(T.state) === 3).length, total: A.length };
    }), ie = ye(() => {
      const A = Number(we.value?.startTime) || 0, w = Number(we.value?.endTime) || 0;
      if (!A || !w) return "";
      const T = (Q) => {
        const be = new Date(Q * 1e3);
        return `${be.getMonth() + 1}/${be.getDate()}`;
      };
      return `${T(A)} — ${T(w)}`;
    }), Z = ye(() => {
      const A = we.value?.phase;
      return A === "upcoming" ? "未开始" : A === "ended" ? "已结束" : "进行中";
    });
    async function U(A = !1) {
      if (!(C || l.value)) {
        if (!V()) {
          o.value = "请先选择账号";
          return;
        }
        l.value = !0;
        try {
          const { data: w } = await s.host.api.get(`/api/activity/muge-ranch${A ? "?force=1" : ""}`);
          if (C) return;
          if (!w?.ok) throw new Error(w?.error || "读取失败");
          i.value = w.activity, o.value = "";
        } catch (w) {
          C || (o.value = w.response?.data?.error || w.message || "读取失败");
        } finally {
          C || (l.value = !1);
        }
      }
    }
    async function Ce(A) {
      if (!(C || d.value)) {
        d.value = A;
        try {
          const { data: w } = await s.host.api.post("/api/activity/muge-ranch/claim", { action: A });
          if (C) return;
          if (!w?.ok) throw new Error(w?.error || "领取失败");
          w.activity && (i.value = w.activity);
          const T = w.result?.ids || [];
          O.success(T.length ? `已领取 ${T.length} 项奖励` : "当前没有可领取的奖励");
        } catch (w) {
          C || O.error(w.response?.data?.error || w.message || "领取失败");
        } finally {
          C || (d.value = "");
        }
      }
    }
    function _t() {
      Re(), p = setInterval(() => {
        document.visibilityState === "visible" && U();
      }, 6e4);
    }
    function Re() {
      p && clearInterval(p), p = null;
    }
    return Ar(() => {
      U(!0), _t();
    }), Or(() => {
      C = !0, Re();
    }), (A, w) => (L(), B("div", Ao, [
      E("header", Oo, [
        E("button", {
          class: "back",
          type: "button",
          title: "返回活动列表",
          onClick: w[0] || (w[0] = (T) => n("back"))
        }, [...w[6] || (w[6] = [
          E("svg", {
            viewBox: "0 0 24 24",
            width: "18",
            height: "18",
            "aria-hidden": "true"
          }, [
            E("path", {
              fill: "none",
              stroke: "currentColor",
              "stroke-width": "2",
              "stroke-linecap": "round",
              "stroke-linejoin": "round",
              d: "M15 18l-6-6 6-6"
            })
          ], -1)
        ])]),
        E("div", Po, [
          w[8] || (w[8] = E("h2", null, "牧歌初启", -1)),
          E("p", Mo, [
            E("span", null, $(ie.value), 1),
            w[7] || (w[7] = E("span", { class: "dot" }, "·", -1)),
            E("span", null, $(Z.value), 1)
          ])
        ]),
        E("button", {
          class: "ghost",
          type: "button",
          disabled: l.value,
          onClick: w[1] || (w[1] = (T) => U(!0))
        }, $(l.value ? "刷新中…" : "刷新"), 9, Io)
      ]),
      E("nav", Ro, [
        (L(), B(ce, null, vt(r, (T) => E("button", {
          key: T.key,
          type: "button",
          class: st(["tab", { active: f.value === T.key }]),
          onClick: (Q) => f.value = T.key
        }, [
          es($(T.label) + " ", 1),
          T.key === "celebration" && te.value?.celebration?.claimableCount ? (L(), B("span", No, $(te.value.celebration.claimableCount), 1)) : T.key === "friend" && te.value?.friend?.claimableCount ? (L(), B("span", $o, $(te.value.friend.claimableCount), 1)) : T.key === "manual" && (te.value?.manual?.claimableTaskCount || te.value?.manual?.claimableStageCount) ? (L(), B("span", Do, $(te.value.manual.claimableTaskCount + te.value.manual.claimableStageCount), 1)) : Ye("", !0)
        ], 10, Fo)), 64))
      ]),
      o.value ? (L(), B("p", jo, $(o.value), 1)) : Ye("", !0),
      i.value?.warnings?.length ? (L(), B("p", Ho, $(i.value.warnings.join("；")), 1)) : Ye("", !0),
      !i.value && l.value ? (L(), B("div", Lo, "读取中…")) : !i.value && !o.value ? (L(), B("div", ko, "暂无数据")) : Ye("", !0),
      i.value && f.value === "celebration" ? (L(), B("section", Bo, [
        E("div", Ko, [
          E("div", Vo, [
            w[9] || (w[9] = E("span", { class: "hero-label" }, "全服累计饲养", -1)),
            E("strong", Uo, $(ee(fe.value?.total)), 1),
            E("span", Wo, "下一档 " + $(ee(ot.value)), 1)
          ]),
          E("button", {
            class: "primary",
            type: "button",
            disabled: !te.value?.celebration?.claimable || d.value === "celebration",
            onClick: w[2] || (w[2] = (T) => Ce("celebration"))
          }, $(d.value === "celebration" ? "领取中…" : `领取奖励${te.value?.celebration?.claimableCount ? ` (${te.value.celebration.claimableCount})` : ""}`), 9, qo)
        ]),
        E("div", Go, [
          E("i", {
            style: gs({ width: `${gt.value}%` })
          }, null, 4)
        ]),
        E("ul", Jo, [
          (L(!0), B(ce, null, vt(fe.value?.tiers, (T) => (L(), B("li", {
            key: T.id,
            class: st(["tier", P(T).cls])
          }, [
            E("span", zo, $(ee(T.threshold)), 1),
            E("span", Yo, [
              j(T.reward) ? (L(), B("img", {
                key: 0,
                src: j(T.reward),
                alt: T.reward.name,
                onError: (Q) => k(T.reward)
              }, null, 40, Xo)) : (L(), B("em", Zo, $((T.reward?.name || "奖")[0]), 1)),
              es(" " + $(q(T.reward)), 1)
            ]),
            E("span", Qo, $(P(T).text), 1)
          ], 2))), 128))
        ]),
        fe.value?.tiers?.length ? Ye("", !0) : (L(), B("p", ec, "暂无档位数据"))
      ])) : i.value && f.value === "friend" ? (L(), B("section", tc, [
        E("div", sc, [
          E("div", nc, [
            w[10] || (w[10] = E("span", { class: "hero-label" }, "已开启牧场的好友", -1)),
            E("strong", rc, $(me.value?.friends?.length || 0), 1),
            E("span", ic, "共 " + $(me.value?.tiers?.length || 0) + " 档奖励", 1)
          ]),
          E("button", {
            class: "primary",
            type: "button",
            disabled: !te.value?.friend?.claimable || d.value === "friend",
            onClick: w[3] || (w[3] = (T) => Ce("friend"))
          }, $(d.value === "friend" ? "领取中…" : `领取奖励${te.value?.friend?.claimableCount ? ` (${te.value.friend.claimableCount})` : ""}`), 9, lc)
        ]),
        E("ul", oc, [
          (L(!0), B(ce, null, vt(me.value?.tiers, (T) => (L(), B("li", {
            key: T.id,
            class: st(["tier", P(T).cls])
          }, [
            E("span", cc, $(R(T.threshold)) + " 位", 1),
            E("span", fc, [
              j(T.reward) ? (L(), B("img", {
                key: 0,
                src: j(T.reward),
                alt: T.reward.name,
                onError: (Q) => k(T.reward)
              }, null, 40, uc)) : (L(), B("em", ac, $((T.reward?.name || "奖")[0]), 1)),
              es(" " + $(q(T.reward)), 1)
            ]),
            E("span", dc, $(P(T).text), 1)
          ], 2))), 128))
        ]),
        me.value?.tiers?.length ? Ye("", !0) : (L(), B("p", hc, "暂无档位数据"))
      ])) : i.value && f.value === "manual" ? (L(), B("section", pc, [
        E("div", gc, [
          E("div", _c, [
            w[11] || (w[11] = E("span", { class: "hero-label" }, "阶段进度", -1)),
            E("strong", mc, $(Ct.value.claimed) + " / " + $(Ct.value.total), 1),
            E("span", bc, " 待领任务 " + $(te.value?.manual?.claimableTaskCount || 0) + " · 待领阶段 " + $(te.value?.manual?.claimableStageCount || 0), 1)
          ]),
          E("div", vc, [
            E("button", {
              class: "primary",
              type: "button",
              disabled: !te.value?.manual?.claimableTaskCount || d.value === "manualTask",
              onClick: w[4] || (w[4] = (T) => Ce("manualTask"))
            }, $(d.value === "manualTask" ? "领取中…" : "领取任务奖励"), 9, yc),
            E("button", {
              class: "primary soft",
              type: "button",
              disabled: !te.value?.manual?.claimableStageCount || d.value === "manualStage",
              onClick: w[5] || (w[5] = (T) => Ce("manualStage"))
            }, $(d.value === "manualStage" ? "领取中…" : "领取阶段奖励"), 9, xc)
          ])
        ]),
        E("ul", Sc, [
          (L(!0), B(ce, null, vt(Ge.value?.stages, (T) => (L(), B("li", {
            key: T.id,
            class: st(["tier", P(T).cls])
          }, [
            E("span", wc, "阶段 " + $(T.id) + " · " + $(T.threshold) + " 个任务", 1),
            E("span", Cc, $(q(T.reward)), 1),
            E("span", Tc, $(P(T).text), 1)
          ], 2))), 128))
        ]),
        (L(!0), B(ce, null, vt(wt.value, (T) => (L(), B("div", {
          key: T.stage,
          class: "stage-block"
        }, [
          E("div", Ec, [
            E("span", null, "第 " + $(T.stage) + " 阶段", 1),
            E("span", Ac, "已领 " + $(T.claimed) + " / " + $(T.rows.length), 1)
          ]),
          E("ul", Oc, [
            (L(!0), B(ce, null, vt(T.rows, (Q) => (L(), B("li", {
              key: Q.id,
              class: st(["task", se(Q).cls])
            }, [
              E("div", Pc, [
                E("span", Mc, $(Q.title || `任务 ${Q.id}`), 1),
                E("span", Ic, $(R(Q.progress)) + " / " + $(R(Q.target)), 1)
              ]),
              E("div", Rc, [
                E("span", Fc, $(q(Q.reward)), 1),
                E("span", Nc, $(se(Q).text), 1)
              ])
            ], 2))), 128))
          ])
        ]))), 128)),
        Ge.value?.tasks?.length ? Ye("", !0) : (L(), B("p", $c, "暂无任务数据"))
      ])) : i.value && f.value === "personality" ? (L(), B("section", Dc, [
        E("div", jc, [
          w[12] || (w[12] = E("h3", null, "牧场人格", -1)),
          E("p", null, $(Je.value?.reason || "尚未取得牧场人格的协议样本"), 1),
          w[13] || (w[13] = E("p", { class: "muted" }, "该模块需要用官方客户端完成测试与分享；本插件暂不代操作，避免误发未知命令。", -1))
        ])
      ])) : Ye("", !0),
      E("footer", Hc, [
        w[14] || (w[14] = E("span", null, "数据来源：活动网关实时读取", -1)),
        i.value?.activity?.serverTime ? (L(), B("span", Lc, "服务器时间 " + $(new Date(i.value.activity.serverTime * 1e3).toLocaleTimeString("zh-CN")), 1)) : Ye("", !0)
      ])
    ]));
  }
}, Bc = /* @__PURE__ */ Eo(kc, [["__scopeId", "data-v-53e88bfd"]]);
function Kc(e, t = {}) {
  const s = wo({
    render: () => zl(Bc, {
      host: t,
      onBack: () => t.onBack?.()
    })
  });
  return s.mount(e), {
    unmount: () => {
      try {
        s.unmount();
      } catch {
      }
    }
  };
}
const Uc = { mount: Kc };
export {
  Uc as default,
  Kc as mount
};
