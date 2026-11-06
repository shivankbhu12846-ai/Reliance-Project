# Delegation Lab

A timed experiment platform for testing whether people delegate more work to an AI agent when rewards are shared in a group than when they work alone.

## Files

- `index.html` – the whole app (participant, panel and researcher views)
- `netlify/functions/agent.mjs` – the AI agent endpoint; keeps your API key on the server
- `netlify.toml` – tells Netlify where things are

## Deploy

1. Put these files in a GitHub repository.
2. In Netlify: **Add new site → Import an existing project**, pick the repository. No build command is needed.
3. In **Site configuration → Environment variables**, add:
   - `AI_API_KEY` – your API key
   - `AI_PROVIDER` – `anthropic` (default), `gemini` or `openai`
   - `AI_MODEL` – optional for Anthropic (default `claude-haiku-5-5`) and Gemini (default `gemini-3.5-flash`); required for OpenAI
4. Redeploy so the function picks up the variables.
5. In **Forms**, enable form detection. Two forms appear after the next deploy: `submissions` and `ratings`.

If the API key is missing or the model can't be reached, the agent uses the pre-written outputs in `index.html`, so the experiment still runs. The researcher table and CSV show which source each agent answer came from (`agent_source`: `live` or `prewritten`).

## Running a session

- **Participant tab:** choose Individual or Group of four, enter IDs, start. In the group condition, members tap their ID before working on a task, so each action is logged to the right person.
- **Panel tab:** judges enter a name and rate each submission from −2 to +2. They don't see who made it, whether the agent was used, or the condition.
- **Researcher tab:** delegation rate per person and per condition, weak agent outputs submitted unedited, and mean panel scores. Copy the data as CSV.

## Collecting data across devices

Each device keeps its own copy of the data, and every submission and rating is also sent to Netlify Forms. To combine everything: export the `submissions` and `ratings` forms as CSV from the Netlify dashboard, then use **Import CSV** in the Researcher tab. Do the same on a judge's device to load submissions for rating.

## How the 75% works

Tasks are drawn in blocks of four, and in each block exactly one is assigned the weak agent output. For those tasks the live model is told to include one specific, checkable error (listed per task in `index.html`). The other three get a normal, best-effort answer.

The app opens with clearly marked example data. Remove it in the Researcher tab before a real run.
