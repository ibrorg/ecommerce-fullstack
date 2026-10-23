import React, { useState } from 'react';
import { useConfig } from '../../context/ConfigContext';
import { FiSave, FiRotateCcw } from 'react-icons/fi';

interface BrandingEditorProps {
  onSave: () => void;
}

const BrandingEditor: React.FC<BrandingEditorProps> = ({ onSave }) => {
  const { branding, updateBranding } = useConfig();
  const [localBranding, setLocalBranding] = useState(branding);

  const handleSave = async () => {
    await updateBranding(localBranding);
    onSave();
  };

  const handleReset = () => {
    setLocalBranding(branding);
  };

  return (
    <div className="bg-white rounded-lg border-2 border-gray-200 p-6 sm:p-8 max-w-3xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Branding Configuration</h2>

      <div className="space-y-6">
        {/* Store Information */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">Store Name</label>
          <input
            type="text"
            value={localBranding.storeName}
            onChange={(e) => setLocalBranding({ ...localBranding, storeName: e.target.value })}
            maxLength={100}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">Store Description</label>
          <textarea
            value={localBranding.storeDescription}
            onChange={(e) => setLocalBranding({ ...localBranding, storeDescription: e.target.value })}
            maxLength={500}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Contact Information */}
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Email</label>
              <input
                type="email"
                value={localBranding.storeEmail}
                onChange={(e) => setLocalBranding({ ...localBranding, storeEmail: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Phone</label>
              <input
                type="tel"
                value={localBranding.storePhone}
                onChange={(e) => setLocalBranding({ ...localBranding, storePhone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Address</label>
              <input
                type="text"
                value={localBranding.storeAddress}
                onChange={(e) => setLocalBranding({ ...localBranding, storeAddress: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* Media URLs */}
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Media</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Logo URL</label>
              <input
                type="url"
                value={localBranding.logoUrl}
                onChange={(e) => setLocalBranding({ ...localBranding, logoUrl: e.target.value })}
                placeholder="https://example.com/logo.png"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Favicon URL</label>
              <input
                type="url"
                value={localBranding.faviconUrl}
                onChange={(e) => setLocalBranding({ ...localBranding, faviconUrl: e.target.value })}
                placeholder="https://example.com/favicon.ico"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Banner URL</label>
              <input
                type="url"
                value={localBranding.bannerUrl}
                onChange={(e) => setLocalBranding({ ...localBranding, bannerUrl: e.target.value })}
                placeholder="https://example.com/banner.jpg"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* Regional Settings */}
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Regional Settings</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Currency</label>
              <input
                type="text"
                value={localBranding.currency}
                onChange={(e) => setLocalBranding({ ...localBranding, currency: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Currency Symbol</label>
              <input
                type="text"
                value={localBranding.currencySymbol}
                onChange={(e) => setLocalBranding({ ...localBranding, currencySymbol: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Timezone</label>
              <input
                type="text"
                value={localBranding.timezone}
                onChange={(e) => setLocalBranding({ ...localBranding, timezone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Language</label>
              <input
                type="text"
                value={localBranding.language}
                onChange={(e) => setLocalBranding({ ...localBranding, language: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* Social Media */}
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Social Media</h3>
          <div className="grid grid-cols-2 gap-4">
            {['facebook', 'twitter', 'instagram', 'linkedin', 'youtube'].map(platform => (
              <div key={platform}>
                <label className="block text-sm font-medium text-gray-900 mb-2 capitalize">{platform}</label>
                <input
                  type="url"
                  value={(localBranding.socialMedia as any)[platform] || ''}
                  onChange={(e) => setLocalBranding({
                    ...localBranding,
                    socialMedia: {
                      ...localBranding.socialMedia,
                      [platform]: e.target.value
                    }
                  })}
                  placeholder={`https://${platform}.com/yourprofile`}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-3 mt-8">
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <FiSave size={18} />
          Save Branding
        </button>
        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
        >
          <FiRotateCcw size={18} />
          Reset
        </button>
      </div>
    </div>
  );
};

export default BrandingEditor;
