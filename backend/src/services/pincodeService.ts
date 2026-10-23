// Simplified pincode serviceability data for India
// In production, this would be fetched from a courier API (Shiprocket, Delhivery)
// or a pincode database. Here we use a representative sample.

interface PincodeEntry {
  pincode: string;
  city: string;
  state: string;
  codAvailable: boolean;
  prepaidAvailable: boolean;
  codLimit: number; // max order value for COD in INR
}

// sample of serviceable pincodes — first 3 digits = sorting district
const SERVICEABLE_PREFIXES: Record<string, PincodeEntry> = {
  '400': { pincode: '400', city: 'Mumbai', state: 'Maharashtra', codAvailable: true, prepaidAvailable: true, codLimit: 50000 },
  '110': { pincode: '110', city: 'New Delhi', state: 'Delhi', codAvailable: true, prepaidAvailable: true, codLimit: 50000 },
  '560': { pincode: '560', city: 'Bengaluru', state: 'Karnataka', codAvailable: true, prepaidAvailable: true, codLimit: 50000 },
  '600': { pincode: '600', city: 'Chennai', state: 'Tamil Nadu', codAvailable: true, prepaidAvailable: true, codLimit: 50000 },
  '700': { pincode: '700', city: 'Kolkata', state: 'West Bengal', codAvailable: true, prepaidAvailable: true, codLimit: 50000 },
  '500': { pincode: '500', city: 'Hyderabad', state: 'Telangana', codAvailable: true, prepaidAvailable: true, codLimit: 50000 },
  '411': { pincode: '411', city: 'Pune', state: 'Maharashtra', codAvailable: true, prepaidAvailable: true, codLimit: 50000 },
  '380': { pincode: '380', city: 'Ahmedabad', state: 'Gujarat', codAvailable: true, prepaidAvailable: true, codLimit: 50000 },
  '302': { pincode: '302', city: 'Jaipur', state: 'Rajasthan', codAvailable: true, prepaidAvailable: true, codLimit: 40000 },
  '226': { pincode: '226', city: 'Lucknow', state: 'Uttar Pradesh', codAvailable: false, prepaidAvailable: true, codLimit: 0 }
};

export class PincodeService {
  // check if a pincode is serviceable
  checkServiceability(pincode: string): {
    serviceable: boolean;
    city?: string;
    state?: string;
    codAvailable: boolean;
    codLimit: number;
  } {
    if (!pincode || pincode.length !== 6) {
      return { serviceable: false, codAvailable: false, codLimit: 0 };
    }

    const prefix = pincode.substring(0, 3);
    const entry = SERVICEABLE_PREFIXES[prefix];

    if (!entry) {
      return { serviceable: false, codAvailable: false, codLimit: 0 };
    }

    return {
      serviceable: true,
      city: entry.city,
      state: entry.state,
      codAvailable: entry.codAvailable,
      codLimit: entry.codLimit
    };
  }

  // check COD eligibility for an order
  isCodEligible(pincode: string, orderAmount: number): {
    eligible: boolean;
    reason?: string;
  } {
    const serviceability = this.checkServiceability(pincode);

    if (!serviceability.serviceable) {
      return { eligible: false, reason: 'Delivery not available at this pincode' };
    }

    if (!serviceability.codAvailable) {
      return { eligible: false, reason: 'COD not available at this pincode' };
    }

    if (orderAmount > serviceability.codLimit) {
      return {
        eligible: false,
        reason: `COD only available for orders up to Rs.${serviceability.codLimit}`
      };
    }

    return { eligible: true };
  }
}

export default new PincodeService();
