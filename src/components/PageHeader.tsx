import { ReactNode } from 'react';

interface Props {
  icon: string;          // phosphor icon class, e.g. "ph ph-user-list"
  title: string;
  subtitle?: string;
  actions?: ReactNode;   // right-aligned controls (buttons, etc.)
}

/** Saffron gradient page header used across the devotee/participation/audit screens. */
export default function PageHeader({ icon, title, subtitle, actions }: Props) {
  return (
    <div className="page-head mb-3">
      <div className="page-head__icon"><i className={icon} /></div>
      <div className="flex-1">
        <div className="page-head__title">{title}</div>
        {subtitle && <div className="page-head__sub">{subtitle}</div>}
      </div>
      {actions && <div className="flex align-items-center gap-2">{actions}</div>}
    </div>
  );
}
