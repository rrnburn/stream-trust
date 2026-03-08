const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface LogEvent {
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  component: string;
  message: string;
  meta?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const events: LogEvent[] = Array.isArray(body) ? body : [body];

    for (const event of events) {
      const { level = 'INFO', component = 'unknown', message = '', meta = {} } = event;
      const metaStr = Object.keys(meta).length > 0
        ? ' | ' + Object.entries(meta).map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`).join(' ')
        : '';

      const line = `[${component}] [${level}] ${message}${metaStr}`;

      if (level === 'ERROR') console.error(line);
      else if (level === 'WARN') console.warn(line);
      else console.log(line);
    }

    return new Response(JSON.stringify({ ok: true, count: events.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    console.error(`[log-event] Parse error: ${msg}`);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
