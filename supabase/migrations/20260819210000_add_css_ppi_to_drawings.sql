-- Store the CSS PPI of the device each drawing was captured on, so charts can
-- convert stored CSS-pixel coordinates to real-world cm without guessing the
-- device. CSS PPI = physical PPI / devicePixelRatio (pointer events report CSS px).
ALTER TABLE public.drawings ADD COLUMN IF NOT EXISTS css_ppi REAL;
