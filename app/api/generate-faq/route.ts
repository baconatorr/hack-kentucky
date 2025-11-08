import { NextResponse } from 'next/server';
import { z } from 'zod';

import { generateFaqOnly } from '@/lib/audit';

export const runtime = 'nodejs';

const bodySchema = z.object({
  url: z.string().url()
});

const getErrorMessage = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const { url } = bodySchema.parse(json);
    const artifact = await generateFaqOnly(url);
    if (!artifact) {
      return NextResponse.json({ error: 'Not enough Q&A-ready content to build a FAQ.' }, { status: 422 });
    }
    return NextResponse.json(
      {
        url,
        artifact
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }
    const message = getErrorMessage(error, 'Unable to generate FAQ.');
    const status = /robots/i.test(message) ? 451 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
