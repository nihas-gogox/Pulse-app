# Debit Control — decisions needed from Sathish

Hi Sathish,

We've reviewed your Debit Control POD workflow document against what Pulse does today. Most of it is clear. Before we build, we need your answers to the points below. A short answer per point is enough. Where options are listed, pick one or describe something else.

## Must decide before implementation

**D1 — Inward**
- (a) Trip Ops can already mark a trip's hard-copy POD as received. Should Debit Control's "Mark Inward" be:
  - the same event (a trip Trip Ops already marked received goes straight to POD Received), or
  - a separate step done by the Debit Control team (every completed trip starts in POD Pending, whatever Trip Ops recorded)?
- (b) Is "Docket Number" the same as the courier's AWB / tracking number? If not, what is it?
- (c) Can a POD be inwarded without a courier (handed over in person)? If yes, what goes in Courier Name and Docket Number?

**D3 — After Approve / Approve Invoice**
- (a) Where does the trip appear after **Approve** ("Balance & Invoice")? A new tab in Debit Control, the existing Invoicing screen, or somewhere else?
- (b) Where does it appear after **Approve Invoice** ("Invoicing / Balance process")? Is it the same place as (a) or a different one?
- (c) Can a trip be invoiced to the client only after Approve / Approve Invoice, or can invoicing happen independently?

**D4 — Balance Hold**
- (a) What does Balance Hold stop? The vendor's balance payment, the client invoice, both, or something else?
- (b) Who releases a Balance Hold, and by what action?
- (c) After release, where does the trip go, and what status does it get?
- (d) Is a hold caused by **Decline** handled any differently from a hold caused by **Approve Invoice**?

**D5 — Amounts and exceptions**
- (a) After validation, should **Total Client Value** become the amount billed to the client, or be recorded alongside the existing trip price?
- (b) Should **Total Vendor Value** become the amount payable to the vendor, or be recorded alongside the existing vendor rate?
- (c) For Delay Delivery / Damage / Product Missing: are these deducted from someone, and from whom (vendor, client, driver)? Or are they recorded for reference only?
- (d) If they are deducted: at what point, and as what? For example, a debit note, a deduction on the vendor payment, or a credit note to the client.

**D6 — Data sources**
- (a) **Indent Type (Contract / Adhoc / Spot):** Pulse does not record this today. Where does it come from, and who sets it?
- (b) **Client Operations HUB:** Pulse does not record this today. What is it (a client location, an internal branch, other), and who sets it?

## Also confirm

**D7 — Entry to POD Pending:** Which trips enter POD Pending — only trips with status Completed? Should trips completed before go-live be included?

**D8 — Own-fleet trips:** For trips run on our own vehicles (no vendor), should the Vendor section and Total Vendor Value be skipped, or filled some other way?

**D9 — Who can act:** Which roles or people may do each of these: Mark Inward, Validate, Approve, Approve Invoice, Decline, release a Hold? Must the person approving be different from the person who inwarded?

**D10 — Reversal:** Can an Approved or Approve-Invoice trip be reopened or reversed? If yes, by whom, and what happens to the saved values?

Thanks — we'll hold implementation until these are answered.
