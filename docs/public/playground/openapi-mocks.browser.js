import { faker as M, Faker as _, en as P } from "@faker-js/faker";
import ft from "@apidevtools/swagger-parser";
class O extends Error {
  constructor(e) {
    super(e), this.name = "OpenApiMocksError", Object.setPrototypeOf(this, new.target.prototype);
  }
}
function G(t, e) {
  const n = e.split(".");
  if (n.length < 2)
    throw new O(
      `openapi-mocks: x-faker-method "${e}" is not a valid Faker dot-path. Expected at least two segments (e.g. "internet.email").`
    );
  let r = t;
  for (let s = 0; s < n.length - 1; s++) {
    const a = n[s];
    if (typeof r != "object" || r === null || !(a in r))
      throw new O(
        `openapi-mocks: x-faker-method "${e}" is not a valid Faker dot-path. Module "${a}" not found.`
      );
    r = r[a];
  }
  const o = n[n.length - 1];
  if (typeof r != "object" || r === null || !(o in r))
    throw new O(
      `openapi-mocks: x-faker-method "${e}" is not a valid Faker dot-path. Method "${o}" not found.`
    );
  const i = r[o];
  if (typeof i != "function")
    throw new O(
      `openapi-mocks: x-faker-method "${e}" does not resolve to a callable function. "${o}" is of type ${typeof i}.`
    );
  return i.call(r);
}
function dt(t) {
  return t.toLowerCase().replace(/_/g, "");
}
const mt = /* @__PURE__ */ new Map([
  // Personal
  ["firstname", { path: "person.firstName", outputType: "string" }],
  ["lastname", { path: "person.lastName", outputType: "string" }],
  ["fullname", { path: "person.fullName", outputType: "string" }],
  ["name", { path: "person.fullName", outputType: "string" }],
  ["username", { path: "internet.username", outputType: "string" }],
  ["username", { path: "internet.username", outputType: "string" }],
  ["nickname", { path: "internet.username", outputType: "string" }],
  ["avatar", { path: "image.avatar", outputType: "string" }],
  ["avatarurl", { path: "image.avatar", outputType: "string" }],
  ["bio", { path: "lorem.paragraph", outputType: "string" }],
  // Contact
  ["email", { path: "internet.email", outputType: "string" }],
  ["emailaddress", { path: "internet.email", outputType: "string" }],
  ["phone", { path: "phone.number", outputType: "string" }],
  ["phonenumber", { path: "phone.number", outputType: "string" }],
  // Web
  ["url", { path: "internet.url", outputType: "string" }],
  ["website", { path: "internet.url", outputType: "string" }],
  ["imageurl", { path: "image.url", outputType: "string" }],
  ["image", { path: "image.url", outputType: "string" }],
  ["photo", { path: "image.url", outputType: "string" }],
  // Location
  ["address", { path: "location.streetAddress", outputType: "string" }],
  ["streetaddress", { path: "location.streetAddress", outputType: "string" }],
  ["city", { path: "location.city", outputType: "string" }],
  ["state", { path: "location.state", outputType: "string" }],
  ["zip", { path: "location.zipCode", outputType: "string" }],
  ["zipcode", { path: "location.zipCode", outputType: "string" }],
  ["postalcode", { path: "location.zipCode", outputType: "string" }],
  ["country", { path: "location.country", outputType: "string" }],
  ["latitude", { path: "location.latitude", outputType: "number" }],
  ["lat", { path: "location.latitude", outputType: "number" }],
  ["longitude", { path: "location.longitude", outputType: "number" }],
  ["lng", { path: "location.longitude", outputType: "number" }],
  ["lon", { path: "location.longitude", outputType: "number" }],
  // Content
  ["title", { path: "lorem.sentence", outputType: "string" }],
  ["description", { path: "lorem.paragraph", outputType: "string" }],
  ["summary", { path: "lorem.paragraph", outputType: "string" }],
  ["slug", { path: "lorem.slug", outputType: "string" }],
  // Business
  ["company", { path: "company.name", outputType: "string" }],
  ["companyname", { path: "company.name", outputType: "string" }],
  ["price", { path: "commerce.price", outputType: "string" }],
  ["amount", { path: "commerce.price", outputType: "string" }],
  ["currency", { path: "finance.currencyCode", outputType: "string" }],
  // Identifiers
  ["id", { path: "string.uuid", outputType: "string" }],
  // Appearance
  ["color", { path: "color.rgb", outputType: "string" }],
  ["colour", { path: "color.rgb", outputType: "string" }],
  // Dates
  ["createdat", { path: "date.past", outputType: "object" }],
  ["updatedat", { path: "date.recent", outputType: "object" }]
]), gt = {
  string: ["string"],
  number: ["number", "integer"],
  boolean: ["boolean"],
  object: ["object", "string"]
  // dates can be serialized as strings
};
function yt(t, e) {
  const n = dt(t), r = mt.get(n);
  if (r) {
    if (e !== void 0) {
      const o = Array.isArray(e) ? e.find((i) => i !== "null") : e;
      if (o !== void 0 && !gt[r.outputType].includes(o))
        return;
    }
    return r.path;
  }
}
const ht = -2147483648, bt = 2147483647, vt = Number.MIN_SAFE_INTEGER, xt = Number.MAX_SAFE_INTEGER;
function Y(t, e, n) {
  let r = e, o = n;
  t.minimum !== void 0 && (r = Math.max(r, t.minimum)), t.maximum !== void 0 && (o = Math.min(o, t.maximum));
  const i = t.exclusiveMinimum, s = t.exclusiveMaximum;
  return typeof i == "boolean" && i && t.minimum !== void 0 ? r = t.minimum + 1 : typeof i == "number" && (r = Math.max(r, i + 1)), typeof s == "boolean" && s && t.maximum !== void 0 ? o = t.maximum - 1 : typeof s == "number" && (o = Math.min(o, s - 1)), { min: r, max: o };
}
function Tt(t, e) {
  const n = t.format, r = t.minLength, o = t.maxLength, i = t.pattern;
  switch (n) {
    case "date-time":
      return e.date.recent().toISOString();
    case "date":
      return e.date.recent().toISOString().split("T")[0];
    case "email":
      return e.internet.email();
    case "uri":
    case "url":
      return e.internet.url();
    case "uuid":
      return e.string.uuid();
    case "hostname":
      return e.internet.domainName();
    case "ipv4":
      return e.internet.ipv4();
    case "ipv6":
      return e.internet.ipv6();
    case "byte":
      return Buffer.from(e.lorem.words(3)).toString("base64");
  }
  if (i)
    try {
      return e.helpers.fromRegExp(i);
    } catch {
      console.warn(
        `openapi-mocks: pattern "${i}" could not be used with faker.helpers.fromRegExp, falling back to a plain string`
      );
    }
  if (r !== void 0 || o !== void 0) {
    const s = r ?? 0, a = o ?? Math.max(s + 20, 30), c = e.number.int({ min: s, max: a });
    return e.string.alphanumeric(c);
  }
  return e.lorem.words(e.number.int({ min: 1, max: 5 }));
}
function wt(t, e) {
  const { min: n, max: r } = Y(t, -1e9, 1e9), o = t.multipleOf, i = e.number.float({ min: n, max: r });
  return o !== void 0 && o > 0 ? Math.round(i / o) * o : i;
}
function Ot(t, e) {
  const n = t.format === "int64", r = n ? vt : ht, o = n ? xt : bt, { min: i, max: s } = Y(t, r, o), a = t.multipleOf, c = e.number.int({ min: i, max: s });
  return a !== void 0 && a > 0 ? Math.round(c / a) * a : c;
}
function H(t, e) {
  const n = t.minItems, r = t.maxItems, o = n ?? 0, i = r ?? 3, s = e.number.int({ min: o, max: i }), a = t.items, c = [];
  for (let f = 0; f < s; f++)
    c.push(a ? L(a, e) : e.lorem.word());
  return c;
}
function U(t, e) {
  const n = t.properties;
  if (!n)
    return {};
  const r = {};
  for (const [o, i] of Object.entries(n))
    r[o] = L(i, e);
  return r;
}
function L(t, e) {
  const n = t.enum;
  if (n && n.length > 0)
    return e.helpers.arrayElement(n);
  const r = t.type;
  let o;
  switch (typeof r == "string" ? o = r : Array.isArray(r) && (o = r.find((s) => s !== "null") ?? "null"), o) {
    case "string":
      return Tt(t, e);
    case "number":
      return wt(t, e);
    case "integer":
      return Ot(t, e);
    case "boolean":
      return e.datatype.boolean();
    case "array":
      return H(t, e);
    case "object":
      return U(t, e);
    case "null":
      return null;
    default:
      return t.properties ? U(t, e) : t.items ? H(t, e) : e.lorem.word();
  }
}
function Q(t) {
  const e = t.type;
  if (typeof e == "string")
    return e === "null" ? void 0 : e;
  if (Array.isArray(e))
    return e.find((n) => n !== "null");
  if (t.properties) return "object";
  if (t.items) return "array";
}
function tt(t) {
  if (t.nullable === !0) return !0;
  const e = t.type;
  return Array.isArray(e) ? e.includes("null") : !1;
}
function et(t) {
  const e = {};
  let n;
  const r = {}, o = [];
  for (const i of t) {
    const s = i, a = s.type, c = typeof a == "string" ? a : void 0;
    if (c !== void 0) {
      if (n !== void 0 && n !== c)
        throw new O(
          `openapi-mocks: allOf has conflicting types: "${n}" vs "${c}"`
        );
      n = c;
    }
    const f = s.properties;
    f && Object.assign(r, f);
    const u = s.required;
    if (u)
      for (const p of u)
        o.includes(p) || o.push(p);
    for (const [p, m] of Object.entries(s))
      p !== "type" && p !== "properties" && p !== "required" && (e[p] = m);
  }
  return n !== void 0 && (e.type = n), Object.keys(r).length > 0 && (e.properties = r), o.length > 0 && (e.required = o), e;
}
function T(t, e = {}) {
  const {
    overrides: n = {},
    ignoreExamples: r = !1,
    faker: o = M,
    propertyName: i,
    _overridePath: s = "",
    arrayLengths: a = {},
    maxDepth: c = 3,
    _depth: f = 0,
    _visitedSchemas: u = /* @__PURE__ */ new Set()
  } = e, p = {
    overrides: n,
    ignoreExamples: r,
    faker: o,
    arrayLengths: a,
    maxDepth: c,
    _depth: f,
    _visitedSchemas: u
  };
  if (s && Object.prototype.hasOwnProperty.call(n, s))
    return n[s];
  if (tt(t) && o.datatype.boolean())
    return null;
  if (!r) {
    const y = t.example;
    if (y !== void 0)
      return y;
    const l = t.default;
    if (l !== void 0)
      return l;
  }
  const m = t["x-faker-method"];
  if (typeof m == "string")
    return G(o, m);
  if (i) {
    const y = t.type, l = Array.isArray(y) ? y.filter((x) => x !== "null") : y, d = yt(i, l);
    if (d)
      try {
        return G(o, d);
      } catch {
      }
  }
  const h = t.allOf;
  if (h && h.length > 0) {
    const y = et(h);
    return T(y, { ...p, propertyName: i, _overridePath: s });
  }
  const g = t.oneOf;
  if (g && g.length > 0)
    return jt(g, t, { ...p, propertyName: i, _overridePath: s });
  const v = t.anyOf;
  if (v && v.length > 0)
    return St(v, { ...p, propertyName: i, _overridePath: s });
  const b = Q(t);
  return b === "object" ? Mt(t, p, s) : b === "array" ? $t(t, p, s, i) : L(t, o);
}
function jt(t, e, n) {
  const { faker: r = M } = n, o = e.discriminator;
  let i, s;
  if (o?.propertyName && o.mapping) {
    const c = Object.entries(o.mapping), [, f] = c[r.number.int({ min: 0, max: c.length - 1 })];
    s = Object.keys(o.mapping)[c.findIndex(([, p]) => p === f)], i = t.find((p) => {
      const m = p.$ref;
      return typeof m == "string" ? m === f : !1;
    }) ?? t[r.number.int({ min: 0, max: t.length - 1 })];
  } else if (i = t[r.number.int({ min: 0, max: t.length - 1 })], o?.propertyName) {
    const f = i.properties?.[o.propertyName];
    if (f) {
      const u = f.enum;
      u && u.length > 0 && (s = String(u[0]));
      const p = f.const;
      p !== void 0 && (s = String(p));
    }
  }
  const a = T(i, n);
  return o?.propertyName && s !== void 0 && typeof a == "object" && a !== null && (a[o.propertyName] = s), a;
}
function St(t, e) {
  const { faker: n = M } = e, r = n.number.int({ min: 1, max: t.length }), i = n.helpers.shuffle([...t]).slice(0, r);
  if (i.length === 1)
    return T(i[0], e);
  const s = et(i);
  return T(s, e);
}
function Mt(t, e, n) {
  const { faker: r = M, overrides: o = {}, _depth: i = 0, maxDepth: s = 3, _visitedSchemas: a = /* @__PURE__ */ new Set() } = e, c = t.properties, f = t.required;
  if (!c)
    return {};
  const u = {};
  for (const [p, m] of Object.entries(c)) {
    const h = f?.includes(p) ?? !1, g = n ? `${n}.${p}` : p, v = Object.keys(o).some(
      (l) => l === g || l.startsWith(`${g}.`)
    );
    if (!h && !v && r.datatype.boolean())
      continue;
    const b = m;
    if (a.has(b) && i >= s) {
      h && (u[p] = It(m, e));
      continue;
    }
    const y = new Set(a);
    y.add(b), u[p] = T(m, {
      ...e,
      propertyName: p,
      _overridePath: g,
      _depth: i + 1,
      _visitedSchemas: y
    });
  }
  for (const [p, m] of Object.entries(o)) {
    const h = n ? `${n}.` : "";
    if (p.startsWith(h)) {
      const g = p.slice(h.length);
      g.includes(".") || (u[g] = m);
    }
  }
  return u;
}
function $t(t, e, n, r) {
  const { faker: o = M, arrayLengths: i = {} } = e, s = t.minItems, a = t.maxItems, c = t.items;
  let f = 0, u = 5;
  s !== void 0 && (f = s), a !== void 0 && (u = a);
  const p = r && i[r] !== void 0 ? r : n && i[n] !== void 0 ? n : void 0;
  if (p !== void 0) {
    const [l, d] = i[p];
    f = Math.max(f, l), u = Math.min(u, d), l === d && (f = l, u = d);
  }
  f > u && (u = f);
  const m = o.number.int({ min: f, max: u }), h = [], g = [];
  n && g.push(`${n}[*].`), r && r !== n && g.push(`${r}[*].`);
  const v = {}, b = /* @__PURE__ */ new Set();
  for (const [l, d] of Object.entries(i))
    for (const x of g)
      if (l.startsWith(x)) {
        const w = l.slice(x.length);
        v[w] = d, b.add(l);
        break;
      }
  let y = i;
  if (b.size > 0) {
    const l = {};
    for (const [d, x] of Object.entries(i))
      b.has(d) || (l[d] = x);
    y = { ...l, ...v };
  }
  for (let l = 0; l < m; l++) {
    const d = n ? `${n}.${l}` : String(l);
    h.push(
      c ? T(c, {
        ...e,
        arrayLengths: y,
        propertyName: void 0,
        _overridePath: d
      }) : o.lorem.word()
    );
  }
  return h;
}
function It(t, e) {
  const { faker: n = M } = e;
  if (tt(t)) return null;
  switch (Q(t)) {
    case "string":
      return "";
    case "number":
      return 0;
    case "integer":
      return 0;
    case "boolean":
      return !1;
    case "array":
      return [];
    case "object":
      return {};
    default:
      return null;
  }
}
function Dt(t, e = {}) {
  const { seed: n, ignoreExamples: r = !1, overrides: o = {}, arrayLengths: i = {}, maxDepth: s = 3 } = e, a = new _({ locale: [P] });
  return n !== void 0 && a.seed(n), T(t, {
    faker: a,
    ignoreExamples: r,
    overrides: o,
    arrayLengths: i,
    maxDepth: s
  });
}
async function kt(t) {
  let e;
  typeof t == "string" ? t.startsWith("http://") || t.startsWith("https://") ? e = t : t.trimStart().startsWith("{") ? e = JSON.parse(t) : e = t : e = t;
  const n = await ft.dereference(e), r = n.openapi;
  if (!r || !r.startsWith("3."))
    throw new O(
      `openapi-mocks: expected an OpenAPI 3.x document but got ${r ? `openapi: "${r}"` : 'no "openapi" field'}`
    );
  return n;
}
function At(t, e, n) {
  const r = e.split(".");
  let o = t;
  for (let s = 0; s < r.length - 1; s++) {
    const a = r[s], c = r[s + 1], f = /^\d+$/.test(c);
    if (typeof o != "object" || o === null)
      return;
    const u = o;
    if (!(a in u))
      u[a] = f ? [] : {};
    else if (typeof u[a] != "object" || u[a] === null)
      return;
    o = u[a];
  }
  const i = r[r.length - 1];
  typeof o == "object" && o !== null && (o[i] = n);
}
function Et(t, e) {
  for (const [n, r] of Object.entries(e))
    At(t, n, r);
}
function Nt(t) {
  return t.replace(/([A-Z])/g, (e) => `_${e.toLowerCase()}`).replace(/^_/, "");
}
function Ct(t) {
  return t.replace(/_([a-z])/g, (e, n) => n.toUpperCase());
}
function _t(t) {
  const e = /* @__PURE__ */ new Set();
  e.add(t), /[A-Z]/.test(t) && e.add(Nt(t)), t.includes("_") && e.add(Ct(t));
  const n = t.toLowerCase();
  return n.endsWith("id") && n !== "id" && e.add("id"), Array.from(e);
}
function Pt(t, e, n) {
  if (!t || typeof t != "object") return t;
  for (const [r, o] of Object.entries(e)) {
    const i = _t(r);
    for (const s of i)
      if (Object.prototype.hasOwnProperty.call(t, s)) {
        const c = n?.properties?.[s]?.type;
        if (c === "integer" || c === "number" || Array.isArray(c) && (c.includes("integer") || c.includes("number"))) {
          const u = Number(o);
          t[s] = isNaN(u) ? o : u;
        } else
          t[s] = o;
        break;
      }
  }
  return t;
}
const Lt = ["get", "put", "post", "delete", "options", "head", "patch", "trace"];
function X(t) {
  const e = [], n = t.paths ?? {};
  for (const [r, o] of Object.entries(n))
    if (o)
      for (const i of Lt) {
        const s = o[i];
        if (!s) continue;
        const a = s.operationId;
        a && e.push({ operationId: a, method: i, path: r, operation: s });
      }
  return e;
}
function Z(t, e, n) {
  const r = t.responses ?? {}, o = Object.keys(r).map((s) => parseInt(s, 10)).filter((s) => !isNaN(s));
  if (e?.statusCode !== void 0) {
    const s = e.statusCode;
    return o.includes(s) ? [s] : (console.warn(
      `openapi-mocks: operation has no response defined for status code ${s}`
    ), []);
  }
  if (n && n.length > 0)
    return n.filter((s) => o.includes(s));
  const i = o.filter((s) => s >= 200 && s < 300).sort((s, a) => s - a);
  return i.length === 0 ? (console.warn(
    `openapi-mocks: operation "${t.operationId}" has no 2xx response defined — skipping`
  ), []) : [i[0]];
}
function J(t, e) {
  const n = t.content;
  if (!n) return;
  const r = n["application/json"];
  if (!r) {
    const o = Object.keys(n);
    if (o.length > 0) {
      const i = e ? ` for operation "${e}"` : "";
      console.warn(
        `openapi-mocks: response${i} has no application/json content type (found: ${o.join(", ")}) — skipping`
      );
    }
    return;
  }
  return r.schema;
}
function Ft(t) {
  return t.replace(/\{([^}]+)\}/g, ":$1");
}
function Vt(t, e = {}) {
  const {
    seed: n,
    ignoreExamples: r = !1,
    maxDepth: o = 3,
    baseUrl: i = "",
    echoPathParams: s = !1,
    statusCodes: a
  } = e;
  let c;
  function f() {
    return c || (c = kt(t)), c;
  }
  function u(p, m, h, g, v, b) {
    const y = p.responses?.[String(h)];
    if (!y) return;
    const l = J(y, p.operationId);
    if (!l) return;
    let d = T(l, {
      faker: g,
      ignoreExamples: v,
      overrides: {},
      arrayLengths: m?.arrayLengths ?? {},
      maxDepth: o
    });
    if (m?.overrides && typeof d == "object" && d !== null && Et(d, m.overrides), m?.transform && typeof d == "object" && d !== null) {
      const x = m.transform({ ...d }, b);
      x !== void 0 && (d = x);
    }
    return d;
  }
  return {
    async data(p = {}) {
      const m = await f(), { operations: h, statusCodes: g, ignoreExamples: v } = p, b = v ?? r, y = g ?? a, l = new _({ locale: [P] });
      n !== void 0 && l.seed(n);
      const d = /* @__PURE__ */ new Map(), x = X(m);
      for (const { operationId: w, operation: $ } of x) {
        if (h && !Object.prototype.hasOwnProperty.call(h, w))
          continue;
        const j = h?.[w], A = Z($, j, y);
        if (A.length === 0) continue;
        const I = /* @__PURE__ */ new Map();
        for (const S of A) {
          const k = u($, j, S, l, b);
          k !== void 0 && I.set(S, k);
        }
        I.size > 0 && d.set(w, I);
      }
      return d;
    },
    async handlers(p = {}) {
      let m;
      try {
        m = await import("msw");
      } catch {
        throw new O(
          "openapi-mocks: .handlers() requires msw. Install it with: npm install msw"
        );
      }
      const { http: h, HttpResponse: g } = m, v = await f(), { operations: b, statusCodes: y, ignoreExamples: l } = p, d = l ?? r, x = y ?? a, w = X(v), $ = [];
      for (const { operationId: j, method: A, path: I, operation: S } of w) {
        if (b && !Object.prototype.hasOwnProperty.call(b, j))
          continue;
        const k = b?.[j], F = Z(S, k, x);
        if (F.length === 0) continue;
        const R = F[0], z = S.responses?.[String(R)];
        if (!z) continue;
        const q = J(z, j);
        if (!q) continue;
        const D = Ft(I), nt = i ? `${i.replace(/\/$/, "")}${D}` : D, rt = S, ot = k, E = R, st = d, it = s, at = q, V = h[A];
        if (typeof V != "function") continue;
        const pt = V(nt, ({ request: ct, params: ut }) => {
          const W = new _({ locale: [P] });
          n !== void 0 && W.seed(n);
          const K = u(
            rt,
            ot,
            E,
            W,
            st,
            ct
          );
          if (K === void 0)
            return new g(null, { status: E });
          let N = { ...K };
          if (it) {
            const B = {};
            for (const [lt, C] of Object.entries(ut))
              B[lt] = Array.isArray(C) ? C[0] ?? "" : C;
            N = Pt(N, B, at);
          }
          return g.json(N, { status: E });
        });
        $.push(pt);
      }
      return $;
    }
  };
}
export {
  O as OpenApiMocksError,
  Vt as createMockClient,
  Dt as generateFromSchema
};
//# sourceMappingURL=openapi-mocks.browser.js.map
