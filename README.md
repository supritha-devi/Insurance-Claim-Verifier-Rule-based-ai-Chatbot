# Insurance Claim Verifier

**Insurance Claim Verifier, a rule-based AI chatbot** is an explainable claim-screening prototype for insurance claims officers. The browser app has four stages: a title splash shown for three seconds, the chatbot conversation, a separate claim-result page, and a final page explaining the AI techniques and their role in the application.

This is a consistency checker, not a fraud detector or an automated final decision-maker. A human claims officer must review the evidence and make the final decision.

## Run the web application

The web app is static HTML, CSS, and JavaScript. It has no server, build step, package installation, database, or online API.

- For a quick preview, open `index.html` in a browser.
- In VS Code, install/use the Live Server extension if the browser restricts local file behavior, then choose **Open with Live Server** for `index.html`.

The web app can be hosted by GitHub Pages. To publish it:

1. Create a GitHub repository and upload/push the project files.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, choose **GitHub Actions** as the source.
4. Push the files to the `main` branch. The included workflow deploys the static site automatically; it can also be started manually from the repository's **Actions** tab.
5. Wait for the workflow to finish. The published URL appears in the deployment job and on the Pages settings screen.

The page files (`index.html`, `styles.css`, and `app.js`) are at the repository root, as required by that Pages configuration.

## Use the application

1. Wait three seconds on the title splash; the chatbot opens automatically.
2. Select **New claim** or type a request to start.
3. Choose accident, theft, or injury from the assistant's chat choices.
4. Reply to each question in the chat. Use the back-arrow button or type `back` to revisit a previous answer.
5. After the questions are complete, review the recommendation, consistency issues, flags, missing items, fired rules, and proof steps on the separate result page.
6. Choose **Continue to final explanation** to open the last page, which explains the knowledge base, logic representation, resolution/refutation, forward chaining, and their roles here.

You can ask a supported question during the claim flow (for example, “What is forward chaining?” or “Are my answers uploaded?”). The assistant answers without changing the pending claim question. If it does not recognize a question, it says so rather than recording it as a claim answer, then repeats the question it was waiting for. Use the result page's navigation to return to the conversation or continue to the final AI-techniques page.

Select **Load claim JSON** in the chatbot composer to evaluate a local structured claim object. Add `claim_type` as `accident`, `theft`, or `injury`, plus the matching fields used by the guided questions. The JSON is read locally in your browser, not uploaded.
Example injury files are available in `sample_data/`; load `injury_clean.json` for an approval example or `injury_investigate.json` for mismatched facts and multiple flags.

Evidence files selected in the guided flow are not uploaded or saved. The app uses the selection only to record whether a file was provided. It does not inspect document content or image content. Photo dates and whether GPS matches can be entered as visible metadata; this static browser prototype does not read EXIF/GPS data itself.

## concepts demonstrated

- **Knowledge base:** numbered, explicit policy and consistency rules.
- **Facts and propositional/first-order logic:** structured answers are represented as facts (for example, `Damage(Front)` and `Repaired(Rear)`) and compared by rules.
- **Resolution/refutation:** when entered facts conflict with a consistency condition, the app shows a simplified proof trace and reports the contradiction/empty-clause result. This educational demonstration is rule-driven; it is not a general-purpose theorem prover.
- **Forward chaining:** the app applies matching IF–THEN rules to entered facts, records the rules that fire, and accumulates flags.
- **Decision logic:** a contradiction or two or more flags recommends investigation; otherwise missing information requests documents; with no flags, contradictions, or evidence gaps the prototype recommends approval for human review.
- **Rule-based interaction:** structured questions are asked in a conversational flow; no machine learning or arbitrary free-form claim interpretation is used.

## Claim types

- **Accident:** accident time/location, claimant's prior location, FIR, policy start, licence status, vehicle damage and garage repair.
- **Theft:** theft time/location, report, policy start, RC/licence and key status.
- **Injury:** linked accident/admission dates, claimant and hospital injury descriptions, stay duration, amount, policy start and hospital bill.

The rules are intentionally simplified for an AI lab demonstration. Health and life claims are possible future extensions using the same rule engine to compare entered fields such as dates, diagnosis match and amounts, without giving medical advice.

## Privacy and limitations

- The browser app performs its screening locally. It does not send claims to a service or save them to a database.
- It checks consistency, not whether typed or selected evidence is genuine.
- A missing or unreadable photo metadata value is not a contradiction. This web version does not parse photo EXIF/GPS.
- Policy thresholds are illustrative and should not be used for real insurance decisions.
- Real insurers use substantially more advanced review processes. The prototype is for education only.

## Python command-line prototype and tests

The original Python CLI remains available:

```powershell
python main.py
```

Run its regression tests with:

```powershell
python -m unittest -v test_claim_verifier
```

Pillow is an optional dependency for the Python prototype's photo metadata reader:

```powershell
python -m pip install pillow
```
