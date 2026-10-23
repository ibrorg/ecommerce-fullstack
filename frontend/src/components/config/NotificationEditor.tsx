import React, { useState } from 'react';
import { useConfig } from '../../context/ConfigContext';
import { FiSave, FiToggleLeft, FiToggleRight } from 'react-icons/fi';

interface NotificationEditorProps {
  onSave: () => void;
}

const NotificationEditor: React.FC<NotificationEditorProps> = ({ onSave }) => {
  const { notifications, updateNotifications } = useConfig();
  const [localNotifications, setLocalNotifications] = useState(notifications);

  const handleSave = async () => {
    await updateNotifications(localNotifications);
    onSave();
  };

  return (
    <div className="bg-white rounded-lg border-2 border-gray-200 p-6 sm:p-8 max-w-3xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Notification Configuration</h2>

      <div className="space-y-8">
        {/* Email Settings */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Email Notifications</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
              <span className="font-medium text-gray-900">Enable Email</span>
              <button
                onClick={() => setLocalNotifications({
                  ...localNotifications,
                  email: { ...localNotifications.email, enabled: !localNotifications.email.enabled }
                })}
              >
                {localNotifications.email.enabled ? (
                  <FiToggleRight className="text-green-600" size={32} />
                ) : (
                  <FiToggleLeft className="text-gray-400" size={32} />
                )}
              </button>
            </div>

            {localNotifications.email.enabled && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">SMTP Provider</label>
                  <input
                    type="text"
                    value={localNotifications.email.smtpProvider}
                    onChange={(e) => setLocalNotifications({
                      ...localNotifications,
                      email: { ...localNotifications.email, smtpProvider: e.target.value }
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Sender Email</label>
                  <input
                    type="email"
                    value={localNotifications.email.senderEmail}
                    onChange={(e) => setLocalNotifications({
                      ...localNotifications,
                      email: { ...localNotifications.email, senderEmail: e.target.value }
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Sender Name</label>
                  <input
                    type="text"
                    value={localNotifications.email.senderName}
                    onChange={(e) => setLocalNotifications({
                      ...localNotifications,
                      email: { ...localNotifications.email, senderName: e.target.value }
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* SMS Settings */}
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">SMS Notifications</h3>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
            <span className="font-medium text-gray-900">Enable SMS</span>
            <button
              onClick={() => setLocalNotifications({
                ...localNotifications,
                sms: { ...localNotifications.sms, enabled: !localNotifications.sms.enabled }
              })}
            >
              {localNotifications.sms.enabled ? (
                <FiToggleRight className="text-green-600" size={32} />
              ) : (
                <FiToggleLeft className="text-gray-400" size={32} />
              )}
            </button>
          </div>
        </div>

        {/* Push Settings */}
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Push Notifications</h3>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
            <span className="font-medium text-gray-900">Enable Push</span>
            <button
              onClick={() => setLocalNotifications({
                ...localNotifications,
                push: { ...localNotifications.push, enabled: !localNotifications.push.enabled }
              })}
            >
              {localNotifications.push.enabled ? (
                <FiToggleRight className="text-green-600" size={32} />
              ) : (
                <FiToggleLeft className="text-gray-400" size={32} />
              )}
            </button>
          </div>
        </div>

        {/* Event Types */}
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Event Notifications</h3>
          <div className="space-y-3">
            {Object.entries(localNotifications.eventTypes).map(([key, enabled]) => (
              <div key={key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                <span className="font-medium text-gray-900 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                <button
                  onClick={() => setLocalNotifications({
                    ...localNotifications,
                    eventTypes: {
                      ...localNotifications.eventTypes,
                      [key]: !enabled
                    }
                  })}
                >
                  {enabled ? (
                    <FiToggleRight className="text-green-600" size={32} />
                  ) : (
                    <FiToggleLeft className="text-gray-400" size={32} />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <FiSave size={18} />
          Save Notifications
        </button>
      </div>
    </div>
  );
};

export default NotificationEditor;
