import { ECIES_CONFIG, encrypt } from "eciesjs";
import { NextRequest, NextResponse } from "next/server";

ECIES_CONFIG.symmetricNonceLength = 12;

export async function POST(request: NextRequest) {
  const token = process.env.HF_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "HF_TOKEN is not configured" },
      { status: 503 },
    );
  }
  const { executorPublicKey } = (await request.json()) as {
    executorPublicKey?: string;
  };
  if (!executorPublicKey || !/^0x[0-9a-fA-F]{66,130}$/.test(executorPublicKey)) {
    return NextResponse.json(
      { error: "A compressed or uncompressed executor public key is required" },
      { status: 400 },
    );
  }
  try {
    const secret = JSON.stringify({ HF_TOKEN: token });
    const encrypted = encrypt(
      Buffer.from(executorPublicKey.slice(2), "hex"),
      Buffer.from(secret),
    );
    return NextResponse.json({
      encrypted: `0x${Buffer.from(encrypted).toString("hex")}`,
      keyRef: "HF_TOKEN",
      nonceLength: 12,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Credential encryption failed",
      },
      { status: 400 },
    );
  }
}
