import React, { useState } from 'react';
import { useConfig } from '../../context/ConfigContext';
import { FiSave } from 'react-icons/fi';

interface LayoutEditorProps {
  onSave: () => void;
}

const LayoutEditor: React.FC<LayoutEditorProps> = ({ onSave }) => {
  const { layout, updateLayout } = useConfig();
  const [localLayout, setLocalLayout] = useState(layout);

  const handleSave = async () => {
    await updateLayout(localLayout);
    onSave();
  };

  return (
    <div className="bg-white rounded-lg border-2 border-gray-200 p-6 sm:p-8 max-w-3xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Layout Configuration</h2>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">Header Style</label>
          <select
            value={localLayout.headerStyle}
            onChange={(e) => setLocalLayout({ ...localLayout, headerStyle: e.target.value as any })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="classic">Classic</option>
            <option value="modern">Modern</option>
            <option value="minimal">Minimal</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">Footer Style</label>
          <select
            value={localLayout.footerStyle}
            onChange={(e) => setLocalLayout({ ...localLayout, footerStyle: e.target.value as any })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="standard">Standard</option>
            <option value="expanded">Expanded</option>
            <option value="minimal">Minimal</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">Sidebar Position</label>
          <select
            value={localLayout.sidebarPosition}
            onChange={(e) => setLocalLayout({ ...localLayout, sidebarPosition: e.target.value as any })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="left">Left</option>
            <option value="right">Right</option>
          </select>
        </div>

        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={localLayout.sidebarCollapsible}
              onChange={(e) => setLocalLayout({ ...localLayout, sidebarCollapsible: e.target.checked })}
              className="w-5 h-5 rounded"
            />
            <span className="font-medium text-gray-900">Sidebar Collapsible</span>
          </label>
        </div>

        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={localLayout.showBreadcrumbs}
              onChange={(e) => setLocalLayout({ ...localLayout, showBreadcrumbs: e.target.checked })}
              className="w-5 h-5 rounded"
            />
            <span className="font-medium text-gray-900">Show Breadcrumbs</span>
          </label>
        </div>

        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={localLayout.showFooter}
              onChange={(e) => setLocalLayout({ ...localLayout, showFooter: e.target.checked })}
              className="w-5 h-5 rounded"
            />
            <span className="font-medium text-gray-900">Show Footer</span>
          </label>
        </div>

        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={localLayout.showChatbot}
              onChange={(e) => setLocalLayout({ ...localLayout, showChatbot: e.target.checked })}
              className="w-5 h-5 rounded"
            />
            <span className="font-medium text-gray-900">Show Chatbot</span>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">Items Per Page</label>
          <input
            type="number"
            value={localLayout.itemsPerPage}
            onChange={(e) => setLocalLayout({ ...localLayout, itemsPerPage: parseInt(e.target.value) })}
            min="5"
            max="100"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">Default Sort By</label>
          <input
            type="text"
            value={localLayout.defaultSortBy}
            onChange={(e) => setLocalLayout({ ...localLayout, defaultSortBy: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">Default Sort Order</label>
          <select
            value={localLayout.defaultSortOrder}
            onChange={(e) => setLocalLayout({ ...localLayout, defaultSortOrder: e.target.value as any })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>
      </div>

      <div className="flex gap-3 mt-8">
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <FiSave size={18} />
          Save Layout
        </button>
      </div>
    </div>
  );
};

export default LayoutEditor;
