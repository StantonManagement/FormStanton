'use client';

interface AlertDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onClose: () => void;
  variant?: 'success' | 'error' | 'info';
}

export default function AlertDialog({
  isOpen,
  title,
  message,
  onClose,
  variant = 'info',
}: AlertDialogProps) {
  if (!isOpen) return null;

  const buttonClass = variant === 'error'
    ? 'bg-red-700 text-white hover:bg-red-800'
    : variant === 'success'
    ? 'bg-green-700 text-white hover:bg-green-800'
    : 'bg-[#8b7355] text-white hover:bg-[#6d5a43]';

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
      <div className="bg-white border border-gray-300 max-w-md w-full p-6">
        <h3 className="font-serif text-xl mb-4">{title}</h3>
        <p className="font-sans text-sm mb-6 text-gray-700 whitespace-pre-line">{message}</p>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className={`px-4 py-2 transition-colors font-sans text-sm ${buttonClass}`}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
