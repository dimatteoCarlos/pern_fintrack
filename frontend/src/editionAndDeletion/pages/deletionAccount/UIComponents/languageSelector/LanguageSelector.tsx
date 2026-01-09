import { LanguageKeyType } from "../../../../utils/languages";

// frontend/src/shared/components/LanguageSelector/LanguageSelector.tsx
export const LanguageSelector = ({ 
  language, 
  changeLanguage,
  size = 'medium' 
}: {
  language: LanguageKeyType;
  changeLanguage: (lang: LanguageKeyType) => void;
  size?: 'small' | 'medium' | 'large';
}) => {
  const sizes = {
    small: { padding: '2px 6px', fontSize: '12px' },
    medium: { padding: '6px 12px', fontSize: '14px' },
    large: { padding: '8px 16px', fontSize: '16px' }
  };

  return (
    <select
      value={language}
      onChange={(e) => changeLanguage(e.target.value as LanguageKeyType)}
      style={{
        padding: sizes[size].padding,
        borderRadius: '6px',
        border: '1px solid #d1d5db',
        fontSize: sizes[size].fontSize,
        backgroundColor: 'white',
        cursor: 'pointer'
      }}
    >
      <option value="es">🇪🇸 ES</option>
      <option value="en">🇬🇧 EN</option>
    </select>
  );
};