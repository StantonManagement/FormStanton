'use client';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning' | 'info';
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'info',
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const confirmButtonClass = variant === 'danger'
    ? 'bg-red-700 text-white hover:bg-red-800'
    : 'bg-[#8b7355] text-white hover:bg-[#6d5a43]';

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
      <div className="bg-white border border-gray-300 max-w-md w-full p-6">
        <h3 className="font-serif text-xl mb-4">{title}</h3>
        <p className="font-sans text-sm mb-6 text-gray-700 whitespace-pre-line">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-[#8b7355] text-[#8b7355] hover:bg-[#f8f7f5] transition-colors font-sans text-sm"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 transition-colors font-sans text-sm ${confirmButtonClass}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
