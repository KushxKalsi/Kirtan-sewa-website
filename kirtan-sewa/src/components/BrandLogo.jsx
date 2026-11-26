import { BRAND_LOGO } from '../../shared/brand';

export default function BrandLogo({ className, alt = '', src = BRAND_LOGO, ...props }) {
  return <img src={src} className={`brand-logo ${className || ''}`} alt={alt} width="768" height="768" draggable={false} {...props} />;
}
