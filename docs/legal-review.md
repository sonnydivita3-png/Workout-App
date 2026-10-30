# Legal: what's in the app, and what to have a lawyer check

Written by the developer, not a lawyer. Have a Wisconsin attorney review it before a public release.

## What's in the app
- **Agreement screen** (`src/components/TermsGate.tsx`) before anything else, for new installs and existing users,
  and again whenever `TERMS_VERSION` in `src/lib/legal.ts` goes up. There are three separate, unticked boxes, and all
  three are required:
  1. a health check (the warning signs that mean "see a doctor first");
  2. assumption of risk and release, naming negligence explicitly;
  3. age (18+, or 13–17 with a parent or guardian) and agreement to the terms, including arbitration.

  The version and time of agreement are saved on the device and in cloud backup. Settings → Help shows the date.
- **Terms of use** (in-app, and public at `…/#terms`), sections that limit rights in capitals:
  - not medical advice; your safety is your responsibility;
  - assumption of risk (§5); release including ordinary negligence (§6), not gross negligence or intentional conduct;
  - no warranties (§9); liability capped at the greater of $50 or what was paid (§10); indemnity (§11);
  - individual arbitration (AAA consumer rules) with a small-claims option, no class actions, jury waiver, 30-day
    opt-out (§13);
  - Wisconsin law, Waukesha County courts, one-year claim limit "to the extent the law allows" (§14);
  - Apple's required end-user terms (§15).
- **The future LLC:**
  - §1 defines the "Durata parties": owners, members, managers, employees, contractors, successors and assigns.
  - §1 and §17 say a company formed to run the app takes over these terms. Agreements made now carry over.
- **Health notice** with when to see a doctor and when to stop.

## When the LLC is formed
1. Set `OPERATOR` in `src/lib/legal.ts` to its exact legal name.
2. Raise `TERMS_VERSION` and update `TERMS_UPDATED`, so everyone agrees once more to terms that name the LLC. The
   terms already cover the hand-over, but a fresh agreement naming the company is stronger evidence.
3. Run the app and the business only through the LLC's accounts (bank, developer accounts, domain, Supabase). Mixing
   personal and business money is the usual way an LLC's protection is lost ("piercing the veil").

## Questions for the lawyer
- **Is the release enforceable in Wisconsin?** Wisconsin courts are notably strict with exculpatory contracts and
  have struck down several:
  - *Yauger v. Skiing Enterprises* (1996);
  - *Atkins v. Swimwest Family Fitness Center* (2005), a fitness-center waiver;
  - *Roberts v. T.H.E. Insurance Co.* (2016).

  Those decisions faulted releases that were overbroad, didn't clearly say they covered the provider's own
  negligence, were buried in another document, or gave no chance to bargain. The app's release:
  - is limited to injury from exercise;
  - names negligence;
  - has its own heading and its own checkbox;
  - excludes gross negligence and intentional conduct.

  Nobody can bargain over a free app's terms, though. Assume the release may not hold, and treat it as one layer.
  The others are the disclaimers, the safety design (no weight suggestions, the 10% run rule, the warnings), the LLC
  and insurance.
- **Arbitration:** it blocks class actions, but under the AAA consumer rules the business pays most of the fees,
  even when it wins. Many arbitration claims at once ("mass arbitration") can cost more than a court case. Keep it,
  or drop it for small claims and Waukesha County courts?
- **Minors (13–17):** minors can usually void contracts, and Wisconsin hasn't clearly approved parents waiving a
  child's injury claims in advance. Is 18+ only safer for the release? The trade-off is a smaller audience and an
  older app store age rating.
- **Insurance:** general liability plus technology errors and omissions (professional) insurance for the LLC. An LLC
  protects personal assets but not the business's own. Insurance is what actually pays a claim.
- **Privacy:** the policy covers what the app does. Ask whether state consumer-health-data laws (e.g. Washington's My
  Health My Data Act) apply to body weight and workout data from users in those states, and whether they need extra
  consent wording.
