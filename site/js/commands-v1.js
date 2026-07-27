/* Vozen commands catalogue — sourced from contracts/discord-commands.json. */
(function () {
  "use strict";

  const commands = [
    ["/invite", "Get the link to add Vozen to another server.", "start", "Free", ""],
    ["/setup", "Configure the text channel, auto-read and voice permissions in one guided step.", "start", "Admin", ""],
    ["/join", "Join your current voice channel.", "start", "Free", ""],
    ["/leave", "Leave the voice channel.", "start", "Free", ""],
    ["/tts <text>", "Read a message out loud with your selected voice.", "start", "Free", "Voice channel required"],
    ["/tts-file <text>", "Create a private audio file from short text without joining a call.", "start", "Free", "Max 500 characters"],
    ["/skip", "Skip the audio currently playing.", "start", "Free", ""],
    ["/queue", "View or manage the privacy-safe playback queue.", "start", "Free", "show · remove · clear · pause · resume"],
    ["/shut-up", "Stop Vozen speaking now and clear the whole queue.", "start", "Free", ""],
    ["/laugh", "Make Vozen laugh out loud in your current voice.", "start", "Free", ""],
    ["/sound <clip>", "Play a sound clip in the voice channel.", "start", "Free", ""],
    ["/joke <language>", "Tell a short joke in the language you choose.", "fun", "Free", "Optional engine · optional laughter"],
    ["/rizz <language>", "Drop a pickup line in the language you choose.", "fun", "Premium", "Engine required · optional sound"],
    ["/8-ball <question>", "Ask the magic 8-ball a yes/no question.", "fun", "Free", "Language · engine"],
    ["/fortune", "Read a fortune out loud.", "fun", "Free", "Language · engine"],
    ["/fact", "Tell a random fun fact.", "fun", "Free", "Language · engine"],
    ["/wyr", "Ask a would-you-rather question.", "fun", "Free", "Language · engine"],
    ["/cast", "Randomly cast everyone in your voice call and reveal the result.", "fun", "Free", "Voice channel required"],
    ["/birthday", "Set, show or clear your birthday greeting.", "fun", "Free", "set · show · clear"],
    ["/game play", "Start a voice or text minigame with the server.", "fun", "Free + Premium", "Menu · language · engine"],
    ["/game list", "See the minigames available to this server.", "fun", "Free", ""],
    ["/game stop", "Stop the active minigame.", "fun", "Free", ""],
    ["/randomizer", "Pick one option at random and say it out loud.", "fun", "Free", "Options · language"],
    ["/top-speakers", "See who Vozen has read the most, with daily streaks.", "stats", "Free", ""],
    ["/server-stats", "View server messages, top talkers and game stats.", "stats", "Free + Premium", "Free preview"],
    ["/stats", "Show Vozen bot statistics.", "stats", "Admin", ""],
    ["/bot-stats", "Show public servers, voice sessions and uptime.", "stats", "Free", ""],
    ["/uptime", "See how long Vozen has been online.", "stats", "Free", ""],
    ["/voice", "Manage your personal voice, language, engine and effects.", "settings", "Free + Premium", "set · show · reset · preview"],
    ["/config", "Manage server-wide Vozen settings.", "settings", "Admin", "show · reset · channels · toggles"],
    ["/config language", "Set the language Vozen uses for this server.", "settings", "Admin", ""],
    ["/config default-voice", "Choose the server default voice and engine.", "settings", "Admin", ""],
    ["/config block-word", "Add or remove words Vozen skips while reading.", "settings", "Admin", "add · remove"],
    ["/config greet-language", "Choose the language used for greetings.", "settings", "Admin", ""],
    ["/privacy", "Manage your personal data and opt-out preferences.", "settings", "Free", ""],
    ["/translate", "Configure opt-in text translation.", "settings", "Free", ""],
    ["/pronunciation", "Teach Vozen how to say a word in your messages.", "settings", "Free", "add · list · remove"],
    ["/server-pronunciation", "Manage pronunciations for everyone in the server.", "settings", "Admin + Premium", "Admin · 3 free / 50 Premium"],
    ["/premium", "Check Premium status or activate a server licence.", "premium", "Free", "info · activate · redeem"],
    ["/transcribe", "Start or stop live voice transcription for consenting speakers.", "premium", "Premium", "start · stop"],
    ["/redeem <code>", "Redeem a Vozen gift code.", "premium", "Free", ""],
    ["/help", "Show Vozen's command list in Discord.", "help", "Free", ""],
    ["/vote", "Get the link to vote for Vozen on top.gg.", "help", "Free", ""],
    ["/Speak", "Read a selected message out loud.", "help", "Free", "Message context action"],
    ["/Translate", "Translate a selected message.", "help", "Free", "Message context action"],
    ["/Transcribe voice message", "Transcribe a selected voice message.", "help", "Premium", "Message context action"],
  ];

  const groups = [
    ["start", "Start & voice", "Get Vozen into a call and control the queue."],
    ["fun", "Fun & games", "Make the voice channel playful."],
    ["stats", "Stats & activity", "See what your server is saying."],
    ["settings", "Settings & privacy", "Shape Vozen around your server."],
    ["premium", "Premium", "Extra engines and server-wide upgrades."],
    ["help", "Help & community", "Find support and share Vozen."],
  ];

  const groupsEl = document.getElementById("commandGroups");
  const search = document.getElementById("commandSearch");
  const result = document.getElementById("commandResults");
  const filters = [...document.querySelectorAll("[data-filter]")];
  let activeFilter = "all";

  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const tagClass = (tag) => tag.toLowerCase().includes("premium") ? "command-tag--premium" : tag.toLowerCase().includes("admin") ? "command-tag--admin" : "command-tag--free";

  function render() {
    const query = (search?.value || "").trim().toLowerCase();
    const visible = commands.filter(([name, description, category, access, usage]) => {
      const matchesFilter = activeFilter === "all" || category === activeFilter || access.toLowerCase().includes(activeFilter);
      const text = `${name} ${description} ${access} ${usage}`.toLowerCase();
      return matchesFilter && (!query || text.includes(query));
    });

    groupsEl.innerHTML = groups.map(([id, title, note]) => {
      const items = visible.filter(([, , category]) => category === id);
      if (!items.length) return "";
      return `<section class="command-group" aria-labelledby="group-${id}">
        <div class="command-group__head"><div><div class="command-group__title"><h3 id="group-${id}">${title}</h3><span class="command-group__count">${items.length}</span></div><p>${note}</p></div></div>
        <div class="command-list">${items.map(([name, description, , access, usage]) => `<article class="command-row">
          <div class="command-row__top"><code>${escapeHtml(name)}</code><span class="command-tag ${tagClass(access)}">${escapeHtml(access)}</span></div>
          <p>${escapeHtml(description)}</p>
          ${usage ? `<span class="command-row__usage">${escapeHtml(usage)}</span>` : ""}
        </article>`).join("")}</div>
      </section>`;
    }).join("");

    const noun = visible.length === 1 ? "command" : "commands";
    result.textContent = query || activeFilter !== "all" ? `${visible.length} ${noun} match your search.` : `Showing all ${visible.length} commands.`;
    document.querySelectorAll(".command-empty").forEach((empty) => empty.remove());
    if (!visible.length) result.insertAdjacentHTML("afterend", '<p class="command-empty">No commands match that search. Try a shorter word or choose All.</p>');
  }

  filters.forEach((button) => button.addEventListener("click", () => {
    activeFilter = button.dataset.filter || "all";
    filters.forEach((item) => item.classList.toggle("is-active", item === button));
    render();
  }));
  search?.addEventListener("input", render);
  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && document.activeElement !== search && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      search?.focus();
    }
  });
  render();
})();
