import {createMailWorker} from '../_shared/mail-worker.mjs';
Deno.serve(createMailWorker({
 serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
 url:Deno.env.get('SUPABASE_URL'),
 siteUrl:Deno.env.get('PUBLIC_URL'),
 enabled:Deno.env.get('MAIL_DELIVERY_ENABLED'),
 apiKey:Deno.env.get('BREVO_API_KEY'),
 sender:Deno.env.get('BREVO_SENDER_EMAIL'),
 senderVerified:Deno.env.get('BREVO_SENDER_VERIFIED')
}));
