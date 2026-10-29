export const adminHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Forever Memories Travel CMS</title>
<link rel="stylesheet" href="/admin.css">
</head>
<body>
<header class="top">
  <p class="sub">Staff CMS</p>
  <p class="brand">Forever Memories Travel</p>
</header>
<div id="app"></div>
<script src="/admin.js"></script>
</body>
</html>
`;

export const adminCss = `@font-face {
  font-family: "Cormorant Garamond";
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url("/admin/fonts/cormorant-garamond-500.woff2") format("woff2");
}
@font-face {
  font-family: "Nunito Sans";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("/admin/fonts/nunito-sans-400.woff2") format("woff2");
}
@font-face {
  font-family: "Nunito Sans";
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url("/admin/fonts/nunito-sans-700.woff2") format("woff2");
}
@font-face {
  font-family: "Nunito Sans";
  font-style: italic;
  font-weight: 400;
  font-display: swap;
  src: url("/admin/fonts/nunito-sans-400-italic.woff2") format("woff2");
}
:root {
  --navy: #074570;
  --navy-deep: #042c48;
  --red: #d93f2c;
  --gold: #d59d3b;
  --sky: #279fba;
  --ink: #1c2830;
  --paper: #f7f4ee;
  --white: #fff;
  --line: rgba(7, 69, 112, 0.16);
  --serif: "Cormorant Garamond", Georgia, serif;
  --sans: "Nunito Sans", "Segoe UI", sans-serif;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--sans);
  font-size: 1rem;
  line-height: 1.55;
}
a { color: var(--navy); }
.top {
  padding: 1.5rem 1rem 1rem;
  background:
    radial-gradient(ellipse at 50% 0%, rgba(39, 159, 186, 0.16), transparent 58%),
    var(--white);
  border-bottom: 1px solid var(--line);
}
.brand, .sub { width: min(1080px, calc(100% - 2rem)); margin-left: auto; margin-right: auto; }
.sub {
  margin: 0;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--navy);
}
.brand {
  margin: 0.35rem auto 0;
  font-family: var(--serif);
  font-weight: 500;
  font-size: 1.5rem;
  line-height: 1.15;
  color: var(--navy-deep);
}
.layout {
  display: flex;
  gap: 1.2rem;
  align-items: flex-start;
  width: min(1080px, calc(100% - 2rem));
  margin: 1.2rem auto 2.5rem;
}
nav {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 11rem;
  position: sticky;
  top: 0.75rem;
  padding: 0.7rem;
  background: var(--white);
  border-top: 3px solid var(--gold);
  box-shadow: 0 0 0 1px var(--line);
}
nav a {
  display: flex;
  align-items: center;
  min-height: 44px;
  padding: 0.3rem 0.75rem;
  border-radius: 999px;
  color: var(--navy);
  font-size: 0.92rem;
  font-weight: 700;
  text-decoration: none;
}
nav a:hover { background: var(--paper); color: var(--navy-deep); }
main { flex: 1; min-width: 0; }
main > p:first-child {
  margin: 0 0 0.35rem;
  color: var(--navy);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
h1, h2 { font-family: var(--serif); font-weight: 500; line-height: 1.15; }
h1 { margin: 0 0 0.6rem; color: var(--navy-deep); font-size: 1.8rem; }
h2 { margin: 1.2rem 0 0.45rem; color: var(--navy); font-size: 1.35rem; }
form h2:first-child, .card h2:first-child { margin-top: 0; }
#app > form { width: min(40rem, calc(100% - 2rem)); margin: 2rem auto; }
form, .card {
  margin: 0 0 1.2rem;
  padding: 1.2rem 1.2rem 1.4rem;
  background: var(--white);
  border-top: 3px solid var(--gold);
  box-shadow: 0 0 0 1px var(--line);
}
label {
  display: block;
  margin: 0.75rem 0 0.25rem;
  color: var(--navy);
  font-size: 0.92rem;
  font-weight: 700;
}
input, textarea, select {
  display: block;
  width: 100%;
  max-width: 40rem;
  min-height: 44px;
  padding: 0.65rem 0.7rem;
  border: 1px solid rgba(7, 69, 112, 0.28);
  border-radius: 0.4rem;
  background: var(--white);
  color: var(--ink);
  font: 400 1rem var(--sans);
}
textarea { min-height: 6rem; resize: vertical; }
button, .button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  margin: 0.75rem 0.5rem 0 0;
  padding: 0.55rem 1.3rem;
  border: 0;
  border-radius: 999px;
  background: var(--navy);
  color: white;
  font: 700 1rem var(--sans);
  line-height: 1.15;
  text-decoration: none;
  cursor: pointer;
}
button:hover, .button:hover { background: var(--navy-deep); }
button.danger, button.danger:hover { background: var(--red); color: white; }
button:disabled, button:disabled:hover, .button:disabled {
  background: #5b656c;
  color: #fff;
  opacity: 1;
  cursor: not-allowed;
}
main > button {
  background: var(--white);
  color: var(--navy);
  box-shadow: 0 0 0 1px var(--line);
}
main > button:hover { background: var(--paper); color: var(--navy-deep); }
button:focus, a:focus, input:focus, textarea:focus, select:focus {
  outline: 2px solid var(--sky);
  outline-offset: 2px;
}
.figures { display: grid; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr)); gap: 1rem; margin: 1rem 0; }
.figures a {
  display: block;
  min-height: 44px;
  padding: 1rem 1.1rem 1.15rem;
  background: var(--white);
  border-top: 3px solid var(--gold);
  box-shadow: 0 0 0 1px var(--line);
  color: inherit;
  text-decoration: none;
}
.figures a:hover { color: var(--navy-deep); }
.figures span {
  display: block;
  color: var(--navy);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.figures strong {
  display: block;
  margin-top: 0.35rem;
  color: var(--navy-deep);
  font-family: var(--serif);
  font-size: 1.5rem;
  font-weight: 500;
  line-height: 1.15;
  overflow-wrap: anywhere;
}
.table-wrap {
  overflow-x: auto;
  margin: 0.75rem 0 1rem;
  background: var(--white);
  border-top: 3px solid var(--gold);
  box-shadow: 0 0 0 1px var(--line);
}
table { width: 100%; border-collapse: collapse; }
th, td {
  padding: 0.7rem 0.75rem;
  border-bottom: 1px solid var(--line);
  text-align: left;
  vertical-align: top;
  overflow-wrap: anywhere;
}
th {
  background: var(--paper);
  color: var(--navy);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.table-wrap a { color: var(--navy); font-weight: 700; }
.note { max-width: 40rem; color: #5c6b74; }
.save-note { color: var(--navy-deep); font-weight: 700; }
.error, .error.save-note { color: var(--red); font-weight: 700; }
.staff-notes { display: grid; gap: 0.75rem; margin-top: 1rem; }
.staff-saved {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 0.75rem 1rem;
  margin-top: 0;
}
.staff-saved.is-deleted time,
.staff-saved.is-deleted .staff-author,
.staff-bubble.is-deleted { color: #5b656c; }
.staff-bubble.is-deleted {
  background: #eceae4;
  border-top-color: #c4bfb4;
  box-shadow: none;
}
tr.account-disabled td {
  color: #5b656c;
  background: #eceae4;
}
tr.account-deleted td {
  color: #1a1e22;
  background: #a39e96;
}
.account-actions button { margin-top: 0.25rem; }
.activity-log {
  max-height: 18rem;
  overflow: auto;
  background: var(--white);
  border-top: 3px solid var(--gold);
  box-shadow: 0 0 0 1px var(--line);
}
.activity-line {
  display: grid;
  grid-template-columns: 14.5rem minmax(8rem, 14rem) minmax(9rem, 13rem) minmax(0, 1fr);
  gap: 0.35rem 0.75rem;
  padding: 0.55rem 0.75rem;
  border-bottom: 1px solid var(--line);
  font-size: 0.92rem;
}
.activity-head {
  position: sticky;
  top: 0;
  background: var(--paper);
  color: var(--navy);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.staff-saved time {
  flex: 0 1 auto;
  margin: 0.35rem 0 0;
  color: var(--navy);
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.4;
}
.staff-bubble {
  flex: 1 1 16rem;
  margin: 0;
  padding: 0.85rem 1rem;
  background: var(--white);
  color: var(--ink);
  font-weight: 400;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  border-radius: 1rem;
  border-top: 3px solid var(--gold);
  box-shadow: 0 0 0 1px var(--line);
}
.staff-author {
  flex: 1 0 100%;
  margin: 0;
  color: var(--navy);
  font-size: 0.85rem;
  font-weight: 700;
  line-height: 1.4;
}
@media (max-width: 800px) {
  .layout { flex-direction: column; }
  nav { position: static; flex-direction: row; flex-wrap: wrap; }
  .activity-line { grid-template-columns: 1fr; }
}
`;

export const adminJs = String.raw`var app = document.querySelector("#app");
var LINKS = [
  ["#/home", "Home"],
  ["#/statistics", "Statistics"],
  ["#/copy", "Page copy"],
  ["#/stories", "Stories"],
  ["#/listings", "Listings"],
  ["#/images", "Images"],
  ["#/inquiries", "Inquiries"],
  ["#/publish", "Publish"],
  ["#/account", "Account"]
];
var SECTION_LABELS = {
  intro: "Intro",
  vacations: "Family vacations",
  parks: "Theme parks",
  cruises: "Cruises",
  international: "International",
  steps: "How a trip starts",
  plan: "Plan a trip"
};
var SECTION_ORDER = ["intro", "vacations", "parks", "cruises", "international", "steps", "plan"];
var SERVICE_ORDER = ["vacations", "parks", "cruises", "international"];
var STATUSES = ["new", "contacted", "planning", "booked", "closed", "spam"];
var LOGIN_FAIL = "That username and password did not match.";

function el(tag, attrs, children) {
  var node = document.createElement(tag);
  Object.keys(attrs || {}).forEach(function (key) {
    if (key === "class") node.className = attrs[key];
    else if (key.slice(0, 2) === "on") node.addEventListener(key.slice(2), attrs[key]);
    else if (attrs[key] != null) node.setAttribute(key, String(attrs[key]));
  });
  (children || []).forEach(function (child) {
    if (child == null || child === false) return;
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  });
  return node;
}

function dash(value) {
  return value == null || value === "" ? "—" : String(value);
}

function formatSeconds(value) {
  if (value == null || !isFinite(Number(value))) return "—";
  var total = Math.round(Number(value));
  var minutes = Math.floor(total / 60);
  var rest = total % 60;
  return minutes > 0 ? minutes + "m " + rest + "s" : rest + "s";
}

function api(path, options) {
  return fetch(path, options).then(function (response) {
    if (response.status === 204) return { response: response, data: null };
    return response.json().catch(function () { return null; }).then(function (data) {
      return { response: response, data: data };
    });
  });
}

function findDoc(docs, kind, slug) {
  return docs.filter(function (doc) { return doc.kind === kind && doc.slug === slug; })[0];
}

function field(label, value, name, multiline) {
  var input = multiline
    ? el("textarea", { name: name }, [])
    : el("input", { name: name, value: value || "" });
  if (multiline) input.value = value || "";
  return el("div", {}, [el("label", {}, [label]), input]);
}

function layout(user, page) {
  var nav = el("nav", {}, LINKS.map(function (link) {
    return el("a", { href: link[0] }, [link[1]]);
  }));
  var signOut = el("button", { type: "button", onclick: function () {
    api("/logout", { method: "POST" }).then(function () { render(); });
  } }, ["Sign out"]);
  app.replaceChildren(el("div", { class: "layout" }, [
    nav,
    el("main", {}, [el("p", {}, [user.username]), signOut, page])
  ]));
}

function showLogin(message) {
  var form = el("form", {}, [
    el("h1", {}, ["Sign in"]),
    field("Username", "", "username", false),
    el("label", {}, ["Password"]),
    el("input", { name: "password", type: "password", autocomplete: "current-password" }),
    el("button", { type: "submit" }, ["Sign in"]),
    message ? el("p", { class: "error" }, [message]) : null
  ]);
  form.username.setAttribute("autocomplete", "username");
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var button = form.querySelector("button");
    button.disabled = true;
    api("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: form.username.value, password: form.password.value })
    }).then(function (result) {
      if (!result.response.ok) {
        showLogin(LOGIN_FAIL);
        return;
      }
      location.hash = "#/home";
      render();
    });
  });
  app.replaceChildren(form);
}

function showPasswordChange(message) {
  var form = el("form", {}, [
    el("h1", {}, ["Choose a new password"]),
    el("p", {}, ["Set a password of 12 to 128 characters before using the CMS."]),
    el("label", {}, ["Current password"]),
    el("input", { name: "current_password", type: "password" }),
    el("label", {}, ["New password"]),
    el("input", { name: "new_password", type: "password" }),
    el("button", { type: "submit" }, ["Save password"]),
    message ? el("p", { class: "error" }, [message]) : null
  ]);
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    api("/api/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        current_password: form.current_password.value,
        new_password: form.new_password.value
      })
    }).then(function (result) {
      if (!result.response.ok) {
        showPasswordChange((result.data && result.data.error) || "The password was not changed.");
        return;
      }
      location.hash = "#/home";
      render();
    });
  });
  app.replaceChildren(form);
}

