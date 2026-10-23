import React, { useState, useEffect } from 'react';
import { useAppSelector } from '../store/hooks';
import { Navigate } from 'react-router-dom';
import { 
  FiSettings, FiEdit3, FiToggleLeft, FiToggleRight, FiSave, FiAlertCircle,
  FiCheckCircle, FiLayout, FiType, FiBell, FiFlag
} from 'react-icons/fi';
import { useConfig } from '../context/ConfigContext';
import ThemeEditor from './config/ThemeEditor';
import BrandingEditor from './config/BrandingEditor';
import LayoutEditor from './config/LayoutEditor';
import FeatureFlagsEditor from './config/FeatureFlagsEditor';
import NotificationEditor from './config/NotificationEditor';

type ConfigTab = 'theme' | 'branding' | 'layout' | 'features' | 'notifications' | 'maintenance';

const AdminConfig: React.FC = () => {
  const { user, isAuthenticated } = useAppSelector((state: any) => state.auth);
  const { maintenanceMode, toggleMaintenanceMode, error, clearError } = useConfig();
  const [activeTab, setActiveTab] = useState<ConfigTab>('theme');
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Auto-dismiss the success banner after 3s. Previously this was a
  // setTimeout call rendered directly in JSX, which leaked a Timeout object
  // into the React tree and scheduled a new timer on every render.
  useEffect(() => {
    if (!saveSuccess) return;
    const timer = setTimeout(() => setSaveSuccess(false), 3000);
    return () => clearTimeout(timer);
  }, [saveSuccess]);

  if (!isAuthenticated || user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  const tabs: { id: ConfigTab; label: string; icon: React.ReactNode; description: string }[] = [
    { id: 'theme', label: 'Theme & Colors', icon: <FiEdit3 size={20} />, description: 'Customize colors and typography' },
    { id: 'branding', label: 'Branding', icon: <FiType size={20} />, description: 'Store name, logo, contact info' },
    { id: 'layout', label: 'Layout', icon: <FiLayout size={20} />, description: 'UI/UX layout configuration' },
    { id: 'features', label: 'Features', icon: <FiFlag size={20} />, description: 'Enable/disable platform features' },
    { id: 'notifications', label: 'Notifications', icon: <FiBell size={20} />, description: 'Email, SMS, push settings' },
    { id: 'maintenance', label: 'Maintenance', icon: <FiSettings size={20} />, description: 'Maintenance mode control' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Site Configuration</h1>
          <p className="text-gray-600 mt-2">Manage all aspects of your e-commerce platform</p>
        </div>
      </div>

      {/* Alerts */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FiAlertCircle className="text-red-600" size={20} />
              <span className="text-red-700">{error}</span>
            </div>
            <button onClick={clearError} className="text-red-600 hover:text-red-800">✕</button>
          </div>
        )}
        
        {saveSuccess && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
            <FiCheckCircle className="text-green-600" size={20} />
            <span className="text-green-700">Changes saved successfully!</span>
          </div>
        )}
        {saveSuccess && setTimeout(() => setSaveSuccess(false), 3000)}
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20 mt-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 sm:px-4 py-4 border-b-2 font-medium text-sm whitespace-nowrap flex flex-col sm:flex-row items-center gap-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
                title={tab.description}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'theme' && <ThemeEditor onSave={() => setSaveSuccess(true)} />}
        {activeTab === 'branding' && <BrandingEditor onSave={() => setSaveSuccess(true)} />}
        {activeTab === 'layout' && <LayoutEditor onSave={() => setSaveSuccess(true)} />}
        {activeTab === 'features' && <FeatureFlagsEditor onSave={() => setSaveSuccess(true)} />}
        {activeTab === 'notifications' && <NotificationEditor onSave={() => setSaveSuccess(true)} />}
        
        {/* Maintenance Mode */}
        {activeTab === 'maintenance' && (
          <div className="bg-white rounded-lg border-2 border-gray-200 p-6 sm:p-8 max-w-2xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Maintenance Mode</h2>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div>
                  <p className="font-semibold text-gray-900">Enable Maintenance Mode</p>
                  <p className="text-sm text-gray-600 mt-1">Site will be unavailable to visitors</p>
                </div>
                <button
                  onClick={() => toggleMaintenanceMode(!maintenanceMode)}
                  className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  {maintenanceMode ? (
                    <FiToggleRight className="text-green-600" size={32} />
                  ) : (
                    <FiToggleLeft className="text-gray-600" size={32} />
                  )}
                </button>
              </div>

              {maintenanceMode && (
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Maintenance Message (Optional)
                  </label>
                  <textarea
                    value={maintenanceMessage}
                    onChange={(e) => setMaintenanceMessage(e.target.value)}
                    placeholder="We're performing scheduled maintenance. We'll be back online soon!"
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={() => toggleMaintenanceMode(true, maintenanceMessage)}
                    className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <FiSave size={18} />
                    Save Message
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminConfig;
