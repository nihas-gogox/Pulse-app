STATUS: BUSINESS DECISIONS REQUIRED — IMPLEMENTATION BLOCKED

# Debit Control — Decisions Required

For: **Sathish** (business owner). Some questions also need **Finance** or the **access/permissions owner (RBAC)** — marked on each one.

We've turned your answers so far into a working design. The questions below are the ones still open. Each one changes what we build, so we won't guess. A short answer per question is enough. Where options are listed, pick one or describe your own.

---

## A. Workflow

### BDR-1 — What do "Approve" and "Approve Invoice" mean? (Sathish)

Your original document and your latest answer describe two different flows. Both start the same way:

**POD Pending → Log POD Inward → POD Received → Validate (open the popup and enter charges)**

After that they differ:

**Option A — Approve Invoice is a separate choice in the Validate popup** (your original document)

| Choice in the Validate popup | Client invoice | Vendor balance payment |
|---|---|---|
| **Approve** | Can be raised | Can be paid |
| **Approve Invoice** | Can be raised | **On hold** |
| **Decline** | Cannot be raised (trip stays in POD Received) | **On hold** |

**Option B — Approve Invoice is a second step that comes later** (your latest answer)

| Step | What happens |
|---|---|
| 1. **Approve** (in the Validate popup) | Charges accepted → vendor Balance Payment Request raised → trip becomes **Ready for Invoicing** |
| 2. **Approve Invoice** (later, on Ready-for-Invoicing trips) | Trip is released for **Invoicing / Bill Generation** |
| 3. Invoicing | Bill generated → Client Portal or manual submission |
| **Decline** (in the Validate popup) | Trip stays in POD Received; vendor balance **on hold** |

Note on Option B: you also said a hold from **Decline** and a hold from **Approve Invoice** must stay distinguishable. Under Option B, Approve Invoice doesn't create a hold. If you choose B, tell us what creates the second kind of hold.

**Please answer:**
- **1a.** Option A, Option B, or a combination (describe it)?
- **1b.** If B: what creates an "Approve Invoice hold"?

### BDR-2 — Balance Payment Request (Sathish + Finance)

- **2a.** When a trip is approved, is the vendor Balance Payment Request raised **automatically**, or does someone press a separate button?
- **2b.** Before Finance can pay the vendor's balance, which is true?
  - It must have a Balance Payment Request from Debit Control, **or**
  - It only needs to not be on hold (no request needed).

**Effect:** this decides whether Finance can pay vendor balances for trips Debit Control hasn't looked at yet.

### BDR-4 — How is a Decline hold cleared? (Sathish)

When a trip is **Declined**, it stays in POD Received with the vendor balance on hold. Later the issue gets sorted out. How does the hold end?
- **Option 1:** Debit Control presses **Release Hold** (the trip may still be in POD Received).
- **Option 2:** Debit Control re-validates and **Approves** (or Approves Invoice), which clears the hold automatically.
- **Option 3:** Either of the above.

### BDR-13 — Who releases a Balance Hold? (Sathish + Finance)

We have two different answers on record:
- An earlier answer: **Finance** releases the hold.
- The latest answer: **Debit Control** resolves the issue and releases the hold, and the payment request then goes to Finance.

**Please answer:**
- **13a.** Who presses Release Hold: Debit Control, Finance, or either?
- **13b.** After the release, does Finance have an approval step before paying, or does Finance just pay?

---

## B. Amounts

What Pulse has today:
- The trip's **client price** and **vendor rate**.
- For some clients, a contract with loading/unloading/halting/detention rates and delay/damage/shortage clauses. These are filled in for only 1–2 clients, and no test trip is linked to them yet.
- **No** vendor contract terms at all.

### BDR-5 — How do loading, unloading and detention affect the final values? (Sathish + Finance)

You said these depend on the cost type and the agreement. For each cost type we need the rule:

| Cost type | Option 1: add to **Client Value** | Option 2: add to **Vendor Value** | Option 3: add to **both** | Option 4: **neither** (pass-through, reference only) | Option 5: **replaces** part of the base price |
|---|---|---|---|---|---|
| Loading | | | | | |
| Unloading | | | | | |
| Detention / Halting | | | | | |
| Extra Point *(from your document)* | | | | | |
| Other Value *(from your document)* | | | | | |
| Special Approval *(from your document)* | | | | | |

