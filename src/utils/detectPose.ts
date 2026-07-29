/**
 * Single-shot pose detection using MediaPipe PoseLandmarker.
 *
 * Runs once on a video frame (IMAGE mode, heavy model for best accuracy)
 * and returns RapidFit skeleton joint positions. Caches the PoseLandmarker
 * instance across calls for instant subsequent detections.
 */

import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { POSE_MODEL_URLS } from '../types/pose';
import { landmarksToSkeleton, type NormalizedLandmark } from './poseMapping';
import type { Point, SkeletonKey } from '../types';

let visionPromise: Promise<Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>> | null = null;
let landmarker: PoseLandmarker | null = null;
let landmarkerPromise: Promise<PoseLandmarker> | null = null;

async function getVision() {
  if (!visionPromise) {
    visionPromise = FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm',
    );
  }
  return visionPromise;
}

async function getLandmarker(): Promise<PoseLandmarker> {
  if (landmarker) return landmarker;
  if (landmarkerPromise) return landmarkerPromise;
  landmarkerPromise = (async () => {
    const vision = await getVision();
    const lm = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: POSE_MODEL_URLS.heavy, delegate: 'GPU' },
      runningMode: 'IMAGE',
      numPoses: 1,
      minPoseDetectionConfidence: 0.3,
    });
    landmarker = lm;
    return lm;
  })();
  return landmarkerPromise;
}

export interface DetectPoseResult {
  points: Record<SkeletonKey, Point>;
  side: 'left' | 'right';
}

/**
 * Run a single pose detection on the current video frame.
 * Returns skeleton joint positions in video-native pixel coordinates,
 * or null if no pose is detected.
 */
export async function detectPose(
  video: HTMLVideoElement,
): Promise<DetectPoseResult | null> {
  if (!video.videoWidth || !video.videoHeight) return null;
  const lm = await getLandmarker();
  const result = lm.detect(video);
  if (!result.landmarks || result.landmarks.length === 0) return null;
  const landmarks = result.landmarks[0] as NormalizedLandmark[];
  return landmarksToSkeleton(landmarks, video.videoWidth, video.videoHeight, 'auto');
}
