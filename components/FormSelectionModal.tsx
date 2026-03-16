import { useState } from 'react';
import { Department, departmentLabels, TenantForm, tenantForms, getFormById } from '@/lib/formsData';
import AlertDialog from '@/components/kit/AlertDialog';

interface FormSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (selectedFormIds: number[]) => void;
  tenant: {
    name: string;
    buildingAddress: string;
    unitNumber: string;
  };
}

// Form categories for walk-in scenarios
const FORM_CATEGORIES = {
  parking: {
    title: 'Parking/Vehicle',
    description: 'Vehicle and parking related forms',
    formIds: [22], // Vehicle & Parking Addendum
  },
  pets: {
    title: 'Pet Information',
    description: 'Pet registration and policies',
    formIds: [12], // Pet approval request
  },
  insurance: {
    title: 'Renters Insurance',
    description: 'Insurance requirements and LLC information',
    formIds: [23, 24], // Insurance Information + How-to Add Additional Insured
  },
};

export default function FormSelectionModal({ 
  isOpen, 
  onClose, 
  onGenerate, 
  tenant 
}: FormSelectionModalProps) {
  const [selectedForms, setSelectedForms] = useState<number[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('onboarding');
  const [isGenerating, setIsGenerating] = useState(false);

  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant?: 'success' | 'error' | 'info';
  }>({ isOpen: false, title: '', message: '' });

  if (!isOpen) return null;

  const handleFormToggle = (formId: number) => {
    setSelectedForms(prev => 
      prev.includes(formId) 
        ? prev.filter(id => id !== formId)
        : [...prev, formId]
    );
  };

  const handleCategorySelect = (categoryId: string) => {
    setActiveCategory(categoryId);
    const category = FORM_CATEGORIES[categoryId as keyof typeof FORM_CATEGORIES];
    if (category) {
      // Auto-select all forms in category
      setSelectedForms(prev => {
        const newSelection = [...prev];
        category.formIds.forEach(formId => {
          if (!newSelection.includes(formId)) {
            newSelection.push(formId);
          }
        });
        return newSelection;
      });
    }
  };

  const handleGenerate = async () => {
    if (selectedForms.length === 0) {
      setAlertDialog({
        isOpen: true,
        title: 'No Forms Selected',
        message: 'Please select at least one form',
        variant: 'error'
      });
      return;
    }

    setIsGenerating(true);
    try {
      onGenerate(selectedForms);
      onClose();
      setSelectedForms([]);
    } finally {
      setIsGenerating(false);
    }
  };

  const getFormsForCategory = (categoryId: string) => {
    const category = FORM_CATEGORIES[categoryId as keyof typeof FORM_CATEGORIES];
    if (!category) return [];
    
    return category.formIds.map(id => {
      const form = getFormById(id);
      return {
        id,
        title: form?.title || `Form ${id}`,
        description: form?.description || ''
      };
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-start justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Print Forms for Tenant</h2>
              <p className="text-sm text-gray-600 mt-1">
                {tenant.name} • {tenant.buildingAddress} • Unit {tenant.unitNumber}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Categories */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Select a Category</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(FORM_CATEGORIES).map(([key, category]) => (
              <button
                key={key}
                onClick={() => handleCategorySelect(key)}
                className={`p-3 text-left border rounded-lg transition-colors ${
                  activeCategory === key
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium text-gray-900">{category.title}</div>
                <div className="text-sm text-gray-600">{category.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Forms List */}
        <div className="px-6 py-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">
            Selected Forms ({selectedForms.length})
          </h3>
          <div className="space-y-2">
            {selectedForms.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                Select a category above to see available forms
              </p>
            ) : (
              selectedForms.map(formId => (
                <div
                  key={formId}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <span className="text-sm font-medium">
                    {getFormById(formId)?.title || `Form ${formId}`}
                  </span>
                  <button
                    onClick={() => handleFormToggle(formId)}
                    className="text-red-600 hover:text-red-700 text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={selectedForms.length === 0 || isGenerating}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isGenerating ? 'Generating...' : `Generate ${selectedForms.length} Form${selectedForms.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>

      <AlertDialog
        isOpen={alertDialog.isOpen}
        title={alertDialog.title}
        message={alertDialog.message}
        onClose={() => setAlertDialog({ ...alertDialog, isOpen: false })}
        variant={alertDialog.variant}
      />
    </div>
  );
}
