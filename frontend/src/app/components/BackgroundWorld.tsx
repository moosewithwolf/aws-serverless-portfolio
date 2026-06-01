export function BackgroundWorld() {
  return (
    <div className="background-world" aria-hidden="true">
      <div className="parallax-layer" id="layer1">
        <div className="blob" id="blob1" />
      </div>
      <div className="parallax-layer" id="layer2">
        <div className="blob" id="blob2" />
      </div>
    </div>
  );
}
