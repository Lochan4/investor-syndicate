# The Syndicate — Investor Walkthrough Script
### Stage-by-Stage User Journey

---

## LOGIN

The investor arrives at the login screen. The interface shows a single centered card on a near-black background — logo at the top, email and password fields, and a TOTP code field below them. Nothing else is on screen.

**[USER ACTION]**
The investor enters their email, password, and TOTP code, then presses Enter.

**[SCREEN]**
The login card pulses once — a brief, quiet animation — and dissolves. The main canvas loads.

---

## ENTRY STATE — THE BLANK CANVAS

The screen settles into its default three-panel layout. On the left edge, the **Assets** panel sits collapsed — a thin vertical strip with a small icon and label, folded away. On the right edge, the **Assessment** panel mirrors it exactly. Both are present but not occupying space. The center of the screen is a wide, blank canvas — no grid, no placeholder text. At the absolute center of this canvas sits the **microphone toggle**: a circular button with a faint outer ring that pulses slowly, indicating the system is ready but not yet listening. Below the toggle, a small ghost text reads: *Press [Space] to speak — or hover to begin.*

---

## STAGE 1 — WORKSPACES

**[CONTEXT]**
The investor wants to see which workspaces their account has access to. Workspaces are the top-level containers in the system — each one holds a collection of projects, typically organized around a fund, cohort, or deal type.

**[USER ACTION]**
The investor presses Spacebar. The mic outer ring solidifies from its slow pulse into a steady lit state. A single, short audio tone plays confirming the mic is live. A real-time transcription line appears just below the toggle, rendering words as they are spoken.

**[USER SPEAKS]**
*"What are all the workspaces that I'm a part of?"*

**[SCREEN]**
The transcription line settles. The mic ring dims back to its resting state. The canvas begins generating **workspace cards** — one per workspace the investor has access to — appearing in a staggered cascade, each card fading in slightly after the previous. Each card shows:

- Workspace name — large, bold
- Number of projects inside — subdued, right-aligned
- Last activity timestamp — small, at the bottom of the card

The investor reads through the cards and identifies the workspace they want to enter.

**[USER ACTION]**
The investor presses Spacebar again to reactivate the mic.

**[USER SPEAKS]**
*"Open Seed Fund Q4."*

**[SCREEN]**
The card named *Seed Fund Q4* highlights — a thin ring appears around it. The remaining workspace cards dim to low opacity. The selected card then begins to expand outward toward the edges of the screen and, once it fills the canvas, dissolves into the next layer. Stage 2 loads.

---

## STAGE 2 — PROJECTS INSIDE A WORKSPACE

**[CONTEXT]**
The investor is now inside the selected workspace. The header area shows the workspace name — *Seed Fund Q4* — on the left, with a back arrow to return to the workspace list. The mic toggle is back at the center of the canvas in its resting state. The canvas is blank again.

**[USER ACTION]**
The investor presses Spacebar to activate the mic.

**[USER SPEAKS]**
*"List all the projects I'm part of in this workspace. And show me where each one stands."*

**[SCREEN]**
Project cards cascade in — one per project the investor has been assigned to inside this workspace. Each card shows:

- **Startup / prospect name** — bold, prominent
- **Round type** — Seed, Pre-Seed, Series A, etc.
- **Status badge** — top-right corner of each card, color-coded:
  - Grey — *Entry* — Prospect newly added, no analysis begun
  - Blue — *In Analysis* — Investors actively reviewing
  - Amber — *Consensus* — Closing in on final deliberation
  - Green — *Invested* — Decision made, closed
- **Personal status pill** — below the project name, showing whether the investor's own input is pending, submitted, or not required
- **Progress bar** — along the bottom of the card, showing how many of the total assigned investors have completed their input for this project

The investor scans the cards, identifies a project — *BluShift*, currently *In Analysis*, with their own input still pending — and decides to open it.

**[USER ACTION]**
The investor presses Spacebar to activate the mic.

**[USER SPEAKS]**
*"Open BluShift."*

**[SCREEN]**
The BluShift card highlights. The other cards dim. The same push-through transition runs — the card expands and dissolves into the next layer. Stage 3 loads.

---

## STAGE 3 — INSIDE A PROJECT

**[CONTEXT]**
The investor is now inside a specific project. This is where the actual analysis work happens. The canvas is no longer a navigational layer — it is a full conversational workspace.

**[SCREEN — INITIAL STATE]**
The left Assets panel now shows a badge count on its icon — the number of documents attached to this project. The right Assessment panel shows a partial completion badge. At the center of the canvas, the mic toggle rests in its default position. In the **top-right corner** of the canvas, a small collapsed panel has appeared, labeled *Pending Actions*, with a count of how many actions are outstanding and a small chevron-down arrow. It is closed by default.

---

### 3a — Viewing the Action List

**[USER ACTION]**
The investor activates the mic.

**[USER SPEAKS]**
*"List all the actions that are yet to be done in this project."*

**[SCREEN]**
The Pending Actions panel in the top-right corner unfurls — action cards slide out from beneath the panel header, one after another, and settle into the top-right quadrant of the canvas without covering the main workspace area. Each action card shows:

- **Action name** — e.g. *Founder Background Check*, *Market Sizing Validation*
- **Collective completion** — how many of the total assigned investors have submitted input for this action, shown as a fraction and a percentage
- **Personal status** — whether the investor's own input is required, already submitted, or not applicable
- **Deadline** — if one has been set
- **Progress bar** — thin bar along the bottom of the card reflecting the completion percentage

Cards where the investor's own input is still required carry a soft amber glow on their left edge. Cards where the investor's input is already submitted show no highlight. Cards that are fully complete across all investors are visually subdued.

---

### 3b — Minimizing the Action Panel

After reviewing the list, the investor wants to clear the canvas and begin the analysis work.

**[USER ACTION]**
The investor activates the mic.

**[USER SPEAKS]**
*"Okay, put those to the side."*

**[SCREEN]**
Each action card folds in place — a compact animation — and slides toward the top-right corner, stacking behind the Pending Actions panel header. The panel collapses back into its button state. Its label updates to reflect how many actions specifically require the investor's input. The rest of the canvas clears. The mic toggle returns to its resting state at the center.

The panel stays in the top-right corner as a collapsed hover button with a down-arrow. The investor can re-expand it at any point.

---

### 3c — The Conversation

**[USER ACTION]**
The investor clicks the Assets panel on the left to open it. It slides out, showing a list of documents — pitch deck, financial model, founder bios, and any other materials attached to this project. The investor clicks on the pitch deck to bring it into the active context of the conversation engine.

**[USER ACTION]**
The investor activates the mic.

**[USER SPEAKS]**
*"Walk me through BluShift's go-to-market strategy based on their deck."*

**[SCREEN]**
The system generates a response directly onto the center canvas — structured text rendered in blocks: a summary paragraph followed by bullet points. At the bottom of the response block, a row of citations appears in small text, each one referencing the specific slide or section it drew from. Clicking a citation opens an inline preview of that exact page without navigating away.

The conversation continues downward as the investor asks follow-up questions, challenges assumptions, and drills into specific areas. Each exchange is part of the same continuous canvas session for this project.

---

### 3d — How Actions Are Configured (Admin Layer)

The action cards the investor sees are not generated automatically. Each one was created by the admin or super-admin before the investor arrived, through the **Action Edit Panel**, accessible via: *Settings → Canvas Edit → Action Edit*.

In this panel, the admin creates each action with:

- **Action name** — a short label that appears as the card title
- **Prompt** — a freetext field where the admin writes exactly what the system should guide the investor to evaluate for this action
- **Minimum required responses** — the number of investors who must submit before the action is marked complete
- **Sub-questions** — optional structured breakdown within the action
- **Document attachments** — specific files the action should reference
- **Deadline** — an optional date
- **Role visibility** — which roles (investor, reviewer, viewer) can see and interact with this action

Any change made in the Action Edit Panel takes effect immediately and propagates to all investors working on the project in real time. The investor sees only the finished cards — not the configuration behind them.

---

## MID-SESSION — CAROUSEL NAVIGATION

**[CONTEXT]**
The investor has been working inside a Stage 3 project canvas. At some point, they want to switch to a different project without going back through the workspace and project lists.

**[USER ACTION]**
The investor activates the mic.

**[USER SPEAKS]**
*"Can you get me to another project?"*

**[SCREEN]**
The current canvas does not navigate away. Instead, it begins to shrink — compressing into a centered rectangle — while a dark background materializes around it. The investor is effectively stepping back from the canvas they were in, while still keeping it in frame.

From the left and right edges of the dark background, other project cards slide in to form a **carousel**. Each card shows a compact preview of a project the investor has access to: project name, status badge, and pending action count. The current project — the one the investor just stepped back from — is positioned at the center of the carousel, slightly larger than the others, marking it as the current context.

**[USER ACTION]**
The investor moves through the carousel using arrow keys or by swiping. Hovering over a card surfaces a tooltip with a more detailed breakdown of what is pending on that project. The investor does not commit to navigating anywhere until they select a card.

**[USER ACTION]**
The investor selects the project they want — by pressing Spacebar or clicking the card.

**[SCREEN]**
The selected card expands. The carousel collapses. The dark background dissolves. The selected project's Stage 3 canvas loads. The previous project — *BluShift* — is preserved exactly as it was: the conversation, the document context, the scroll position. Returning to it later resumes from the same point.

---

## SUMMARY TABLE

| Stage | Entry Trigger | What the Canvas Shows |
|---|---|---|
| Entry | Login completes | Blank canvas, mic toggle at center, both panels collapsed |
| Stage 1 | *"What workspaces am I part of?"* | Workspace cards |
| Stage 1 → 2 | *"Open [workspace name]"* | Card push-through → project list loads |
| Stage 2 | *"List all projects"* | Project cards with status badges and progress bars |
| Stage 2 → 3 | *"Open [project name]"* | Card push-through → project canvas loads |
| Stage 3 | *"List pending actions"* | Action cards unfurl from top-right panel |
| Stage 3 | *"Put those to the side"* | Cards fold back into collapsed panel |
| Stage 3 | Conversation input | AI response renders on canvas, with citations |
| Carousel | *"Get me to another project"* | Canvas shrinks, dark bg, carousel slides in from edges |
| Carousel → Stage 3 | Select a project card | Carousel collapses, selected project canvas loads |

---