function homePage() {
  var page = el("section", {}, [el("h1", {}, ["Home"]), el("p", {}, ["Loading"])]);
  Promise.all([
    api("/api/documents"),
    api("/api/inquiries"),
    api("/api/statistics")
  ]).then(function (results) {
    var docs = results[0].response.ok && results[0].data ? results[0].data.documents : [];
    var drafts = docs.filter(function (doc) { return doc.status === "draft"; }).length;
    var publish = findDoc(docs, "agency", "publish");
    var publishLine = publish && publish.body && publish.body.publishedAt
      ? publish.body.publishedAt + (publish.body.commit ? " (" + publish.body.commit.slice(0, 7) + ")" : "")
      : "Not published from this admin yet.";
    var inquiry = results[1];
    var inquiryLine = inquiry.response.status === 503 || !inquiry.response.ok
      ? el("p", {}, [(inquiry.data && inquiry.data.error) || "The inquiry store is not reachable."])
      : el("p", {}, ["New trip requests: " + (inquiry.data.inquiries || []).filter(function (row) {
          return row.status === "new";
        }).length]);
    var stats = results[2];
    var figures;
    if (!stats.response.ok) {
      figures = el("p", {}, [(stats.data && stats.data.error) || "Statistics are not reachable."]);
    } else {
      var users = stats.data.activeUsers;
      var seconds = stats.data.engagementSeconds;
      var average = users && seconds != null ? formatSeconds(Number(seconds) / Number(users)) : "—";
      var longest = stats.data.longestSection ? (SECTION_LABELS[stats.data.longestSection] || stats.data.longestSection) : "—";
      figures = el("div", { class: "figures" }, [
        el("a", { href: "#/statistics" }, [el("span", {}, ["People"]), el("strong", {}, [dash(users)])]),
        el("a", { href: "#/statistics" }, [el("span", {}, ["Average time in view"]), el("strong", {}, [average])]),
        el("a", { href: "#/statistics" }, [el("span", {}, ["Longest section"]), el("strong", {}, [longest])])
      ]);
    }
    page.replaceChildren(
      el("h1", {}, ["Home"]),
      el("p", {}, ["Drafts: " + drafts]),
      el("p", {}, ["Last publish: " + publishLine]),
      inquiryLine,
      figures
    );
  });
  return page;
}

