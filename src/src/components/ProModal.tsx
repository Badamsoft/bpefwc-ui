import React from 'react';
import { X, Check, Zap, Lock } from 'lucide-react';

interface ProModalProps {
  onClose: () => void;
}

export function ProModal({ onClose }: ProModalProps) {
  const features = [
    'Unlimited scheduled exports',
    'Cloud storage integrations (Google Drive, Dropbox, S3)',
    'Advanced filters and combinations',
    'ACF and custom fields support',
    'Multilingual exports (WPML/Polylang)',
    'Bulk image export and ZIP creation',
    'Post-export actions (FTP, Email, Webhooks)',
    'Priority support',
  ];

  const plans = [
    {
      name: 'Professional',
      price: '$79',
      period: '/year',
      description: 'Perfect for growing stores',
      features: ['1 site license', 'All PRO features', 'Email support', '1 year updates'],
      popular: false,
    },
    {
      name: 'Business',
      price: '$149',
      period: '/year',
      description: 'For agencies and multiple stores',
      features: ['5 site licenses', 'All PRO features', 'Priority support', 'Lifetime updates'],
      popular: true,
    },
    {
      name: 'Enterprise',
      price: '$299',
      period: '/year',
      description: 'Unlimited sites and white-label',
      features: ['Unlimited sites', 'All PRO features', 'Priority support', 'White-label option'],
                        />
                        <span className={`${plan.popular ? 'text-white' : 'text-gray-700'} text-body`}>
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <button
                    className={`w-full py-3 rounded-xl transition-colors text-label ${
                      plan.popular
                        ? 'bg-white text-[#FF3A2E] hover:bg-gray-50'
                        : 'bg-[#FF3A2E] text-white hover:bg-red-600'
                    }`}
                  >
                    Get {plan.name}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Guarantee */}
          <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-2xl text-center">
            <p className="text-blue-900 block-heading mb-1">30-Day Money-Back Guarantee</p>
            <p className="text-blue-700 text-body">
              Try PRO risk-free. If you're not satisfied, get a full refund within 30 days.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
