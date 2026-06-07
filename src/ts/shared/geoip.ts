import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Defines a range of IP addresses and the associated country name.
 */
export interface GeoIpRange {
  /** Starting IP as a 32-bit unsigned integer. */
  start: number;
  /** Ending IP as a 32-bit unsigned integer. */
  end: number;
  /** Country name matching this range. */
  country: string;
}

/**
 * GeoIPService loads IP ranges and resolves IP addresses to countries.
 * Uses a local JSON database and binary search lookup.
 */
export class GeoIPService {
  private ranges: GeoIpRange[] = [];
  private dbPath = join(process.cwd(), "configs", "core", "geoip.json");

  /**
   * Initializes the GeoIPService by loading or seeding the database.
   */
  constructor() {
    this.Initialize();
  }

  /**
   * Initializes database and loads IP ranges. Seeds defaults if file is missing.
   */
  private Initialize(): void {
    if (existsSync(this.dbPath)) {
      try {
        const content = readFileSync(this.dbPath, "utf-8");
        const rawRanges = JSON.parse(content) as Array<{ start: string; end: string; country: string }>;
        this.ranges = rawRanges.map(r => ({
          start: this.IPToLong(r.start),
          end: this.IPToLong(r.end),
          country: r.country
        })).sort((a, b) => a.start - b.start);
      } catch (err) {
        console.error("[GeoIP] Error loading database, falling back to defaults:", err);
        this.LoadDefaults();
      }
    } else {
      this.LoadDefaults();
      this.SaveDatabase();
    }
  }

  /**
   * Seeds the default GeoIP ranges for fallback/local testing.
   */
  private LoadDefaults(): void {
    const defaults = [
      { start: "1.1.0.0", end: "1.1.255.255", country: "Turkey" },
      { start: "2.2.0.0", end: "2.2.255.255", country: "Germany" },
      { start: "3.3.0.0", end: "3.3.255.255", country: "United States" },
      { start: "4.4.0.0", end: "4.4.255.255", country: "United Kingdom" },
      { start: "5.5.0.0", end: "5.5.255.255", country: "France" },
      { start: "8.8.8.0", end: "8.8.8.255", country: "United States" }
    ];

    this.ranges = defaults.map(r => ({
      start: this.IPToLong(r.start),
      end: this.IPToLong(r.end),
      country: r.country
    })).sort((a, b) => a.start - b.start);
  }

  /**
   * Writes the loaded ranges back into geoip.json.
   */
  private SaveDatabase(): void {
    try {
      const raw = this.ranges.map(r => ({
        start: this.LongToIP(r.start),
        end: this.LongToIP(r.end),
        country: r.country
      }));
      writeFileSync(this.dbPath, JSON.stringify(raw, null, 2), "utf-8");
    } catch (err) {
      console.error("[GeoIP] Error saving default database:", err);
    }
  }

  /**
   * Converts a standard IPv4 string representation into a 32-bit unsigned integer.
   * 
   * @param ip The IP address string (e.g. "127.0.0.1").
   * @returns Unsigned 32-bit integer representation of the IP.
   */
  public IPToLong(ip: string): number {
    const parts = ip.split(".").map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) {
      return 0;
    }
    return (parts[0]! * 16777216 + parts[1]! * 65536 + parts[2]! * 256 + parts[3]!) >>> 0;
  }

  /**
   * Converts a 32-bit unsigned integer back into a standard IPv4 string.
   * 
   * @param long The unsigned 32-bit integer IP representation.
   * @returns Standard IP address string (e.g. "192.168.1.1").
   */
  public LongToIP(long: number): string {
    return [
      (long >>> 24) & 255,
      (long >>> 16) & 255,
      (long >>> 8) & 255,
      long & 255
    ].join(".");
  }

  /**
   * Looks up the country corresponding to a given IP string.
   * Performs an efficient binary search lookup.
   * 
   * @param ip The IP address string to search.
   * @returns Country name, or "Local / Unknown" if not found.
   */
  public Lookup(ip: string): string {
    if (ip === "127.0.0.1" || ip === "localhost") {
      return "Localhost";
    }

    const ipLong = this.IPToLong(ip);
    if (ipLong === 0) {
      return "Unknown";
    }

    // Binary search algorithm across sorted IP ranges
    let low = 0;
    let high = this.ranges.length - 1;

    while (low <= high) {
      const mid = (low + high) >> 1;
      const range = this.ranges[mid]!;

      if (ipLong >= range.start && ipLong <= range.end) {
        return range.country;
      }

      if (ipLong < range.start) {
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    return "Local / Unknown";
  }

  /**
   * Auto-updates the GeoIP database.
   */
  public async UpdateDatabase(): Promise<boolean> {
    try {
      // Mock/simulate download for safety, or pull from open-source repository
      const response = await fetch("https://raw.githubusercontent.com/datasets/geoip2-ipv4/master/data/geoip-ranges.json").catch(() => null);
      if (response && response.ok) {
        const content = await response.text();
        writeFileSync(this.dbPath, content, "utf-8");
        this.Initialize();
        console.log("[GeoIP] Auto-updated database successfully.");
        return true;
      }
      return false;
    } catch (err) {
      console.error("[GeoIP] Failed to update database:", err);
      return false;
    }
  }
}

export const geoIPService = new GeoIPService();

