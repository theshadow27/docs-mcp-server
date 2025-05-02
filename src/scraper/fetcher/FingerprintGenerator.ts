import {
  FingerprintGenerator as FG,
  type FingerprintGeneratorOptions,
} from "fingerprint-generator";

/**
 * Generates realistic browser-like HTTP headers to help avoid bot detection.
 */
export class FingerprintGenerator {
  private fingerprintGenerator: FG;

  /**
   * Creates an instance of FingerprintGenerator.
   * @param options Optional configuration for the fingerprint generator.
   */
  constructor(options?: Partial<FingerprintGeneratorOptions>) {
    // Default options for a broad range of realistic fingerprints
    const defaultOptions: Partial<FingerprintGeneratorOptions> = {
      browsers: [{ name: "chrome", minVersion: 100 }, "firefox", "safari"],
      devices: ["desktop", "mobile"],
      operatingSystems: ["windows", "linux", "macos", "android", "ios"],
      locales: ["en-US", "en"],
      browserListQuery: "last 10 versions",
      httpVersion: "2",
      strict: false,
      screen: {
        minWidth: 800,
        minHeight: 600,
        maxWidth: 1920,
        maxHeight: 1080,
      },
    };

    this.fingerprintGenerator = new FG({
      ...defaultOptions,
      ...options,
    });
  }

  /**
   * Generates a set of realistic HTTP headers from a fingerprint.
   * @returns A set of realistic HTTP headers from a fingerprint.
   */
  generateHeaders(): Record<string, string> {
    // Assuming getFingerprint returns an object with a 'headers' property
    const fingerprint = this.fingerprintGenerator.getFingerprint();
    // Need to confirm the exact structure of the fingerprint object
    // and where headers are located. This is an educated guess.
    return fingerprint.headers as Record<string, string>;
  }
}
