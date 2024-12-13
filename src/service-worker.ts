console.log("Service worker loaded");

const CHASE_ALARM = "CHASE_ALARM";
const CHASE_ALARM_PERIOD_MINS = 1440;
const CHASE_ALARM_RANDOM_BUFFER_MINS = 10;
const CHASE_URL = "https://millionpoints.chase.com/?pg_name=entry";
const CHASE_URL_THANK_YOU = "?pg_name=thank_you";
const CHASE_URL_ALREADY_ENTERED = "?pg_name=already_entered";

async function fillForm(): Promise<void> {
  async function scrollIntoViewAndDelay(element: HTMLElement): Promise<void> {
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    await new Promise((resolve) =>
      setTimeout(resolve, 500 + Math.random() * 1000)
    );
  }

  async function fakeKeyboardAndMouseMovements() {
    // The website has antibot detection script to check for keyboard events and mouse movements.
    // Let's trigger some random activity to bypass it

    // Trigger random amount of keyboard presses
    Array.from({ length: Math.floor(1 + Math.random() * 4) }).forEach(() => {
      const tabEvent = new KeyboardEvent("keydown", {
        key: "Tab",
        code: "Tab",
        bubbles: true,
      });
      document.body.dispatchEvent(tabEvent);
    });
    await new Promise((resolve) =>
      setTimeout(resolve, 500 + Math.random() * 1000)
    );

    // Trigger random amount of mouse movements
    Array.from({ length: Math.floor(100 + Math.random() * 200) }).forEach(
      () => {
        const x = Math.random() * window.innerWidth;
        const y = Math.random() * window.innerHeight;

        const event = new MouseEvent("mousemove", {
          bubbles: true,
          clientX: x,
          clientY: y,
        });
        document.body.dispatchEvent(event);
      }
    );
    await new Promise((resolve) =>
      setTimeout(resolve, 500 + Math.random() * 1000)
    );
  }

  console.log("Filling out form");
  document.body.style.backgroundColor = "orange";

  const inputs = [
    "cardTypeInput",
    "lastFourInput",
    "firstNameInput",
    "lastNameInput",
    "phoneInput",
    "emailInput",
  ];

  const storedInputs = await chrome.storage.local.get(inputs);

  const cardTypeFormField = document.getElementById(
    "edit-field-card"
  ) as HTMLSelectElement;
  const cardTypeOption = Array.from(cardTypeFormField.options).find((option) =>
    option.label
      .toLowerCase()
      .includes(storedInputs.cardTypeInput.toLowerCase())
  );
  if (cardTypeOption) {
    cardTypeOption.selected = true;
    cardTypeFormField.value = cardTypeOption.value;
  }
  await scrollIntoViewAndDelay(cardTypeFormField);

  const last4FormField = document.getElementById(
    "edit-field-vendor-token-0-value"
  ) as HTMLInputElement;
  last4FormField.value = storedInputs.lastFourInput;
  await scrollIntoViewAndDelay(last4FormField);

  const firstNameFormField = document.getElementById(
    "edit-field-name-first-0-value"
  ) as HTMLInputElement;
  firstNameFormField.value = storedInputs.firstNameInput;
  await scrollIntoViewAndDelay(firstNameFormField);

  const lastNameFormField = document.getElementById(
    "edit-field-name-last-0-value"
  ) as HTMLInputElement;
  lastNameFormField.value = storedInputs.lastNameInput;
  await scrollIntoViewAndDelay(lastNameFormField);

  const phoneFormField = document.getElementById(
    "edit-field-phone-0-value"
  ) as HTMLInputElement;
  phoneFormField.value = storedInputs.phoneInput;
  await scrollIntoViewAndDelay(phoneFormField);

  const emailFormField = document.getElementById(
    "edit-field-email-0-value"
  ) as HTMLInputElement;
  emailFormField.value = storedInputs.emailInput;
  await scrollIntoViewAndDelay(emailFormField);

  const consentCheck = document.getElementById(
    "edit-field-rules-consent-value"
  ) as HTMLInputElement;
  consentCheck.checked = true;

  const ageCheck = document.getElementById(
    "edit-field-age-confirm-value"
  ) as HTMLInputElement;
  ageCheck.checked = true;

  const submitButton = document.getElementById(
    "submit-entry"
  ) as HTMLButtonElement;

  await scrollIntoViewAndDelay(submitButton);

  console.log("Form filled");

  console.log("Faking keyboard and mouse movements");
  await fakeKeyboardAndMouseMovements();
  await new Promise((resolve) =>
    setTimeout(resolve, 500 + Math.random() * 3000)
  );

  console.log("Submitting");

  submitButton.click();

  // On submit, let service worker know to start monitoring URL
  await chrome.runtime.sendMessage({ action: "form-submitted" });
}

