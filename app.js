"use strict";

const app = document.querySelector("#app");

const QUESTION_SETS = {
  accident: [
    { key: "accident_date", text: "Claimant's accident date? (DD-MM-YYYY)", type: "date" },
    { key: "accident_time", text: "Claimant's accident time? (for example, 10:00 PM)", type: "time" },
    { key: "location", text: "Where does the claimant say the accident happened?", example: "Gandhipuram, Coimbatore" },
    { key: "driver", text: "Who was driving, according to the claim?", example: "Claimant or named driver" },
    { key: "damaged_part", text: "Which part does the claimant say was damaged?", example: "Front bumper" },
    { key: "before_place", text: "Where does the claimant say they were before the accident?", example: "At the office, or unknown" },
    { key: "before_time", text: "Until what time was the claimant at that place? Enter a time such as 10 PM, or choose 'Unknown' if it was not recorded.", type: "time", optional: true, choices: [{ label: "Time unknown / not recorded", value: "unknown" }] },
    { key: "fir_date", text: "What date was the FIR filed?", type: "date-or-none", choices: [{ label: "No FIR provided", value: "none" }] },
    { key: "policy_start_date", text: "What policy start date is recorded? (DD-MM-YYYY)", type: "date" },
    { key: "licence_valid", text: "Does the evidence indicate that the licence is valid?", type: "yes-no" },
    { key: "repaired_part", text: "Which part does the garage invoice say was repaired?", example: "Front bumper", choices: [{ label: "Invoice not provided", value: "skip" }] },
    { key: "photo_path", text: "Attach a photo if available, or skip. I won't analyze the image itself.", type: "file", optional: true, choices: [{ label: "Skip photo", value: "skip" }] },
    { key: "photo_date", text: "If available, what date is recorded in the photo metadata? (DD-MM-YYYY)", type: "date", optional: true },
    { key: "photo_gps_match", text: "If photo GPS metadata is available, does it match the reported location?", type: "yes-no", optional: true },
  ],
  theft: [
    { key: "theft_date", text: "Claimant's theft date? (DD-MM-YYYY)", type: "date" },
    { key: "theft_time", text: "Claimant's theft time? (for example, 11:00 PM)", type: "time" },
    { key: "location", text: "Where does the claimant say the vehicle was stolen?", example: "Peelamedu" },
    { key: "report_date", text: "What date was the theft reported?", type: "date-or-none", choices: [{ label: "No report provided", value: "none" }] },
    { key: "policy_start_date", text: "What policy start date is recorded? (DD-MM-YYYY)", type: "date" },
    { key: "licence_valid", text: "Does the evidence indicate that the RC/licence is valid?", type: "yes-no" },
    { key: "keys_available", text: "Were the keys available according to the claim file?", type: "yes-no" },
    { key: "photo_path", text: "Attach a photo or document if available, or skip.", type: "file", optional: true, choices: [{ label: "Skip file", value: "skip" }] },
    { key: "photo_date", text: "If available, what date is recorded in the photo metadata? (DD-MM-YYYY)", type: "date", optional: true },
    { key: "photo_gps_match", text: "If photo GPS metadata is available, does it match the reported location?", type: "yes-no", optional: true },
  ],
  injury: [
    { key: "accident_date", text: "Claimant's accident date? (DD-MM-YYYY)", type: "date" },
    { key: "hospital_admission_date", text: "What hospital admission date is recorded? (DD-MM-YYYY)", type: "date" },
    { key: "claimant_injury", text: "What injury does the claimant report?", example: "Head injury" },
    { key: "hospital_report_injury", text: "What injury is stated in the hospital report?", example: "Leg fracture", choices: [{ label: "Report not provided", value: "skip" }] },
    { key: "days_stayed", text: "How many days was the hospital stay?", type: "number" },
    { key: "claim_amount", text: "What is the claim amount in rupees?", type: "number" },
    { key: "policy_start_date", text: "What policy start date is recorded? (DD-MM-YYYY)", type: "date" },
    { key: "hospital_bill_attached", text: "Is the hospital bill attached?", type: "yes-no" },
  ],
};

const state = {
  screen: "splash",
  messages: [],
  phase: "idle",
  claimType: null,
  questionIndex: 0,
  answers: {},
  assessment: null,
};

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]);

function addMessage(role, text, extra = {}) {
  state.messages.push({ role, text, ...extra });
  render();
}

function render() {
  if (state.screen === "splash") {
    renderSplash();
    return;
  }
  if (state.screen === "result") {
    renderResultPage();
    return;
  }
  if (state.screen === "techniques") {
    renderTechniquesPage();
    return;
  }
  renderChat();
}

function renderSplash() {
  app.innerHTML = `
    <section class="splash-screen" aria-label="Application title">
      <div class="splash-brand-mark" aria-hidden="true">IC</div>
      <p class="splash-eyebrow">Claims officer assistant</p>
      <h1>Insurance Claim Verifier,<br>a rule based ai chatbot</h1>
      <div class="splash-progress" aria-hidden="true"><span></span></div>
    </section>`;
}

