import {createPublicHandler} from '../_shared/public-handler.mjs';
Deno.serve(createPublicHandler({supabaseUrl:Deno.env.get('SUPABASE_URL'),serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),siteUrl:Deno.env.get('PUBLIC_URL'),turnstileSecret:Deno.env.get('TURNSTILE_SECRET_KEY'),protectionMode:Deno.env.get('PUBLIC_ABUSE_PROTECTION')||'turnstile'}));
