import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextResponse } from "next/server";
import { z } from "zod";

export const maxDuration = 60;

const JobFields = z.object({
  reference: z.string().describe("Consignment, job, order or invoice number. Empty if none."),
  customerName: z.string().describe("Business or person receiving the goods. Empty if none."),
  customerEmail: z.string().describe("Receiver's email. Empty if none."),
  customerPhone: z.string().describe("Receiver's phone, as written. Empty if none."),
  pickupAddress: z.string().describe("Full pickup / sender / collect-from address. Empty if none."),
  dropoffAddress: z.string().describe("Full delivery / receiver / deliver-to address. Empty if none."),
  notes: z.string().describe("Short delivery instructions, item count, weight or special handling. Empty if none."),
});

export type ExtractedJob = z.infer<typeof JobFields>;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

/** Reads a consignment note, delivery docket or PDF and returns job fields. */
export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Document reading is off. Add ANTHROPIC_API_KEY to turn it on.", demo: true },
      { status: 501 },
    );
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "File is over 20 MB" }, { status: 413 });

  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  let source: Anthropic.ContentBlockParam;
  if (file.type === "application/pdf") {
    source = { type: "document", source: { type: "base64", media_type: "application/pdf", data } };
  } else if ((IMAGE_TYPES as readonly string[]).includes(file.type)) {
    source = { type: "image", source: { type: "base64", media_type: file.type as ImageType, data } };
  } else {
    return NextResponse.json({ error: "Use a PDF or a photo (JPG, PNG, WEBP)" }, { status: 415 });
  }

  const client = new Anthropic();
  try {
    const response = await client.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      output_config: { effort: "low", format: zodOutputFormat(JobFields) },
      messages: [
        {
          role: "user",
          content: [
            source,
            {
              type: "text",
              text: "This is a transport document such as a consignment note, delivery docket or purchase order, usually Australian. Extract the job details. Use full street addresses including suburb, state and postcode where shown. Leave a field empty rather than guessing.",
            },
          ],
        },
      ],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return NextResponse.json({ error: "Couldn't read that document. Please fill in the job by hand." }, { status: 422 });
    }
    return NextResponse.json({ fields: response.parsed_output });
  } catch (err) {
    const status = err instanceof Anthropic.APIError && err.status ? err.status : 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status });
  }
}
