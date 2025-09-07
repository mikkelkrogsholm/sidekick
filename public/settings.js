// Settings management module
const Settings = {
  get(k, d){ try { return JSON.parse(localStorage.getItem(k) ?? JSON.stringify(d)); } catch { return d; } },
  set(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
};

// Defaults
const defaults = {
  sk_prompt: "You are Sidekick. Be concise and actionable.",
  sk_model: "gpt-4o-realtime-preview-2024-12-17",
  sk_voice: "marin",
  sk_use_notes: true,
  sk_autopause: true,
  sk_record_conversations: false,
  sk_temp: 0.6,
  sk_ptt_mode: "hold",
  sec_show_timestamps: false
};

// Wire drawer
window.addEventListener('DOMContentLoaded', () => {
  const el = id => document.getElementById(id);
  const map = ["sk_prompt","sk_model","sk_voice","sk_use_notes","sk_autopause","sk_record_conversations","sk_temp","sk_ptt_mode","sec_show_timestamps"];
  map.forEach(key => {
    const node = el(key);
    if (!node) return;
    const val = Settings.get(key, defaults[key]);
    if (node.type === "checkbox") node.checked = !!val;
    else if (node.tagName === "TEXTAREA" || node.tagName === "INPUT" || node.tagName === "SELECT") node.value = val;
    node.addEventListener('change', () => {
      const v = node.type === "checkbox" ? node.checked : (node.type === "range" ? parseFloat(node.value) : node.value);
      Settings.set(key, v);
    });
  });

  // Advanced settings button now expands the settings panel
  el("skSettingsBtn")?.addEventListener("click", () => {
    const settingsContent = el("settingsContent");
    const settingsToggle = el("settingsToggle");
    if (settingsContent && settingsContent.classList.contains("hidden")) {
      settingsContent.classList.remove("hidden");
      settingsToggle?.classList.add("expanded");
      localStorage.setItem("settingsExpanded", "true");
    }
    // Scroll to advanced settings section
    const advancedSection = document.querySelector(".settings-section:last-child");
    if (advancedSection) {
      advancedSection.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });
});

// Export for use in other modules
window.Settings = Settings;
window.settingsDefaults = defaults;