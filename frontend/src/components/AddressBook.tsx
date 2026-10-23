import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiMapPin,
  FiHome,
  FiBriefcase,
  FiTag,
  FiCheck,
  FiAlertCircle,
  FiStar,
  FiX,
  FiLoader,
  FiUser,
  FiPhone,
  FiNavigation,
} from 'react-icons/fi';

export interface Address {
  _id: string;
  label: 'Home' | 'Work' | 'Other';
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  landmark?: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
  createdAt: string;
}

interface FormState {
  label: 'Home' | 'Work' | 'Other';
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  landmark: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
}

const EMPTY_FORM: FormState = {
  label: 'Home',
  fullName: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'India',
  landmark: '',
  isDefaultShipping: false,
  isDefaultBilling: false,
};

const labelConfig = {
  Home: { icon: FiHome, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  Work: { icon: FiBriefcase, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  Other: { icon: FiTag, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
};

const AddressBook: React.FC = () => {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const fetchAddresses = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getAddresses();
      setAddresses(res.data.data || []);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load addresses');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  // auto-clear success banner
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(''), 3500);
      return () => clearTimeout(t);
    }
  }, [success]);

  const openAddForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setError('');
    setShowForm(true);
  };

  const openEditForm = (addr: Address) => {
    setForm({
      label: addr.label,
      fullName: addr.fullName,
      phone: addr.phone,
      line1: addr.line1,
      line2: addr.line2 || '',
      city: addr.city,
      state: addr.state,
      postalCode: addr.postalCode,
      country: addr.country,
      landmark: addr.landmark || '',
      isDefaultShipping: addr.isDefaultShipping,
      isDefaultBilling: addr.isDefaultBilling,
    });
    setEditingId(addr._id);
    setError('');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName.trim() || !form.phone.trim() || !form.line1.trim()) {
      setError('Name, phone and address line 1 are required');
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (editingId) {
        await api.updateAddress(editingId, form);
        setSuccess('Address updated');
      } else {
        await api.createAddress(form);
        setSuccess('Address saved');
      }
      await fetchAddresses();
      closeForm();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save address');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setSaving(true);
    setError('');
    try {
      await api.deleteAddress(id);
      setConfirmDelete(null);
      setSuccess('Address removed');
      await fetchAddresses();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete address');
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefaultShipping = async (id: string) => {
    setError('');
    try {
      await api.setDefaultShippingAddress(id);
      await fetchAddresses();
      setSuccess('Default shipping address updated');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update default');
    }
  };

  const handleSetDefaultBilling = async (id: string) => {
    setError('');
    try {
      await api.setDefaultBillingAddress(id);
      await fetchAddresses();
      setSuccess('Default billing address updated');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update default');
    }
  };

  const inputClass =
    'w-full px-4 py-3 text-base border-2 rounded-xl transition-all focus:outline-none focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/5 hover:border-neutral-300 bg-white border-neutral-200';

  return (
    <div className="p-6 sm:p-8 lg:p-10 rounded-2xl lg:rounded-3xl shadow-lg border border-gray-200 bg-white">
      {/* header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-neutral-900 flex items-center justify-center">
              <FiMapPin className="text-white" size={20} />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Saved Addresses</h2>
          </div>
          <p className="text-sm sm:text-base text-gray-600">
            Manage delivery addresses for faster checkout.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={openAddForm}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-black text-white hover:bg-gray-900 active:scale-95 transition-all shadow-lg"
          >
            <FiPlus size={18} />
            Add Address
          </button>
        )}
      </div>

      {/* banners */}
      {success && (
        <div className="mb-5 p-4 rounded-xl bg-green-50 border border-green-200 flex items-center gap-3">
          <FiCheck className="text-green-600 flex-shrink-0" size={20} />
          <p className="text-green-800 font-medium">{success}</p>
        </div>
      )}
      {error && (
        <div className="mb-5 p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3">
          <FiAlertCircle className="text-red-600 flex-shrink-0" size={20} />
          <p className="text-red-800 font-medium">{error}</p>
        </div>
      )}

      {/* form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 p-6 bg-gray-50 border-2 border-neutral-200 rounded-2xl space-y-5"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">
              {editingId ? 'Edit Address' : 'New Address'}
            </h3>
            <button
              type="button"
              onClick={closeForm}
              className="p-2 hover:bg-neutral-200 rounded-lg transition-colors"
            >
              <FiX className="text-gray-500" size={18} />
            </button>
          </div>

          {/* label picker */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">
              Label
            </label>
            <div className="flex gap-2">
              {(['Home', 'Work', 'Other'] as const).map((lbl) => {
                const cfg = labelConfig[lbl];
                const Icon = cfg.icon;
                const active = form.label === lbl;
                return (
                  <button
                    key={lbl}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, label: lbl }))}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                      active
                        ? `${cfg.bg} ${cfg.border} ${cfg.color}`
                        : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <Icon size={16} />
                    {lbl}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* full name */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">
                Recipient Name
              </label>
              <div className="relative">
                <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                  className={inputClass + ' pl-10'}
                  placeholder="John Doe"
                  required
                />
              </div>
            </div>
            {/* phone */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">
                Phone
              </label>
              <div className="relative">
                <FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  className={inputClass + ' pl-10'}
                  placeholder="+91 98765 43210"
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">
              Address Line 1
            </label>
            <input
              type="text"
              value={form.line1}
              onChange={(e) => setForm((p) => ({ ...p, line1: e.target.value }))}
              className={inputClass}
              placeholder="House no, Building, Street"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">
                Address Line 2 <span className="text-gray-400 normal-case">(optional)</span>
              </label>
              <input
                type="text"
                value={form.line2}
                onChange={(e) => setForm((p) => ({ ...p, line2: e.target.value }))}
                className={inputClass}
                placeholder="Apartment, Suite"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">
                Landmark <span className="text-gray-400 normal-case">(optional)</span>
              </label>
              <div className="relative">
                <FiNavigation className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  value={form.landmark}
                  onChange={(e) => setForm((p) => ({ ...p, landmark: e.target.value }))}
                  className={inputClass + ' pl-10'}
                  placeholder="Near park"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">
                City
              </label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                className={inputClass}
                placeholder="Mumbai"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">
                State
              </label>
              <input
                type="text"
                value={form.state}
                onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))}
                className={inputClass}
                placeholder="Maharashtra"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">
                Postal Code
              </label>
              <input
                type="text"
                value={form.postalCode}
                onChange={(e) => setForm((p) => ({ ...p, postalCode: e.target.value }))}
                className={inputClass}
                placeholder="400001"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">
              Country
            </label>
            <input
              type="text"
              value={form.country}
              onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))}
              className={inputClass}
              placeholder="India"
            />
          </div>

          {/* default toggles */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <label className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-gray-200 cursor-pointer hover:border-gray-300 transition-colors flex-1">
              <input
                type="checkbox"
                checked={form.isDefaultShipping}
                onChange={(e) => setForm((p) => ({ ...p, isDefaultShipping: e.target.checked }))}
                className="w-4 h-4 accent-black"
              />
              <span className="text-sm font-semibold text-gray-700">Set as default shipping</span>
            </label>
            <label className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-gray-200 cursor-pointer hover:border-gray-300 transition-colors flex-1">
              <input
                type="checkbox"
                checked={form.isDefaultBilling}
                onChange={(e) => setForm((p) => ({ ...p, isDefaultBilling: e.target.checked }))}
                className="w-4 h-4 accent-black"
              />
              <span className="text-sm font-semibold text-gray-700">Set as default billing</span>
            </label>
          </div>

          {/* actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold bg-black text-white hover:bg-gray-900 active:scale-95 transition-all shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <FiLoader className="animate-spin" size={18} />
                  Saving...
                </>
              ) : (
                <>
                  <FiCheck size={18} />
                  {editingId ? 'Update Address' : 'Save Address'}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="px-6 py-3.5 rounded-xl font-bold border-2 border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <FiLoader className="animate-spin text-gray-400" size={28} />
        </div>
      ) : addresses.length === 0 && !showForm ? (
        <div className="text-center py-12 bg-gray-50 rounded-2xl">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiMapPin className="text-gray-400" size={28} />
          </div>
          <h4 className="text-lg font-semibold text-gray-900 mb-1">No saved addresses</h4>
          <p className="text-gray-500 text-sm">Add an address to speed up checkout.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {addresses.map((addr) => {
            const cfg = labelConfig[addr.label] || labelConfig.Other;
            const LabelIcon = cfg.icon;
            return (
              <div
                key={addr._id}
                className={`relative p-5 rounded-2xl border-2 transition-all hover:shadow-md ${
                  addr.isDefaultShipping
                    ? 'border-neutral-900 bg-neutral-50/50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                {/* delete confirm overlay */}
                {confirmDelete === addr._id ? (
                  <div className="absolute inset-0 z-10 bg-white/95 rounded-2xl flex flex-col items-center justify-center p-6 text-center">
                    <FiAlertCircle className="text-red-500 mb-3" size={32} />
                    <p className="font-semibold text-gray-900 mb-1">Delete this address?</p>
                    <p className="text-sm text-gray-500 mb-4">This cannot be undone.</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDelete(addr._id)}
                        disabled={saving}
                        className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="px-4 py-2 rounded-lg border-2 border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* label + defaults */}
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${cfg.bg} ${cfg.color} ${cfg.border} border`}
                  >
                    <LabelIcon size={12} />
                    {addr.label}
                  </span>
                  <div className="flex gap-1.5">
                    {addr.isDefaultShipping && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-neutral-900 text-white">
                        <FiStar size={10} /> SHIP
                      </span>
                    )}
                    {addr.isDefaultBilling && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-600 text-white">
                        <FiCheck size={10} /> BILL
                      </span>
                    )}
                  </div>
                </div>

                {/* recipient */}
                <p className="font-bold text-gray-900 text-base">{addr.fullName}</p>
                <p className="text-sm text-gray-600 mt-0.5">{addr.phone}</p>

                {/* address lines */}
                <div className="mt-3 text-sm text-gray-700 leading-relaxed">
                  <p>{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}</p>
                  <p>
                    {addr.city}, {addr.state} {addr.postalCode}
                  </p>
                  <p>{addr.country}</p>
                  {addr.landmark && (
                    <p className="text-gray-500 mt-1">Landmark: {addr.landmark}</p>
                  )}
                </div>

                {/* actions */}
                <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-2">
                  {!addr.isDefaultShipping && (
                    <button
                      onClick={() => handleSetDefaultShipping(addr._id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                    >
                      <FiStar size={12} /> Default ship
                    </button>
                  )}
                  {!addr.isDefaultBilling && (
                    <button
                      onClick={() => handleSetDefaultBilling(addr._id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                    >
                      <FiCheck size={12} /> Default bill
                    </button>
                  )}
                  <div className="ml-auto flex gap-1">
                    <button
                      onClick={() => openEditForm(addr)}
                      className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                      title="Edit"
                      aria-label={`Edit ${addr.fullName} address`}
                    >
                      <FiEdit2 size={15} />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(addr._id)}
                      className="p-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                      title="Delete"
                      aria-label={`Delete ${addr.fullName} address`}
                    >
                      <FiTrash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AddressBook;
