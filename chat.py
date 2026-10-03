import random
import re

THEME = {
    "base": "\033[48;5;255m",
    "header": "\033[38;5;25m",
    "text": "\033[38;5;236m",
    "accent": "\033[38;5;208m",
    "bot": "\033[48;5;252m",
    "user": "\033[48;5;230m",
    "reset": "\033[0m",
}

INTENT_RESPONSES = {
    "greeting": [
        "Hello, officer! I am the Claim Verifier, your claim pre-screening assistant. Say 'new claim', 'load file' or 'help'.",
        "Good day, officer! I help pre-screen accident, theft and injury claims. You can start a new claim, load a file or ask for help.",
        "Vanakkam, officer! I can help review a claim. Say 'new claim', 'load file' or 'help'.",
    ],
    "thanks": [
        "You're welcome, officer!",
        "Happy to help with the review.",
        "You're welcome. Let me know if you need anything else.",
    ],
    "farewell": [
        "Goodbye, officer! Take care.",
        "Thanks for using the Claim Verifier. Goodbye!",
        "Goodbye. The unfinished claim, if any, was not saved.",
    ],
    "smalltalk": [
        "I'm doing well, thanks! Ready when you are.",
        "I'm a rule-based assistant that helps claims officers pre-screen claims.",
        "I was built as an AI lab project using resolution and forward chaining.",
    ],
    "help": [
        "I pre-screen accident, theft and injury claims by comparing claimant statements with evidence and policy rules. I can recommend Approve, Request documents or Investigate, and explain why. Commands: new claim, load file, why, show proof, restart, cancel and bye.",
        "I check claims for contradictions, late reports and mismatches, then explain my recommendation. Say 'new claim' to begin, 'load file' to review structured data, or 'why' to revisit the last result.",
    ],
}


def normalize_text(text: str) -> str:
    value = text.strip().lower()
    value = re.sub(r"([a-z])\1{2,}", r"\1\1", value)
    value = re.sub(r"[^a-z0-9\s:/-]", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def _contains(value: str, pattern: str) -> bool:
    return re.search(pattern, value) is not None


def match_intent(text: str) -> str:
    value = normalize_text(text)
    if not value:
        return "unknown"

    # Put commands that change the flow before greetings/help in compound messages.
    if _contains(value, r"\b(cancel|restart|start over|reset)\b"):
        return "restart"
    if _contains(value, r"\b(bye|goodbye|see you|exit|quit)\b"):
        return "farewell"
    if _contains(value, r"\b(load file|upload|claim file|file to review)\b"):
        return "load_file"
    if _contains(value, r"\b(why|explain|show proof|which rules fired)\b"):
        return "status"
    if _contains(value, r"\b(new claim|review (a )?claim|check (a )?claim|start (a )?claim|start)\b"):
        return "start_claim"
    if _contains(value, r"\b(accident|theft|injury) claim\b"):
        return "start_claim"
    if _contains(value, r"\b(help|what can you do|i need (your )?help)\b"):
        return "help"
    if _contains(value, r"\b(thanks|thank you|thnks)\b"):
        return "thanks"
    if _contains(value, r"\b(hi|hello|hey|hii|helo|good morning|good afternoon|good evening|vanakkam)\b"):
        return "greeting"
    if _contains(value, r"\b(how are you|who are you|who made you|what are you)\b"):
        return "smalltalk"
    return "unknown"


def choose_response(intent: str) -> str:
    responses = INTENT_RESPONSES.get(
        intent,
        ["I didn't understand that. You can say 'new claim', 'help' or 'bye'."],
    )
    return random.choice(responses)


def is_pending_claim_answer(text: str) -> bool:
    return match_intent(text) == "unknown"


def format_colored(text: str, color: str = "") -> str:
    return f"{color}{text}{THEME['reset']}" if color else text


def title_bar(label: str) -> str:
    return f"{THEME['header']}=== {label} ==={THEME['reset']}"
