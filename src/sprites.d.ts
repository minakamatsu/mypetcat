declare module "../public/cat/sprites.json" {
  const manifest: {
    frameWidth: number;
    frameHeight: number;
    scale: number;
    anchor?: "bottom" | "top";
    drawOffsetY?: number;
    canvasPadTop?: number;
    animations: Record<
      string,
      {
        file: string;
        frameCount: number;
        fps: number;
        loop: boolean;
        drawOffsetY?: number;
      }
    >;
  };
  export default manifest;
}
