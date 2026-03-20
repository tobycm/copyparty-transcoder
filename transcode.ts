interface TranscodeOptions {
  inputPath: string;
  outputPath: string;
  reencode?: boolean;
  nvidiaHardwareAcceleration?: boolean;
}

export async function transcodeVideo({ inputPath, outputPath, reencode, nvidiaHardwareAcceleration }: TranscodeOptions) {
  const validVideo = await isValidVideo(inputPath);
  if (!validVideo) {
    throw new NotVideo(`The file at path "${inputPath}" is not a valid video file.`);
  }

  const videoInfo = await getVideoInfo(inputPath);

  const is10Bit = videoInfo.pixFmt.includes("10");

  console.log(`🎬 Video detected as: ${is10Bit ? "HDR (10-bit)" : "SDR (8-bit)"}`);
  console.log(`📊 Resolution: ${videoInfo.width}x${videoInfo.height} @ ${videoInfo.fps.toFixed(2)} fps`);
  console.log(`🎥 Codec: ${videoInfo.codec}`);

  // Discord doesn't support 60fps videos from NVENC, cap at 30fps for compatibility
  const targetFps = videoInfo.fps > 30 ? 30 : videoInfo.fps;
  if (targetFps < videoInfo.fps) {
    console.log(`⚠️  Capping frame rate to ${targetFps}fps for Discord compatibility`);
  }

  const command = [
    "ffmpeg",
    "-y",
    ...(reencode && nvidiaHardwareAcceleration ? ["-hwaccel", "cuda", "-hwaccel_output_format", "cuda"] : []),
    "-i",
    inputPath,

    ...(reencode
      ? nvidiaHardwareAcceleration
        ? [
            "-c:v",
            videoInfo.codec === "h264" ? "copy" : "h264_nvenc",
            "-preset",
            "p5",
            "-rc",
            "vbr",
            "-cq",
            "22",
            "-b:v",
            "0",
            "-multipass",
            "qres",
            "-profile:v",
            "main",
            "-r",
            targetFps.toString(), // Cap frame rate for Discord compatibility
            "-vf",
            is10Bit
              ? "tonemap_cuda=format=yuv420p:tonemap=hable:primaries=bt709:transfer=bt709:matrix=bt709,scale_cuda='trunc(iw/16)*16':'trunc(ih/16)*16'"
              : "scale_cuda='trunc(iw/16)*16':'trunc(ih/16)*16'",
          ]
        : [
            "-c:v",
            videoInfo.codec === "h264" ? "copy" : "libx264",
            "-pix_fmt", //
            "yuv420p",
            "-preset",
            "fast",
            "-crf",
            "23",
            ...(targetFps < videoInfo.fps ? ["-r", targetFps.toString()] : []),
          ]
      : ["-c:v", "copy"]),
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart",
    outputPath,
  ];

  console.log(`Spawn: ${command.join(" ")}`);
  const proc = Bun.spawn(command, {
    stdout: "inherit",
    stderr: "inherit",
  });

  await proc.exited;
  if (proc.exitCode !== 0) {
    throw new Error("FFmpeg failed");
  }
}

interface VideoInfo {
  codec: string;
  pixFmt: string;
  fps: number;
  width: number;
  height: number;
}

async function getVideoInfo(inputPath: string): Promise<VideoInfo> {
  const command = [
    "ffprobe",
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=pix_fmt,r_frame_rate,width,height,codec_name",
    "-of",
    "json",
    inputPath,
  ];

  const proc = Bun.spawn(command, { stdout: "pipe" });
  const output = await new Response(proc.stdout).text();
  const data = JSON.parse(output);

  const stream = data.streams[0];
  const pixFmt = stream.pix_fmt || "";
  const codec = stream.codec_name || "";

  // Parse frame rate (comes as "60000/1001" or "30/1")
  const [num, den] = stream.r_frame_rate.split("/").map(Number);
  const fps = num / den;

  const width = stream.width || 1920;
  const height = stream.height || 1080;

  return { fps, width, height, codec, pixFmt };
}

export class NotVideo extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotVideo";
  }
}

async function isValidVideo(inputPath: string): Promise<boolean> {
  const command = ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_type", "-of", "csv=p=0", inputPath];

  const proc = Bun.spawn(command, { stdout: "pipe" });
  const output = await new Response(proc.stdout).text();
  return output.includes("video");
}
