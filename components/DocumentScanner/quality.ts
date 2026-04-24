export interface QualityScores {
  blur: number;
  brightness: number;
  resolution: number;
}

export interface QualityResult {
  scores: QualityScores;
  flags: string[];
}

const BLUR_THRESHOLD = 100;
const BRIGHTNESS_THRESHOLD = 50;
const RESOLUTION_THRESHOLD = 1000;

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function getImageData(image: CanvasImageSource, width: number, height: number): ImageData {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to get canvas context');
  }
  ctx.drawImage(image, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

function computeBrightness(imageData: ImageData): number {
  const { data } = imageData;
  let sum = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    sum += 0.299 * r + 0.587 * g + 0.114 * b;
  }

  return sum / (data.length / 4);
}

function computeLaplacianVariance(imageData: ImageData): number {
  const { data, width, height } = imageData;
  const gray = new Float32Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      gray[y * width + x] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    }
  }

  const laplacianValues: number[] = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const center = gray[y * width + x];
      const up = gray[(y - 1) * width + x];
      const down = gray[(y + 1) * width + x];
      const left = gray[y * width + (x - 1)];
      const right = gray[y * width + (x + 1)];
      const lap = up + down + left + right - 4 * center;
      laplacianValues.push(lap);
    }
  }

  const mean = laplacianValues.reduce((acc, value) => acc + value, 0) / Math.max(laplacianValues.length, 1);
  const variance = laplacianValues.reduce((acc, value) => acc + (value - mean) ** 2, 0) / Math.max(laplacianValues.length, 1);

  return variance;
}

export function evaluateImageQuality(image: CanvasImageSource, width: number, height: number): QualityResult {
  const imageData = getImageData(image, width, height);
  const brightness = computeBrightness(imageData);
  const blur = computeLaplacianVariance(imageData);
  const resolution = Math.max(width, height);

  const flags: string[] = [];
  if (blur < BLUR_THRESHOLD) {
    flags.push('blurry');
  }
  if (brightness < BRIGHTNESS_THRESHOLD) {
    flags.push('dark');
  }
  if (resolution < RESOLUTION_THRESHOLD) {
    flags.push('low_resolution');
  }

  return {
    scores: {
      blur,
      brightness,
      resolution,
    },
    flags,
  };
}