**Please answer:**
- **5a.** Fill in the table. If the answer differs by agreement type (for example contract vs ad-hoc), tell us the rule per type.
- **5b.** Where is the rule kept?
  - **Option 1:** the Debit Control user chooses the treatment on each trip (we record their choice), **or**
  - **Option 2:** it comes from the client/vendor contract, set up in advance. In that case Debit Control can't be used for a client until their contract is set up, and vendor contracts don't hold these terms today.
- **5c.** On the Validate popup, are "Client Cost" and "Vendor Cost" the **existing trip price** (shown, not re-typed), or a **new value** the user enters?

**Effect:** Final Client Value becomes what the client is billed, and Final Vendor Value becomes what the vendor is paid (your D5 answer). So these rules directly change invoices and vendor payments.

### BDR-6 — Delay, damage and shortage (Sathish + Finance)

You said these depend on the case and can be attributed to the vendor, client, driver or someone else. Debit Control does not raise debit notes, deductions or credit notes.

**Please answer:**
- **6a.** Do delay / damage / shortage amounts change the Final Client Value or Final Vendor Value?
  - **Option 1:** No — Debit Control only records the amount and who is responsible, for another team to act on.
  - **Option 2:** Yes — they reduce the value of the responsible party (tell us how).
  - **Option 3:** It depends (tell us the rule).
- **6b.** Who picks the responsible party on each trip: the Debit Control user, or the contract terms?
- **6c.** Is "Halting" in your document the same as "Detention"?

---

## C. Reopen (Sathish + Finance)

### BDR-3 — Reopening an approved trip

You said approved trips can be reopened by Debit Control and Finance, that Finance decides how to treat the amounts, and that history must never be overwritten. We still need:

| Question | Options |
|---|---|
| **3a.** Which trips can be reopened? | Approved · Invoice Approved · both |
| **3b.** Allowed after the **client invoice is issued**? | Yes · No · Yes, but only with Finance |
| **3c.** Allowed after the **vendor balance is paid**? | Yes · No · Yes, but only with Finance |
| **3d.** Where does the trip go after reopening? | Back to POD Received (re-validate) · Back to POD Pending (re-inward) · The person reopening chooses |
| **3e.** Who can reopen? | Debit Control **or** Finance (either alone) · Debit Control **and** Finance (both must agree) |
| **3f.** What happens to an issued invoice, a vendor payment, or ledger entries already made? | A fixed rule (tell us what it is) · Finance decides each time |

---

## D. Inward

### BDR-7 — Log POD Inward fields (Sathish)

Your latest answer lists: POD Count, Person Name, Client Name, LR Number, Courier Name and Docket/AWB (courier only when applicable).

- **7a.** "Person Name" is:
  - the person who **delivered/handed over** the POD, **or**
  - the Debit Control member who **received** it? (Pulse records the logged-in user automatically either way.)
- **7b.** "Client Name" is:
  - shown from the trip (**not editable**), **or**
  - typed in as a check?
- **7c.** Your original document required a **POD Received Date**. Is it still required?
  - If yes: typed by the user, or the moment it was logged?

### BDR-8 — Partial or multiple inwards (Sathish)

You mentioned cases with **multiple PODs** that are incomplete.
- **8a.** Can one trip be inwarded **more than once** (for example, part of the PODs today and the rest later)?
- **8b.** If PODs are missing, does the trip stay in **POD Pending**, or move to POD Received marked incomplete?
- **8c.** Is "POD Count" compared against an **expected** number? If so, where does that number come from?

### BDR-9 — Draft save (Sathish — confirmation only)

Your document says Cancel saves nothing, and there is no "save draft" button. **Confirm:** no draft save is needed? (Yes / No)

### BDR-10 — A trip marked Completed by mistake (Sathish)

If Trip Ops reverts a trip from Completed after it has entered POD Pending, should the trip:
- leave POD Pending,
- stay with a warning, or
- be handled another way?

---

## E. Permissions / navigation

### BDR-11 — Owners, admins and who can view (Sathish + RBAC owner)

How Pulse works today, compared with the rule you gave (D9):

