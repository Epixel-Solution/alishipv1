
ALTER TABLE public.parcels
  ADD COLUMN IF NOT EXISTS service_class text NOT NULL DEFAULT 'express',
  ADD COLUMN IF NOT EXISTS waybill_mode text NOT NULL DEFAULT 'electronic',
  ADD COLUMN IF NOT EXISTS delivery_type text NOT NULL DEFAULT 'door',
  ADD COLUMN IF NOT EXISTS goods_type text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS settlement_type text NOT NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS product_service text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS reverse_receipts boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS actual_freight numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS insured_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS insurance_fee numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cod_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_freight numeric(12,2);

-- Backfill: copy existing amount into cod_amount where payment is COD
UPDATE public.parcels
  SET cod_amount = amount
  WHERE payment_type = 'cod' AND cod_amount = 0;

-- Validation: ensure values are within allowed enums
ALTER TABLE public.parcels
  ADD CONSTRAINT parcels_service_class_chk CHECK (service_class IN ('express','ltl')),
  ADD CONSTRAINT parcels_waybill_mode_chk CHECK (waybill_mode IN ('electronic','paper')),
  ADD CONSTRAINT parcels_delivery_type_chk CHECK (delivery_type IN ('door','branch','locker')),
  ADD CONSTRAINT parcels_goods_type_chk CHECK (goods_type IN ('normal','fragile','documents','electronics','perishable','liquid','other')),
  ADD CONSTRAINT parcels_settlement_type_chk CHECK (settlement_type IN ('cash','monthly','prepaid','cod')),
  ADD CONSTRAINT parcels_product_service_chk CHECK (product_service IN ('standard','same_day','next_day','economy'));
