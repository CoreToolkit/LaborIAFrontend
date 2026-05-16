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

const toForwardedQuery = (query: NextApiRequest["query"]): string => {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, item));
      continue;
    }

    if (typeof value === "string") {
      params.set(key, value);
    }
  }

  return params.toString();
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

  const backendUrl = getBackendUrl();
  if (!backendUrl) {
    return res.status(500).json({ message: "Backend URL not configured in environment." });
  }

  try {
    const queryString = toForwardedQuery(req.query);
    const basePaths = ["/api/roles", "/roles"];
    const paths = queryString ? basePaths.map((path) => `${path}?${queryString}`) : basePaths;

    const backendResponse = await fetchWithFallbackPaths(backendUrl, paths, {
      method: "GET",
      headers: {
        ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
      },
    });

    const payload = await toJsonPayload(backendResponse);
    return res.status(backendResponse.status).json(payload);
  } catch (error) {
    console.error("Proxy roles list error:", error);
    return res.status(502).json({ message: "Failed to reach backend roles endpoint." });
  }
}