function statisticsPage() {
  var page = el("section", {}, [el("h1", {}, ["Statistics"]), el("p", {}, ["Loading"])]);
  api("/api/statistics").then(function (result) {
    if (!result.response.ok) {
      page.replaceChildren(el("h1", {}, ["Statistics"]), el("p", {}, [(result.data && result.data.error) || "Statistics are not reachable."]));
      return;
    }
    var data = result.data;
    var users = data.activeUsers;
    var seconds = data.engagementSeconds;
    var average = users && seconds != null ? formatSeconds(Number(seconds) / Number(users)) : "—";
    var longest = data.longestSection ? (SECTION_LABELS[data.longestSection] || data.longestSection) : "—";
    var body = el("tbody", {}, SECTION_ORDER.map(function (name) {
      var row = (data.sections || []).filter(function (item) { return item.name === name; })[0] || {};
      return el("tr", {}, [
        el("td", {}, [SECTION_LABELS[name]]),
        el("td", {}, [dash(row.users)]),
        el("td", {}, [row.visibleMsec == null ? "—" : formatSeconds(Number(row.visibleMsec) / 1000)])
      ]);
    }));
    page.replaceChildren(
      el("h1", {}, ["Statistics"]),
      el("p", {}, ["Last 28 days. A dash means no row yet."]),
      el("div", { class: "figures" }, [
        el("a", { href: "#/statistics" }, [el("span", {}, ["People"]), el("strong", {}, [dash(users)])]),
        el("a", { href: "#/statistics" }, [el("span", {}, ["Average time in view"]), el("strong", {}, [average])]),
        el("a", { href: "#/statistics" }, [el("span", {}, ["Longest section"]), el("strong", {}, [longest])])
      ]),
      el("div", { class: "table-wrap" }, [el("table", {}, [
        el("thead", {}, [el("tr", {}, [el("th", {}, ["Section"]), el("th", {}, ["People"]), el("th", {}, ["Time in view"])])]),
        body
      ])])
    );
  });
  return page;
}

