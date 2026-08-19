-- Precomputed pen-path length per drawing in cm, so aggregate stats (e.g. the
-- admin page's total distance drawn) don't have to unpack drawing_data JSON on
-- every request. Written at capture time; backfilled here for existing rows
-- using the stored css_ppi (falling back to the iPad-class 132 CSS PPI).
ALTER TABLE public.drawings ADD COLUMN IF NOT EXISTS path_length_cm REAL;

WITH pts AS (
  SELECT d.id,
         d.css_ppi,
         (p.value->>'x')::float AS x,
         (p.value->>'y')::float AS y,
         p.ordinality AS ord
  FROM public.drawings d,
       LATERAL jsonb_array_elements(d.drawing_data) WITH ORDINALITY AS p(value, ordinality)
  WHERE d.path_length_cm IS NULL
    AND jsonb_typeof(d.drawing_data) = 'array'
),
seg AS (
  SELECT id, css_ppi,
         sqrt(power(x - lag(x) OVER w, 2) + power(y - lag(y) OVER w, 2)) AS len
  FROM pts
  WINDOW w AS (PARTITION BY id ORDER BY ord)
),
tot AS (
  SELECT id, sum(len) * 2.54 / coalesce(max(css_ppi), 132) AS cm
  FROM seg
  GROUP BY id
)
UPDATE public.drawings d
SET path_length_cm = tot.cm
FROM tot
WHERE d.id = tot.id;
