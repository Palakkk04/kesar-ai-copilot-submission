"""Assembles workflow/kesar_support_copilot.json from code/*.js and prompts/*.md.

Run:  python tools/build_workflow.py
The code/ and prompts/ folders are the source of truth; the JSON is generated.
"""
import json
import re
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CODE = ROOT / "code"
PROMPTS = ROOT / "prompts"
OUT = ROOT / "workflow" / "kesar_support_copilot.json"


def read(p: Path) -> str:
    return p.read_text(encoding="utf-8")


SCHEMA_LIB = read(CODE / "lib_schema.js")
VALIDATOR_LIB = read(CODE / "lib_validate.js")
P_V1 = read(PROMPTS / "classifier_v1.md").strip()
P_V2 = read(PROMPTS / "classifier_v2.md").strip()
AGENT_SYSTEM = read(PROMPTS / "agent_system.md").strip()


def js(name: str) -> str:
    src = read(CODE / name)
    src = src.replace("__SCHEMA_LIB__", SCHEMA_LIB)
    src = src.replace("__VALIDATOR_LIB__", VALIDATOR_LIB)
    src = src.replace("__PROMPT_CLASSIFIER_V1__", json.dumps(P_V1, ensure_ascii=False))
    src = src.replace("__PROMPT_CLASSIFIER_V2__", json.dumps(P_V2, ensure_ascii=False))
    src = src.replace("__AGENT_SYSTEM_CHARS__", str(len(AGENT_SYSTEM)))
    left = re.findall(r"__[A-Z][A-Z0-9_]+__", src)
    assert not left, f"{name}: unfilled placeholders {left}"
    return src


nodes = []


def node(name, ntype, version, pos, params, **extra):
    n = {"parameters": params, "id": str(uuid.uuid4()), "name": name, "type": ntype,
         "typeVersion": version, "position": list(pos)}
    n.update(extra)
    nodes.append(n)
    return n


def code_node(name, file, pos, **extra):
    return node(name, "n8n-nodes-base.code", 2, pos, {"jsCode": js(file)}, **extra)


def if_node(name, expr, pos):
    return node(name, "n8n-nodes-base.if", 2, pos, {
        "conditions": {
            "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose"},
            "conditions": [{
                "id": str(uuid.uuid4()),
                "leftValue": expr,
                "rightValue": "",
                "operator": {"type": "boolean", "operation": "true", "singleValue": True},
            }],
            "combinator": "and",
        },
        "options": {},
    })


SHEET_DOC = {"__rl": True, "mode": "url", "value": "={{ $('Config').first().json.sheet_url }}"}


def sheet(tab):
    return {"__rl": True, "mode": "name", "value": tab}


def llm_http(name, pos):
    return node(name, "n8n-nodes-base.httpRequest", 4.2, pos, {
        "method": "POST",
        "url": "={{ $('Config').first().json.llm_url }}",
        "authentication": "predefinedCredentialType",
        "nodeCredentialType": "groqApi",
        "sendBody": True,
        "specifyBody": "json",
        "jsonBody": "={{ JSON.stringify($json.llm_request) }}",
        "options": {"timeout": 120000},
    }, retryOnFail=True, maxTries=3, waitBetweenTries=5000, onError="continueRegularOutput")


