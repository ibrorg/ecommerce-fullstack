import React, { useState } from 'react';
import { useConfig } from '../../context/ConfigContext';
import { FiSave, FiRotateCcw } from 'react-icons/fi';

interface ThemeEditorProps {
  onSave: () => void;
}

const ThemeEditor: React.FC<ThemeEditorProps> = ({ onSave }) => {
  const { theme, updateTheme } = useConfig();
  const [localTheme, setLocalTheme] = useState(theme);
  const [isDark, setIsDark] = useState(theme.isDark);

  const handleSave = async () => {
    await updateTheme({...localTheme, isDark});
    onSave();
  };

  const handleReset = () => {
    setLocalTheme(theme);
    setIsDark(theme.isDark);
  };

  return (
    <div className="bg-white rounded-lg border-2 border-gray-200 p-6 sm:p-8 max-w-3xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Theme Configuration</h2>

      <div className="space-y-6">
        {/* Color Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {[
            { key: 'primaryColor', label: 'Primary' },
            { key: 'secondaryColor', label: 'Secondary' },
            { key: 'accentColor', label: 'Accent' },
            { key: 'successColor', label: 'Success' },
            { key: 'warningColor', label: 'Warning' },
            { key: 'errorColor', label: 'Error' }
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-900 mb-2">{label}</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={(localTheme as any)[key]}
                  onChange={(e) => setLocalTheme({ ...localTheme, [key]: e.target.value })}
                  className="w-12 h-10 rounded-lg border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={(localTheme as any)[key]}
                  onChange={(e) => setLocalTheme({ ...localTheme, [key]: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Typography */}
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Typography</h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Primary Font</label>
              <input
                type="text"
                value={localTheme.font.primary}
                onChange={(e) => setLocalTheme({
                  ...localTheme,
                  font: { ...localTheme.font, primary: e.target.value }
                })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Secondary Font</label>
              <input
                type="text"
                value={localTheme.font.secondary}
                onChange={(e) => setLocalTheme({
                  ...localTheme,
                  font: { ...localTheme.font, secondary: e.target.value }
                })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* Dark Mode Toggle */}
        <div className="border-t border-gray-200 pt-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isDark}
              onChange={(e) => setIsDark(e.target.checked)}
              className="w-5 h-5 rounded"
            />
            <span className="font-medium text-gray-900">Enable Dark Mode</span>
          </label>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-3 mt-8">
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <FiSave size={18} />
          Save Theme
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

export default ThemeEditor;
