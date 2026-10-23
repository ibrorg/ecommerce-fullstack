import axios from 'axios';

/**
 * GeoIntelligenceService
 * 
 * Geographic analysis for fraud detection:
 * - IP geolocation
 * - Country risk assessment
 * - Impossible travel detection
 * - Timezone analysis
 * - VPN/Proxy detection
 */

interface GeoLocation {
  country: string;
  countryCode: string;
  city: string;
  latitude: number;
  longitude: number;
  timezone: string;
  isp: string;
}

interface CountryRiskData {
  countryCode: string;
  countryName: string;
  riskScore: number; // 0-100
  fraudRate: number; // Historical fraud rate
  restrictions: string[]; // e.g., ["high_value_orders", "international_shipping"]
  chargeback_rate: number;
  payment_processors: string[]; // Supported processors
}

// Country risk database (would be in database in production)
const COUNTRY_RISK_DATABASE: Record<string, CountryRiskData> = {
  'US': { countryCode: 'US', countryName: 'United States', riskScore: 10, fraudRate: 0.02, restrictions: [], chargeback_rate: 0.015, payment_processors: ['stripe', 'paypal'] },
  'CA': { countryCode: 'CA', countryName: 'Canada', riskScore: 15, fraudRate: 0.025, restrictions: [], chargeback_rate: 0.018, payment_processors: ['stripe', 'paypal'] },
  'GB': { countryCode: 'GB', countryName: 'United Kingdom', riskScore: 12, fraudRate: 0.022, restrictions: [], chargeback_rate: 0.016, payment_processors: ['stripe', 'paypal'] },
  'RU': { countryCode: 'RU', countryName: 'Russia', riskScore: 75, fraudRate: 0.15, restrictions: ['no_shipping', 'high_verification'], chargeback_rate: 0.25, payment_processors: [] },
  'NG': { countryCode: 'NG', countryName: 'Nigeria', riskScore: 85, fraudRate: 0.30, restrictions: ['high_verification', 'manual_review'], chargeback_rate: 0.40, payment_processors: [] },
  'IN': { countryCode: 'IN', countryName: 'India', riskScore: 45, fraudRate: 0.08, restrictions: ['requires_verification'], chargeback_rate: 0.12, payment_processors: ['stripe'] },
  'CN': { countryCode: 'CN', countryName: 'China', riskScore: 60, fraudRate: 0.12, restrictions: ['requires_verification', 'vpn_detection'], chargeback_rate: 0.20, payment_processors: [] },
};

// VPN/Proxy detection list (simplified)
const VPN_PROVIDERS = ['expressvpn', 'nordvpn', 'surfshark', 'ivpn', 'protonvpn'];

export class GeoIntelligenceService {
  /**
   * Get geolocation from IP address using MaxMind GeoIP2
   */
  static async getGeolocation(ipAddress: string): Promise<GeoLocation> {
    if (process.env.MAXMIND_API_KEY) {
      return this.getLocationFromMaxMind(ipAddress);
    }

    // Fallback to IP-based service (less accurate)
    return this.getLocationFromIPAPI(ipAddress);
  }

  /**
   * MaxMind GeoIP2 lookup (most accurate)
   */
  private static async getLocationFromMaxMind(ipAddress: string): Promise<GeoLocation> {
    try {
      const response = await axios.get(
        `https://geoip.maxmind.com/geoip/v2.1/city/${ipAddress}`,
        {
          auth: {
            username: 'maxmind',
            password: process.env.MAXMIND_API_KEY || '',
          },
        }
      );

      const data = response.data;
      return {
        country: data.country.names.en,
        countryCode: data.country.iso_code,
        city: data.city?.names?.en || 'Unknown',
        latitude: data.location.latitude,
        longitude: data.location.longitude,
        timezone: data.location.time_zone,
        isp: 'Unknown', // MaxMind city doesn't include ISP
      };
    } catch (error) {
      console.error('MaxMind lookup failed:', error);
      return this.getLocationFromIPAPI(ipAddress);
    }
  }

