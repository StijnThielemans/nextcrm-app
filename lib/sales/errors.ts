export class SalesError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = "SalesError";
  }
}
