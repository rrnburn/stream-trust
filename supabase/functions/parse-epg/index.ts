import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface EpgProgram {
  user_id: string;
  source_id: string;
  channel_id: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  category: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { epgUrl, sourceId, userId } = await req.json();

    if (!epgUrl || !sourceId || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing epgUrl, sourceId, or userId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Download XMLTV data
    console.log(`Fetching EPG from: ${epgUrl}`);
    const res = await fetch(epgUrl, {
      headers: { "User-Agent": "okhttp/4.9.2", Accept: "*/*" },
    });

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch EPG: ${res.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let xmlText = await res.text();

    // Handle gzipped content if the URL ends with .gz but wasn't auto-decompressed
    // (fetch usually handles content-encoding, but some servers serve .xml.gz without proper headers)

    // Parse XMLTV
    const programs = parseXmlTv(xmlText, userId, sourceId);
    console.log(`Parsed ${programs.length} programs from EPG`);

    if (programs.length === 0) {
      return new Response(
        JSON.stringify({ total: 0, inserted: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete old EPG data for this source
    await supabase
      .from("epg_programs")
      .delete()
      .eq("user_id", userId)
      .eq("source_id", sourceId);

    // Batch insert (500 at a time)
    const batchSize = 500;
    let inserted = 0;
    for (let i = 0; i < programs.length; i += batchSize) {
      const batch = programs.slice(i, i + batchSize);
      const { error } = await supabase.from("epg_programs").insert(batch);
      if (error) {
        console.error(`Batch insert error at ${i}:`, error.message);
      } else {
        inserted += batch.length;
      }
    }

    console.log(`Inserted ${inserted}/${programs.length} EPG programs`);

    // Count unique channels
    const uniqueChannels = new Set(programs.map((p) => p.channel_id)).size;

    return new Response(
      JSON.stringify({ total: programs.length, inserted, channels: uniqueChannels }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("EPG parse error:", e.message);
    return new Response(
      JSON.stringify({ error: e.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Simple XMLTV parser using regex (no DOM parser in Deno edge functions).
 * Only keeps programs within the next 24 hours to limit data size.
 */
function parseXmlTv(xml: string, userId: string, sourceId: string): EpgProgram[] {
  const programs: EpgProgram[] = [];
  const now = new Date();
  const cutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Match <programme> elements
  const programmeRegex = /<programme\s+([^>]*)>([\s\S]*?)<\/programme>/gi;
  let match: RegExpExecArray | null;

  while ((match = programmeRegex.exec(xml)) !== null) {
    const attrs = match[1];
    const body = match[2];

    const startStr = extractAttr(attrs, "start");
    const stopStr = extractAttr(attrs, "stop");
    const channelId = extractAttr(attrs, "channel");

    if (!startStr || !stopStr || !channelId) continue;

    const startTime = parseXmlTvDate(startStr);
    const endTime = parseXmlTvDate(stopStr);

    if (!startTime || !endTime) continue;

    // Only keep programs within next 24h window
    if (endTime < now || startTime > cutoff) continue;

    const title = extractTag(body, "title") || "Unknown";
    const desc = extractTag(body, "desc") || "";
    const category = extractTag(body, "category") || "";

    programs.push({
      user_id: userId,
      source_id: sourceId,
      channel_id: channelId,
      title,
      description: desc,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      category,
    });
  }

  return programs;
}

function extractAttr(attrs: string, name: string): string | null {
  const re = new RegExp(`${name}="([^"]*)"`, "i");
  const m = attrs.match(re);
  return m ? m[1] : null;
}

function extractTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>`, "i");
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}

/**
 * Parse XMLTV date format: "20240115120000 +0000"
 */
function parseXmlTvDate(str: string): Date | null {
  try {
    // Format: YYYYMMDDHHmmss [+/-HHMM]
    const cleaned = str.trim();
    const datePart = cleaned.substring(0, 14).padEnd(14, "0");
    const tzPart = cleaned.substring(14).trim();

    const year = parseInt(datePart.substring(0, 4));
    const month = parseInt(datePart.substring(4, 6)) - 1;
    const day = parseInt(datePart.substring(6, 8));
    const hour = parseInt(datePart.substring(8, 10));
    const min = parseInt(datePart.substring(10, 12));
    const sec = parseInt(datePart.substring(12, 14));

    let date = new Date(Date.UTC(year, month, day, hour, min, sec));

    // Apply timezone offset if present
    if (tzPart) {
      const tzMatch = tzPart.match(/([+-])(\d{2})(\d{2})/);
      if (tzMatch) {
        const sign = tzMatch[1] === "+" ? -1 : 1;
        const offsetMin = parseInt(tzMatch[2]) * 60 + parseInt(tzMatch[3]);
        date = new Date(date.getTime() + sign * offsetMin * 60 * 1000);
      }
    }

    return date;
  } catch {
    return null;
  }
}