function renderChat() {
  const messages = state.messages.map((message) => {
    const body = message.kind === "result" ? resultCard(message.assessment)
      : `<p>${escapeHtml(message.text).replace(/\n/g, "<br>")}</p>`;
    const choices = message.choices?.length
      ? `<div class="chat-choices">${message.choices.map((choice) => `<button class="choice-button" data-value="${escapeHtml(choice.value)}">${escapeHtml(choice.label)}</button>`).join("")}</div>`
      : "";
    return `<article class="chat-message ${message.role}" ${message.role === "bot" ? 'aria-label="Assistant message"' : 'aria-label="Officer message"'}>
      <span class="message-avatar">${message.role === "bot" ? "CV" : "CO"}</span>
      <div class="message-content">${body}${choices}</div>
    </article>`;
  }).join("");

  app.innerHTML = `
    <section class="chat-panel" aria-label="Insurance Claim Verifier chatbot">
      <div class="chat-heading">
        <div><p class="eyebrow">Claims officer assistant</p><h1>Insurance Claim Verifier, a rule-based AI chatbot</h1></div>
        <span class="online-badge"><i></i> Ready</span>
      </div>
      <div class="chat-messages" id="chat-messages" aria-live="polite">${messages}</div>
      ${composerMarkup()}
    </section>`;

  const transcript = app.querySelector("#chat-messages");
  transcript.scrollTop = transcript.scrollHeight;
  app.querySelectorAll(".choice-button").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.phase === "claim-type") processMessage(button.dataset.value);
      else if (state.phase === "question") submitAnswer(button.dataset.value);
      else processMessage(button.dataset.value);
    });
  });
  app.querySelector("#load-json")?.addEventListener("change", loadJsonClaim);
  app.querySelector("#evidence-file")?.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) submitAnswer(file);
  });
  app.querySelector("#back-button")?.addEventListener("click", () => {
    addMessage("user", "Back to previous question");
    goBack();
  });
  app.querySelector("#attach-button")?.addEventListener("click", () => app.querySelector("#evidence-file").click());
  app.querySelectorAll("[data-action=\"back-to-chat\"]").forEach((button) => {
    button.addEventListener("click", () => {
      state.screen = "chat";
      render();
    });
  });
  app.querySelectorAll("[data-action=\"new-review\"]").forEach((button) => {
    button.addEventListener("click", () => {
      state.screen = "chat";
      state.messages = [];
      state.assessment = null;
      state.claimType = null;
      state.answers = {};
      state.phase = "idle";
      renderWelcome();
    });
  });
  const form = app.querySelector("#chat-form");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = app.querySelector("#chat-input");
    if (input.files?.length) {
      submitAnswer(input.files[0]);
    } else {
      const value = input.value.trim();
      if (value) processMessage(value);
    }
  });
  app.querySelector("#chat-input")?.focus();
}

function composerMarkup() {
  if (state.phase === "question") {
    const question = QUESTION_SETS[state.claimType][state.questionIndex];
    const placeholder = question.type === "file"
      ? "Type “skip” or “not available”, or attach a file"
      : question.optional ? "Optional — type skip or not available" : question.example ? `Enter answer · e.g. ${question.example}` : "Type the officer's answer...";
    const yesNo = question.type === "yes-no"
      ? `<div class="composer-choices"><button type="button" class="choice-button" data-value="yes">Yes</button><button type="button" class="choice-button" data-value="no">No</button>${question.optional ? '<button type="button" class="choice-button" data-value="skip">Unknown / skip</button>' : ""}</div>`
      : "";
    const choices = question.choices?.length
      ? `<div class="composer-choices">${question.choices.map((choice) => `<button type="button" class="choice-button" data-value="${escapeHtml(choice.value)}">${escapeHtml(choice.label)}</button>`).join("")}</div>`
      : "";
    return `<div class="chat-composer-wrap">
      ${yesNo}${choices}
      <form id="chat-form" class="chat-composer">
        <label class="sr-only" for="chat-input">Your reply</label>
        <input id="chat-input" type="text" placeholder="${escapeHtml(placeholder)}" ${question.optional ? "" : "required"}>
        ${question.type === "file" ? '<input id="evidence-file" type="file" accept="image/*,.pdf,.doc,.docx" hidden><button type="button" class="icon-button" id="attach-button" aria-label="Attach a photo or document" title="Attach a photo or document">＋</button>' : ""}
        <button type="button" class="icon-button" id="back-button" aria-label="Go back to previous question" title="Previous question">←</button>
        <button type="submit" class="send-button" aria-label="Send reply">Send <span aria-hidden="true">➤</span></button>
      </form>
      <div class="composer-footer"><span>Enter to send · Replies stay in this browser</span><label for="load-json" class="load-link">Load claim JSON<input id="load-json" type="file" accept=".json,application/json" hidden></label></div>
      <p id="input-error" class="error-message" role="alert"></p>
    </div>`;
  }
  return `<div class="chat-composer-wrap">
    <div class="suggestions">
      <button class="suggestion-button" data-command="new claim">New claim</button>
      <button class="suggestion-button" data-command="help">Help</button>
      <label class="suggestion-button load-link">Load claim JSON<input id="load-json" type="file" accept=".json,application/json" hidden></label>
    </div>
    <form id="chat-form" class="chat-composer">
      <label class="sr-only" for="chat-input">Message the assistant</label>
      <input id="chat-input" type="text" placeholder="Type a message, such as “new claim” or “help”...">
      <button type="submit" class="send-button" aria-label="Send message">Send <span aria-hidden="true">➤</span></button>
    </form>
    <div class="composer-footer"><span>Rule-based assistant · Claim details stay in this browser</span><span>Type “bye” to end</span></div>
  </div>`;
}

