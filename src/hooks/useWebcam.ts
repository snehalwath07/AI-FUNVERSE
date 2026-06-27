import { useEffect, useRef, useState } from 'react';

export interface UseWebcamReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  error: string | null;
  loading: boolean;
  permissionGranted: boolean;
  requestPermission: () => Promise<void>;
  stopWebcam: () => void;
}

export const useWebcam = (autoStart = true): UseWebcamReturn => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(autoStart);
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);

  const stopWebcam = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setPermissionGranted(false);
  };

  const requestPermission = async () => {
    setLoading(true);
    setError(null);
    try {
      // Release any existing stream first
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
          frameRate: { ideal: 30 }
        },
        audio: false
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setPermissionGranted(true);
      setError(null);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        // Make sure it plays inline for mobile compatibility
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.muted = true;
        
        // Wait for metadata to load to ensure dimensions are ready
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(err => {
            console.error("Video play failed:", err);
          });
        };
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Camera access denied. Please enable webcam permissions in your browser.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No webcam detected on your device.');
      } else {
        setError(`Failed to access webcam: ${err.message || 'Unknown error'}`);
      }
      setPermissionGranted(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoStart) {
      requestPermission();
    }
    return () => {
      // Auto-cleanup on unmount
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [autoStart]);

  return {
    videoRef,
    stream,
    error,
    loading,
    permissionGranted,
    requestPermission,
    stopWebcam
  };
};
