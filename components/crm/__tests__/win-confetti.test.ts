import { createWinPieces, playWinConfetti, stepPiece } from "../win-confetti";

function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

describe("win confetti", () => {
  it("spreads a light burst across the width and lets it fall", () => {
    const width = 1200;
    const height = 800;
    const pieces = createWinPieces(width, height, seeded(7));
    expect(pieces.length).toBeGreaterThan(50);
    expect(pieces.length).toBeLessThan(120);
    const xs = pieces.map((piece) => piece.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(width * 0.5);
    const startY = pieces.reduce((sum, piece) => sum + piece.y, 0) / pieces.length;
    let next = pieces;
    for (let i = 0; i < 40; i += 1) next = next.map((piece) => stepPiece(piece, 0.05));
    const laterY = next.reduce((sum, piece) => sum + piece.y, 0) / next.length;
    expect(laterY).toBeGreaterThan(startY + 80);
  });

  it("does nothing when there is no document", () => {
    expect(playWinConfetti).not.toThrow();
    playWinConfetti();
  });
});