function saveDocs(form, pairs) {
  var button = form.querySelector("button");
  button.disabled = true;
  var jobs = pairs.map(function (pair) {
    return api("/api/documents/" + encodeURIComponent(pair.doc.id), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: pair.body() })
    });
  });
  Promise.all(jobs).then(function (results) {
    button.disabled = false;
    var failed = results.filter(function (result) { return !result.response.ok; })[0];
    var note = form.querySelector(".save-note");
    if (note) note.remove();
    form.append(el("p", { class: failed ? "error save-note" : "save-note" }, [
      failed ? ((failed.data && failed.data.error) || "The copy was not saved.") : "Saved in the admin. The public site changes after Publish."
    ]));
  });
}

function copyPage() {
  var page = el("section", {}, [el("h1", {}, ["Page copy"]), el("p", {}, ["Loading"])]);
  api("/api/documents").then(function (result) {
    if (!result.response.ok) {
      page.replaceChildren(el("h1", {}, ["Page copy"]), el("p", { class: "error" }, ["The page copy could not be loaded."]));
      return;
    }
    var docs = result.data.documents;
    var agency = findDoc(docs, "agency", "agency");
    var intro = findDoc(docs, "agency", "intro");
    var plan = findDoc(docs, "plan", "plan");
    var form = el("form", {}, [
      el("p", { class: "note" }, ["The public site changes after Publish."])
    ]);
    if (agency) {
      form.append(field("Eyebrow", agency.body.eyebrow, "eyebrow", false));
      form.append(field("Footer line", agency.body.footerLine, "footerLine", true));
    }
    if (intro) {
      form.append(field("Intro heading", intro.body.heading, "introHeading", false));
      form.append(field("Intro lede", intro.body.lede, "introLede", true));
    }
    SERVICE_ORDER.forEach(function (slug) {
      var doc = findDoc(docs, "section", slug);
      if (!doc) return;
      form.append(el("h2", {}, [doc.body.kicker || slug]));
      form.append(field("Kicker", doc.body.kicker, slug + "Kicker", false));
      form.append(field("Heading", doc.body.heading, slug + "Heading", false));
      form.append(field("Body", doc.body.body, slug + "Body", true));
    });
    docs.filter(function (doc) { return doc.kind === "step"; }).sort(function (a, b) {
      return Number(a.body.order || 0) - Number(b.body.order || 0);
    }).forEach(function (doc, index) {
      form.append(field("Step " + (index + 1) + " title", doc.body.title, "stepTitle" + doc.id, false));
      form.append(field("Step " + (index + 1) + " body", doc.body.body, "stepBody" + doc.id, true));
    });
    if (plan) {
      form.append(field("Plan kicker", plan.body.kicker, "planKicker", false));
      form.append(field("Plan heading", plan.body.heading, "planHeading", false));
      form.append(field("Plan body", plan.body.body, "planBody", true));
    }
    form.append(el("button", { type: "submit" }, ["Save page copy"]));
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var pairs = [];
      if (agency) pairs.push({ doc: agency, body: function () {
        return { name: agency.body.name, eyebrow: form.eyebrow.value, footerLine: form.footerLine.value };
      } });
      if (intro) pairs.push({ doc: intro, body: function () {
        return { heading: form.introHeading.value, lede: form.introLede.value };
      } });
      SERVICE_ORDER.forEach(function (slug) {
        var doc = findDoc(docs, "section", slug);
        if (!doc) return;
        pairs.push({ doc: doc, body: function () {
          return { kicker: form[slug + "Kicker"].value, heading: form[slug + "Heading"].value, body: form[slug + "Body"].value };
        } });
      });
      docs.filter(function (doc) { return doc.kind === "step"; }).forEach(function (doc) {
        pairs.push({ doc: doc, body: function () {
          return { title: form["stepTitle" + doc.id].value, body: form["stepBody" + doc.id].value, order: doc.body.order };
        } });
      });
      if (plan) pairs.push({ doc: plan, body: function () {
        return { kicker: form.planKicker.value, heading: form.planHeading.value, body: form.planBody.value };
      } });
      saveDocs(form, pairs);
    });
    page.replaceChildren(el("h1", {}, ["Page copy"]), form);
  });
  return page;
}

