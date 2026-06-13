ALTER TABLE public.parcels
  DROP CONSTRAINT IF EXISTS parcels_delivery_type_chk,
  DROP CONSTRAINT IF EXISTS parcels_settlement_type_chk;

UPDATE public.parcels SET delivery_type = 'door' WHERE delivery_type = 'locker';
UPDATE public.parcels SET settlement_type = 'prepaid' WHERE settlement_type = 'monthly';

ALTER TABLE public.parcels
  ADD CONSTRAINT parcels_delivery_type_chk
    CHECK (delivery_type IN ('door','branch')),
  ADD CONSTRAINT parcels_settlement_type_chk
    CHECK (settlement_type IN ('cash','prepaid','freight_collect','cod'));

ALTER TABLE public.parcels
  ADD COLUMN IF NOT EXISTS cash_received_by uuid;