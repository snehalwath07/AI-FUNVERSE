// AI FunVerse V2 tracking utilities
// Contains velocity-adaptive smoothing and mirroring coordinate mapping for browser-based CV models.

export class LandmarkSmoother {
  private prevX: number | null = null;
  private prevY: number | null = null;
  private alpha: number;

  constructor(alpha = 0.15) {
    this.alpha = alpha; // Base smoothing factor for slow movements
  }

  smooth(x: number, y: number) {
    if (this.prevX === null || this.prevY === null) {
      this.prevX = x;
      this.prevY = y;
      return { x, y };
    }

    // Calculate displacement speed
    const dx = x - this.prevX;
    const dy = y - this.prevY;
    const speed = Math.sqrt(dx * dx + dy * dy);

    // Adaptive alpha logic:
    // Scale speed (0 to 50 pixels displacement) to dynamically shift alpha from baseAlpha (0.15) to 0.80
    const maxSpeed = 50; 
    const speedFactor = Math.min(1.0, speed / maxSpeed);
    const adaptiveAlpha = this.alpha + (0.80 - this.alpha) * speedFactor;

    const smoothedX = adaptiveAlpha * x + (1 - adaptiveAlpha) * this.prevX;
    const smoothedY = adaptiveAlpha * y + (1 - adaptiveAlpha) * this.prevY;

    this.prevX = smoothedX;
    this.prevY = smoothedY;
    return { x: smoothedX, y: smoothedY };
  }

  reset() {
    this.prevX = null;
    this.prevY = null;
  }
}

export const mapLandmark = (
  landmark: { x: number; y: number },
  width: number,
  height: number,
  isMirror = true
) => {
  const mappedX = isMirror ? (1.0 - landmark.x) : landmark.x;
  return {
    x: mappedX * width,
    y: landmark.y * height
  };
};
