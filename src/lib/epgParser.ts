/**
 * Client-side XMLTV parser for native builds.
 * Ported from supabase/functions/parse-epg/index.ts
 */

export interface LocalEpgProgram {
  channel_id: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  category: string;
}

export function parseXmlTvLocal(xml: string): LocalEpgProgram[] {
  const programs: LocalEpgProgram[] = [];
  const now = new Date();
  const cutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Limit total programs to prevent memory issues on Android
  const MAX_PROGRAMS = 10000;

  const programmeRegex = /<programme\s+([^>]*)>([\s\S]*?)<\/programme>/gi;
  let match: RegExpExecArray | null;

  while ((match = programmeRegex.exec(xml)) !== null) {
    // Safety check to prevent runaway memory usage
    if (programs.length >= MAX_PROGRAMS) {
      console.warn('Reached max program limit, stopping parse');
      break;
    }

    const attrs = match[1];
    const body = match[2];

    const startStr = extractAttr(attrs, 'start');
    const stopStr = extractAttr(attrs, 'stop');
    const channelId = extractAttr(attrs, 'channel');

    if (!startStr || !stopStr || !channelId) continue;

    const startTime = parseXmlTvDate(startStr);
    const endTime = parseXmlTvDate(stopStr);

    if (!startTime || !endTime) continue;
    if (endTime < now || startTime > cutoff) continue;

    const title = extractTag(body, 'title') || 'Unknown';
    const desc = extractTag(body, 'desc') || '';
    const category = extractTag(body, 'category') || '';

    programs.push({
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
  const re = new RegExp(`${name}="([^"]*)"`, 'i');
  const m = attrs.match(re);
  return m ? m[1] : null;
}

function extractTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i');
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}

function parseXmlTvDate(str: string): Date | null {
  try {
    const cleaned = str.trim();
    const datePart = cleaned.substring(0, 14).padEnd(14, '0');
    const tzPart = cleaned.substring(14).trim();

    const year = parseInt(datePart.substring(0, 4));
    const month = parseInt(datePart.substring(4, 6)) - 1;
    const day = parseInt(datePart.substring(6, 8));
    const hour = parseInt(datePart.substring(8, 10));
    const min = parseInt(datePart.substring(10, 12));
    const sec = parseInt(datePart.substring(12, 14));

    let date = new Date(Date.UTC(year, month, day, hour, min, sec));

    if (tzPart) {
      const tzMatch = tzPart.match(/([+-])(\d{2})(\d{2})/);
      if (tzMatch) {
        const sign = tzMatch[1] === '+' ? -1 : 1;
        const offsetMin = parseInt(tzMatch[2]) * 60 + parseInt(tzMatch[3]);
        date = new Date(date.getTime() + sign * offsetMin * 60 * 1000);
      }
    }

    return date;
  } catch {
    return null;
  }
}