| Action | Your rule (D9) | How Pulse permissions work today |
|---|---|---|
| Log POD Inward | Debit Control + Admin | Org **owners and admins can do everything**, plus anyone given the permission |
| Validate / Approve / Approve Invoice / Decline | Debit Control only | Owners and admins **would also be able to** |
| Release Hold | Debit Control only | Owners and admins **would also be able to** |
| Reopen | Debit Control + Finance | Owners and admins **would also be able to**. Finance members only if given the permission |

We will not change either side without your answer.

- **11a.** Should org **owners and admins** be blocked from Validate / Approve / Approve Invoice / Decline / Release Hold / Reopen, as your rule says? Or should they keep full access, as in the rest of Pulse?
  - Note: if they are blocked and nobody in an org has the Debit Control permission, that org can't use Debit Control until someone is given it.
- **11b.** Does "Admin" in your rule include the **org owner**?
- **11c.** Who can **view** the Debit Control screens without acting? Debit Control only, or also Finance / Admin / others?

### BDR-12 — The existing POD Reconciliation screen (Sathish)

Pulse already has a POD Reconciliation screen with Pending / Received tabs.
- **12a.** Should Debit Control:
  - **replace** it,
  - sit **alongside** it (both available), or
  - be a new section **inside** it?

---

## F. Technical items (for the team — these become final once the business answers are in)

Sathish doesn't need to answer these. Each is marked with the business answer it waits for.

| ID | Item | Waits for |
|---|---|---|
| TD-1 | Keep two separate statuses per trip: POD/invoice progress, and vendor-balance hold/request | BDR-1, BDR-2 |
| TD-2 | Only members of the trip's own organization can act; vendor trips only; aggregator-type orgs | — (can be settled now) |
| TD-3 | A permission check that enforces your D9 rule exactly, on the server | BDR-11 |
| TD-4 | How a trip enters POD Pending when marked Completed, and the go-live cut-off | BDR-10 |
| TD-5 | Every validation saved as a new version; original trip prices never overwritten | — (can be settled now) |
| TD-6 | Protection against double-clicks, retries and two people acting at once | — (can be settled now) |
| TD-7 | Temporarily block reopen after an invoice or payment until BDR-3 is answered | BDR-3 |
| TD-8 | How charge lines are stored | BDR-5, BDR-6 |
| TD-9 | Whether cost rules are read from client contracts | BDR-5 |

---

## G. External dependencies (other teams)

Findings A and B below are **existing V1/platform issues, not Debit Control bugs**. They are listed only because Debit Control's release depends on them being resolved.

| ID | What is needed | Owner | Needed to build Debit Control? | Needed for preprod testing? | Needed for production? |
|---|---|---|---|---|---|
| EXT-1 | Vendor balance payments must respect the Debit Control hold, and pay the Final Vendor Value | Compliance / Finance | No | **Yes** (to test that a hold blocks payment) | **Yes** |
| EXT-2 | Client invoices only for Debit-Control-approved trips, billed at the Final Client Value; check the other invoice types | Invoicing | No | **Yes** (to test "no invoicing without approval") | **Yes** |
| EXT-3 | Decide if and when finance reports and ledgers use the final values, and how reopen after invoice/payment is handled | Finance | No | For preprod **sign-off** only | **Yes** |
| EXT-4 | Structured client contract rules for charges, and any vendor contract terms (only if BDR-5 chooses contract-based rules) | Clients / Suppliers commercial team | Only if BDR-5 = contract-based | Only if BDR-5 = contract-based | Only if BDR-5 = contract-based |
| EXT-5 | Register the Debit Control permissions and role, and update the access-model docs | Access/permissions (RBAC) owner | No | Yes | Yes |
| EXT-6 | Choose the one official audit-history store that Debit Control will write to | Audit/platform owner | **Yes** (needed before the database design is final) | Yes | Yes |
| Finding A | Existing V1 issue: the POD trip-list lookup doesn't check that the user belongs to the organization (confirmed on preprod; production not verified) | DB/security owner | No (Debit Control will not use it) | No | **Yes** (fixed or formally accepted) |
| Finding B | Existing V1 issue: the POD audit log function is missing, so some POD history is silently lost (confirmed on preprod; production not verified) | Audit/platform owner | Through EXT-6 | Through EXT-6 | **Yes** |

---

**Rule:** No implementation may begin until BDR-1 through BDR-8, BDR-11, BDR-12 and BDR-13 are answered or explicitly accepted as out-of-scope. BDR-9/10 may remain deferred only if the release owner explicitly accepts that scope.
