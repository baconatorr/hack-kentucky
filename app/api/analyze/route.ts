import { NextResponse } from 'next/server';
import { z } from 'zod';

import { runGeoAudit } from '@/lib/audit';

export const runtime = 'nodejs';

const bodySchema = z.object({
  url: z.string().url()
});

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const { url } = bodySchema.parse(json);
    const result = await runGeoAudit(url);
    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const message = getErrorMessage(error, 'Audit failed.');
    const status = /robots/i.test(message) ? 451 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
