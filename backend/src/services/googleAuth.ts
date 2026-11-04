import { OAuth2Client } from "google-auth-library";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

let client: OAuth2Client | null = null;

function getGoogleClient(): OAuth2Client {
  if (!client) {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_ID.trim()) {
      throw new Error(
        "Google OAuth is not configured. Set GOOGLE_CLIENT_ID env var.",
      );
    }
    client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
  }
  return client;
}

/**
 * Verifies a Google ID token and returns the payload if valid.
 * Validates issuer, audience, signature, expiration, and email_verified claim.
 * Never trusts a client-submitted email address as proof of Google identity.
 */
export async function verifyGoogleIdToken(
  idToken: string,
): Promise<{
  googleId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
}> {
  const oauth2Client = getGoogleClient();

  const ticket = await oauth2Client.verifyIdToken({
    idToken,
    audience: GOOGLE_CLIENT_ID!,
  });

  const payload = ticket.getPayload();

  if (!payload) {
    throw new Error("Invalid Google ID token: no payload");
  }

  // Google's OAuth2Client.verifyIdToken already validates issuer, audience,
  // signature, and expiration. We additionally require email_verified.
  if (!payload.email_verified) {
    throw new Error("Google email is not verified");
  }

  if (!payload.sub) {
    throw new Error("Invalid Google ID token: no subject");
  }

  if (!payload.email) {
    throw new Error("Invalid Google ID token: no email");
  }

  const result: {
    googleId: string;
    email: string;
    emailVerified: boolean;
    name: string;
    picture?: string;
  } = {
    googleId: payload.sub,
    email: payload.email,
    emailVerified: Boolean(payload.email_verified),
    name: payload.name ?? "",
  };

  if (payload.picture !== undefined) {
    result.picture = payload.picture;
  }

  return result;
}

export function isGoogleConfigured(): boolean {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID.trim());
}
