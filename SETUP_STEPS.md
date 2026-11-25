# Setup steps (do these in order)

## 1. Google Sheet
1. Create a Google Sheet named **Kesar Support**.
2. File → Import → Upload `sheets/audit_log.csv` → **Insert new sheet(s)**. Rename the tab to exactly **Audit Log**.
3. File → Import → Upload `sheets/tickets.csv` → **Insert new sheet(s)**. Rename the tab to exactly **Tickets**.
4. Delete the empty default "Sheet1". Copy the sheet URL from the address bar.

## 2. n8n
1. Log in to n8n Cloud → **Create workflow** → `...` menu (top right) → **Import from File** → `workflow/kesar_support_copilot.json`.
2. **Credentials** (keys are stored in n8n, never in the workflow file):
   - Open **Classify Email (Gemini)** → Credential → *Create new* → "Google Gemini(PaLM) Api" → paste your AI Studio key → Save.
   - Select the same credential in **Repair JSON (Gemini)** and **Gemini Chat Model**.
   - Open **Read Tickets** → Credential → *Sign in with Google*. Select the same Google credential in **Upsert Ticket** and **Append Audit Log**.
3. Open the **Config** node and paste your sheet URL into `sheet_url`.
4. Save.

## 3. First test run (3 emails)
- In **Config** set `only_ids: ['E01','E03','E07']` → click **Test workflow**.
- Check the Audit Log tab (3 rows) and the Tickets tab (1 ticket for E03).

## 4. Full runs
- **v1 baseline:** `prompt_version: 'v1'`, `only_ids` = 10+ emails (e.g. E01,E03,E05,E07,E08,E10,E12,E16,E20,E22).
- Before the v2 run, delete the v1 rows from both tabs (or copy them to a "v1 results" tab first; you need them for the test report).
- **v2 final:** `prompt_version: 'v2'`, `only_ids: []` → all 25.

## Changing logic
`code/` and `prompts/` are the source files. After editing them, run `python tools/build_workflow.py` and re-import the workflow,
or paste the code straight into the n8n node. (If you edit inside n8n, copy the change back into `code/` as well.)
