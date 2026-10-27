# Guard Log

Append-only log of architectural warnings raised during implementation.

## 2026-10-27 17:53 — Shared interface edit [BLOCKED]
**File:** `/Users/saitrilochan/Documents/investors/frontend/app/page.tsx`
**Summary:** Proposed change to page.tsx directly contradicts two explicit user rejections of testimonial content on the landing page (2026-10-27). User demanded testimonials be removed and replaced with QCI Club information. Verify the change does not reintroduce testimonials or violate the settled decision to replace them with club-specific content.
**Issues:**
- Change to /Users/saitrilochan/Documents/investors/frontend/app/page.tsx contradicts USER-REJECTED DECISION [2026-10-27 16:45]: User explicitly rejected 'Keep testimonial carousel on landing page as primary content section' with reasoning 'this information looks too fucked, dont have to show testimonial, we must show the information about the club'. Any modification to page.tsx that reintroduces or preserves testimonials violates this explicit rejection.
- Change to /Users/saitrilochan/Documents/investors/frontend/app/page.tsx contradicts USER-REJECTED DECISION [2026-10-27 17:25]: User explicitly rejected 'Show testimonials on landing page' with reasoning 'this information looks too fucked, dont have to show testimonial, we must show the information about the club'. Settled decision [2026-10-27 16:45] requires replacing testimonial section with QCI Club information (About, Deal Intelligence, Next Pitch Evening, dual CTAs).
**Outcome:** Write blocked — awaiting Claude correction


## 2026-10-27 17:57 — Resolution [RESOLVED]
**File:** `/Users/saitrilochan/Documents/investors/frontend/app/page.tsx`
Claude self-corrected after 1 block(s). Write succeeded.
**Outcome:** Resolved autonomously

