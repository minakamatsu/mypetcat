declare module "../public/cat/sprites.json" {
  const manifest: {
    frameWidth: number;
    frameHeight: number;
    scale: number;
    animations: Record<
      string,
      { file: string; frameCount: number; fps: number; loop: boolean }
    >;
  };
  export default manifest;
}
