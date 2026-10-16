import {createMailEvents} from '../_shared/mail-events.mjs';
Deno.serve(createMailEvents({enabled:Deno.env.get('BREVO_EVENTS_ENABLED'),secret:Deno.env.get('BREVO_EVENTS_TOKEN'),url:Deno.env.get('SUPABASE_URL'),serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}));
