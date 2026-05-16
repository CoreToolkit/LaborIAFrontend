import type { NextApiRequest, NextApiResponse } from "next";

import { getServerBackendUrl as getBackendUrl } from "@/config/api";

const toJsonPayload = async (backendResponse: Response): Promise<Record<string, unknown> | unknown[]> => {
  const text = await backendResponse.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as Record<string, unknown> | unknown[];
  } catch {
    return { message: text };
  }
};

const getRoleId = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) {
    return value[0] || null;
  }

  return value || null;
};

const fetchWithFallbackPaths = async (
  backendUrl: string,
  paths: string[],
  init: RequestInit
): Promise<Response> => {
  let lastError: unknown = null;

  for (const path of paths) {
    try {
      const response = await fetch(`${backendUrl}${path}`, init);
      if (response.status !== 404) {
        return response;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return fetch(`${backendUrl}${paths[0]}`, init);
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const roleId = getRoleId(req.query.roleId);
  if (!roleId) {
    return res.status(400).json({ message: "Missing roleId parameter." });
  }

  const backendUrl = getBackendUrl();
  if (!backendUrl) {
    return res.status(500).json({ message: "Backend URL not configured in environment." });
  }

  try {
    const encodedRoleId = encodeURIComponent(roleId);
    const backendResponse = await fetchWithFallbackPaths(
      backendUrl,
      [`/api/roles/${encodedRoleId}`, `/roles/${encodedRoleId}`],
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
    console.error("Proxy role detail error:", error);
    return res.status(502).json({ message: "Failed to reach backend role detail endpoint." });
  }
}
