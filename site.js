const form = document.querySelector("#trip-form");
const endpoint = "https://preview-inquiries.forevermemoriestravel.com/inquiries";

if (form) {
  const note = document.querySelector("#form-note");
  const submitButton = form.querySelector("button[type=submit]");
  const buttonLabel = submitButton.textContent;
  let locked = false;
  let attempt = { material: "", key: "" };

  function payloadMaterial(body) {
    return JSON.stringify(body);
  }

  function attemptKey(body) {
    const material = payloadMaterial(body);
    if (attempt.material !== material) {
      attempt = { material, key: crypto.randomUUID() };
    }
    return attempt.key;
  }

  function honeypotValue() {
    const control = form.elements.namedItem("fmt_hp");
    return control ? control.value : "";
  }

  function lockButton() {
    locked = true;
    submitButton.disabled = true;
    submitButton.textContent = "Sending your request…";
    submitButton.classList.add("is-pending");
    form.setAttribute("aria-busy", "true");
    note.textContent = "";
    note.setAttribute("role", "status");
  }

  function unlockButton(message) {
    locked = false;
    submitButton.disabled = false;
    submitButton.textContent = buttonLabel;
    submitButton.classList.remove("is-pending");
    form.removeAttribute("aria-busy");
    note.setAttribute("role", "alert");
    note.textContent = message;
    submitButton.focus();
  }

  const tripTypes = {
    "Family vacation": "family",
    "Theme park": "park",
    "Cruise": "cruise",
    "International": "international",
  };

  function leadParams() {
    const params = { lead_source: "trip_form" };
    const tripType = tripTypes[form.trip.value];
    if (tripType) {
      params.trip_type = tripType;
    }
    return params;
  }

  function recordLeadThen(go) {
    let moved = false;
    const once = () => {
      if (moved) {
        return;
      }
      moved = true;
      go();
    };
    if (typeof gtag === "function") {
      gtag("event", "generate_lead", {
        ...leadParams(),
        transport_type: "beacon",
        event_callback: once,
        event_timeout: 800,
      });
      window.setTimeout(once, 1000);
      return;
    }
    once();
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (locked) {
      return;
    }
    if (!form.reportValidity()) {
      return;
    }
    if (honeypotValue()) {
      return;
    }

    const body = {
      name: form.name.value,
      email: form.email.value,
      phone: form.phone.value,
      trip: form.trip.value,
      when: form.when.value,
      who: form.who.value,
      notes: form.notes.value,
      company: honeypotValue(),
      source_url: `${location.origin}${location.pathname}`,
    };
    body.idempotency_key = attemptKey(body);
    lockButton();

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 201 && result.id) {
        const mail = result.visitor_email === "sent" ? "sent" : "failed";
        const next = `thanks.html?ref=${encodeURIComponent(result.id)}&mail=${mail}`;
        recordLeadThen(() => window.location.assign(next));
        return;
      }
      if (response.status === 409) {
        attempt = { material: "", key: "" };
      }
      const message = response.status === 429
        ? "We already have several requests from this network. Please wait and try again."
        : "The request was not sent. Please try again.";
      unlockButton(message);
    } catch (error) {
      unlockButton("The request was not sent. Please try again.");
    }
  });
}

function setText(node, value) {
  if (node && typeof value === "string") {
    node.textContent = value;
  }
}

function applyContent(data) {
  if (!data || data.version !== 1) {
    return;
  }
  const agency = data.agency || {};
  const intro = data.intro || {};
  const plan = data.plan || {};
  setText(document.querySelector("[data-field='eyebrow']"), agency.eyebrow);
  setText(document.querySelector("[data-field='footer-line']"), agency.footerLine);
  setText(document.querySelector("[data-field='intro-lede']"), intro.lede);
  setText(document.querySelector("[data-field='plan-kicker']"), plan.kicker);
  setText(document.querySelector("[data-field='plan-heading']"), plan.heading);
  setText(document.querySelector("[data-field='plan-body']"), plan.body);
  (data.sections || []).forEach((section) => {
    const article = document.getElementById(section.id);
    if (!article) {
      return;
    }
    setText(article.querySelector("[data-field='kicker']"), section.kicker);
    setText(article.querySelector("[data-field='heading']"), section.heading);
    setText(article.querySelector("[data-field='body']"), section.body);
  });
  const steps = document.querySelectorAll("#steps li");
  (data.steps || []).forEach((step, index) => {
    const item = steps[index];
    if (!item) {
      return;
    }
    setText(item.querySelector("[data-field='title']"), step.title);
    setText(item.querySelector("[data-field='body']"), step.body);
  });
  renderStories(data.stories || []);
  renderListings(data.listings || []);
}

function articleBlock(item) {
  const article = document.createElement("article");
  const kicker = document.createElement("p");
  kicker.className = "kicker";
  kicker.textContent = item.title || "";
  const summary = document.createElement("p");
  summary.textContent = item.summary || "";
  const body = document.createElement("p");
  body.textContent = item.body || "";
  article.append(kicker, summary, body);
  if (item.image) {
    const image = document.createElement("img");
    image.src = item.image;
    image.alt = item.imageAlt || "";
    article.prepend(image);
  }
  return article;
}

function renderStories(stories) {
  const existing = document.getElementById("stories");
  if (!existing) {
    return;
  }
  const note = existing.querySelector(".empty-note");
  if (!stories.length) {
    if (note) {
      note.hidden = false;
    }
    return;
  }
  if (note) {
    note.hidden = true;
  }
  existing.querySelectorAll("article").forEach((node) => node.remove());
  stories.forEach((item) => existing.append(articleBlock(item)));
}

function renderListings(listings) {
  const grid = document.getElementById("destinations");
  if (!grid || !listings.length) {
    return;
  }
  const slots = {
    family: "card-family",
    park: "card-park",
    cruise: "card-cruise",
    international: "card-world",
    "all-inclusive": "card-all-inclusive",
    celebration: "card-celebration",
  };
  listings.forEach((item) => {
    const id = slots[item.category];
    const article = id ? grid.querySelector("#" + id) : null;
    if (!article) {
      return;
    }
    setText(article.querySelector("[data-field='heading']"), item.title || "");
    setText(article.querySelector("[data-field='body']"), item.summary || "");
  });
}

fetch("/content/site.json", { cache: "no-cache" })
  .then((response) => (response.ok ? response.json() : null))
  .then((data) => applyContent(data))
  .catch(() => {});

const sectionNames = ["hero", "welcome", "destinations", "everyone", "plan", "vacations", "parks", "cruises", "international", "steps"];
const visibleSince = new Map();

function flushSection(name) {
  const started = visibleSince.get(name);
  if (!started) {
    return;
  }
  visibleSince.delete(name);
  const elapsed = Math.min(1800000, Date.now() - started);
  if (elapsed < 1000 || typeof gtag !== "function") {
    return;
  }
  gtag("event", "section_visible", {
    section_name: name,
    visible_msec: elapsed,
  });
}

function markVisible(name) {
  if (!document.hidden && !visibleSince.has(name)) {
    visibleSince.set(name, Date.now());
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    sectionNames.forEach(flushSection);
  }
});

window.addEventListener("pagehide", () => {
  sectionNames.forEach(flushSection);
});

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const name = entry.target.id;
      if (!sectionNames.includes(name)) {
        return;
      }
      if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
        markVisible(name);
      } else {
        flushSection(name);
      }
    });
  }, { threshold: [0, 0.5] });
  sectionNames.forEach((name) => {
    const node = document.getElementById(name);
    if (node) {
      observer.observe(node);
    }
  });
}