function collectionPage(kind, title) {
  var page = el("section", {}, [el("h1", {}, [title])]);
  api("/api/documents").then(function (result) {
    if (!result.response.ok) {
      page.append(el("p", { class: "error" }, ["The list could not be loaded."]));
      return;
    }
    var items = result.data.documents.filter(function (doc) { return doc.kind === kind; });
    items.forEach(function (doc) { page.append(itemCard(kind, doc)); });
    page.append(itemCard(kind, null));
  });
  return page;
}

function itemCard(kind, doc) {
  var body = doc ? doc.body : { title: "", summary: "", body: "", image: "", imageAlt: "", category: "family", slug: "" };
  var form = el("form", { class: "card" }, [
    el("h2", {}, [doc ? body.title : "New " + kind]),
    field("Title", body.title, "title", false),
    field("Slug", doc ? doc.slug : "", "slug", false),
    field("Summary", body.summary, "summary", true),
    field("Body", body.body, "body", true),
    field("Image path", body.image || "", "image", false),
    field("Image alt", body.imageAlt || "", "imageAlt", false)
  ]);
  if (kind === "listing") {
    var select = el("select", { name: "category" }, ["family", "park", "cruise", "international", "all-inclusive", "celebration"].map(function (category) {
      return el("option", { value: category }, [category]);
    }));
    select.value = body.category || "family";
    form.append(el("label", {}, ["Category"]), select);
  }
  if (doc) {
    var status = el("select", { name: "status" }, [
      el("option", { value: "draft" }, ["draft"]),
      el("option", { value: "published" }, ["published"])
    ]);
    status.value = doc.status;
    form.append(el("label", {}, ["Status"]), status);
  }
  form.append(el("button", { type: "submit" }, [doc ? "Save" : "Create draft"]));
  if (doc) {
    form.append(el("button", { type: "button", class: "danger", onclick: function () {
      api("/api/documents/" + encodeURIComponent(doc.id), { method: "DELETE" }).then(function () {
        location.hash = kind === "story" ? "#/stories" : "#/listings";
        render();
      });
    } }, [doc.status === "published" ? "Unpublish" : "Delete draft"]));
  }
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var payload = {
      kind: kind,
      title: form.title.value,
      slug: form.slug.value,
      summary: form.summary.value,
      body: form.body.value,
      image: form.image.value,
      imageAlt: form.imageAlt.value
    };
    if (kind === "listing") payload.category = form.category.value;
    var path = doc ? "/api/documents/" + encodeURIComponent(doc.id) : "/api/documents";
    var sent = doc ? { body: payload, status: form.status.value } : payload;
    api(path, {
      method: doc ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sent)
    }).then(function (result) {
      var note = form.querySelector(".save-note");
      if (note) note.remove();
      form.append(el("p", { class: result.response.ok ? "save-note" : "error save-note" }, [
        result.response.ok ? "Saved." : ((result.data && result.data.error) || "Not saved.")
      ]));
      if (result.response.ok && !doc) render();
    });
  });
  return form;
}

function imagesPage() {
  var form = el("form", {}, [
    el("h1", {}, ["Images"]),
    el("p", { class: "note" }, ["JPEG, PNG, or WebP. 900 KB or less. Alt text is required."]),
    el("label", {}, ["Image"]),
    el("input", { name: "file", type: "file", accept: "image/jpeg,image/png,image/webp" }),
    field("Alt text", "", "alt", false),
    el("button", { type: "submit" }, ["Upload"])
  ]);
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var data = new FormData();
    data.set("file", form.file.files[0]);
    data.set("alt", form.alt.value);
    api("/api/media", { method: "POST", body: data }).then(function (result) {
      var note = form.querySelector(".save-note");
      if (note) note.remove();
      var message = result.response.ok
        ? "Saved as " + result.data.path
        : ((result.data && result.data.error) || "The image was not uploaded.");
      form.append(el("p", { class: result.response.ok ? "save-note" : "error save-note" }, [message]));
    });
  });
  return form;
}

function publishPage() {
  var page = el("section", {}, [
    el("h1", {}, ["Publish"]),
    el("p", { class: "note" }, ["Publish sends the saved page to the public site. GitHub Pages can take a few minutes to show it."]),
    el("button", { type: "button", onclick: function (event) {
      var button = event.currentTarget;
      button.disabled = true;
      api("/api/publish", { method: "POST" }).then(function (result) {
        button.disabled = false;
        var old = page.querySelector(".save-note");
        if (old) old.remove();
        var message = result.response.ok
          ? "Published " + (result.data.commit || "") + ". " + (result.data.note || "")
          : ((result.data && result.data.error) || "Publish did not finish.");
        page.append(el("p", { class: result.response.ok ? "save-note" : "error save-note" }, [message]));
      });
    } }, ["Publish"])
  ]);
  return page;
}