function renderWelcome() {
  if (state.messages.length) return;
  state.screen = "chat";
  addMessage("bot", "Hello, claims officer! I help pre-screen accident, theft and injury claims by comparing the statement with available evidence and policy rules. What would you like to do?", {
    choices: [
      { label: "New claim", value: "new claim" },
      { label: "Help", value: "help" },
    ],
  });
}

function normalize(text) {
  return String(text).trim().toLowerCase().replace(/([a-z])\1{2,}/g, "$1$1").replace(/[!?.,]+/g, " ").replace(/\s+/g, " ");
}

function intent(text) {
  const value = normalize(text);
  if (/\b(cancel|restart|start over|reset)\b/.test(value)) return "restart";
  if (/\b(bye|goodbye|see you|exit|quit)\b/.test(value)) return "bye";
  if (/\b(load file|load claim|upload|claim file)\b/.test(value)) return "load";
  if (/\b(why|explain|show proof|which rules fired)\b/.test(value)) return "why";
  if (/\b(algorithms?|techniques?|how does (this|it) work|how it works)\b/.test(value)) return "techniques";
  if (/\b(new claim|review (a )?claim|check (a )?claim|start( a)? claim)\b/.test(value)) return "start";
  if (/\b(accident|theft|injury) claim\b/.test(value)) return "start";
  if (/\b(help|what can you do|i need (your )?help)\b/.test(value)) return "help";
  if (/\b(thanks|thank you|thnks)\b/.test(value)) return "thanks";
  if (/\b(hi|hello|hey|hii|helo|good morning|good afternoon|good evening|vanakkam)\b/.test(value)) return "greeting";
  if (/\b(how are you|who are you|who made you)\b/.test(value)) return "smalltalk";
  return "answer";
}

function looksLikeQuestion(text) {
  const value = normalize(text);
  return /\?$/.test(text.trim())
    || /^(what|why|how|where|when|which|who|can you|could you|do you|is this|are you)\b/.test(value);
}

function answerQuestion(text) {
  const value = normalize(text);
  if (/\b(forward chaining|forward chain)\b/.test(value)) {
    return "Forward chaining starts with the facts entered for this claim, checks the knowledge-base rules, and adds the flags or conclusions whose conditions match.";
  }
  if (/\b(resolution|empty clause|refutation)\b/.test(value)) {
    return "Resolution checks for a contradiction by adding the negation of the consistency claim to the relevant clauses. If resolving them derives the empty clause (□), the consistency assumption is refuted.";
  }
  if (/\b(knowledge base|rules|rule fired|rules fired)\b/.test(value)) {
    return "The knowledge base is the set of numbered, hand-written claim and policy rules. After the review, open “Show proof steps and rules fired” to see which rules matched.";
  }
  if (/\b(data|answers|information).{0,20}\b(store|saved|save|sent|private|server|upload)\b|\b(where|how).{0,30}\b(store|saved|save|sent|private|server)\b/.test(value)) {
    return "Your answers stay in this browser session. They are not sent to a server or saved to a database. A file you select is used only to note that evidence was provided; its contents are not uploaded or inspected.";
  }
  if (/\b(machine learning|deep learning|ml|api|online)\b/.test(value)) {
    return "No. This is a classical, rule-based prototype. Its questions, keyword handling, and claim rules are explicit; it uses no machine learning, external datasets, or online APIs.";
  }
  if (/\b(claim types|claim type|types of claim|what claims)\b/.test(value)) {
    return "I support vehicle accident, vehicle theft, and accident-related injury claim reviews.";
  }
  if (/\b(what do i enter|what should i enter|what answer|how do i answer|format)\b/.test(value)) {
    const question = QUESTION_SETS[state.claimType][state.questionIndex];
    return question.example
      ? `For this question, enter the value recorded in the claimant statement or evidence. For example: ${question.example}.`
      : `For this question, ${question.text.toLowerCase()} Use the value shown in the claimant statement or evidence.`;
  }
  if (/\b(approve|investigat|request documents|decision|recommendation)\b/.test(value) && state.assessment) {
    return explanation(state.assessment);
  }
  return null;
}

