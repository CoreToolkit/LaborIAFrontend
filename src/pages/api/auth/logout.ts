import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL;

  if (!backendUrl) {
    return res
      .status(500)
      .json({ message: "Backend URL not configured in environment." });
  }

  try {
    const backendResponse = await fetch(`${backendUrl}/auth/logout`, {
      method: "POST",
      headers: {
        ...(req.headers.authorization
          ? { Authorization: req.headers.authorization }
          : {}),
      },
    });

    const text = await backendResponse.text();

    // Intenta parsear como JSON; si falla, devuelve texto plano.
    let payload: unknown = text;
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = text || { message: "Logout response with no body" };
    }

    return res
      .status(backendResponse.status)
      .json(
        typeof payload === "object" ? payload : { message: String(payload) }
      );
  } catch (error) {
    console.error("Proxy logout error:", error);
    return res
      .status(502)
      .json({ message: "Failed to reach backend logout endpoint." });
  }
}