function mountainTime(iso) {
  if (!iso) return "";
  var date = new Date(iso);
  if (isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  }).format(date);
}

function noteStamp(iso) {
  if (!iso) return "";
  var date = new Date(iso);
  if (isNaN(date.getTime())) return "";
  var parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h12",
    timeZoneName: "short"
  }).formatToParts(date);
  var bag = {};
  parts.forEach(function (part) {
    if (part.type !== "literal") bag[part.type] = part.value;
  });
  if (!bag.month || !bag.day || !bag.year || !bag.hour || !bag.minute || !bag.second || !bag.dayPeriod || !bag.timeZoneName) return "";
  return bag.month + "/" + bag.day + "/" + bag.year + " " + bag.hour + ":" + bag.minute + ":" + bag.second + " " + bag.dayPeriod + " " + bag.timeZoneName;
}

var TWO_DAYS = 2 * 24 * 60 * 60 * 1000;

function staffNoteEntry(entry, inquiryId, notesBox) {
  if (!entry || !entry.created_at) return null;
  var deleted = Boolean(entry.deleted_at);
  if (deleted) {
    var hideAt = new Date(entry.deleted_at).getTime() + TWO_DAYS;
    if (!isNaN(hideAt) && hideAt <= Date.now()) return null;
  }
  var stamp = noteStamp(entry.created_at);
  if (!stamp) return null;
  var row = el("div", { class: deleted ? "staff-saved is-deleted" : "staff-saved" }, [
    el("time", { datetime: entry.created_at }, [deleted ? "Deleted · " + stamp : stamp]),
    el("p", { class: deleted ? "staff-bubble is-deleted" : "staff-bubble" }, [entry.body || ""])
  ]);
  if (deleted && !isNaN(hideAt)) {
    setTimeout(function () { row.remove(); }, hideAt - Date.now());
  }
  if (!deleted) {
    var button = el("button", { type: "button", class: "danger" }, ["Delete"]);
    button.addEventListener("click", function () {
      button.disabled = true;
      api("/api/inquiries/" + encodeURIComponent(inquiryId) + "/notes/" + encodeURIComponent(entry.id), {
        method: "DELETE"
      }).then(function (result) {
        var oldError = notesBox.querySelector(".save-note");
        if (oldError) oldError.remove();
        if (!result.response.ok || !result.data || !result.data.staff_note_entries) {
          button.disabled = false;
          notesBox.append(el("p", { class: "error save-note" }, [
            (result.data && result.data.error) || "The inquiry store is not reachable."
          ]));
          return;
        }
        renderStaffNotes(notesBox, result.data.staff_note_entries, inquiryId);
      });
    });
    row.append(button);
  }
  row.append(el("p", { class: "staff-author" }, [entry.created_by || "—"]));
  return row;
}

function renderStaffNotes(notesBox, entries, inquiryId) {
  var nodes = (entries || []).map(function (entry) {
    return staffNoteEntry(entry, inquiryId, notesBox);
  }).filter(Boolean);
  notesBox.replaceChildren.apply(notesBox, nodes);
}

