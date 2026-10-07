/// <reference types="https://esm.sh/@types/web-push@3.6.3" />
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { corsHeaders } from '../_shared/http.ts';

// Dynamic import for web-push to avoid type issues
const webpush = await import('npm:web-push@3.6.7').then(m => m.default);

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get VAPID keys from environment
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    
    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error('VAPID keys not configured');
    }

    // Configure web-push
    webpush.setVapidDetails(
      'mailto:no-reply@agrilink.ao',
      vapidPublicKey,
      vapidPrivateKey
    );

    const { userId, title, body, data, icon } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace(/^Bearer\s+/i, '');
    const { data: authData, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !authData.user) return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const caller = authData.user.id;
    if (caller !== userId) {
      const { data: allowed } = await supabaseClient.from('users').select('is_root_admin,is_super_root').eq('id', caller).maybeSingle();
      if (!allowed?.is_root_admin && !allowed?.is_super_root) {
        return new Response(JSON.stringify({ error: 'Permission denied' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Get user's push subscriptions
    const { data: subscriptions, error: subError } = await supabaseClient
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (subError) {
      throw subError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No push subscriptions found for user' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare notification payload
    const payload = JSON.stringify({
      title: title || 'Notificação AgriLink',
      body: body || 'Você tem uma nova notificação',
      icon: icon || '/favicon.ico',
      badge: '/favicon.ico',
      data: data || {},
      vibrate: [200, 100, 200],
      tag: `agrilink-${String(data?.notification_id || crypto.randomUUID())}`,
      requireInteraction: false,
      renotify: true,
    });

    // Send push notification to all user's devices
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            auth: sub.auth_key,
            p256dh: sub.p256dh_key,
          },
        };

        try {
          await webpush.sendNotification(pushSubscription, payload);
          return { success: true, subscription: sub.id };
        } catch (error: unknown) {
          console.error('Error sending to subscription:', sub.id, error);
          
          const err = error as any;
          // If subscription is invalid/expired, delete it
          if (err?.statusCode === 410 || err?.statusCode === 404) {
            await supabaseClient
              .from('push_subscriptions')
              .delete()
              .eq('id', sub.id);
          }
          
          return { success: false, subscription: sub.id, error: err?.message || "Unknown error" };
        }
      })
    );

    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failCount = results.filter(r => r.status === 'rejected' || !r.value.success).length;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent to ${successCount} device(s), ${failCount} failed`,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in send-push-notification:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});