## Goals

Address the issues across waybill entry, navigation, theming, tracking visibility, scan flow, and exception handling — without breaking existing data.

---

## 1. Waybill Entry — Guided Multi-Step Flow

Replace the long single-page form (`src/components/WaybillForm.tsx`) with a 5-step wizard that conditionally shows fields based on settlement type.

```text
Step 1: Service       → service_class (Express / LTL), waybill_mode, paper #
Step 2: Sender        → name, phone, area, landmark/map
Step 3: Receiver      → name, phone, area, landmark/map
Step 4: Parcel        → delivery_type, goods_type, description, weight, qty
Step 5: Payment       → settlement_type → conditional fields below
                          • cash            → actual_freight (auto-attributed to logged-in staff)
                          • prepaid_wallet  → wallet account picker (or note), no COD
                          • cod             → cod_amount + actual_freight
                          • freight_collect → no upfront freight, recipient pays on arrival
                        + insured_amount, insurance_fee, product_service, remarks
```

- Top progress bar with step numbers + labels; back/next buttons; final "Place Order" only on Step 5.
- Per-step Zod validation; cannot advance if invalid.
- Weight > 5 kg gate kept (admin-only freight) — surfaced on Step 4.
- Same submit logic as today; just refactored UX.
- Rider mode keeps the post-submit WhatsApp confirmation card.

---

## 2. Visual / Theme Cleanup

- **Logo** (`src/components/Logo.tsx`): replace bundled image with a neutral placeholder block + comment:
  ```tsx
  // TODO: replace /public/brand/aliship-logo.png with your own logo via local upload.
  ```
- **Login screen**: remove the dark hero with white-on-white "SORTED · SHIPPED · SIMPLE" text and the "Track a parcel →" link below the form. Login becomes a clean light card on neutral background — `PublicShell` already provides header/footer, so no duplication.
- **Office/Admin home** ("Operations" hero) currently shows white text on a light gradient on some themes — switch to a solid dark band (`bg-zinc-950 text-zinc-50`) so it's always legible.
- **Double headers / footers** sweep: `OfficeHome` hero, `track.tsx` inner hero, and `login.tsx` inner Logo block all sit inside `PublicShell`/`AppShell` which already render their own header. Audit and remove the inner duplicates.
- **Admin sidebar (Sheet) scroll**: wrap the nav inside `<SheetContent>` with `overflow-y-auto max-h-[calc(100vh-5rem)]` so the long admin menu scrolls.

---

## 3. Public Tracking Page — Richer Detail

Update `src/server/tracking.functions.ts` and `src/routes/track.tsx`:

- Expose per-event details on the timeline (currently `notes: null`):
  - Status label (Picked up, Out for delivery, Delivered, …)
  - Courier / rider name (first name + initial)
  - Site name (from / to) — already wired
  - For Out for Delivery: courier phone (masked)
  - For Delivered: receiver name + collected-by note
- Render each event card with icon + status pill, timestamp, courier line, site line — matching the screenshot style.
- Add an `external_order_ref` text column on `parcels` so Alimall (and other external systems) can attach their order number. Tracking endpoint accepts either waybill OR external order ref.

```text
Event card example:
  ✓ 2026-04-30 19:51   Delivered
    Collected by Charles M. at Mombasa CBD New
    Courier: Steve K.
```

---

## 4. Scan Flow Hardening

- **404 on scan**: audit tile links in `OfficeHome` — admin home reuses `OfficeHome` with `basePath="/admin"` but tiles hardcode `/office/scan/...`. Switch tiles to use `basePath` so `/admin/scan/<type>` resolves correctly.
- **Status sequence lock**: tighten `ALLOWED_TRANSITIONS` in `src/lib/parcel-status.ts` and DB trigger so:
  - `Created` → only `Picked Up`, `On Hold`, `Exception`
  - `Picked Up` → only `Departed`/`Vehicle Sealed`
  - `Arrived` / `Ready` → only `Out for Delivery` next
  - `Out for Delivery` → only `Delivered`, `Exception`, `Rescheduled`
- Already-`Out for Delivery` parcels are blocked from re-OFD (already implemented; verify and surface in `ScanScreen` with a clearer banner).
- Update parcel detail page's manual "Update status" dropdown to **only show next-allowed statuses** for the user's role (no free-form picker), so staff cannot arbitrarily flip status. Super admin retains full override behind a confirmation dialog logged to audit.

