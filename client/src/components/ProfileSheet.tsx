import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import Profile from '@/pages/Profile';
import { useProfileSheet } from '@/contexts/ProfileSheetContext';

export default function ProfileSheet() {
  const { isOpen, closeProfile } = useProfileSheet();

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeProfile()}>
      <SheetContent
        side="right"
        hideClose
        className="p-0 w-full sm:max-w-md overflow-y-auto"
        style={{ backgroundColor: '#F0F2F5' }}
      >
        <VisuallyHidden>
          <SheetTitle>Meu Perfil</SheetTitle>
          <SheetDescription>Editar informações do perfil</SheetDescription>
        </VisuallyHidden>
        <Profile onClose={closeProfile} />
      </SheetContent>
    </Sheet>
  );
}
