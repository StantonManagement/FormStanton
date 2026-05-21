# How I Actually Work With Claude

*A note for François — the operating model, not the hype.*

You already know how to run delivery. What's new here isn't software, it's the **cost model of an LLM agent**, and once that clicks the workflow designs itself. The short version: I never let one tool do everything. I split the work into three stages and run each stage in the mode that's cheapest for that kind of thinking. That's the whole reason I stopped hitting limits.

---

## First, the mental model that matters

An LLM agent is not a deterministic build pipeline. Two things drive what it costs you:

1. **Context is reprocessed every turn.** The model re-reads the whole conversation — every file it opened, every diff, every tool output — on *each* step. A long agentic session accumulates context and you pay for that accumulation repeatedly, not once.
2. **The expensive mode is the agentic loop**: read files → write code → re-read → fix → re-run. Each iteration is a full round-trip carrying all that context. And if the agent is *also* trying to figure out what you actually want while it's looping, every misunderstanding is a wasted expensive cycle.

So the goal of the workflow is simple: **keep exploration out of the expensive lane.** Do the cheap thinking where it's cheap, and only spend agentic cycles on execution against a clear target.

---

## The three stages

**1. Brainstorm in plain chat.**
This is whiteboard mode — pure reasoning, no tools, no files, no agent running around the repo. What am I building, who's it for, what breaks, what are the edge cases. It's the cheapest mode there is and it's where most of the real thinking happens. I deliberately don't let it touch code here.

**2. Move to Cowork to write the spec.**
Cowork has access to my actual project files, so the plan is grounded in what already exists instead of guessed. But the output of this stage is **not code** — it's a written spec (I call them PRDs). It states exactly what to build, the data shape, the integration points, the edge cases, and what "done" means. Cowork plans and verifies; it doesn't build. Think of it as the design-doc stage, except the thing reading the doc next is another agent.

**3. Hand the spec to a build agent.**
I take that spec to a coding tool (I use Windsurf) and it writes the code. Because the target is unambiguous, it's mostly one clean pass instead of the "no, not like that, try again" loop — which is exactly the loop that used to burn all my tokens.

---

## Why this is cheaper, concretely

The spec is doing the same job an API contract or an interface does between two teams: it **decouples the "what" from the "how."** The build agent isn't paying (in tokens) to interpret my intent — I already resolved intent in a cheaper mode. You're no longer letting an expensive agentic loop double as your brainstorming session.

Put bluntly: skipping straight to "build me X" means the agent discovers your requirements *while* building, gets them wrong a few times, and each wrong turn is a full expensive cycle. You end up paying exploration costs at build-time prices.

---

## The smaller habits that compound

- **Fresh context per task.** Don't let one thread balloon — old context rides along on every subsequent turn and that's silent token spend. New topic, new conversation.
- **One concern per conversation.** Don't make the model juggle five unrelated things; it carries all of it forward.
- **Persist intent in writing.** The spec means I'm not re-priming the same background every session.
- **Scope the agent's surface area.** Point a build agent at the relevant files, not the whole repo, so it isn't reading (and re-reading) everything.

---

## The one-liner

Think in chat (cheap). Spec it in Cowork (grounded). Build from the spec (fast). **Don't make the expensive tool do the cheap thinking.**

Happy to walk you through a live one whenever — easier to show than describe.
