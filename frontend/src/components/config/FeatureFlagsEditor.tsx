import React, { useState } from 'react';
import { useConfig } from '../../context/ConfigContext';
import { FiSave, FiToggleLeft, FiToggleRight } from 'react-icons/fi';

interface FeatureFlagsEditorProps {
  onSave: () => void;
}

const FeatureFlagsEditor: React.FC<FeatureFlagsEditorProps> = ({ onSave }) => {
  const { features, updateFeatures } = useConfig();
  const [localFeatures, setLocalFeatures] = useState(features);

  const handleSave = async () => {
    await updateFeatures(localFeatures);
    onSave();
  };

  const featureList = [
    { key: 'sellerRegistration', label: 'Seller Registration', description: 'Allow users to register as sellers' },
    { key: 'reviews', label: 'Product Reviews', description: 'Enable customer product reviews' },
    { key: 'ratings', label: 'Ratings', description: 'Enable product ratings system' },
    { key: 'wishlist', label: 'Wishlist', description: 'Allow customers to save wishlist' },
    { key: 'cart', label: 'Shopping Cart', description: 'Enable shopping cart functionality' },
    { key: 'checkout', label: 'Checkout', description: 'Enable checkout process' },
    { key: 'payments', label: 'Payments', description: 'Enable payment processing' },
    { key: 'orders', label: 'Orders', description: 'Enable order management' },
    { key: 'returns', label: 'Product Returns', description: 'Enable return requests' },
    { key: 'refunds', label: 'Refunds', description: 'Enable refund processing' },
    { key: 'coupons', label: 'Coupons & Discounts', description: 'Enable coupon system' },
    { key: 'analytics', label: 'Analytics', description: 'Enable analytics dashboard' },
    { key: 'reportBuilder', label: 'Report Builder', description: 'Enable custom reports' },
    { key: 'customRoles', label: 'Custom Roles', description: 'Enable custom role management' }
  ];

  return (
    <div className="bg-white rounded-lg border-2 border-gray-200 p-6 sm:p-8 max-w-3xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Feature Flags</h2>
      <p className="text-gray-600 mb-6">Enable or disable platform features globally</p>

      <div className="space-y-3">
        {featureList.map(({ key, label, description }) => (
          <div key={key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
            <div>
              <p className="font-semibold text-gray-900">{label}</p>
              <p className="text-sm text-gray-600">{description}</p>
            </div>
            <button
              onClick={() => setLocalFeatures({ ...localFeatures, [key]: !(localFeatures as any)[key] })}
              className="flex-shrink-0"
            >
              {(localFeatures as any)[key] ? (
                <FiToggleRight className="text-green-600" size={32} />
              ) : (
                <FiToggleLeft className="text-gray-400" size={32} />
              )}
            </button>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <FiSave size={18} />
          Save Features
        </button>
      </div>
    </div>
  );
};

export default FeatureFlagsEditor;