Y = 400
# ---- intake ----
node("Run Test Emails", "n8n-nodes-base.manualTrigger", 1, (0, Y), {})
code_node("Config", "01_config.js", (220, Y))
code_node("Load Data", "02_load_data.js", (440, Y), retryOnFail=True, maxTries=3, waitBetweenTries=3000)
code_node("Split Emails", "03_split_emails.js", (660, Y))
node("Loop Over Emails", "n8n-nodes-base.splitInBatches", 3, (880, Y), {"batchSize": 1, "options": {}})
# ---- classification ----
code_node("Build Classifier Request", "04_build_classifier_request.js", (1120, Y))
llm_http("Classify Email (LLM)", (1340, Y))
code_node("Validate Classification", "05_validate_classification.js", (1560, Y))
if_node("JSON Valid?", "={{ $json.json_valid }}", (1780, Y))
code_node("Build Repair Request", "06_build_repair_request.js", (2000, Y + 240))
llm_http("Repair JSON (LLM)", (2220, Y + 240))
code_node("Validate Repair / Fallback", "07_validate_repair.js", (2440, Y + 240))
# ---- rules ----
code_node("Apply Business Rules", "08_apply_business_rules.js", (2680, Y))
if_node("Needs Reply?", "={{ $json.needs_reply }}", (2900, Y))
# ---- agent ----
node("Draft Reply Agent", "@n8n/n8n-nodes-langchain.agent", 1.7, (3160, Y - 160), {
    "agent": "toolsAgent",
    "promptType": "define",
    "text": "={{ $json.agent_prompt }}",
    "options": {"systemMessage": AGENT_SYSTEM, "maxIterations": 6, "returnIntermediateSteps": True},
}, retryOnFail=True, maxTries=3, waitBetweenTries=5000, onError="continueRegularOutput")
node("Groq Chat Model", "@n8n/n8n-nodes-langchain.lmChatGroq", 1, (3060, Y + 60), {
    "model": "openai/gpt-oss-120b",
    "options": {"temperature": 0.3},
})
node("get_order", "@n8n/n8n-nodes-langchain.toolCode", 1.1, (3220, Y + 60), {
    "name": "get_order",
    "description": ("Look up the customer's order in the order system. Input: the order ID (format KC-####). "
                    "If the customer gave no order ID, input their email address. Returns status, items, amounts, "
                    "courier, tracking link and dates, or found:false. Only orders that belong to the sender are returned."),
    "language": "javaScript",
    "jsCode": js("tool_get_order.js"),
})
node("search_faq", "@n8n/n8n-nodes-langchain.toolCode", 1.1, (3380, Y + 60), {
    "name": "search_faq",
    "description": ("Search Kesar & Co.'s official FAQ and policies (shipping, COD, cancellation, returns, damaged/wrong/missing "
                    "items, refunds, products, medical safety, contact). Input: a short English query, e.g. "
                    "'return window unopened' or 'saffron serum vegan oily skin'. Returns the matching FAQ sections. "
                    "This is the ONLY allowed source for policy and product facts."),
    "language": "javaScript",
    "jsCode": js("tool_search_faq.js"),
})
code_node("Check Reply Guardrails", "09_check_reply_guardrails.js", (3560, Y - 160))
code_node("No Reply (log only)", "10_no_reply.js", (3160, Y + 300))
# ---- tickets ----
if_node("Needs Ticket?", "={{ $json.needs_ticket }}", (3800, Y))
node("Read Tickets", "n8n-nodes-base.googleSheets", 4.5, (4020, Y - 160), {
    "operation": "read", "documentId": SHEET_DOC, "sheetName": sheet("Tickets"), "options": {},
}, alwaysOutputData=True, retryOnFail=True, maxTries=3, waitBetweenTries=3000)
code_node("Build Ticket", "11_build_ticket.js", (4240, Y - 160))
node("Upsert Ticket", "n8n-nodes-base.googleSheets", 4.5, (4460, Y - 160), {
    "operation": "appendOrUpdate", "documentId": SHEET_DOC, "sheetName": sheet("Tickets"),
    "columns": {"mappingMode": "autoMapInputData", "value": {}, "matchingColumns": ["ticket_id"], "schema": []},
    "options": {},
}, retryOnFail=True, maxTries=3, waitBetweenTries=3000)
code_node("Attach Ticket", "12_attach_ticket.js", (4680, Y - 160))
# ---- audit ----
code_node("Build Audit Row", "13_build_audit_row.js", (4900, Y))
node("Append Audit Log", "n8n-nodes-base.googleSheets", 4.5, (5120, Y), {
    "operation": "append", "documentId": SHEET_DOC, "sheetName": sheet("Audit Log"),
    "columns": {"mappingMode": "autoMapInputData", "value": {}, "matchingColumns": [], "schema": []},
    "options": {},
})  # no auto-retry on append: a retry after a partial success writes duplicate rows
node("Wait (rate limit)", "n8n-nodes-base.wait", 1.1, (5340, Y), {
    "amount": "={{ $('Config').first().json.delay_seconds }}", "unit": "seconds",
}, webhookId=str(uuid.uuid4()))

