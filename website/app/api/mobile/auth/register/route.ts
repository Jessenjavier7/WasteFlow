import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/app/lib/prisma";
import { createMobileToken } from "@/app/lib/mobile-auth";

export const runtime = "nodejs";

const registerSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(100),
  email: z.string().trim().email("Format email tidak valid.").max(254),
  password: z.string().min(8, "Password minimal 8 karakter.").max(72),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const validation = registerSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Data registrasi tidak valid.",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { name, email, password } = validation.data;
    const normalizedEmail = email.toLowerCase();

    // Cek apakah email sudah terdaftar.
    const existingUser = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          message: "Email sudah terdaftar.",
        },
        { status: 409 },
      );
    }

    // Hash password sebelum disimpan.
    const passwordHash = await hash(password, 12);

    // Buat akun user.
    const user = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        passwordHash,
        role: "USER",
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
      },
    });

    // Buat JWT untuk mobile.
    const accessToken = await createMobileToken({
      userId: user.id,
      role: String(user.role),
    });

    return NextResponse.json(
      {
        success: true,
        message: "Registrasi berhasil.",
        accessToken,
        user: {
          ...user,
          role: String(user.role),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Mobile registration error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Terjadi kesalahan saat registrasi.",
      },
      { status: 500 },
    );
  }
}
