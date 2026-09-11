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
const stepsEl = document.getElementById("steps").children;
const errorEl = document.getElementById("error");

function setStage(stage) {
  stageLabel.textContent = STAGE_LABELS[stage] ?? stage;
  fill.style.width = `${STAGE_PROGRESS[stage] ?? 0}%`;

  const index = STAGES.indexOf(stage);
  Array.from(stepsEl).forEach((li, i) => {
    li.dataset.active = String(i === index);
    li.dataset.done = String(i < index);
  });
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