function processMessage(text) {
  const action = intent(text);
  if (state.phase === "question" && (action === "techniques" || action === "answer" && looksLikeQuestion(text))) {
    addMessage("user", text);
    addMessage("bot", answerQuestion(text) || "I can answer questions about the claim flow and the rules used, but I didn't recognize that question. I haven't recorded it as a claim answer.");
    repeatQuestion();
    return;
  }
  if (action === "start") {
    addMessage("user", text);
    const type = ["accident", "theft", "injury"].find((name) => new RegExp(`\\b${name} claim\\b`, "i").test(text));
    if (type) chooseType(type);
    else startClaim();
  } else if (action === "techniques") {
    addMessage("user", text);
    state.screen = "techniques";
    render();
  } else if (action === "help") {
    addMessage("user", text);
    addMessage("bot", "I guide you through a structured accident, theft, or injury claim conversation. I compare entered statements and evidence, show rules that fire, and explain any consistency issues or missing details. Try “new claim”, “load claim JSON”, “why”, “back”, “cancel”, or “bye”.");
    repeatQuestion();
  } else if (action === "greeting") {
    addMessage("user", text);
    addMessage("bot", "Hello, officer! I'm here to help with the claim review.");
    repeatQuestion();
  } else if (action === "thanks") {
    addMessage("user", text);
    addMessage("bot", "You're welcome, officer.");
    repeatQuestion();
  } else if (action === "smalltalk") {
    addMessage("user", text);
    addMessage("bot", text.toLowerCase().includes("how are you")
      ? "I'm ready to help review a claim. What would you like to do?"
      : "I'm a rule-based assistant designed to help claims officers compare claim statements with entered evidence.");
    repeatQuestion();
  } else if (action === "bye") {
    addMessage("user", text);
    addMessage("bot", "Goodbye, officer. You can start a new conversation whenever you return.");
    state.phase = "idle";
  } else if (action === "restart") {
    addMessage("user", text);
    startClaim();
  } else if (action === "why") {
    addMessage("user", text);
    if (state.assessment) addMessage("bot", explanation(state.assessment));
    else addMessage("bot", "There isn't a completed claim to explain yet. I can explain the screening after we finish the claim questions.");
    repeatQuestion();
  } else if (action === "load") {
    addMessage("user", text);
    addMessage("bot", "Use the “Load claim JSON” control below to choose a structured claim file from this device.");
    repeatQuestion();
  } else if (state.phase === "claim-type") {
    addMessage("user", text);
    const type = ["accident", "theft", "injury"].find((name) => new RegExp(`\\b${name}\\b`, "i").test(text));
    if (type) chooseType(type);
    else addMessage("bot", "Which claim type would you like to review: accident, theft, or injury?", {
      choices: ["accident", "theft", "injury"].map((name) => ({ label: name[0].toUpperCase() + name.slice(1), value: name })),
    });
  } else if (state.phase === "question") {
    if (action === "answer" && /\b(back|previous question)\b/.test(normalize(text))) {
      addMessage("user", text);
      goBack();
    } else {
      submitAnswer(text);
    }
  } else {
    addMessage("user", text);
    addMessage("bot", "I didn't understand that. You can say “new claim”, “help”, or “bye”.");
  }
}

function startClaim() {
  state.messages.forEach((message) => { message.choices = undefined; });
  state.phase = "claim-type";
  state.claimType = null;
  state.questionIndex = 0;
  state.answers = {};
  state.assessment = null;
  addMessage("bot", "Which claim type are you reviewing?", {
    choices: [
      { label: "Accident", value: "accident" },
      { label: "Theft", value: "theft" },
      { label: "Injury", value: "injury" },
    ],
  });
}

function chooseType(type) {
  state.messages.forEach((message) => { message.choices = undefined; });
  state.claimType = type;
  state.phase = "question";
  state.questionIndex = 0;
  state.answers = {};
  addMessage("bot", `Okay, ${type} claim. I'll ask one question at a time; you can type “back” to revisit the previous answer.`);
  askQuestion();
}

function askQuestion(repeat = false) {
  if (state.phase !== "question") return;
  const question = QUESTION_SETS[state.claimType][state.questionIndex];
  if (!repeat) {
    const text = `${question.text}${state.answers[question.key] ? ` (Current answer: ${displayAnswer(state.answers[question.key])})` : ""}`;
    addMessage("bot", text, { choices: question.choices });
  } else {
    addMessage("bot", question.text, { choices: question.choices });
  }
}

function repeatQuestion() {
  if (state.phase === "question") askQuestion(true);
}

function goBack() {
  if (state.questionIndex === 0) {
    addMessage("bot", "You're at the first question. Type “cancel” to choose a different claim type.");
    askQuestion(true);
    return;
  }
  state.questionIndex -= 1;
  askQuestion();
}

function displayAnswer(value) {
  if (value && typeof value === "object" && value.name) return `attached ${value.name}`;
  if (value === "none" || value === "skip") return "not provided";
  const isoDate = typeof value === "string" && value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDate) return `${isoDate[3]}-${isoDate[2]}-${isoDate[1]}`;
  return value;
}