function inquiriesPage(id) {
  var page = el("section", {}, [el("h1", {}, ["Inquiries"]), el("p", {}, ["Loading"])]);
  if (id) {
    api("/api/inquiries/" + encodeURIComponent(id)).then(function (result) {
      if (!result.response.ok) {
        page.replaceChildren(
          el("h1", {}, ["Inquiries"]),
          el("p", {}, [result.response.status === 503 ? "The inquiry store is not reachable." : ((result.data && result.data.error) || "That trip request was not found.")])
        );
        return;
      }
      var row = result.data;
      var form = el("form", {}, [
        el("p", {}, ["Submitted " + (mountainTime(row.submitted_at) || "—")]),
        el("p", {}, [row.name + " · " + row.email]),
        el("p", {}, ["Phone: " + (row.phone || "—")]),
        el("p", {}, ["Trip: " + row.trip]),
        el("p", {}, ["When: " + (row.travel_when || "—")]),
        el("p", {}, ["Who: " + (row.party || "—")]),
        el("p", {}, ["Notes: " + (row.notes || "—")]),
        el("p", {}, ["Visitor email: " + row.visitor_email_status]),
        el("p", {}, ["Agency email: " + row.ryan_email_status])
      ]);
      var status = el("select", { name: "status" }, STATUSES.map(function (value) {
        return el("option", { value: value }, [value]);
      }));
      status.value = row.status;
      form.append(el("label", {}, ["Status"]), status, field("Staff notes", "", "staff_notes", true));
      form.append(el("button", { type: "submit" }, ["Save"]));
      var notesBox = el("div", { class: "staff-notes" });
      form.append(notesBox);
      renderStaffNotes(notesBox, row.staff_note_entries || [], id);
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        api("/api/inquiries/" + encodeURIComponent(id), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: form.status.value, staff_notes: form.staff_notes.value })
        }).then(function (saved) {
          var oldError = form.querySelector(".save-note");
          if (oldError) oldError.remove();
          if (!saved.response.ok || !saved.data || !saved.data.staff_note_entries) {
            form.append(el("p", { class: "error save-note" }, [
              (saved.data && saved.data.error) || "The inquiry store is not reachable."
            ]));
            return;
          }
          form.staff_notes.value = "";
          if (saved.data.status) status.value = saved.data.status;
          renderStaffNotes(notesBox, saved.data.staff_note_entries, id);
        });
      });
      page.replaceChildren(el("h1", {}, ["Inquiry"]), el("p", {}, [el("a", { href: "#/inquiries" }, ["Back to the list"])]), form);
    });
    return page;
  }
  api("/api/inquiries").then(function (result) {
    if (!result.response.ok) {
      page.replaceChildren(el("h1", {}, ["Inquiries"]), el("p", {}, ["The inquiry store is not reachable."]));
      return;
    }
    var rows = result.data.inquiries || [];
    if (!rows.length) {
      page.replaceChildren(el("h1", {}, ["Inquiries"]), el("p", {}, ["No trip requests yet."]));
      return;
    }
    var body = el("tbody", {}, rows.map(function (row) {
      return el("tr", {}, [
        el("td", {}, [mountainTime(row.submitted_at) || "—"]),
        el("td", {}, [el("a", { href: "#/inquiries/" + row.id }, [row.name || ""])]),
        el("td", {}, [row.email || ""]),
        el("td", {}, [row.trip || ""]),
        el("td", {}, [row.status || ""])
      ]);
    }));
    page.replaceChildren(
      el("h1", {}, ["Inquiries"]),
      el("div", { class: "table-wrap" }, [el("table", {}, [
        el("thead", {}, [el("tr", {}, ["Submitted", "Name", "Email", "Trip", "Status"].map(function (label) { return el("th", {}, [label]); }))]),
        body
      ])])
    );
  });
  return page;
}

var FIVE_DAYS = 5 * 24 * 60 * 60 * 1000;

function accountStatus(account) {
  if (account && account.deleted_at) return "Deleted";
  if (account && account.disabled) return "Disabled";
  if (account && account.must_change_password) return "Active, must change password";
  return "Active";
}

function accountClass(account) {
  if (account && account.deleted_at) return "account-deleted";
  if (account && account.disabled) return "account-disabled";
  return "";
}

function accountButtons(account, me) {
  if (!account) return [];
  if (account.deleted_at) return ["Reset password", "Restore"];
  if (account.username === me) return [];
  return ["Reset password", account.disabled ? "Enable" : "Disable", "Delete"];
}

function accountLeaves(deletedAt) {
  if (!deletedAt) return "";
  var parsed = new Date(deletedAt).getTime();
  if (isNaN(parsed)) return "";
  return noteStamp(new Date(parsed + FIVE_DAYS).toISOString());
}

function accountRow(account, me, onAction) {
  if (!account || !account.username) return null;
  var deleted = Boolean(account.deleted_at);
  var hideAt = deleted ? new Date(account.deleted_at).getTime() + FIVE_DAYS : NaN;
  if (deleted && !isNaN(hideAt) && hideAt <= Date.now()) return null;
  var leaves = deleted ? accountLeaves(account.deleted_at) : "";
  var status = leaves ? accountStatus(account) + ". Gone after " + leaves + "." : accountStatus(account);
  var buttons = accountButtons(account, me);
  var actions = buttons.length
    ? el("div", { class: "account-actions" }, buttons.map(function (label) {
        var attrs = { type: "button", onclick: function () { onAction(account, label); } };
        if (label === "Delete") attrs.class = "danger";
        return el("button", attrs, [label]);
      }))
    : el("span", {}, ["This account is you."]);
  var row = el("tr", { class: accountClass(account) }, [
    el("td", {}, [account.username]),
    el("td", {}, [status]),
    el("td", {}, [el("time", { datetime: account.last_login_at || "" }, [noteStamp(account.last_login_at) || "—"])]),
    el("td", {}, [actions])
  ]);
  if (deleted && !isNaN(hideAt)) setTimeout(function () { row.remove(); }, hideAt - Date.now());
  return row;
}

function loadAccounts(listNode, me, onAction) {
  api("/api/staff").then(function (result) {
    if (!result.response.ok) {
      listNode.replaceChildren(el("p", { class: "error" }, [
        (result.data && result.data.error) || "The account list is not reachable."
      ]));
      return;
    }
    var accounts = (result.data && result.data.accounts) || [];
    var who = (result.data && result.data.you) || me;
    if (!accounts.length) {
      listNode.replaceChildren(el("p", {}, ["No accounts."]));
      return;
    }
    listNode.replaceChildren(el("div", { class: "table-wrap" }, [el("table", {}, [
      el("thead", {}, [el("tr", {}, ["Username", "Status", "Last sign-in", "Actions"].map(function (label) {
        return el("th", {}, [label]);
      }))]),
      el("tbody", {}, accounts.map(function (account) { return accountRow(account, who, onAction); }))
    ])]));
  });
}

