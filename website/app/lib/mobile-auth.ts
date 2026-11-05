import { SignJWT, jwtVerify } from "jose";

const MOBILE_JWT_ISSUER = "wasteflow-api";
const MOBILE_JWT_AUDIENCE = "wasteflow-mobile";

function getMobileSecret() {
  const secret = process.env.MOBILE_JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("MOBILE_JWT_SECRET is missing or too short.");
  }

  return new TextEncoder().encode(secret);
}

export type MobileTokenPayload = {
  userId: string;
  role: string;
};

export async function createMobileToken(payload: MobileTokenPayload) {
  return new SignJWT({
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuer(MOBILE_JWT_ISSUER)
    .setAudience(MOBILE_JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getMobileSecret());
}

export async function verifyMobileToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, getMobileSecret(), {
      issuer: MOBILE_JWT_ISSUER,
      audience: MOBILE_JWT_AUDIENCE,
      algorithms: ["HS256"],
    });

    if (typeof payload.sub !== "string" || typeof payload.role !== "string") {
      return null;
    }

    return {
      userId: payload.sub,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export async function getMobileUserFromRequest(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice(7).trim();

  if (!token) {
    return null;
  }

  return verifyMobileToken(token);
}
