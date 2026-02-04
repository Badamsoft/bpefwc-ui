import React from 'react';
import type { ReactElement } from 'react';
import { 
  Crown, 
  Zap, 
  Cloud, 
  Calendar, 
  Database, 
  FileSpreadsheet, 
  Workflow, 
  ShieldCheck,
  Check,
  X,
  Sparkles,
  Rocket
} from 'lucide-react';

const UPGRADE_URL = 'https://badamsoft.com/wooproduct-exporter/';

export function UpgradePro(): ReactElement {
  const proFeatures = [
    {
      icon: Database,
      title: 'Unlimited Exports',
      description: 'Export unlimited products without any restrictions'
    },
    {
      icon: Cloud,
      title: 'Cloud Integrations',
      description: 'Direct exports to Google Sheets, Dropbox, FTP, and more'
    },
    {
      icon: Calendar,
      title: 'Advanced Scheduling',
      description: 'Automated exports with flexible scheduling options'
    },
    {
      icon: FileSpreadsheet,
      title: 'Premium Formats',
      description: 'Access to XML, JSON, and custom format templates'
    },
    {
      icon: Workflow,
      title: 'Custom Workflows',
      description: 'Build complex export workflows with conditions and triggers'
    },
    {
      icon: ShieldCheck,
      title: 'Priority Support',
      description: '24/7 premium support with 1-hour response time'
    }
  ];

  const comparisonFeatures = [
    { name: 'Export Products', free: true, pro: true },
    { name: 'CSV Format', free: true, pro: true },
    { name: 'XLSX / TSV / JSON / XML Formats', free: false, pro: true },
    { name: 'Basic Field Selection', free: true, pro: true },
    { name: 'Advanced Fields (Attributes, ACF, Meta)', free: false, pro: true },
    { name: 'Export History', free: true, pro: true },
    { name: 'Templates (Save/Import/Export)', free: true, pro: true },
    { name: 'Automated Scheduling', free: false, pro: true },
    { name: 'Advanced Filters & Conditions', free: false, pro: true },
    { name: 'Media Export (ZIP / Cloud / Local)', free: false, pro: true },
    { name: 'API Access', free: false, pro: true },
    { name: 'Multilingual Export Settings', free: false, pro: true },
    { name: 'Access Control (Roles & Permissions)', free: false, pro: true },
    { name: 'Priority Support', free: false, pro: true },
  ];

  return (
    <div className="upgrade-pro">
      <div className="upgrade-container">
        <section className="upgrade-hero">
          <div className="upgrade-hero-content">
            <div className="upgrade-badge">
              <Crown className="upgrade-badge-icon" />
              <span className="upgrade-badge-text">PREMIUM VERSION</span>
            </div>

            <h1 className="upgrade-title">
              Unlock the Full Power of <br />
              <span className="upgrade-title-accent">
                Product Exporter PRO
                <Sparkles className="upgrade-title-icon" />
              </span>
            </h1>

            <p className="upgrade-subtitle">
              Supercharge your WooCommerce exports with unlimited products, automated scheduling,
              cloud integrations, and premium support
            </p>

            <button
              onClick={() => window.open(UPGRADE_URL, '_blank', 'noopener,noreferrer')}
              className="upgrade-primary-button"
              type="button"
            >
              <Rocket className="upgrade-button-icon" />
              Upgrade to PRO Now
            </button>

            <p className="upgrade-hero-note">
              One-time payment • Lifetime updates • 30-day money-back guarantee
            </p>
          </div>
        </section>

        <section className="upgrade-features">
          <h2 className="upgrade-section-title">Premium Features</h2>
          <div className="upgrade-features-grid">
            {proFeatures.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div key={index} className="upgrade-feature-card">
                  <div className="upgrade-feature-icon">
                    <Icon />
                  </div>
                  <div className="upgrade-feature-content">
                    <h3 className="upgrade-feature-title">{feature.title}</h3>
                    <p className="upgrade-feature-text">{feature.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="upgrade-comparison">
          <h2 className="upgrade-section-title">FREE vs PRO Comparison</h2>
          <div className="upgrade-table-card">
            <table className="upgrade-table">
              <thead>
                <tr>
                  <th className="upgrade-table-heading">Feature</th>
                  <th className="upgrade-table-heading upgrade-table-free">FREE</th>
                  <th className="upgrade-table-heading upgrade-table-pro">
                    <span className="upgrade-table-pro-label">
                      <Crown className="upgrade-table-pro-icon" />
                      PRO
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonFeatures.map((feature, index) => (
                  <tr key={index}>
                    <td className="upgrade-table-cell">{feature.name}</td>
                    <td className="upgrade-table-cell upgrade-table-free">
                      {typeof feature.free === 'boolean' ? (
                        feature.free ? (
                          <Check className="upgrade-check" />
                        ) : (
                          <X className="upgrade-x" />
                        )
                      ) : (
                        <span className="upgrade-table-text">{feature.free}</span>
                      )}
                    </td>
                    <td className="upgrade-table-cell upgrade-table-pro">
                      {typeof feature.pro === 'boolean' ? (
                        feature.pro ? (
                          <Check className="upgrade-check upgrade-check-pro" />
                        ) : (
                          <X className="upgrade-x" />
                        )
                      ) : (
                        <span className="upgrade-table-pro-text">{feature.pro}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="upgrade-cta">
          <Zap className="upgrade-cta-icon" />
          <h2 className="upgrade-cta-title">Ready to Upgrade?</h2>
          <p className="upgrade-cta-text">
            Join thousands of WooCommerce store owners who trust Product Exporter PRO
            to streamline their product management workflow
          </p>
          <button
            onClick={() => window.open(UPGRADE_URL, '_blank', 'noopener,noreferrer')}
            className="upgrade-primary-button upgrade-cta-button"
            type="button"
          >
            <Crown className="upgrade-button-icon" />
            Get PRO Access Now
          </button>
          <div className="upgrade-cta-benefits">
            <div className="upgrade-cta-benefit">
              <Check className="upgrade-check" />
              Instant Activation
            </div>
            <div className="upgrade-cta-benefit">
              <Check className="upgrade-check" />
              Lifetime Updates
            </div>
            <div className="upgrade-cta-benefit">
              <Check className="upgrade-check" />
              Money-back Guarantee
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
