import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/app/lib/prisma";
import { createMobileToken } from "@/app/lib/mobile-auth";

export const runtime = "nodejs";

const loginSchema = z.object({
  email: z.string().trim().email("Format email tidak valid."),
  password: z.string().min(1, "Password wajib diisi.").max(72),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const validation = loginSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Data login tidak valid.",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { email, password } = validation.data;
    const normalizedEmail = email.toLowerCase();

    // Cari user berdasarkan email.
    const user = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        passwordHash: true,
      },
    });

    // Gunakan pesan generik untuk menghindari
    // pengungkapan apakah email terdaftar.
    if (!user || !user.passwordHash) {
      return NextResponse.json(
        {
          success: false,
          message: "Email atau password salah.",
        },
        { status: 401 },
      );
    }

    // Verifikasi password.
    const isPasswordValid = await compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return NextResponse.json(
        {
          success: false,
          message: "Email atau password salah.",
        },
        { status: 401 },
      );
    }

    // Mobile hanya diperuntukkan bagi role USER.
    if (String(user.role).toUpperCase() !== "USER") {
      return NextResponse.json(
        {
          success: false,
          message: "Akun ini tidak memiliki akses ke aplikasi mobile.",
        },
        { status: 403 },
      );
    }

    // Buat JWT.
    const accessToken = await createMobileToken({
      userId: user.id,
      role: String(user.role),
    });

    return NextResponse.json({
      success: true,
      message: "Login berhasil.",
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: String(user.role),
      },
    });
  } catch (error) {
    console.error("Mobile login error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Terjadi kesalahan saat login.",
      },
      { status: 500 },
    );
  }
}
