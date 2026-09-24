import * as faceapi from '@vladmandic/face-api';

let modelsLoaded = false;
let loadingPromise: Promise<void> | null = null;

export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const modelUrl = '/models';
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl),
      faceapi.nets.faceLandmark68Net.loadFromUri(modelUrl),
      faceapi.nets.faceRecognitionNet.loadFromUri(modelUrl),
      faceapi.nets.ssdMobilenetv1.loadFromUri(modelUrl),
    ]);
    modelsLoaded = true;
  })();

  return loadingPromise;
}

export interface FaceData {
  landmarks: { x: number; y: number }[];
  descriptor: number[];
  detection: { x: number; y: number; width: number; height: number };
}

export async function extractFaceData(
  input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  useSsd = false
): Promise<FaceData | null> {
  await loadFaceModels();

  const detectorOptions = useSsd
    ? new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 })
    : new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 });

  const result = await faceapi
    .detectSingleFace(input, detectorOptions)
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!result) return null;

  return {
    landmarks: result.landmarks.positions.map((p) => ({ x: p.x, y: p.y })),
    descriptor: Array.from(result.descriptor),
    detection: {
      x: result.detection.box.x,
      y: result.detection.box.y,
      width: result.detection.box.width,
      height: result.detection.box.height,
    },
  };
}

export function euclideanDistance(d1: number[], d2: number[]): number {
  if (d1.length !== d2.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < d1.length; i++) {
    const diff = d1[i] - d2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

export function findBestMatch(
  queryDescriptor: number[],
  knownDescriptors: { id: string; name: string; descriptor: number[] }[]
): { id: string; name: string; distance: number; confidence: number } | null {
  if (knownDescriptors.length === 0) return null;

  let best = { id: '', name: '', distance: Infinity };

  for (const entry of knownDescriptors) {
    const dist = euclideanDistance(queryDescriptor, entry.descriptor);
    if (dist < best.distance) {
      best = { id: entry.id, name: entry.name, distance: dist };
    }
  }

  // Convert distance to confidence (lower distance = higher confidence)
  // Typical threshold: 0.6 means same person
  const confidence = Math.max(0, 1 - best.distance / 1.2);

  if (best.distance > 0.6) {
    return { ...best, confidence };
  }

  return { ...best, confidence };
}

export function drawLandmarksOnCanvas(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement | HTMLVideoElement,
  faceData: FaceData
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = image.width || (image as HTMLImageElement).naturalWidth;
  canvas.height = image.height || (image as HTMLImageElement).naturalHeight;

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  // Draw detection box
  const { x, y, width, height } = faceData.detection;
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, height);

  // Draw landmarks
  ctx.fillStyle = '#3b82f6';
  for (const point of faceData.landmarks) {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 2, 0, 2 * Math.PI);
    ctx.fill();
  }
}
