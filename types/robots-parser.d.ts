declare module 'robots-parser' {
  interface RobotsParserOptions {
    allowOnNeutral?: boolean;
  }

  interface RobotsParserInstance {
    isAllowed(url: string, userAgent?: string): boolean | undefined;
    isDisallowed(url: string, userAgent?: string): boolean | undefined;
    getSitemaps(): string[];
  }

  export default function robotsParser(
    url: string,
    txt: string,
    options?: RobotsParserOptions
  ): RobotsParserInstance;
}
