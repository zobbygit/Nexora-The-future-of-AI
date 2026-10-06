import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export default function LegalModals() {
  const [isOpen, setIsOpen] = useState(false);
  const [modalType, setModalType] = useState<'legal' | 'privacy' | 'terms' | null>(null);

  const openModal = (type: 'legal' | 'privacy' | 'terms') => {
    setModalType(type);
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setModalType(null);
  };

  const content = {
    legal: {
      title: 'Legal Information',
      desc: 'Nexora is provided "as is" without warranty of any kind. By using our AI tools, you agree to comply with all applicable laws and not to use the platform for generating harmful or illegal content.',
    },
    privacy: {
      title: 'Privacy Policy',
      desc: 'We prioritize your privacy. Your data is encrypted, and we do not sell your personal information to third parties. AI prompts are processed securely and are not used to train public models without your explicit consent.',
    },
    terms: {
      title: 'Terms of Service',
      desc: 'By accessing Nexora, you agree to these terms. You are responsible for maintaining the confidentiality of your account and for all activities that occur under your account.',
    },
  };

  return (
    <>
      {/* The clickable links that stay on your current page */}
      <div className="flex items-center justify-center gap-4 text-sm font-medium text-gray-400">
        <span 
          onClick={() => openModal('legal')} 
          className="cursor-pointer transition hover:text-violet-400"
        >
          Legal
        </span>
        <span 
          onClick={() => openModal('privacy')} 
          className="cursor-pointer transition hover:text-violet-400"
        >
          Privacy
        </span>
        <span 
          onClick={() => openModal('terms')} 
          className="cursor-pointer transition hover:text-violet-400"
        >
          Terms
        </span>
      </div>

      {/* The Modal Overlay - appears directly over your current page */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#12101a] p-6 shadow-2xl"
            >
              {/* Header */}
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">
                  {modalType && content[modalType].title}
                </h2>
                <button
                  onClick={closeModal}
                  className="rounded-lg border border-white/10 p-1.5 text-gray-400 transition hover:bg-white/5 hover:text-white"
                  aria-label="Close modal"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Body Text */}
              <p className="mb-8 text-sm leading-relaxed text-gray-400">
                {modalType && content[modalType].desc}
              </p>

              {/* Dummy Chart Section */}
              <div className="rounded-xl border border-white/5 bg-[#1a1825] p-5 mb-6">
                <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-300">
                  Platform Usage Overview
                </h3>
                <div className="flex h-24 items-end justify-between gap-2">
                  {[40, 70, 50, 90, 100, 60, 80].map((height, i) => (
                    <div key={i} className="flex h-full w-full flex-col justify-end">
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${height}%` }}
                        transition={{ delay: 0.1 + i * 0.05, duration: 0.5, ease: "easeOut" }}
                        className="w-full rounded-t-sm bg-violet-600"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={closeModal}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-gray-300 transition hover:text-white"
                >
                  Close
                </button>
                <button
                  onClick={closeModal}
                  className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-500"
                >
                  Accept & Continue
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}