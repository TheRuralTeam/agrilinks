CREATE OR REPLACE FUNCTION public.notify_product_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_owner_id uuid;
  v_product_name text;
  v_commenter_name text;
  v_comment_preview text;
BEGIN
  SELECT p.user_id, p.product_type
  INTO v_owner_id, v_product_name
  FROM public.products p
  WHERE p.id = NEW.product_id;

  IF v_owner_id IS NULL OR v_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT u.full_name
  INTO v_commenter_name
  FROM public.users u
  WHERE u.id = NEW.user_id;

  v_comment_preview := substring(NEW.comment_text from 1 for 140);
  IF length(NEW.comment_text) > 140 THEN
    v_comment_preview := v_comment_preview || '...';
  END IF;

  PERFORM public.create_notification(
    v_owner_id,
    'comment',
    'Novo comentário no seu produto',
    format('%s comentou em "%s": %s', COALESCE(v_commenter_name, 'Um utilizador'), COALESCE(v_product_name, 'produto'), v_comment_preview),
    jsonb_build_object(
      'product_id', NEW.product_id,
      'comment_id', NEW.id,
      'actor_id', NEW.user_id,
      'actor_name', v_commenter_name,
      'path', format('/produto/%s?comments=1#comments', NEW.product_id)
    )
  );

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.notify_product_comment() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS product_comment_notification ON public.product_comments;
CREATE TRIGGER product_comment_notification
  AFTER INSERT ON public.product_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_product_comment();