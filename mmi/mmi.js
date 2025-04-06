const startScreen = document.getElementById("start-screen");
const practiceScreen = document.getElementById("practice-screen");
const completeScreen = document.getElementById("complete-screen");
const contentDiv = document.getElementById("content");
const timerDisplay = document.getElementById("timer");

const startButton = document.getElementById("start-button");
const restartButton = document.getElementById("restart-button");
const nextButton = document.getElementById("next-button");
const endPracticeButton = document.getElementById("end-practice");
const pauseResumeButton = document.getElementById("pause-resume");

const progressText = document.getElementById("progress-text");
const progressBar = document.getElementById("progress-bar");
const includeExtraCheckbox = document.getElementById("include-extra");
const summaryDiv = document.getElementById("summary");

let data = [];
let selectedScenarios = [];
let currentScenarioIndex = 0;
let currentStepIndex = 0; // 0 = scenario; 1…n = questions

let countdown;
let timeRemaining = 120;
let isPaused = false;
const DURATION = 120; // seconds for answering
const READING_DURATION = 10; // seconds for reading time

// Load data from JSON files based on radio select input state
async function loadData() {
  const selectedSource = document.querySelector('input[name="scenario-source"]:checked').value;
  let mainData = [];
  let extraData = [];

  if (selectedSource === "mmi_db" || selectedSource === "combined") {
    mainData = await fetch("mmi_db.json").then(res => res.json());
  }
  if (selectedSource === "mmi_gpt" || selectedSource === "combined") {
    extraData = await fetch("mmi_gpt.json").then(res => res.json());
  }

  data = [...mainData, ...extraData];
}

// Start a generic timer with a callback when finished
function startTimer(duration, onComplete) {
  timeRemaining = duration;
  updateTimerDisplay(timeRemaining);
  clearInterval(countdown);
  countdown = setInterval(() => {
    if (!isPaused) {
      timeRemaining--;
      updateTimerDisplay(timeRemaining);
      if (timeRemaining <= 0) {
        clearInterval(countdown);
        onComplete();
      }
    }
  }, 1000);
}

// Start the 10-second reading timer for questions
function startReadingTimer(duration, onComplete) {
  timeRemaining = duration;
  updateTimerDisplay(timeRemaining);
  clearInterval(countdown);
  countdown = setInterval(() => {
    if (!isPaused) {
      timeRemaining--;
      updateTimerDisplay(timeRemaining);
      if (timeRemaining <= 0) {
        clearInterval(countdown);
        onComplete();
      }
    }
  }, 1000);
}

// Update the timer display
function updateTimerDisplay(seconds) {
  const min = String(Math.floor(seconds / 60)).padStart(2, '0');
  const sec = String(seconds % 60).padStart(2, '0');
  timerDisplay.textContent = `Time left: ${min}:${sec}`;
}

// Update progress text and visual progress bar across the session
function updateProgress() {
  const totalSessionSteps = selectedScenarios.reduce((acc, scenario) => acc + scenario.questions.length + 1, 0);
  const completedStepsBeforeCurrent = selectedScenarios.slice(0, currentScenarioIndex)
    .reduce((acc, scenario) => acc + scenario.questions.length + 1, 0);
  const overallCurrentStep = completedStepsBeforeCurrent + currentStepIndex;
  const percentage = Math.min((overallCurrentStep / totalSessionSteps) * 100, 100);
  progressBar.style.width = `${percentage}%`;

  // Update progress text for the current scenario:
  const scenarioNumber = currentScenarioIndex + 1;
  const totalScenarios = selectedScenarios.length;
  let stepText = "";
  if (currentStepIndex === 0) {
    stepText = "Scenario";
  } else {
    const questionNumber = currentStepIndex; // step 1 = question 1, etc.
    const totalQuestions = selectedScenarios[currentScenarioIndex].questions.length;
    stepText = `Question ${questionNumber} of ${totalQuestions}`;
  }
  progressText.textContent = `Scenario ${scenarioNumber} of ${totalScenarios} | ${stepText}`;
}

// Show the current step (scenario or question) based on state
function showCurrentStep() {
  const currentScenario = selectedScenarios[currentScenarioIndex];
  updateProgress();
  
  // Always display the scenario ID on top
  if (currentStepIndex === 0) {
    // Scenario step: show scenario text and ID
    contentDiv.innerHTML = `<div>ID: ${currentScenario.id}</div>
                            <div>Scenario: ${currentScenario.scenario}</div>`;
    // Reset timer color to default
    timerDisplay.style.color = "#333";
    // Start the normal 2-minute timer immediately
    startTimer(DURATION, nextStep);
  } else {
    // Question step: show question text and ID, plus a reading time message
    const questionIndex = currentStepIndex - 1;
    const questionText = currentScenario.questions[questionIndex];
    contentDiv.innerHTML = `<div>ID: ${currentScenario.id}</div>
                            <div>Question: ${questionText}</div>
                            <div id="reading-message"><br>Reading time...</div>`;
    // Timer color remains default until reading time ends
    timerDisplay.style.color = "#333";
    // Start 10-second reading timer first
    startReadingTimer(READING_DURATION, () => {
      // After reading time, clear the reading message
      const readingMessage = document.getElementById("reading-message");
      if (readingMessage) readingMessage.textContent = "";
      // Change timer color to green
      timerDisplay.style.color = "green";
      // Then start the normal 2-minute timer
      startTimer(DURATION, nextStep);
    });
  }
}

// Advance to the next step (either next question or next scenario)
function nextStep() {
  const currentScenario = selectedScenarios[currentScenarioIndex];
  const totalSteps = currentScenario.questions.length + 1; // 1 for scenario + questions
  if (currentStepIndex < totalSteps - 1) {
    currentStepIndex++;
    showCurrentStep();
  } else {
    // End of current scenario; move to next scenario if available
    if (currentScenarioIndex < selectedScenarios.length - 1) {
      currentScenarioIndex++;
      currentStepIndex = 0;
      showCurrentStep();
    } else {
      // Session complete; update the complete screen with summary
      summaryDiv.textContent = "Tested scenario IDs: " + 
        selectedScenarios.map(scenario => scenario.id).join(", ");
      practiceScreen.classList.add("hidden");
      completeScreen.classList.remove("hidden");
    }
  }
}

// Event Listeners
startButton.addEventListener("click", async () => {
  await loadData();
  const count = parseInt(document.getElementById("scenario-count").value, 10);
  // Randomize and select scenarios
  selectedScenarios = data.sort(() => 0.5 - Math.random()).slice(0, count);
  startScreen.classList.add("hidden");
  practiceScreen.classList.remove("hidden");
  currentScenarioIndex = 0;
  currentStepIndex = 0;
  showCurrentStep();
});

nextButton.addEventListener("click", () => {
  clearInterval(countdown);
  nextStep();
});

endPracticeButton.addEventListener("click", () => {
  clearInterval(countdown);
  practiceScreen.classList.add("hidden");
  startScreen.classList.remove("hidden");
});

pauseResumeButton.addEventListener("click", () => {
  isPaused = !isPaused;
  pauseResumeButton.textContent = isPaused ? "Resume" : "Pause";
});

restartButton.addEventListener("click", () => {
  location.reload();
});
