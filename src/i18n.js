// Language translations
export const translations = {
  vi: {
    // Home panel
    homeTitle: 'RailRouter VN',
    homeDescription: '<strong>Khám phá</strong> tuyến <abbr title="Metro">Metro</abbr> tại TP. Hồ Chí Minh. <strong>Phóng to</strong> để xem vị trí các ga và lối ra/vào.',
    homeData: 'Dữ liệu',
    homeReference: 'Tham khảo',
    homeContact: 'Liên hệ',
    homeButton: 'Khám phá ngay!',
    
    // Legend
    legendTitle: 'Chú giải',
    legendLine1: 'Tuyến 1 (vận hành)',
    legendStation: 'Ga metro',
    legendExit: 'Lối ra',
    
    // Search
    searchPlaceholder: 'Tìm ga...',
    searchCancel: 'Hủy',
    searchNoResults: 'Không tìm thấy ga nào',
    
    // Station panel
    stationExits: 'Lối ra',
    stationExit: 'Lối ra',
    stationClosed: 'Đóng',
    
    // Buttons
    btnGoogleMaps: '📍 Mở Google Maps',
    
    // Meta
    metaTitle: 'RailRouter VN – Khám phá Metro TPHCM – Bản đồ tàu điện TP.HCM',
    metaDescription: 'Khám phá tuyến Metro tại TP. Hồ Chí Minh',
  },
  
  en: {
    // Home panel
    homeTitle: 'RailRouter VN',
    homeDescription: '<strong>Explore</strong> <abbr title="Metro">Metro</abbr> routes in Ho Chi Minh City. <strong>Zoom in</strong> to see station locations and exits.',
    homeData: 'Data',
    homeReference: 'Reference',
    homeContact: 'Contact',
    homeButton: 'Explore Now!',
    
    // Legend
    legendTitle: 'Legend',
    legendLine1: 'Line 1 (Operational)',
    legendStation: 'Metro station',
    legendExit: 'Exit',
    
    // Search
    searchPlaceholder: 'Search stations...',
    searchCancel: 'Cancel',
    searchNoResults: 'No stations found',
    
    // Station panel
    stationExits: 'Exits',
    stationExit: 'Exit',
    stationClosed: 'Closed',
    
    // Buttons
    btnGoogleMaps: '📍 Open Google Maps',
    
    // Meta
    metaTitle: 'RailRouter VN – Explore HCMC Metro – Ho Chi Minh City Train Map',
    metaDescription: 'Explore Metro routes in Ho Chi Minh City',
  }
};

// Get current language from localStorage or default to Vietnamese
export function getCurrentLanguage() {
  return localStorage.getItem('railrouter-lang') || 'vi';
}

// Set language
export function setLanguage(lang) {
  localStorage.setItem('railrouter-lang', lang);
  document.documentElement.lang = lang;
}

// Get translation
export function t(key) {
  const lang = getCurrentLanguage();
  return translations[lang][key] || translations.vi[key] || key;
}