function openTab(): void {
  chrome.tabs.create({ url: CHASE_URL }, (tab) => {
    chrome.scripting.executeScript({
      target: { tabId: tab.id! },
      func: fillForm,
    });
  });
}

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  console.log("message received:", message);
  if (message.action === "run-now") {
    openTab();
    return;
  }

  if (message.action === "schedule") {
    const storedScheduleState = await chrome.storage.local.get([
      "scheduleState",
    ]);
    if (storedScheduleState.scheduleState === "on") {
      await stopScheduling();
    } else {
      await startScheduling();
    }
  }

  if (message.action === "form-submitted") {
    console.log("formSubmitted. senderTabId:", sender.tab?.id);

    if (sender.tab && sender.tab!.id) {
      const tabId = sender.tab!.id!;

      let runCount = 0;
      const maxRuns = 15;

      const successCheckInterval = setInterval(async () => {
        runCount++;
        if (runCount >= maxRuns) {
          clearInterval(successCheckInterval);
          console.log(`Form submission failed after ${runCount} checks.`);
          await chrome.action.setBadgeText({ text: "!" });
          await chrome.action.setBadgeBackgroundColor({ color: "red" });
          await chrome.action.setBadgeTextColor({ color: "white" });

          const now = new Date();
          await chrome.storage.local.set({
            runStatus: `Last run failed: ${now}`,
          });
          return;
        }

        const tab = await chrome.tabs.get(tabId);
        const currentTabUrl = tab.url;
        console.log("currentTabUrl:", currentTabUrl);

        if (currentTabUrl?.includes(CHASE_URL_THANK_YOU)) {
          console.log("Form submitted successfully");
          clearInterval(successCheckInterval);
          const now = new Date();
          await chrome.storage.local.set({
            runStatus: `Last run successful: ${now}`,
          });
          await chrome.action.setBadgeText({ text: "" });
          await chrome.tabs.remove(tabId);
          return;
        }
        if (currentTabUrl?.includes(CHASE_URL_ALREADY_ENTERED)) {
          console.log("Form submitted but already entered today");
          clearInterval(successCheckInterval);
          const now = new Date();
          await chrome.storage.local.set({
            runStatus: `Last run already entered today: ${now}`,
          });
          await chrome.action.setBadgeText({ text: "" });
          await chrome.tabs.remove(tabId);
          return;
        }
      }, 2000);
    }
  }
});

async function startScheduling(): Promise<void> {
  const storedRunAtInput = await chrome.storage.local.get(["runAtInput"]);
  if (!storedRunAtInput.runAtInput) {
    console.log("Missing runAtInput, can't schedule");
  }

  const [hours, minutes] = storedRunAtInput.runAtInput
    .trim()
    .split(":")
    .map(Number);
  const now = new Date();
  const desiredAlarmDate = new Date(now);
  desiredAlarmDate.setHours(hours, minutes, 0, 0);
  const randomMinutesInMs = Math.floor(Math.random() * 1 * 60000);
  const nextAlarmDate = new Date(
    desiredAlarmDate.getTime() + randomMinutesInMs
  );
  if (nextAlarmDate <= now) {
    nextAlarmDate.setDate(nextAlarmDate.getDate() + 1);
  }
  console.log("nextAlarmDate:", nextAlarmDate);
  await chrome.alarms.create(CHASE_ALARM, {
    when: nextAlarmDate.getTime(),
  });
  await chrome.storage.local.set({
    scheduleState: "on",
    scheduleStatus: `Next scheduled run at ${nextAlarmDate}`,
  });
}

async function stopScheduling(): Promise<void> {
  console.log("Stopping scheduling");
  await chrome.alarms.clear(CHASE_ALARM);
  await chrome.storage.local.set({
    scheduleState: "off",
    scheduleStatus: "",
  });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log("Alarm triggered:", alarm.name);
  if (alarm.name === CHASE_ALARM) {
    openTab();
    const now = new Date();
    const randomMinutesInMs = Math.floor(
      Math.random() * CHASE_ALARM_RANDOM_BUFFER_MINS * 60000
    );
    const nextAlarmDate = new Date(
      now.getTime() + CHASE_ALARM_PERIOD_MINS * 60000 + randomMinutesInMs
    );
    console.log("Next alarm time:", nextAlarmDate);
    await chrome.alarms.create(CHASE_ALARM, {
      when: nextAlarmDate.getTime(),
    });
    await chrome.storage.local.set({
      scheduleStatus: `Next scheduled run at ${nextAlarmDate}`,
    });
  }
});

// Don't auto scheduling when extension loads up
stopScheduling();