function validateAnswer(question, raw) {
  if (question.type === "file") {
    if (typeof raw === "object" && raw.name) return { valid: true, value: { name: raw.name, type: raw.type, size: raw.size } };
    if (/^(skip|none|unknown|unavailable|(?:it(?:'s| is) )?not available|not attached|no photo|no image)$/i.test(String(raw).trim())) {
      return question.optional ? { valid: true, value: "skip" } : { valid: false, error: "A file is required for this question." };
    }
    return { valid: false, error: "Attach a file, or reply “skip” or “not available”." };
  }
  const value = String(raw).trim();
  if (question.key === "before_time" && /^(unknown|not known|not recorded|not available|not sure|unsure|(?:i )?(?:do not|don't|dont) know|same car|in the same car)$/i.test(value)) {
    return { valid: true, value: "unknown" };
  }
  if (question.optional && /^(skip|none|unknown|unavailable|(?:it(?:'s| is) )?not available|not attached|no photo|no image)$/i.test(value)) return { valid: true, value: "skip" };
  if (question.type === "yes-no") {
    if (/^(yes|y)$/i.test(value)) return { valid: true, value: "yes" };
    if (/^(no|n)$/i.test(value)) return { valid: true, value: "no" };
    if (question.optional && /^(skip|unknown|not available)$/i.test(value)) return { valid: true, value: "skip" };
    return { valid: false, error: "Please choose Yes or No." };
  }
  if (question.type === "date-or-none" && /^(none|skip)$/i.test(value)) return { valid: true, value: "none" };
  if (question.type === "text-or-skip" && /^(skip|none)$/i.test(value)) return { valid: true, value: "skip" };
  if (!value) return question.optional ? { valid: true, value: "skip" } : { valid: false, error: "Please enter an answer, or choose the missing-evidence option." };
  if (question.type === "date" || question.type === "date-or-none") {
    const date = parseDate(value);
    return date ? { valid: true, value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` } : { valid: false, error: "Enter a valid date such as 28-09-2026." };
  }
  if (question.type === "time" && !parseTime(value)) return { valid: false, error: `I need a time for this answer. Try “10 PM”, “10:00 PM”, or “22:00”. If the previous-location time is unknown, choose “Time unknown / not recorded”.` };
  if (question.type === "number" && (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)))) return { valid: false, error: "Enter a whole number, for example 15." };
  return { valid: true, value: question.type === "number" ? Number(value) : value };
}

function submitAnswer(raw) {
  if (state.phase !== "question") return;
  const question = QUESTION_SETS[state.claimType][state.questionIndex];
  const result = validateAnswer(question, raw);
  if (!result.valid) {
    addMessage("bot", result.error);
    askQuestion(true);
    return;
  }
  state.messages.forEach((message) => {
    if (message.role === "bot" && message.choices) message.choices = undefined;
  });
  addMessage("user", displayAnswer(result.value));
  state.answers[question.key] = result.value;
  if (question.key === "before_time" && result.value === "unknown") {
    addMessage("bot", "Understood. I'll record that the previous-location time was not available and continue. I won't make an alibi time comparison for this claim.");
  }
  state.questionIndex += 1;
  if (state.questionIndex < QUESTION_SETS[state.claimType].length) {
    askQuestion();
  } else {
    finishClaim();
  }
}

function parseDate(value) {
  const text = String(value).trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const dmy = text.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  const parts = iso ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
    : dmy ? [Number(dmy[3]), Number(dmy[2]), Number(dmy[1])] : null;
  if (!parts) return null;
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return date.getFullYear() === parts[0] && date.getMonth() === parts[1] - 1 && date.getDate() === parts[2] ? date : null;
}

function parseTime(value) {
  const match = String(value).trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  return minutes < 60 && (match[3] ? hours >= 1 && hours <= 12 : hours <= 23) ? { hours: match[3] ? hours % 12 + (/pm/i.test(match[3]) ? 12 : 0) : hours, minutes } : null;
}

function dateFor(data) {
  return parseDate(data);
}

function dayDifference(later, earlier) {
  return Math.floor((later.getTime() - earlier.getTime()) / 86400000);
}

function buildResolutionProof(facts, rule) {
  const clauses = facts.map((fact, index) => ({ id: index + 1, literals: [fact.atom], source: fact.source }));
  const ruleClauseId = clauses.length + 1;
  clauses.push({ id: ruleClauseId, literals: [...facts.map((fact) => `¬${fact.atom}`), "¬CONSISTENT"], source: `Knowledge-base rule: ${rule}` });
  const assumptionId = clauses.length + 1;
  clauses.push({ id: assumptionId, literals: ["CONSISTENT"], source: "Refutation assumption" });
  const lines = ["Resolution refutation:"];
  clauses.forEach((clause) => lines.push(`C${clause.id}: ${clause.literals.join(" ∨ ")} [${clause.source}]`));
  let previousId = ruleClauseId;
  let nextId = clauses.length + 1;
  for (const fact of facts) {
    const factId = facts.indexOf(fact) + 1;
    const nextLiteral = facts.slice(facts.indexOf(fact) + 1).map((remaining) => `¬${remaining.atom}`);
    nextLiteral.push("¬CONSISTENT");
    lines.push(`C${nextId}: ${nextLiteral.join(" ∨ ") || "□"} (resolve C${previousId} with C${factId})`);
    previousId = nextId;
    nextId += 1;
  }
  lines.push(`C${nextId}: □ (resolve C${previousId} with C${assumptionId})`);
  lines.push("The empty clause is derived; the consistency assumption is refuted.");
  return lines;
}

function evaluateClaim(type, answers) {
  const contradictions = [];
  const flags = [];
  const missing = [];
  const rules = [];
  const proof = ["Structured facts were compared using deterministic, source-aware rules."];
  const incident = dateFor(answers.accident_date || answers.theft_date);
  const policy = dateFor(answers.policy_start_date);
  const report = dateFor(type === "injury" ? answers.hospital_admission_date : answers.fir_date || answers.report_date);
  const fire = (id, message, evidence = []) => rules.push({ id, message, evidence });
  const flag = (label, id, message, evidence = []) => { flags.push(label); fire(id, message, evidence); };
  const contradiction = (message, facts, rule) => {
    contradictions.push(message);
    proof.push(...buildResolutionProof(facts, rule));
  };

  if (incident && policy && incident < policy) contradiction("The incident date is before the policy start date.", [
    { atom: "INCIDENT_BEFORE_POLICY", source: "Claimant statement and policy document" },
  ], "an incident before coverage is inconsistent with policy eligibility");
  if (incident && policy) {
    const delta = dayDifference(incident, policy);
    if (delta >= 0 && delta < 7) flag("New policy", type === "injury" ? "I6" : "R2", `Policy began ${delta} day(s) before the incident.`);
  }
  if (incident && report && dayDifference(report, incident) > 2) flag(type === "injury" ? "Late admission" : "Late report", type === "injury" ? "I3" : "R3", `The report/admission was ${dayDifference(report, incident)} day(s) after the incident.`);
  if (answers.licence_valid === "no") contradiction("The licence/RC status is recorded as invalid.", [
    { atom: "INVALID_LICENCE_RC", source: "Licence/RC evidence" },
  ], "policy eligibility requires a valid licence/RC");

  if (type === "accident") {
    const damage = normalizePart(answers.damaged_part || "");
    const repaired = normalizePart(answers.repaired_part || "");
    if (answers.repaired_part && answers.repaired_part !== "skip" && damage !== repaired) contradiction(
      `The claimant reports ${answers.damaged_part} damage, while the garage invoice records ${answers.repaired_part}.`,
      [
        { atom: "CLAIMED_DAMAGE", source: `Claimant statement: ${answers.damaged_part}` },
        { atom: "GARAGE_REPAIR_MISMATCH", source: `Garage invoice: ${answers.repaired_part}` },
      ],
      "the reported damaged part should match the garage repair",
    );
    const incidentTime = parseTime(answers.accident_time || "");
    const priorTime = parseTime(answers.before_time || "");
    if (answers.before_place && answers.before_place.toLowerCase() !== "unknown" && incidentTime && priorTime && (priorTime.hours * 60 + priorTime.minutes) >= (incidentTime.hours * 60 + incidentTime.minutes)) contradiction(
      `The claimant reports being at ${answers.before_place} until ${answers.before_time}, overlapping the ${answers.accident_time} accident time.`,
      [{ atom: "ALIBI_OVERLAPS_INCIDENT", source: "Claimant's prior-location and accident-time statements" }],
      "a person cannot be in two places at the same time",
    );
    if (answers.repaired_part === "skip") missing.push("Garage invoice");
  }
  if (type === "injury") {
    if (answers.claimant_injury && answers.hospital_report_injury && answers.hospital_report_injury !== "skip" && answers.claimant_injury.toLowerCase() !== answers.hospital_report_injury.toLowerCase()) contradiction(
      `The claimant reports ${answers.claimant_injury}, while the hospital report states ${answers.hospital_report_injury}.`,
      [
        { atom: "CLAIMANT_INJURY", source: `Claimant statement: ${answers.claimant_injury}` },
        { atom: "HOSPITAL_REPORT_INJURY_MISMATCH", source: `Hospital report: ${answers.hospital_report_injury}` },
      ],
      "claimant-reported injury should match the hospital report",
    );
    const admission = dateFor(answers.hospital_admission_date);
    if (incident && admission && admission < incident) contradiction("Hospital admission is dated before the accident.", [
      { atom: "ADMISSION_BEFORE_ACCIDENT", source: "Hospital report and claimant accident date" },
    ], "hospital admission should not precede the accident");
    if (Number(answers.days_stayed) >= 15) flag("Long hospital stay", "I4", `${answers.days_stayed}-day stay meets the 15-day review threshold.`);
    if (Number(answers.claim_amount) > 500000) flag("Claim amount above threshold", "I5", `Claim amount Rs ${answers.claim_amount} exceeds Rs 500000.`);
    if (answers.hospital_report_injury === "skip") missing.push("Hospital medical report");
    if (answers.hospital_bill_attached === "no") missing.push("Hospital bill");
  }
  if (type === "accident" || type === "theft") {
    if (!report) missing.push(type === "theft" ? "Theft report / FIR" : "FIR details");
    if (!answers.photo_path || answers.photo_path === "skip") missing.push(type === "theft" ? "Photo or document evidence" : "Photo evidence");
    const photoDate = dateFor(answers.photo_date);
    if (answers.photo_path && photoDate && incident && photoDate < incident) flag("Photo predates incident", "R7", "Entered photo date metadata predates the reported incident.");
    if (answers.photo_gps_match === "no") flag("Photo GPS location differs", "R8", "Entered photo GPS information differs from the reported location.");
    if (answers.photo_path && answers.photo_path !== "skip" && !answers.photo_date) missing.push("Photo date metadata (unavailable in this browser)");
    if (answers.photo_path && answers.photo_path !== "skip" && answers.photo_gps_match === "skip") missing.push("Photo GPS metadata (unavailable in this browser)");
  }

  const required = {
    accident: ["accident_date", "accident_time", "location", "damaged_part", "policy_start_date", "licence_valid"],
    theft: ["theft_date", "theft_time", "location", "policy_start_date", "licence_valid", "keys_available"],
    injury: ["accident_date", "hospital_admission_date", "claimant_injury", "hospital_report_injury", "days_stayed", "claim_amount", "policy_start_date", "hospital_bill_attached"],
  }[type];
  for (const key of required) {
    if (answers[key] === undefined || answers[key] === null || answers[key] === "") missing.push(`Required claim detail: ${key.replaceAll("_", " ")}`);
  }
  const uniqueMissing = [...new Set(missing)];
  const decision = contradictions.length || flags.length >= 2 ? "SEND FOR INVESTIGATION"
    : uniqueMissing.length || flags.length ? "REQUEST DOCUMENTS" : "APPROVE";
  proof.push(`Forward chaining: ${decision} (${contradictions.length} contradiction(s), ${flags.length} flag(s), ${uniqueMissing.length} missing item(s)).`);
  return { decision, contradictions, flags, missing: uniqueMissing, rules, proof };
}

function normalizePart(value) {
  const text = String(value).toLowerCase();
  for (const direction of ["front", "rear", "left", "right"]) if (text.includes(direction)) return direction;
  return text.replace(/\b(bumper|panel|damage|damaged|the|a|an)\b/g, "").trim();
}

function finishClaim() {
  state.assessment = evaluateClaim(state.claimType, state.answers);
  state.phase = "complete";
  state.screen = "result";
  render();
}

function explanation(result) {
  if (result.contradictions.length) return `I found ${result.contradictions.length} consistency contradiction(s). Any contradiction recommends investigation. I also found ${result.flags.length} flag(s) and ${result.missing.length} missing item(s). This is a review recommendation, not a finding of fraud.`;
  if (result.flags.length >= 2) return `${result.flags.length} flags were found; two or more recommend sending the claim for human investigation.`;
  if (result.missing.length) return `I couldn't complete the pre-screen because ${result.missing.join(", ")} are missing. Request those details or documents.`;
  if (result.flags.length) return "One review flag was found. Request supporting evidence for officer review; one flag alone does not prove a contradiction.";
  return "No contradiction, review flag, or required evidence gap was found by the entered rules. An authorized officer still makes the final decision.";
}

function resultCard(result) {
  const cls = result.decision === "SEND FOR INVESTIGATION" ? "investigate" : result.decision === "REQUEST DOCUMENTS" ? "request" : "approve";
  const list = (title, entries) => entries.length ? `<h3>${title}</h3><ul>${entries.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("")}</ul>` : "";
  return `<div class="result-card ${cls}">
    <span class="eyebrow">Pre-screening recommendation</span>
    <h2>${escapeHtml(result.decision)}</h2>
    <p>${escapeHtml(explanation(result))}</p>
    ${list("Consistency issues", result.contradictions)}
    ${list("Flags raised", result.flags)}
    ${list("Missing information / evidence", result.missing)}
    <details><summary>Show proof steps and rules fired</summary>
      <h3>Reasoning</h3><ol>${result.proof.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ol>
      <h3>Rules fired</h3>${result.rules.length ? `<ul>${result.rules.map((rule) => `<li><strong>${escapeHtml(rule.id)}:</strong> ${escapeHtml(rule.message)}${rule.evidence.length ? `<br><small>${rule.evidence.map(escapeHtml).join(" · ")}</small>` : ""}</li>`).join("")}</ul>` : "<p>No alert rules fired.</p>"}
    </details>
  </div>`;
}

function renderResultPage() {
  app.innerHTML = `
    <section class="result-page" aria-labelledby="result-title">
      <p class="eyebrow">Claim review · Result</p>
      <h1 id="result-title">Pre-screening result</h1>
      <p class="result-page-lead">Review the recommendation, supporting findings, missing evidence, and reasoning below.</p>
      ${state.assessment ? resultCard(state.assessment) : "<p>The claim result is not available. Return to the conversation and complete a review.</p>"}
      <nav class="result-page-actions" aria-label="Result navigation">
        <button class="button button-secondary" data-action="back-to-chat">← Back to conversation</button>
        <button class="button button-accent" data-action="show-techniques">Continue to final explanation →</button>
        <button class="button button-secondary" data-action="new-review">Start another review</button>
      </nav>
    </section>`;

  app.querySelector('[data-action="back-to-chat"]').addEventListener("click", () => {
    state.screen = "chat";
    render();
  });
  app.querySelector('[data-action="show-techniques"]').addEventListener("click", () => {
    state.screen = "techniques";
    render();
  });
  app.querySelector('[data-action="new-review"]').addEventListener("click", () => {
    state.screen = "chat";
    state.messages = [];
    state.assessment = null;
    state.claimType = null;
    state.answers = {};
    state.phase = "idle";
    renderWelcome();
  });
}

function renderTechniquesPage() {
  app.innerHTML = `
    <section class="techniques-page" aria-labelledby="techniques-title">
      <p class="eyebrow">Final page · Application techniques</p>
      <h1 id="techniques-title">How the AI techniques work here</h1>
      <p class="techniques-lead">This is the final explanation of how the verifier reasons about the claim conversation you just completed.</p>
      <div class="technique-list">
        <article class="technique-item">
          <span class="technique-number">01</span>
          <div><h2>Knowledge base</h2><p>A collection of hand-written, numbered insurance and consistency rules, such as late reporting, policy start dates, damage mismatches, injury mismatches, and missing evidence.</p><p class="technique-role"><strong>Role in this application:</strong> it defines what evidence comparisons and policy conditions the chatbot checks.</p></div>
        </article>
        <article class="technique-item">
          <span class="technique-number">02</span>
          <div><h2>Facts and propositional / first-order logic</h2><p>Answers are treated as facts tagged by their source. For example: <code>Damage(Front)</code> from the claimant and <code>Repaired(Rear)</code> from a garage invoice.</p><p class="technique-role"><strong>Role in this application:</strong> facts make the claim information explicit so rules can compare people, places, dates, parts, and evidence sources.</p></div>
        </article>
        <article class="technique-item">
          <span class="technique-number">03</span>
          <div><h2>Resolution by refutation</h2><p>The verifier represents a reported mismatch and its consistency rule as clauses, then assumes the claim is consistent. It resolves complementary literals; if this derives the empty clause (□), that assumption is contradicted.</p><p class="technique-role"><strong>Role in this application:</strong> it produces an explainable contradiction proof for mismatches such as a claimant-reported injury differing from the hospital report.</p>${state.assessment?.proof?.some((line) => line.includes("Resolution refutation")) ? `<details class="technique-proof"><summary>See this claim's resolution proof</summary><ol>${state.assessment.proof.filter((line) => line.includes("Resolution") || line.includes("C1:") || line.includes("C2:") || line.includes("C3:") || line.includes("C4:") || line.includes("resolve") || line.includes("empty clause")).map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ol></details>` : ""}</div>
        </article>
        <article class="technique-item">
          <span class="technique-number">04</span>
          <div><h2>Forward chaining</h2><p>Starting with the entered facts, the system checks the IF conditions of its rules. Whenever a condition matches, it fires the rule and adds a flag or conclusion.</p><p class="technique-role"><strong>Role in this application:</strong> it accumulates fired rules such as late admission, new policy, or long hospital stay and passes those findings to the decision logic.</p></div>
        </article>
        <article class="technique-item">
          <span class="technique-number">05</span>
          <div><h2>Decision rules and chatbot flow</h2><p>Any contradiction or two or more flags recommends investigation. Missing documents result in a request for evidence. With no contradictions, flags, or required gaps, the prototype recommends approval for human review.</p><p class="technique-role"><strong>Role in this application:</strong> the guided conversation gathers structured answers; these fixed rules explain the result without machine learning or external services.</p></div>
        </article>
      </div>
      <p class="techniques-disclaimer">This prototype checks consistency, not document authenticity or fraud. A recommendation is not a final claim decision; an authorized claims officer must assess the evidence.</p>
      <div class="techniques-actions">
        <button class="button button-secondary" data-action="back-to-result">← Back to result</button>
        <button class="button button-accent" data-action="new-review">Start another review</button>
      </div>
    </section>`;
  app.querySelector('[data-action="back-to-result"]').addEventListener("click", () => {
    state.screen = state.assessment ? "result" : "chat";
    render();
  });
  app.querySelector('[data-action="new-review"]').addEventListener("click", () => {
    state.screen = "chat";
    state.messages = [];
    state.assessment = null;
    state.claimType = null;
    state.answers = {};
    state.phase = "idle";
    renderWelcome();
  });
}

async function loadJsonClaim(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data || Array.isArray(data) || typeof data !== "object") throw new Error("Select a JSON object.");
    const type = ["accident", "theft", "injury"].includes(String(data.claim_type).toLowerCase()) ? String(data.claim_type).toLowerCase()
      : data.theft_date ? "theft" : data.claimant_injury || data.hospital_admission_date ? "injury" : data.accident_date ? "accident" : null;
    if (!type) throw new Error("The JSON needs claim_type or a recognizable claim date field.");
    addMessage("user", `Loaded claim file: ${file.name}`);
    state.claimType = type;
    state.answers = data;
    state.assessment = evaluateClaim(type, data);
    state.phase = "complete";
    state.screen = "result";
    render();
  } catch (error) {
    addMessage("bot", `I couldn't load that file: ${error.message}`);
  }
}

document.querySelector(".brand").addEventListener("click", (event) => {
  event.preventDefault();
  state.phase = "idle";
  state.claimType = null;
  state.answers = {};
  state.assessment = null;
  state.messages = [];
  renderWelcome();
});

app.addEventListener("click", (event) => {
  const command = event.target.closest("[data-command]");
  if (command) processMessage(command.dataset.command);
});

render();
window.setTimeout(() => {
  if (state.screen !== "splash") return;
  state.screen = "chat";
  renderWelcome();
}, 3000);