  /**
   * IP-based geolocation lookup (fallback)
   */
  private static async getLocationFromIPAPI(ipAddress: string): Promise<GeoLocation> {
    try {
      const response = await axios.get(`https://ipapi.co/${ipAddress}/json/`);

      const data = response.data;
      return {
        country: data.country_name || 'Unknown',
        countryCode: data.country_code || 'XX',
        city: data.city || 'Unknown',
        latitude: data.latitude,
        longitude: data.longitude,
        timezone: data.timezone,
        isp: data.isp || 'Unknown',
      };
    } catch (error) {
      throw new Error(`Failed to get geolocation for IP ${ipAddress}`);
    }
  }

  /**
   * Get country risk profile
   */
  static getCountryRisk(countryCode: string): CountryRiskData {
    return (
      COUNTRY_RISK_DATABASE[countryCode] || {
        countryCode,
        countryName: countryCode,
        riskScore: 50, // Default medium risk
        fraudRate: 0.05,
        restrictions: [],
        chargeback_rate: 0.02,
        payment_processors: ['stripe', 'paypal'],
      }
    );
  }

  /**
   * Detect impossible travel
   * Calculate if user could physically travel between two locations in given time
   */
  static async detectImpossibleTravel(
    location1: GeoLocation,
    location2: GeoLocation,
    timeDeltaSeconds: number
  ): Promise<{
    isImpossible: boolean;
    distance: number;
    requiredTimeSeconds: number;
    actualTimeSeconds: number;
  }> {
    // Calculate distance between coordinates (Haversine formula)
    const distance = this.calculateDistance(
      location1.latitude,
      location1.longitude,
      location2.latitude,
      location2.longitude
    );

    // Maximum realistic travel speed: ~900 km/h (airplane cruising speed + transfers)
    const maxTravelSpeedKmH = 900;
    const requiredTimeHours = distance / maxTravelSpeedKmH;
    const requiredTimeSeconds = requiredTimeHours * 3600;

    const isImpossible = timeDeltaSeconds < requiredTimeSeconds;

    return {
      isImpossible,
      distance,
      requiredTimeSeconds,
      actualTimeSeconds: timeDeltaSeconds,
    };
  }

  /**
   * Haversine formula: calculate distance between two coordinates
   * Returns distance in kilometers
   */
  private static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Calculate location velocity (how fast user moves between locations)
   */
  static calculateLocationVelocity(
    previousLocation: GeoLocation,
    previousTimestamp: Date,
    currentLocation: GeoLocation,
    currentTimestamp: Date
  ): {
    velocity: number; // km per hour
    isAnomalous: boolean;
  } {
    const distance = this.calculateDistance(
      previousLocation.latitude,
      previousLocation.longitude,
      currentLocation.latitude,
      currentLocation.longitude
    );

    const timeHours = (currentTimestamp.getTime() - previousTimestamp.getTime()) / (1000 * 60 * 60);
    const velocity = distance / timeHours;

    // Velocity > 900 km/h is impossible without aircraft
    const isAnomalous = velocity > 900;

    return { velocity, isAnomalous };
  }

  /**
   * Detect VPN/Proxy usage
   */
  static async detectVPN(ipAddress: string): Promise<{
    isVPN: boolean;
    provider?: string;
    confidence: number; // 0-1
  }> {
    // TODO: Implement proper VPN detection using dedicated service
    // For now, return mock data

    try {
      // Could integrate with IPQualityScore, MaxMind, or similar
      // const response = await axios.get(`https://ipqualityscore.com/api/json/ip/${ipAddress}`, {
      //   params: { key: process.env.IPQS_API_KEY }
      // });

      return {
        isVPN: false,
        provider: undefined,
        confidence: 0.5, // Unknown
      };
    } catch (error) {
      return {
        isVPN: false,
        confidence: 0,
      };
    }
  }