---

## 5. Exceptions & Reschedule Behavior

- Exception dialog: convert "Other" into a structured option list (Customer Unreachable, Wrong Address, Refused, Damaged, Lost, Rescheduled, Other-with-text). Already partially there — make all options first-class with icons.
- **Rescheduled flow**: when a rider marks Rescheduled with a `scheduled_date`, keep `assigned_rider_id` on the parcel (do NOT clear it) and have the rider's "My List" filter show:
  - Today's list = OFD or Rescheduled-for-today
  - Tomorrow's list = Rescheduled-for-tomorrow
- Add `scheduled_date` to rider list grouping (`src/routes/rider.list.tsx`).

---

## 6. Layout — Grids on Lists

Convert these list pages from stacked cards to responsive grids (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`):

- `src/routes/office.parcels.index.tsx` (Parcels list)
- `src/routes/admin.menu.tsx` (Admin menu — currently 1-up cards)
- `src/routes/office.menu.tsx`
- `src/routes/office.pending.tsx`
- `src/routes/office.cod.tsx`
- `src/routes/rider.list.tsx`
- `src/routes/admin.users.tsx`, `admin.sites.tsx`

Keep cards readable; use the same card chrome.

---

## 7. Audit Log — Consistent Everywhere

- Create a shared `AuditFeed` component reading from `audit_logs`.
- Add a compact audit panel to `office/parcels/$id` and `rider/parcels/$id` showing changes for that parcel.
- Existing `/admin/audit` becomes the global view; same component, no filter.

---

## 8. Alimall Integration (DB only — no UI yet)

- Migration adds `parcels.external_order_ref TEXT` (indexed) and `parcels.external_source TEXT` (e.g. `alimall`).
- Tracking endpoint matches on `tracking_number`, `external_tracking_number`, OR `external_order_ref`.
- Future-ready for a webhook that creates a parcel from an Alimall order.

---

## Technical Details

- **Files created**:
  - `src/components/waybill/WaybillWizard.tsx` (new multi-step component)
  - `src/components/waybill/steps/{Service,Sender,Receiver,Parcel,Payment}Step.tsx`
  - `src/components/AuditFeed.tsx`
  - `supabase/migrations/<timestamp>_alimall_ref_and_status_lock.sql`
- **Files edited**:
  - `src/components/WaybillForm.tsx` → thin wrapper that mounts `WaybillWizard`
  - `src/components/Logo.tsx`, `src/components/AppShell.tsx`, `src/components/PublicShell.tsx`
  - `src/routes/login.tsx`, `src/routes/track.tsx`, `src/routes/index.tsx`
  - `src/components/OfficeHome.tsx` (basePath-aware tiles + dark hero)
  - `src/components/ScanScreen.tsx` (clearer locked-status banner)
  - `src/lib/parcel-status.ts` (transition map tightened)
  - `src/server/tracking.functions.ts` (richer timeline, external ref lookup)
  - `src/routes/office.parcels.index.tsx`, `admin.menu.tsx`, etc. (grid)
  - `src/routes/office.parcels.$id.tsx`, `rider.parcels.$id.tsx` (next-status-only picker + audit feed)
  - `src/routes/rider.list.tsx` (today/tomorrow rescheduled grouping)
- **Migration**:
  ```sql
  ALTER TABLE parcels ADD COLUMN external_order_ref text;
  ALTER TABLE parcels ADD COLUMN external_source text;
  CREATE INDEX parcels_external_order_ref_idx ON parcels(external_order_ref);
  -- update prevent_invalid_parcel_status() with tighter map (matches lib)
  ```

---

## Open Questions (defaults shown)

1. **Logo placeholder**: do you want me to keep the text "ALISHIP LOGISTICS" wordmark and only replace the icon, or use a generic box for both? — **Default: keep wordmark, replace icon only**.(YES)
2. **Prepaid wallet accounts**: should we add a `wallet_accounts` table now, or just a free-text "wallet name" field on the waybill for now? — **Default: free-text now, table later**.( DONT(
3. **Manual status override on parcel detail**: keep for super admin only? — **Default: yes, super admin only with audit-logged confirmation**.  
  
Create UI FOR ALIMALL TOO