function loadActivity(logNode) {
  api("/api/staff/activity").then(function (result) {
    var head = el("div", { class: "activity-line activity-head" }, ["When", "Who", "Action", "Detail"].map(function (label) {
      return el("span", {}, [label]);
    }));
    if (!result.response.ok) {
      logNode.replaceChildren(head, el("p", { class: "error" }, [
        (result.data && result.data.error) || "The activity log is not reachable."
      ]));
      return;
    }
    var events = (result.data && result.data.events) || [];
    if (!events.length) {
      logNode.replaceChildren(head, el("p", {}, ["No activity yet."]));
      return;
    }
    var lines = events.map(function (event) {
      return el("div", { class: "activity-line" }, [
        el("time", { datetime: event.at || "" }, [noteStamp(event.at) || "—"]),
        el("span", {}, [event.actor || "—"]),
        el("span", {}, [event.action || ""]),
        el("span", {}, [event.detail || ""])
      ]);
    });
    logNode.replaceChildren.apply(logNode, [head].concat(lines));
  });
}

function accountPage(me) {
  var notice = el("div", {}, []);
  var listNode = el("div", {}, [el("p", {}, ["Loading accounts."])]);
  var logNode = el("div", { class: "activity-log" }, [el("p", {}, ["Loading activity."])]);
  function reload() {
    loadAccounts(listNode, me, function (account, label) {
      var prompts = {
        "Reset password": "Reset the password for " + account.username + "? Their current sign-in will end. The temporary password appears once on this page. This CMS does not email it.",
        Disable: "Disable " + account.username + "? They cannot sign in until the account is enabled.",
        Enable: "Enable " + account.username + "?",
        Delete: "Delete " + account.username + "? The account stays on this page for 5 days, in a darker grey, and can be restored. After 5 days it is removed forever.",
        Restore: "Restore " + account.username + "?"
      };
      if (!confirm(prompts[label] || "Continue?")) return;
      var action = {
        "Reset password": "reset",
        Disable: "disable",
        Enable: "enable",
        Delete: "delete",
        Restore: "restore"
      }[label];
      api("/api/staff/" + encodeURIComponent(account.id) + "/" + action, { method: "POST" }).then(function (result) {
        var text = !result.response.ok
          ? ((result.data && result.data.error) || "That account change did not finish.")
          : (label === "Reset password"
            ? "Temporary password for " + account.username + ": " + (result.data.temporary_password || "") + ". Tell them yourself. This CMS does not email it. They must change it before editing."
            : account.username + " updated.");
        notice.replaceChildren(el("p", { class: result.response.ok ? "save-note" : "error" }, [text]));
        reload();
      });
    });
    loadActivity(logNode);
  }
  var password = el("form", { class: "card" }, [
    el("h2", {}, ["Change password"]),
    el("label", {}, ["Current password"]),
    el("input", { name: "current_password", type: "password" }),
    el("label", {}, ["New password"]),
    el("input", { name: "new_password", type: "password" }),
    el("button", { type: "submit" }, ["Save password"])
  ]);
  password.addEventListener("submit", function (event) {
    event.preventDefault();
    api("/api/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        current_password: password.current_password.value,
        new_password: password.new_password.value
      })
    }).then(function (result) {
      password.append(el("p", { class: result.response.ok ? "" : "error" }, [
        result.response.ok ? "Password saved." : ((result.data && result.data.error) || "The password was not changed.")
      ]));
      if (result.response.ok) reload();
    });
  });
  var staff = el("form", { class: "card" }, [
    el("h2", {}, ["Add a staff user"]),
    el("p", { class: "note" }, ["Tell them the temporary password yourself. This CMS does not email it. They must change it before editing."]),
    field("Username", "", "username", false),
    el("label", {}, ["Temporary password"]),
    el("input", { name: "password", type: "password" }),
    el("button", { type: "submit" }, ["Add staff user"])
  ]);
  staff.addEventListener("submit", function (event) {
    event.preventDefault();
    api("/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: staff.username.value, password: staff.password.value })
    }).then(function (result) {
      staff.append(el("p", { class: result.response.ok ? "" : "error" }, [
        result.response.ok ? "Staff user added." : ((result.data && result.data.error) || "The user was not added.")
      ]));
      if (result.response.ok) reload();
    });
  });
  reload();
  return el("section", {}, [
    el("h1", {}, ["Account"]),
    password,
    staff,
    el("h2", {}, ["Staff accounts"]),
    notice,
    listNode,
    el("h2", {}, ["Activity"]),
    logNode
  ]);
}

function render() {
  api("/api/me").then(function (result) {
    if (!result.response.ok) {
      showLogin("");
      return;
    }
    if (result.data.must_change_password) {
      showPasswordChange("");
      return;
    }
    var hash = location.hash || "#/home";
    var page;
    if (hash === "#/statistics") page = statisticsPage();
    else if (hash === "#/copy") page = copyPage();
    else if (hash === "#/stories") page = collectionPage("story", "Stories");
    else if (hash === "#/listings") page = collectionPage("listing", "Listings");
    else if (hash === "#/images") page = imagesPage();
    else if (hash === "#/publish") page = publishPage();
    else if (hash === "#/account") page = accountPage(result.data.username || "");
    else if (hash.indexOf("#/inquiries/") === 0) page = inquiriesPage(hash.slice("#/inquiries/".length));
    else if (hash === "#/inquiries") page = inquiriesPage("");
    else page = homePage();
    layout(result.data, page);
  });
}

window.addEventListener("hashchange", render);
render();
`;