  /**
   * Analyze timezone mismatch
   */
  static analyzeTimezone(userTimezone: string, locationTimezone: string): {
    matches: boolean;
    timezoneOffset: number; // hours
  } {
    // In production, would use more sophisticated timezone library
    const tzMapping: Record<string, number> = {
      'America/New_York': -5,
      'America/Chicago': -6,
      'America/Denver': -7,
      'America/Los_Angeles': -8,
      'Europe/London': 0,
      'Europe/Paris': 1,
      'Asia/Tokyo': 9,
      'Australia/Sydney': 10,
    };

    const userOffset = tzMapping[userTimezone] || 0;
    const locationOffset = tzMapping[locationTimezone] || 0;
    const offset = Math.abs(userOffset - locationOffset);

    return {
      matches: offset <= 2, // Allow 2-hour variance
      timezoneOffset: offset,
    };
  }

  /**
   * Calculate geo-based fraud risk score (0-100)
   */
  static calculateGeoRiskScore(countryCode: string, location: GeoLocation): number {
    const countryRisk = this.getCountryRisk(countryCode);
    let score = countryRisk.riskScore;

    // Add additional factors
    if (countryRisk.chargeback_rate > 0.1) {
      score += 20; // High chargeback countries
    }

    if (countryRisk.payment_processors.length === 0) {
      score += 30; // Unsupported payment processors
    }

    return Math.min(score, 100);
  }

  /**
   * Check if country has shipping restrictions
   */
  static getShippingRestrictions(countryCode: string): string[] {
    const countryRisk = this.getCountryRisk(countryCode);
    return countryRisk.restrictions;
  }

  /**
   * Validate if we can accept payment from this country
   */
  static canAcceptPayment(countryCode: string, orderAmount: number = 0): {
    canAccept: boolean;
    reason?: string;
  } {
    const countryRisk = this.getCountryRisk(countryCode);

    // Check restrictions
    if (countryRisk.restrictions.includes('no_shipping')) {
      return {
        canAccept: false,
        reason: `We do not ship to ${countryRisk.countryName}`,
      };
    }

    if (countryRisk.restrictions.includes('high_verification') && orderAmount > 500) {
      return {
        canAccept: true,
        reason: 'Additional verification required for orders over $500',
      };
    }

    return { canAccept: true };
  }

  /**
   * Get comprehensive geo risk assessment
   */
  static async assessGeoRisk(
    ipAddress: string,
    countryCode: string,
    previousLocations?: GeoLocation[]
  ): Promise<{
    geoRiskScore: number;
    countryRisk: CountryRiskData;
    location: GeoLocation;
    vpnDetected: boolean;
    impossibleTravel: boolean;
    reasons: string[];
  }> {
    const location = await this.getGeolocation(ipAddress);
    const countryRisk = this.getCountryRisk(countryCode);
    const vpnCheck = await this.detectVPN(ipAddress);

    let geoRiskScore = this.calculateGeoRiskScore(countryCode, location);
    const reasons: string[] = [];

    if (vpnCheck.isVPN) {
      geoRiskScore += 20;
      reasons.push(`VPN detected: ${vpnCheck.provider}`);
    }

    let impossibleTravel = false;
    if (previousLocations && previousLocations.length > 0) {
      const lastLocation = previousLocations[previousLocations.length - 1];
      const timeDelta = 60; // Assume 1 minute between requests (in production, track actual time)
      const travel = await this.detectImpossibleTravel(lastLocation, location, timeDelta);

      if (travel.isImpossible) {
        geoRiskScore += 30;
        reasons.push(`Impossible travel: ${travel.distance.toFixed(0)}km in ${travel.actualTimeSeconds}s`);
        impossibleTravel = true;
      }
    }

    return {
      geoRiskScore: Math.min(geoRiskScore, 100),
      countryRisk,
      location,
      vpnDetected: vpnCheck.isVPN,
      impossibleTravel,
      reasons,
    };
  }
}
