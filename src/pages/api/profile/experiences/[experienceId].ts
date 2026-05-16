import type { NextApiRequest, NextApiResponse } from "next";

import { getServerBackendUrl as getBackendUrl } from "@/config/api";

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

const serializeBody = (body: unknown): string => {
  if (typeof body === "string") {
    return body;
  }

  return JSON.stringify(body ?? {});
};

const getExperienceId = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) {
    return value[0] || null;
  }

  return value || null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT" && req.method !== "DELETE") {
    res.setHeader("Allow", "PUT, DELETE");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const experienceId = getExperienceId(req.query.experienceId);
  if (!experienceId) {
    return res.status(400).json({ message: "Missing experienceId parameter." });
  }

  const backendUrl = getBackendUrl();
  if (!backendUrl) {
    return res.status(500).json({ message: "Backend URL not configured in environment." });
  }

  try {
    const backendResponse = await fetch(`${backendUrl}/profiles/me/experiences/${experienceId}`, {
      method: req.method,
      headers: {
        ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
        ...(req.method === "PUT" ? { "Content-Type": "application/json" } : {}),
      },
      body: req.method === "PUT" ? serializeBody(req.body) : undefined,
    });

    const payload = await toJsonPayload(backendResponse);
    return res.status(backendResponse.status).json(payload);
  } catch (error) {
    console.error("Proxy experience by id error:", error);
    return res.status(502).json({ message: "Failed to reach backend experience endpoint." });
  }
}
