-- Record whether the drawing device was in the known-PPI list (detectDevicePpi in
-- src/app/machine/page.jsx). Unrecognized devices fall back to 264 PPI, so their
-- sizes in cm are approximate, and their css_ppi can collide with real iPads
-- (264 / dpr 2 = 132). This flag lets analyses filter those drawings out.
--   true  = known device, PPI looked up
--   false = unknown device, 264 PPI assumed
--   null  = saved before this column existed (unknown)
ALTER TABLE public.drawings ADD COLUMN IF NOT EXISTS device_recognized BOOLEAN;

COMMENT ON COLUMN public.drawings.device_recognized IS
  'true = PPI from the known-device list; false = unknown device, 264 PPI assumed; null = recorded before 2026-11-25';
