import type { NextApiRequest, NextApiResponse } from "next";
import { getBackendUrl } from "@/config/api";

const toJsonPayload = async (res: Response): Promise<Record<string, unknown>> => {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { message: text };
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const backendUrl = getBackendUrl();
  if (!backendUrl) {
    return res.status(500).json({ message: "Backend URL not configured in environment." });
  }

  const limit = req.query.limit ?? "5";
  const offset = req.query.offset ?? "0";

  try {
    const backendResponse = await fetch(
      `${backendUrl}/evaluations/history/user?limit=${limit}&offset=${offset}`,
      {
        method: "GET",
        headers: {
          ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
        },
      }
    );

    const payload = await toJsonPayload(backendResponse);
    return res.status(backendResponse.status).json(payload);
  } catch (error) {
    console.error("Proxy evaluations/history error:", error);
    return res.status(502).json({ message: "Failed to reach backend evaluations endpoint." });
  }
}
