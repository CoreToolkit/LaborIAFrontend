import type { NextApiRequest, NextApiResponse } from "next";

const getBackendUrl = () => process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL;

const toJsonPayload = async (backendResponse: Response): Promise<Record<string, unknown>> => {
  const text = await backendResponse.text();

  if (!text) {
    return {};
  }

  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<string, unknown>;
    }

    return { message: String(parsed) };
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

  try {
    const backendResponse = await fetch(`${backendUrl}/auth/me`, {
      method: "GET",
      headers: {
        ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
      },
    });

    const payload = await toJsonPayload(backendResponse);
    return res.status(backendResponse.status).json(payload);
  } catch (error) {
    console.error("Proxy auth-me error:", error);
    return res.status(502).json({ message: "Failed to reach backend auth/me endpoint." });
  }
}
