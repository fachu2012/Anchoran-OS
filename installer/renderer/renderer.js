const STAGES = ["preparing", "copying", "configuring", "done"];
const STAGE_LABELS = {
  preparing: "Preparing installation…",
  copying: "Copying files…",
  configuring: "Configuring Anchoran OS…",
  done: "Done",
};
const STAGE_PROGRESS = { preparing: 8, copying: 55, configuring: 85, done: 100 };

const stageLabel = document.getElementById("stage-label");
const fill = document.getElementById("progress-fill");
const percentEl = document.getElementById("percent");
const errorEl = document.getElementById("error");
const flashEl = document.getElementById("flash");

function setStage(stage) {
  const percent = STAGE_PROGRESS[stage] ?? 0;
  stageLabel.textContent = STAGE_LABELS[stage] ?? stage;
  fill.style.width = `${percent}%`;
  percentEl.textContent = `${percent}%`;
}

window.anchoranSetup.onStage(setStage);

window.anchoranSetup.onError((message) => {
  errorEl.hidden = false;
  errorEl.textContent = `Setup couldn't finish: ${message}`;
});

window.anchoranSetup.onLaunchFallback(() => {
  stageLabel.textContent = "Installed. Launch Anchoran OS from the Start Menu.";
});

setStage("preparing");
window.anchoranSetup.ready();

// Purely cosmetic — a handful of brief black "restart" flashes over the
// course of the install, echoing the same Windows-Update-style theater
// AnchoranOS itself uses when updating (see src/power/UpdateTheater.tsx).
// They never touch the real progress bar/percentage above, which always
// reflects the actual install stage.
function randomInt(min, max) {
  return Math.floor(min + Math.random() * (max - min));
}

function scheduleFlashes() {
  const count = randomInt(1, 4); // 1-3
  let delay = 0;
  for (let i = 0; i < count; i++) {
    delay += randomInt(7000, 12000);
    setTimeout(() => {
      flashEl.classList.add("on");
      setTimeout(() => flashEl.classList.remove("on"), 550);
    }, delay);
  }
}
scheduleFlashes();
