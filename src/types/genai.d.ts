declare module "@google/genai" {
  export class GoogleGenAI {
    constructor(opts: { apiKey?: string });
    generate?: (opts: any) => Promise<any>;
    predict?: (opts: any) => Promise<any>;
  }
  export default GoogleGenAI;
}
