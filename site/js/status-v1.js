"use strict";

(function () {
  const endpoint = "https://api.vozen.org/api/public/status";
  const allowed = new Set(["operational", "degraded", "unavailable"]);
  const labels = {
    operational: "Operational",
    degraded: "Degraded",
    unavailable: "Unavailable",
  };
  const instance = document.getElementById("statusInstance");
  const overall = document.getElementById("statusOverall");
  const checked = document.getElementById("statusChecked");
  const latency = document.getElementById("statusLatency");
  const services = document.getElementById("statusServices");
  const incident = document.getElementById("statusIncident");
  const fields = {
    bot: { value: document.getElementById("statusBot"), card: document.getElementById("statusCheckBot") },
    database: { value: document.getElementById("statusDatabase"), card: document.getElementById("statusCheckDatabase") },
    providers: { value: document.getElementById("statusProviders"), card: document.getElementById("statusCheckProviders") },
  };

  function safeState(value) {
    return allowed.has(value) ? value : "unavailable";
  }

  function stateLabel(state) {
    return labels[state] || labels.unavailable;
  }

  function updateClock() {
    const now = new Date();
    checked.textContent = now.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
    checked.dateTime = now.toISOString();
  }

  function render(data, measuredLatency) {
    const state = safeState(data && data.status);
    const components = (data && data.components) || {};
    const states = Object.keys(fields).map(function (key) {
      return safeState(components[key]);
    });
    const online = states.filter(function (value) { return value === "operational"; }).length;

    instance.className = "status-instance is-" + state;
    overall.className = "status-badge is-" + state;
    overall.textContent = stateLabel(state);
    services.textContent = online + " / " + states.length;
    latency.textContent = Number.isFinite(measuredLatency) ? Math.max(0, Math.round(measuredLatency)) + " ms" : "Unavailable";

    Object.keys(fields).forEach(function (key, index) {
      const componentState = states[index];
      fields[key].value.textContent = stateLabel(componentState);
      fields[key].card.className = "status-check is-" + componentState;
    });

    const notice = data && typeof data.incident === "string" ? data.incident.slice(0, 240) : "";
    incident.textContent = notice;
    incident.hidden = !notice;
    updateClock();
  }

  const started = performance.now();
  fetch(endpoint, { method: "GET", cache: "no-store", mode: "cors" })
    .then(function (response) {
      if (!response.ok) throw new Error("status request failed");
      return response.json();
    })
    .then(function (data) {
      render(data, performance.now() - started);
    })
    .catch(function () {
      render({ status: "unavailable", components: {} }, performance.now() - started);
    });
})();