# ---- sticky notes ----
def sticky(text, pos, w, h, color):
    node(f"Note {len(nodes)}", "n8n-nodes-base.stickyNote", 1, pos, {"content": text, "width": w, "height": h, "color": color})

sticky("## 1. Intake\nEdit **Config** (sheet URL, prompt v1/v2, subset of emails). Loads orders/FAQ/emails from the repo and loops one email at a time.", (-40, 180), 1060, 420, 7)
sticky("## 2. Classify (LLM -> JSON)\nThe LLM (Groq) returns JSON matching `llm_output.schema.json`. Validated in code; if invalid -> one repair call -> safe fallback (`other` + needs human).", (1080, 180), 1500, 560, 5)
sticky("## 3. Business rules in code\nOrder lookup (ID, else sender email), privacy check, date maths, return eligibility, needs_human, priority.", (2620, 180), 420, 420, 4)
sticky("## 4. AI Agent + tools\nAgent drafts the reply using `get_order` and `search_faq`. Guardrails re-check the draft (amounts, links, IDs, privacy, medical claims).", (3060, 60), 680, 640, 6)
sticky("## 5. Tickets (deduped) + Audit log\nOpen ticket for same order -> update it; else create. Every email -> one Audit Log row.", (3760, 60), 1760, 560, 3)

# ---- connections ----
def main(src, *targets_per_output):
    return {src: {"main": [[{"node": t, "type": "main", "index": 0} for t in outs] for outs in targets_per_output]}}

connections = {}
for part in [
    main("Run Test Emails", ["Config"]),
    main("Config", ["Load Data"]),
    main("Load Data", ["Split Emails"]),
    main("Split Emails", ["Loop Over Emails"]),
    main("Loop Over Emails", [], ["Build Classifier Request"]),   # output 0 = done, 1 = loop
    main("Build Classifier Request", ["Classify Email (LLM)"]),
    main("Classify Email (LLM)", ["Validate Classification"]),
    main("Validate Classification", ["JSON Valid?"]),
    main("JSON Valid?", ["Apply Business Rules"], ["Build Repair Request"]),
    main("Build Repair Request", ["Repair JSON (LLM)"]),
    main("Repair JSON (LLM)", ["Validate Repair / Fallback"]),
    main("Validate Repair / Fallback", ["Apply Business Rules"]),
    main("Apply Business Rules", ["Needs Reply?"]),
    main("Needs Reply?", ["Draft Reply Agent"], ["No Reply (log only)"]),
    main("Draft Reply Agent", ["Check Reply Guardrails"]),
    main("Check Reply Guardrails", ["Needs Ticket?"]),
    main("No Reply (log only)", ["Needs Ticket?"]),
    main("Needs Ticket?", ["Read Tickets"], ["Build Audit Row"]),
    main("Read Tickets", ["Build Ticket"]),
    main("Build Ticket", ["Upsert Ticket"]),
    main("Upsert Ticket", ["Attach Ticket"]),
    main("Attach Ticket", ["Build Audit Row"]),
    main("Build Audit Row", ["Append Audit Log"]),
    main("Append Audit Log", ["Wait (rate limit)"]),
    main("Wait (rate limit)", ["Loop Over Emails"]),
]:
    connections.update(part)

connections["Groq Chat Model"] = {"ai_languageModel": [[{"node": "Draft Reply Agent", "type": "ai_languageModel", "index": 0}]]}
connections["get_order"] = {"ai_tool": [[{"node": "Draft Reply Agent", "type": "ai_tool", "index": 0}]]}
connections["search_faq"] = {"ai_tool": [[{"node": "Draft Reply Agent", "type": "ai_tool", "index": 0}]]}

workflow = {
    "name": "Kesar & Co. Support Copilot",
    "nodes": nodes,
    "connections": connections,
    "pinData": {},
    "settings": {"executionOrder": "v1"},
    "active": False,
    "meta": {"templateCredsSetupCompleted": False},
    "tags": [],
}

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(workflow, indent=2, ensure_ascii=False), encoding="utf-8")
print(f"wrote {OUT} ({len(nodes)} nodes)")
