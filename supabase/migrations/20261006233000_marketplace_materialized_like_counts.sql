-- Marketplace performance: materialize product like counters so feed reads
-- never need to load every like row for every product.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS likes_count integer NOT NULL DEFAULT 0;

UPDATE public.products p
SET likes_count = COALESCE(
  (SELECT count(*)::integer FROM public.product_likes pl WHERE pl.product_id = p.id),
  0
);

CREATE OR REPLACE FUNCTION public.sync_product_likes_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.products
      SET likes_count = likes_count + 1
      WHERE id = NEW.product_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.products
      SET likes_count = GREATEST(likes_count - 1, 0)
      WHERE id = OLD.product_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_product_likes_count ON public.product_likes;

CREATE TRIGGER trg_sync_product_likes_count
AFTER INSERT OR DELETE ON public.product_likes
FOR EACH ROW
EXECUTE FUNCTION public.sync_product_likes_count();
