import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 4 * 1024 * 1024;

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

const MOBILE_JWT_SECRET = process.env.MOBILE_JWT_SECRET;
const ML_API_URL = process.env.ML_API_URL;
const ML_API_KEY = process.env.ML_API_KEY;

type AuthorizationResult =
  | {
      authorized: true;
      userId: string;
      source: "mobile" | "website";
    }
  | {
      authorized: false;
      status: number;
      message: string;
    };

// ==========================================
// 1. MOBILE AUTHENTICATION
// ==========================================

async function authorizeMobileUser(
  token: string,
): Promise<AuthorizationResult> {
  if (!MOBILE_JWT_SECRET) {
    throw new Error("MOBILE_JWT_SECRET is not configured.");
  }

  try {
    const secret = new TextEncoder().encode(MOBILE_JWT_SECRET);

    const { payload } = await jwtVerify(token, secret, {
      issuer: "wasteflow-api",
      audience: "wasteflow-mobile",
      algorithms: ["HS256"],
    });

    const userId = payload.sub;

    if (!userId) {
      return {
        authorized: false,
        status: 401,
        message: "Invalid token payload.",
      };
    }

    return await verifyUser(userId, "mobile");
  } catch (error) {
    if (error instanceof Error && error.name === "JWTExpired") {
      return {
        authorized: false,
        status: 401,
        message: "Session expired. Please login again.",
      };
    }

    if (
      error instanceof Error &&
      (error.name === "JWTInvalid" ||
        error.name === "JWSSignatureVerificationFailed" ||
        error.name === "JWTClaimValidationFailed")
    ) {
      return {
        authorized: false,
        status: 401,
        message: "Invalid or expired token.",
      };
    }

    throw error;
  }
}

// ==========================================
// 2. WEBSITE AUTHENTICATION (AUTH.JS)
// ==========================================

async function authorizeWebsiteUser(): Promise<AuthorizationResult> {
  const session = await auth();

  const userId = session?.user?.id;

  if (!userId) {
    return {
      authorized: false,
      status: 401,
      message: "You must login to perform this action.",
    };
  }

  return await verifyUser(userId, "website");
}

// ==========================================
// 3. VERIFY CURRENT USER FROM DATABASE
// ==========================================

async function verifyUser(
  userId: string,
  source: "mobile" | "website",
): Promise<AuthorizationResult> {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      role: true,
    },
  });

  if (!user || user.role !== "USER") {
    return {
      authorized: false,
      status: 403,
      message: "You are not authorized to perform this action.",
    };
  }

  return {
    authorized: true,
    userId: user.id,
    source,
  };
}

// ==========================================
// 4. UNIFIED AUTHORIZATION
// ==========================================

async function authorizeUser(
  request: NextRequest,
): Promise<AuthorizationResult> {
  const authorization = request.headers.get("authorization");

  // Mobile: Bearer JWT
  if (authorization) {
    if (!authorization.startsWith("Bearer ")) {
      return {
        authorized: false,
        status: 401,
        message: "Invalid authorization header.",
      };
    }

    const token = authorization.substring(7).trim();

    if (!token) {
      return {
        authorized: false,
        status: 401,
        message: "Missing authorization token.",
      };
    }

    return authorizeMobileUser(token);
  }

  // Website: Auth.js session
  return authorizeWebsiteUser();
}

// ==========================================
// 5. PREDICTION API
// ==========================================

export async function POST(request: NextRequest) {
  try {
    // Authorization
    const authResult = await authorizeUser(request);

    if (!authResult.authorized) {
      return NextResponse.json(
        {
          success: false,
          message: authResult.message,
        },
        {
          status: authResult.status,
        },
      );
    }

    // ML service configuration
    if (!ML_API_URL || !ML_API_KEY) {
      console.error("ML service environment variables are missing.");

      return NextResponse.json(
        {
          success: false,
          message: "ML service is not configured.",
        },
        { status: 500 },
      );
    }

    // Parse multipart/form-data
    let formData: FormData;

    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid multipart/form-data request.",
        },
        { status: 400 },
      );
    }

    const image = formData.get("image");

    if (!(image instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          message: "Image file is required.",
        },
        { status: 400 },
      );
    }

    // Validate image
    if (image.size === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Image file cannot be empty.",
        },
        { status: 400 },
      );
    }

    if (image.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          message: "Image size must not exceed 4 MB.",
        },
        { status: 413 },
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(image.type)) {
      return NextResponse.json(
        {
          success: false,
          message: "Only JPEG, PNG, and WebP images are supported.",
        },
        { status: 415 },
      );
    }

    // Forward image to FastAPI
    const mlFormData = new FormData();

    const imageBlob = new Blob([await image.arrayBuffer()], {
      type: image.type,
    });

    mlFormData.append("image", imageBlob, image.name || "waste-image");

    const mlResponse = await fetch(
      `${ML_API_URL.replace(/\/+$/, "")}/predict`,
      {
        method: "POST",
        headers: {
          "X-API-Key": ML_API_KEY,
        },
        body: mlFormData,
        signal: AbortSignal.timeout(30000),
        cache: "no-store",
      },
    );

    // Handle FastAPI response
    if (!mlResponse.ok) {
      const errorText = await mlResponse.text();

      console.error("ML service error:", {
        status: mlResponse.status,
        response: errorText,
      });

      if (mlResponse.status === 401 || mlResponse.status === 403) {
        return NextResponse.json(
          {
            success: false,
            message: "ML service authentication failed.",
          },
          { status: 502 },
        );
      }

      if (mlResponse.status === 413) {
        return NextResponse.json(
          {
            success: false,
            message: "Image is too large for the ML service.",
          },
          { status: 413 },
        );
      }

      return NextResponse.json(
        {
          success: false,
          message: "Failed to process image prediction.",
        },
        { status: 502 },
      );
    }

    const prediction = await mlResponse.json();

    if (!prediction?.success || !prediction?.data) {
      console.error("Invalid ML service response:", prediction);

      return NextResponse.json(
        {
          success: false,
          message: "Invalid response from ML service.",
        },
        { status: 502 },
      );
    }

    // Return prediction to mobile and website
    return NextResponse.json(
      {
        success: true,
        data: prediction.data,
      },
      { status: 200 },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "ML service request timed out.",
        },
        { status: 504 },
      );
    }

    console.error("Predict waste API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Internal server error.",
      },
      { status: 500 },
    );
  }
}
