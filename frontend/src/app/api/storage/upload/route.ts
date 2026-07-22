import { uploadFile } from "@huggingface/hub";
import { NextRequest, NextResponse } from "next/server";
import { keccak256, toHex } from "viem";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const token = process.env.HF_TOKEN;
  const repo = process.env.HF_REPO_ID;
  const repoType = (process.env.HF_REPO_TYPE || "dataset") as
    | "dataset"
    | "model"
    | "space";
  if (!token || !repo) {
    return NextResponse.json(
      { error: "HF_TOKEN and HF_REPO_ID must be configured" },
      { status: 503 },
    );
  }
  const form = await request.formData();
  const file = form.get("file");
  const mode = String(form.get("mode") || "review");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (mode === "fast" && bytes.byteLength > 5_120) {
    return NextResponse.json(
      { error: "Fast review source exceeds the 5 KB HTTP response limit" },
      { status: 413 },
    );
  }
  if (bytes.byteLength > 2_000_000) {
    return NextResponse.json(
      { error: "Source bundle exceeds the 2 MB upload limit" },
      { status: 413 },
    );
  }
  const hash = keccak256(toHex(bytes)).slice(2);
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `sources/${new Date().toISOString().slice(0, 10)}/${hash}-${safeName}`;

  try {
    await uploadFile({
      repo: { type: repoType, name: repo },
      credentials: { accessToken: token },
      file: {
        path,
        content: new Blob([bytes], { type: file.type || "application/octet-stream" }),
      },
      commitTitle: `CodeProof source ${hash.slice(0, 12)}`,
    });
    const prefix = repoType === "dataset" ? "datasets/" : "";
    return NextResponse.json({
      hash: `0x${hash}`,
      path: `${repo}/${path}`,
      uri: `https://huggingface.co/${prefix}${repo}/resolve/main/${path}`,
      storageRef: { platform: "hf", path: `${repo}/${path}`, keyRef: "HF_TOKEN" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "HF upload failed",
      },
      { status: 502 },
    );
  }
}
