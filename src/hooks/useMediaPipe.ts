import { useState, useEffect } from 'react';
import { FilesetResolver, HandLandmarker, FaceLandmarker } from '@mediapipe/tasks-vision';

// Singletons to store model loading promises
let wasmResolverPromise: Promise<any> | null = null;
let handLandmarkerPromise: Promise<HandLandmarker> | null = null;
let faceLandmarkerPromise: Promise<FaceLandmarker> | null = null;

const WASM_CDN_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm';
const HAND_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const FACE_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

export const getWasmResolver = () => {
  if (!wasmResolverPromise) {
    wasmResolverPromise = FilesetResolver.forVisionTasks(WASM_CDN_URL);
  }
  return wasmResolverPromise;
};

export const getHandLandmarkerInstance = async (): Promise<HandLandmarker> => {
  if (!handLandmarkerPromise) {
    const resolver = await getWasmResolver();
    handLandmarkerPromise = HandLandmarker.createFromOptions(resolver, {
      baseOptions: {
        modelAssetPath: HAND_MODEL_URL,
        delegate: 'GPU'
      },
      runningMode: 'VIDEO',
      numHands: 2
    });
  }
  return handLandmarkerPromise;
};

export const getFaceLandmarkerInstance = async (): Promise<FaceLandmarker> => {
  if (!faceLandmarkerPromise) {
    const resolver = await getWasmResolver();
    faceLandmarkerPromise = FaceLandmarker.createFromOptions(resolver, {
      baseOptions: {
        modelAssetPath: FACE_MODEL_URL,
        delegate: 'GPU'
      },
      runningMode: 'VIDEO',
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true
    });
  }
  return faceLandmarkerPromise;
};

export interface UseMediaPipeReturn<T> {
  model: T | null;
  loading: boolean;
  error: string | null;
}

export const useHandLandmarker = (): UseMediaPipeReturn<HandLandmarker> => {
  const [model, setModel] = useState<HandLandmarker | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const instance = await getHandLandmarkerInstance();
        if (active) {
          setModel(instance);
          setError(null);
        }
      } catch (err: any) {
        console.error('Failed to load HandLandmarker:', err);
        if (active) {
          setError(`Failed to load hand landmarker model: ${err.message || err}`);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  return { model, loading, error };
};

export const useFaceLandmarker = (): UseMediaPipeReturn<FaceLandmarker> => {
  const [model, setModel] = useState<FaceLandmarker | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const instance = await getFaceLandmarkerInstance();
        if (active) {
          setModel(instance);
          setError(null);
        }
      } catch (err: any) {
        console.error('Failed to load FaceLandmarker:', err);
        if (active) {
          setError(`Failed to load face landmarker model: ${err.message || err}`);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  return { model, loading, error };
};
