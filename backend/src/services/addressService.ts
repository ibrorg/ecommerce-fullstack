import Address, { IAddress, AddressLabel } from '../models/Address';
import { AppError } from '../middleware/errorHandler';

export class AddressService {
  // list all addresses for a user, defaults first then newest
  async list(userId: string): Promise<IAddress[]> {
    return Address.find({ user: userId })
      .sort({ isDefaultShipping: -1, isDefaultBilling: -1, createdAt: -1 });
  }

  async getById(userId: string, addressId: string): Promise<IAddress> {
    const address = await Address.findOne({ _id: addressId, user: userId });
    if (!address) {
      throw new AppError('Address not found', 404);
    }
    return address;
  }

  async create(userId: string, data: Partial<IAddress>): Promise<IAddress> {
    const existingCount = await Address.countDocuments({ user: userId });

    // first address becomes the default for both shipping and billing
    if (existingCount === 0) {
      data.isDefaultShipping = true;
      data.isDefaultBilling = true;
    } else {
      // only one default shipping / billing per user
      if (data.isDefaultShipping) {
        await Address.updateMany(
          { user: userId, isDefaultShipping: true },
          { $set: { isDefaultShipping: false } }
        );
      }
      if (data.isDefaultBilling) {
        await Address.updateMany(
          { user: userId, isDefaultBilling: true },
          { $set: { isDefaultBilling: false } }
        );
      }
    }

    const address = await Address.create({ ...data, user: userId });
    return address;
  }

  async update(userId: string, addressId: string, data: Partial<IAddress>): Promise<IAddress> {
    const address = await this.getById(userId, addressId);

    // don't allow reassigning ownership via update
    delete (data as any).user;

    if (data.isDefaultShipping === true && !address.isDefaultShipping) {
      await Address.updateMany(
        { user: userId, isDefaultShipping: true, _id: { $ne: addressId } },
        { $set: { isDefaultShipping: false } }
      );
    }
    if (data.isDefaultBilling === true && !address.isDefaultBilling) {
      await Address.updateMany(
        { user: userId, isDefaultBilling: true, _id: { $ne: addressId } },
        { $set: { isDefaultBilling: false } }
      );
    }

    Object.assign(address, data);
    await address.save();
    return address;
  }

  async remove(userId: string, addressId: string): Promise<void> {
    const address = await this.getById(userId, addressId);
    const wasDefaultShipping = address.isDefaultShipping;
    const wasDefaultBilling = address.isDefaultBilling;

    await Address.deleteOne({ _id: addressId, user: userId });

    // promote another address if we just removed a default
    if (wasDefaultShipping) {
      const next = await Address.findOne({ user: userId }).sort({ createdAt: -1 });
      if (next) {
        next.isDefaultShipping = true;
        await next.save();
      }
    }
    if (wasDefaultBilling) {
      const next = await Address.findOne({ user: userId }).sort({ createdAt: -1 });
      if (next && !next.isDefaultBilling) {
        next.isDefaultBilling = true;
        await next.save();
      }
    }
  }

  async setDefaultShipping(userId: string, addressId: string): Promise<IAddress> {
    await this.getById(userId, addressId);
    await Address.updateMany(
      { user: userId, isDefaultShipping: true },
      { $set: { isDefaultShipping: false } }
    );
    const address = await Address.findByIdAndUpdate(
      addressId,
      { $set: { isDefaultShipping: true } },
      { new: true }
    );
    return address!;
  }

  async setDefaultBilling(userId: string, addressId: string): Promise<IAddress> {
    await this.getById(userId, addressId);
    await Address.updateMany(
      { user: userId, isDefaultBilling: true },
      { $set: { isDefaultBilling: false } }
    );
    const address = await Address.findByIdAndUpdate(
      addressId,
      { $set: { isDefaultBilling: true } },
      { new: true }
    );
    return address!;
  }

  // convenience for checkout — pick the default shipping address
  async getDefaultShipping(userId: string): Promise<IAddress | null> {
    return Address.findOne({ user: userId, isDefaultShipping: true });
  }

  async getDefaultBilling(userId: string): Promise<IAddress | null> {
    return Address.findOne({ user: userId, isDefaultBilling: true });
  }
}

export default new AddressService();
