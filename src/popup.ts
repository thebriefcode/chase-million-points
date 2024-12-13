document.addEventListener("DOMContentLoaded", async () => {
  const inputs = [
    "cardTypeInput",
    "lastFourInput",
    "firstNameInput",
    "lastNameInput",
    "phoneInput",
    "emailInput",
    "runAtInput",
  ];
  const storedInputs = await chrome.storage.local.get(inputs);
  inputs.forEach((input) => {
    const inputField = document.getElementById(input) as HTMLInputElement;
    if (storedInputs[input]) {
      inputField.value = storedInputs[input];
      console.log(`Synced ${input}=${inputField.value} from storage`);
    }

    inputField.addEventListener("input", async () => {
      await chrome.storage.local.set({ [input]: inputField.value });
      console.log(`Saved ${input}=${inputField.value} to storage`);
    });
  });

  const runNowBtn = document.getElementById("runNowBtn") as HTMLButtonElement;
  runNowBtn.addEventListener("click", async () => {
    console.log("Running now");

    await chrome.runtime.sendMessage({ action: "run-now" });
  });

  const scheduleBtn = document.getElementById(
    "scheduleBtn"
  ) as HTMLButtonElement;
  const runAtInput = document.getElementById("runAtInput") as HTMLInputElement;
  const storedScheduleState = await chrome.storage.local.get(["scheduleState"]);

  if (storedScheduleState.scheduleState === "on") {
    scheduleBtn.textContent = "Stop scheduling";
    runAtInput.disabled = true;
  }

  scheduleBtn.addEventListener("click", () => {
    console.log("scheduleBtn clicked");
    chrome.runtime.sendMessage({ action: "schedule" });
  });

  const runStatusDiv = document.getElementById("runStatus") as HTMLDivElement;
  const storedRunStatus = await chrome.storage.local.get(["runStatus"]);
  if (storedRunStatus.runStatus) {
    runStatusDiv.textContent = storedRunStatus.runStatus;
  }

  const scheduleStatusDiv = document.getElementById(
    "scheduleStatus"
  ) as HTMLDivElement;
  const storedScheduleStatus = await chrome.storage.local.get([
    "scheduleStatus",
  ]);
  if (storedScheduleStatus.scheduleStatus) {
    scheduleStatusDiv.textContent = storedScheduleStatus.scheduleStatus;
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if ("runStatus" in changes) {
      runStatusDiv.textContent = changes.runStatus.newValue;
    }
    if ("scheduleStatus" in changes) {
      scheduleStatusDiv.textContent = changes.scheduleStatus.newValue;
    }
    if ("scheduleState" in changes) {
      if (changes.scheduleState.newValue === "on") {
        scheduleBtn.textContent = "Stop scheduling";
        runAtInput.disabled = true;
      } else {
        scheduleBtn.textContent = "Start scheduling";
        runAtInput.disabled = false;
      }
    }
  });
});
