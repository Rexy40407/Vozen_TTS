"use strict";

(function () {
  const endpoint = "https://api.vozen.org/api/public/status";
  const allowed = new Set(["operational", "degraded", "unavailable"]);
  const overall = document.getElementById("statusOverall");
  const overallText = document.getElementById("statusOverallText");
  const incident = document.getElementById("statusIncident");
  const checked = document.getElementById("statusChecked");
  const fields = {
    bot: document.getElementById("statusBot"),
    database: document.getElementById("statusDatabase"),
    providers: document.getElementById("statusProviders"),
  };

  function safeState(value) {
    return allowed.has(value) ? value : "unavailable";
  }

  function render(data) {
    const state = safeState(data && data.status);
    overall.className = "status-overall is-" + state;
    overallText.textContent =
      state === "operational"
        ? "All systems operational"
        : state === "degraded"
          ? "Some systems are degraded"
          : "Service unavailable";

    Object.keys(fields).forEach(function (key) {
      fields[key].textContent = safeState(data && data.components && data.components[key]);
    });
    const notice = data && typeof data.incident === "string" ? data.incident.slice(0, 240) : "";
    incident.textContent = notice;
    incident.hidden = !notice;
    checked.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  fetch(endpoint, { method: "GET", cache: "no-store", mode: "cors" })
    .then(function (response) {
      if (!response.ok) throw new Error("status request failed");
      return response.json();
    })
    .then(render)
    .catch(function () {
      render({ status: "unavailable", components: {} });
    });
})();
