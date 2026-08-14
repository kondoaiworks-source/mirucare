-- 下書きの由来に「市のPDFから」を追加する
ALTER TABLE public.rulebook_compose_items
  DROP CONSTRAINT IF EXISTS rulebook_compose_items_origin_check;

ALTER TABLE public.rulebook_compose_items
  ADD CONSTRAINT rulebook_compose_items_origin_check
  CHECK (origin IN ('existing', 'template', 'manual', 'city_pdf'));
