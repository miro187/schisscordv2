import { IconHome, IconMessage, IconUsers, IconSettings, IconMusic } from '@tabler/icons-react';
import { ROUTES } from '@/routes';
// ... andere Imports

export const Navigation = () => {
  return (
    <nav className="flex flex-col h-full w-[72px] bg-gray-800 p-3 gap-2">
      {/* ... bestehende Nav-Items ... */}
      
      <NavigationItem 
        icon="🎵"
        href={ROUTES.MUSIC}
        tooltip="Musik"
      />
      
      {/* ... andere Items ... */}
    </nav>
  );
}; 