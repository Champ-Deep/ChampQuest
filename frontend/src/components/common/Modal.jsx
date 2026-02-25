import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { motionVariants } from '../../utils/animations';

export default function Modal({ isOpen, onClose, children, maxWidth = 'max-w-lg', title }) {
  useEffect(() => {
    if (isOpen) {
      const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="modal-backdrop"
          onClick={onClose}
          {...motionVariants.modalOverlay}
        >
          <motion.div
            className={`glass-card p-6 w-full ${maxWidth} max-h-[90vh] overflow-y-auto`}
            onClick={(e) => e.stopPropagation()}
            {...motionVariants.modalContent}
          >
            {title && (
              <div className="flex justify-between items-center mb-6">
                <h2 className="pixel-font text-lg text-white">{title}</h2>
                <button onClick={onClose} className="text-slate-500 text-lg hover:text-white transition-colors">
                  ✕
                </button>
              </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
